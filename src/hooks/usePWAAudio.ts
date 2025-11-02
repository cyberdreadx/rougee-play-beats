import { useEffect, useState, useRef } from 'react';

export const usePWAAudio = () => {
  const [isPWA, setIsPWA] = useState(false);
  const [audioSupported, setAudioSupported] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isAudioUnlockedRef = useRef(false);

  useEffect(() => {
    // Detect if running as PWA
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSPWA = (window.navigator as any).standalone === true;
      const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches;
      
      return isStandalone || isIOSPWA || isAndroidPWA;
    };

    setIsPWA(checkPWA());

    // Check audio support in PWA
    const checkAudioSupport = () => {
      const audio = new Audio();
      const canPlayMP3 = audio.canPlayType('audio/mpeg') !== '';
      const canPlayOGG = audio.canPlayType('audio/ogg') !== '';
      const canPlayWAV = audio.canPlayType('audio/wav') !== '';
      
      return canPlayMP3 || canPlayOGG || canPlayWAV;
    };

    setAudioSupported(checkAudioSupport());

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsPWA(checkPWA());
    };

    mediaQuery.addEventListener('change', handleDisplayModeChange);

    // iOS PWA audio unlock - Create audio context on first user gesture
    const unlockAudio = async () => {
      if (isAudioUnlockedRef.current) return;
      
      try {
        // Create AudioContext if it doesn't exist
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        // Resume audio context if suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('✅ PWA: Audio context resumed');
        }
        
        // Play a silent audio buffer to unlock audio on iOS
        const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.start(0);
        
        isAudioUnlockedRef.current = true;
        console.log('✅ PWA: Audio unlocked');
        
        // Remove the listener after first unlock
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('click', unlockAudio);
      } catch (error) {
        console.error('❌ PWA: Audio unlock failed:', error);
      }
    };

    // Add listeners for first user gesture (iOS requirement)
    if (checkPWA()) {
      document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
      document.addEventListener('click', unlockAudio, { once: true, passive: true });
    }

    return () => {
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
  }, []);

  const handlePWAAudioPlay = async (audioElement: HTMLAudioElement): Promise<void> => {
    // Ensure audio context is unlocked first
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        console.log('✅ PWA: Resumed audio context before play');
      } catch (error) {
        console.error('❌ PWA: Failed to resume audio context:', error);
      }
    }
    
    // Ensure audio element is ready
    if (audioElement.readyState < 2) {
      console.log('⏳ PWA: Waiting for audio to load...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Audio load timeout'));
        }, 5000);
        
        audioElement.addEventListener('canplay', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        
        audioElement.addEventListener('error', (e) => {
          clearTimeout(timeout);
          reject(e);
        }, { once: true });
        
        // Force load if not already loading
        if (audioElement.networkState === 0) {
          audioElement.load();
        }
      });
    }
    
    // Play audio
    try {
      await audioElement.play();
      console.log('✅ PWA: Audio playing');
    } catch (error: any) {
      console.error('❌ PWA: Play failed:', error);
      
      // Retry once if failed
      if (error.name === 'NotAllowedError') {
        console.log('⚠️ PWA: Autoplay blocked, user needs to tap play');
        throw error;
      } else if (error.name === 'AbortError') {
        console.log('🔄 PWA: Play aborted, retrying...');
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await audioElement.play();
          console.log('✅ PWA: Retry successful');
        } catch (retryError) {
          console.error('❌ PWA: Retry failed:', retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  };

  return {
    isPWA,
    audioSupported,
    handlePWAAudioPlay,
    isAudioUnlocked: isAudioUnlockedRef.current,
  };
};

