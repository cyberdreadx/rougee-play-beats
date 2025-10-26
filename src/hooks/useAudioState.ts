import { useState, useEffect, useRef } from 'react';

interface AudioState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  currentSongId: string | null;
}

// Global audio state that can be accessed from anywhere
let globalAudioState: AudioState = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  currentSongId: null
};

const listeners = new Set<(state: AudioState) => void>();

// Function to update global audio state
export const updateAudioState = (newState: Partial<AudioState>) => {
  globalAudioState = { ...globalAudioState, ...newState };
  listeners.forEach(listener => listener(globalAudioState));
};

// Hook to subscribe to audio state changes
export const useAudioState = () => {
  const [state, setState] = useState<AudioState>(globalAudioState);

  useEffect(() => {
    const listener = (newState: AudioState) => {
      setState(newState);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
};

// Hook to get audio state for a specific song
export const useAudioStateForSong = (songId: string | null) => {
  const audioState = useAudioState();
  
  return {
    currentTime: audioState.currentSongId === songId ? audioState.currentTime : 0,
    duration: audioState.currentSongId === songId ? audioState.duration : 0,
    isPlaying: audioState.currentSongId === songId ? audioState.isPlaying : false,
    isCurrentSong: audioState.currentSongId === songId
  };
};
