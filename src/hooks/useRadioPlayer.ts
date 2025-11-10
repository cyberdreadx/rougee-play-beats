import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "./useWallet";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  play_count: number;
  created_at: string;
}

interface Ad {
  id: string;
  title: string;
  audio_cid: string;
  image_cid: string | null;
  duration: number;
}

export const useRadioPlayer = () => {
  const { fullAddress } = useWallet();
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentAd, setCurrentAd] = useState<Ad | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [songQueue, setSongQueue] = useState<Song[]>([]);
  const [playCount, setPlayCount] = useState(0);
  const [ads, setAds] = useState<Ad[]>([]);

  // Fetch songs for radio queue
  const fetchSongs = useCallback(async () => {
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, artist, wallet_address, audio_cid, cover_cid, play_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching songs:', error);
      return [];
    }

    return data || [];
  }, []);

  // Fetch active ads
  const fetchAds = useCallback(async () => {
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('Error fetching ads:', error);
      return [];
    }

    return data || [];
  }, []);

  // Initialize radio mode
  useEffect(() => {
    if (isRadioMode) {
      fetchSongs().then(songs => {
        const shuffled = [...songs].sort(() => Math.random() - 0.5);
        setSongQueue(shuffled);
      });

      fetchAds().then(fetchedAds => {
        setAds(fetchedAds);
      });
    }
  }, [isRadioMode, fetchSongs, fetchAds]);

  const incrementPlayCount = useCallback(async (songId: string) => {
    try {
      // If user is connected, track individual play with wallet address
      if (fullAddress) {
        const { error } = await supabase.rpc('increment_play_count', {
          song_id: songId,
          user_wallet_address: fullAddress.toLowerCase()
        });

        if (error) {
          console.error('Error incrementing play count:', error);
        }
      } else {
        // If user is not connected, just increment total play count
        const { error } = await supabase.rpc('increment_play_count', {
          song_id: songId
        });

        if (error) {
          console.error('Error incrementing play count:', error);
        }
      }
    } catch (error) {
      console.error('Error incrementing play count:', error);
    }
  }, [fullAddress]);

  const playNextInQueue = useCallback(async () => {
    // Check if we need to play an ad (every 3 songs)
    if (playCount > 0 && playCount % 3 === 0 && ads.length > 0) {
      const randomAd = ads[Math.floor(Math.random() * ads.length)];
      setCurrentAd(randomAd);
      setCurrentSong(null);
      setIsPlaying(true);
      return;
    }

    // Play next song
    if (songQueue.length === 0) {
      const newSongs = await fetchSongs();
      const shuffled = [...newSongs].sort(() => Math.random() - 0.5);
      setSongQueue(shuffled);
      
      if (shuffled.length > 0) {
        const nextSong = shuffled[0];
        setCurrentSong(nextSong);
        setCurrentAd(null);
        setSongQueue(shuffled.slice(1));
        setIsPlaying(true);
        incrementPlayCount(nextSong.id);
        setPlayCount(prev => prev + 1);
      }
    } else {
      const nextSong = songQueue[0];
      setCurrentSong(nextSong);
      setCurrentAd(null);
      setSongQueue(songQueue.slice(1));
      setIsPlaying(true);
      incrementPlayCount(nextSong.id);
      setPlayCount(prev => prev + 1);
    }
  }, [songQueue, playCount, ads, fetchSongs, incrementPlayCount]);

  const startRadio = useCallback(async () => {
    console.log('Starting radio...');
    setIsRadioMode(true);
    setPlayCount(0);
    
    // Fetch and shuffle songs first
    const songs = await fetchSongs();
    console.log('Fetched songs:', songs.length);
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setSongQueue(shuffled);
    
    // Fetch ads
    const fetchedAds = await fetchAds();
    console.log('Fetched ads:', fetchedAds.length);
    setAds(fetchedAds);
    
    // Play first song
    if (shuffled.length > 0) {
      const firstSong = shuffled[0];
      console.log('Playing first song:', firstSong.title);
      setCurrentSong(firstSong);
      setSongQueue(shuffled.slice(1));
      setIsPlaying(true);
      incrementPlayCount(firstSong.id);
      setPlayCount(1);
    } else {
      console.log('No songs available to play');
    }
  }, [fetchSongs, fetchAds, incrementPlayCount]);

  const stopRadio = useCallback(() => {
    setIsRadioMode(false);
    setIsPlaying(false);
    setCurrentSong(null);
    setCurrentAd(null);
    setSongQueue([]);
    setPlayCount(0);
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const onMediaEnd = useCallback(() => {
    if (isRadioMode) {
      playNextInQueue();
    } else {
      setIsPlaying(false);
    }
  }, [isRadioMode, playNextInQueue]);

  return {
    currentSong,
    currentAd,
    isPlaying,
    isRadioMode,
    startRadio,
    stopRadio,
    togglePlayPause,
    onMediaEnd,
  };
};
