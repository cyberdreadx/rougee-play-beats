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
  const [songHistory, setSongHistory] = useState<Song[]>([]);

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
      // Add current song to history before switching (if there is one)
      if (currentSong) {
        setSongHistory(prev => {
          // Don't add if it's already the last song in history
          if (prev.length === 0 || prev[prev.length - 1].id !== currentSong.id) {
            return [...prev, currentSong];
          }
          return prev;
        });
      }
      
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

  const playNextAvailableSong = useCallback(async () => {
    
    try {
      // Fetch songs from the database, excluding the current song
      let query = supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); // Get more songs for better variety

      // Exclude current song if it exists
      if (currentSong?.id) {
        query = query.neq('id', currentSong.id);
      }

      const { data: songs, error } = await query;

      if (error) {
        console.error('❌ Error fetching next song:', error);
        setIsPlaying(false);
        return;
      }


      if (songs && songs.length > 0) {
        // Pick a random song from the available songs
        const randomIndex = Math.floor(Math.random() * songs.length);
        const nextSong = songs[randomIndex];
        
        
        if (nextSong) {
          // Add current song to history before switching
          if (currentSong) {
            setSongHistory(prev => {
              if (prev.length === 0 || prev[prev.length - 1].id !== currentSong.id) {
                return [...prev, currentSong];
              }
              return prev;
            });
          }
          
          setCurrentSong(nextSong);
          setIsPlaying(true);
          incrementPlayCount(nextSong.id);
          
          // Update playlist to just contain this song for consistency
          setPlaylist([nextSong]);
          setCurrentIndex(0);
          
        } else {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('❌ Error in playNextAvailableSong:', error);
      setIsPlaying(false);
    }
  }, [incrementPlayCount, currentSong?.id]);

  const playNext = useCallback(() => {
    console.log('🎵 playNext called!', { 
      playlistLength: playlist.length, 
      currentIndex, 
      shuffleEnabled,
      currentSong: currentSong?.title 
    });
    
    // Check if we have a real playlist (more than 1 song) or just a single song
    if (playlist.length > 1) {
      // Use playlist if available (real playlist with multiple songs)
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
    } else {
      // No real playlist (0 songs or just 1 song), play next available song
      playNextAvailableSong();
    }
  }, [playlist, currentIndex, shuffleEnabled, incrementPlayCount, playNextAvailableSong, currentSong?.title]);

  const playPrevious = useCallback(() => {
    
    if (playlist.length > 1) {
      // Use playlist if available (real playlist with multiple songs)
      const prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
      const prevSong = playlist[prevIndex];
      if (prevSong) {
        setCurrentSong(prevSong);
        setCurrentIndex(prevIndex);
        setIsPlaying(true);
        incrementPlayCount(prevSong.id);
      }
    } else if (songHistory.length > 0) {
      // No real playlist, but we have history - go back to previous song
      const previousSong = songHistory[songHistory.length - 1];
      
      // Remove the last song from history (since we're going back to it)
      setSongHistory(prev => prev.slice(0, -1));
      
      // Add current song to history before switching
      if (currentSong) {
        setSongHistory(prev => {
          if (prev.length === 0 || prev[prev.length - 1].id !== currentSong.id) {
            return [...prev, currentSong];
          }
          return prev;
        });
      }
      
      setCurrentSong(previousSong);
      setIsPlaying(true);
      incrementPlayCount(previousSong.id);
      
      // Update playlist to just contain this song for consistency
      setPlaylist([previousSong]);
      setCurrentIndex(0);
    } else {
      // No history and no real playlist, play next available song (same as next for continuous playback)
      playNextAvailableSong();
    }
  }, [playlist, currentIndex, incrementPlayCount, playNextAvailableSong, songHistory, currentSong]);

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
      if (playlist.length > 1) {
        playNext();
      } else {
        // No real playlist, play next available song
        playNextAvailableSong();
      }
    } else if (playlist.length > 1 && currentIndex < playlist.length - 1) {
      // Normal progression to next song in playlist (real playlist)
      playNext();
    } else {
      // No more songs in playlist or no real playlist, play next available song
      playNextAvailableSong();
    }
  }, [repeatMode, playlist.length, currentIndex, playNext, playNextAvailableSong]);

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