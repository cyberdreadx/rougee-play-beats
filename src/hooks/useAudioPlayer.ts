import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export const useAudioPlayer = () => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  const incrementPlayCount = useCallback(async (songId: string) => {
    try {
      const { error } = await supabase.rpc('increment_play_count', {
        song_id: songId
      });

      if (error) {
        console.error('Error incrementing play count:', error);
      }
    } catch (error) {
      console.error('Error incrementing play count:', error);
    }
  }, []);

  const playSong = useCallback((song: Song, newPlaylist?: Song[]) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
      incrementPlayCount(song.id);
      
      // If playlist provided, use it; otherwise create single-song playlist
      const playlistToUse = newPlaylist && newPlaylist.length > 0 ? newPlaylist : [song];
      setPlaylist(playlistToUse);
      const index = playlistToUse.findIndex(s => s.id === song.id);
      setCurrentIndex(index >= 0 ? index : 0);
    }
  }, [currentSong, isPlaying, incrementPlayCount]);

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    
    let nextIndex: number;
    if (shuffleEnabled) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      nextIndex = (currentIndex + 1) % playlist.length;
    }
    
    const nextSong = playlist[nextIndex];
    if (nextSong) {
      setCurrentSong(nextSong);
      setCurrentIndex(nextIndex);
      setIsPlaying(true);
      incrementPlayCount(nextSong.id);
    }
  }, [playlist, currentIndex, shuffleEnabled, incrementPlayCount]);

  const playPrevious = useCallback(() => {
    if (playlist.length === 0) return;
    
    const prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
    const prevSong = playlist[prevIndex];
    if (prevSong) {
      setCurrentSong(prevSong);
      setCurrentIndex(prevIndex);
      setIsPlaying(true);
      incrementPlayCount(prevSong.id);
    }
  }, [playlist, currentIndex, incrementPlayCount]);

  const toggleShuffle = useCallback(() => {
    setShuffleEnabled(!shuffleEnabled);
  }, [shuffleEnabled]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(mode => {
      if (mode === 'off') return 'all';
      if (mode === 'all') return 'one';
      return 'off';
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const stopSong = useCallback(() => {
    setIsPlaying(false);
    setCurrentSong(null);
  }, []);

  const onSongEnd = useCallback(() => {
    if (repeatMode === 'one') {
      // For repeat one, the AudioPlayer component handles restarting the song
      // We don't need to do anything here
      return;
    } else if (repeatMode === 'all') {
      // For repeat all, go to next song or loop back to first
      playNext();
    } else if (playlist.length > 0 && currentIndex < playlist.length - 1) {
      // Normal progression to next song
      playNext();
    } else {
      // End of playlist, stop playing
      setIsPlaying(false);
    }
  }, [repeatMode, playlist.length, currentIndex, playNext]);

  return {
    currentSong,
    isPlaying,
    playSong,
    togglePlayPause,
    stopSong,
    onSongEnd,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    shuffleEnabled,
    repeatMode,
    playlist,
  };
};