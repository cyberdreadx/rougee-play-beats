import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, CheckCircle, Music, X, ChevronRight, ChevronLeft, Filter, Check, Settings, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getIPFSGatewayUrl, getIPFSGatewayUrls } from "@/lib/ipfs";
import { useToast } from "@/hooks/use-toast";
import { usePWAAudio } from "@/hooks/usePWAAudio";
import { useWallet } from "@/hooks/useWallet";
import { usePrivy } from "@privy-io/react-auth";
import LoginModal from "@/components/LoginModal";
import { usePlayTracking } from "@/hooks/usePlayTracking";
import { updateAudioState } from "@/hooks/useAudioState";
import { useConnectionAwareLoading } from "@/hooks/useConnectionAwareLoading";
interface Song {
  id: string;
  title: string;
  artist: string | null;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  token_address?: string | null;
  play_count: number;
  created_at: string;
  ticker?: string | null;
  ai_usage?: 'none' | 'partial' | 'full' | null;
}

interface Ad {
  id: string;
  title: string;
  audio_cid: string;
  image_cid: string | null;
  duration: number;
}

interface AudioPlayerProps {
  currentSong: Song | null;
  currentAd?: Ad | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSongEnd: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onShuffle?: () => void;
  onRepeat?: () => void;
  onClose?: () => void;
  shuffleEnabled?: boolean;
  repeatMode?: 'off' | 'all' | 'one';
  initialMinimized?: boolean;
}

const AudioPlayer = ({ 
  currentSong, 
  currentAd, 
  isPlaying,
  onPlayPause, 
  onSongEnd,
  onNext,
  onPrevious,
  onShuffle,
  onRepeat,
  onClose,
  shuffleEnabled = false,
  repeatMode = 'off',
  initialMinimized = false
}: AudioPlayerProps) => {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastKnownTimeRef = useRef<number>(0); // Track last known valid time to prevent glitches
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [artistTicker, setArtistTicker] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [currentAudioUrlIndex, setCurrentAudioUrlIndex] = useState(0);
  const [coverImageError, setCoverImageError] = useState(false);
  const [coverImageLoaded, setCoverImageLoaded] = useState(false);
  const [currentCoverUrlIndex, setCurrentCoverUrlIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(initialMinimized);
  const hasUserInteractedRef = useRef(false); // Track if user has manually toggled minimized state
  const [showAiFilterMenu, setShowAiFilterMenu] = useState(false); // Toggle AI filter settings menu
  const [showExpandedArt, setShowExpandedArt] = useState(false); // Toggle expanded album art modal
  
  // AI Filter state - persisted in localStorage
  type AiFilter = 'all' | 'no-ai' | 'partial';
  const [aiFilter, setAiFilter] = useState<AiFilter>(() => {
    const saved = localStorage.getItem('audioPlayer_aiFilter');
    // Migrate old 'no-ai-partial' to 'partial'
    if (saved === 'no-ai-partial') {
      localStorage.setItem('audioPlayer_aiFilter', 'partial');
      return 'partial';
    }
    return (saved as AiFilter) || 'all';
  });
  
  // Save filter to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('audioPlayer_aiFilter', aiFilter);
  }, [aiFilter]);
  
  // Update minimized state when initialMinimized changes (e.g., new song on feed page)
  useEffect(() => {
    if (initialMinimized && !hasUserInteractedRef.current) {
      setIsMinimized(true);
    }
  }, [initialMinimized]);
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showOwnershipPrompt, setShowOwnershipPrompt] = useState(false);
  const [previewTimeRemaining, setPreviewTimeRemaining] = useState(20);
  const loginPromptDismissedRef = useRef<{ songId: string | null; dismissed: boolean }>({ songId: null, dismissed: false });
  const { toast } = useToast();
  const { isPWA, audioSupported, handlePWAAudioPlay, isAudioUnlocked } = usePWAAudio();
  const { isConnected } = useWallet();
  const { authenticated } = usePrivy();
  const { playStatus, recordPlay, checkPlayStatus, refetchBalance } = usePlayTracking(
    currentSong?.id,
    currentSong?.token_address as `0x${string}` | undefined
  );
  const { getPreloadStrategy, getGatewayCount, shouldPreloadNext } = useConnectionAwareLoading();

  // Track mobile nav visibility on scroll
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Only apply on mobile
      if (window.innerWidth >= 768) {
        setIsMobileNavVisible(true);
        return;
      }
      
      // Show nav when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY) {
        setIsMobileNavVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsMobileNavVisible(false);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reset cover image state when song changes
  useEffect(() => {
    setCoverImageError(false);
    setCoverImageLoaded(false);
    setCurrentCoverUrlIndex(0);
  }, [currentSong?.id, currentAd?.id]);

  // Fetch artist ticker and verified status
  useEffect(() => {
    const fetchArtistData = async () => {
      if (!currentSong?.wallet_address) {
        setArtistTicker(null);
        setIsVerified(false);
        return;
      }

      const { data } = await supabase
        .from("public_profiles")
        .select("artist_ticker, verified")
        .eq("wallet_address", currentSong.wallet_address)
        .maybeSingle();

      setArtistTicker(data?.artist_ticker || null);
      setIsVerified(data?.verified || false);
    };

    fetchArtistData();
  }, [currentSong?.wallet_address]);

  // Computed values (must come before handlers that use them)
  const isAd = !!currentAd;
  const displayTitle = isAd ? currentAd?.title || "" : currentSong?.title || "";
  const displayArtist = isAd ? "Advertisement" : currentSong?.artist || "Unknown Artist";
  const coverCid = isAd ? currentAd?.image_cid : currentSong?.cover_cid;
  const displayCover = coverCid ? (() => {
    try {
      return getIPFSGatewayUrl(coverCid);
    } catch (error) {
      console.warn('Failed to get IPFS gateway URL:', error);
      return "";
    }
  })() : "";

  // Get multiple fallback URLs for the cover image
  const coverFallbackUrls = coverCid ? (() => {
    try {
      return getIPFSGatewayUrls(coverCid, getGatewayCount(), false);
    } catch (error) {
      console.warn('Failed to get IPFS gateway URLs:', error);
      return [];
    }
  })() : [];

  // Get current cover URL to try - use a more defensive approach
  const currentCoverUrl = (() => {
    try {
      return coverFallbackUrls[currentCoverUrlIndex] || displayCover;
    } catch (error) {
      console.warn('Failed to get current cover URL:', error);
      return displayCover;
    }
  })();

  // Handle cover image load success
  const handleCoverImageLoad = () => {
    setCoverImageLoaded(true);
    setCoverImageError(false);
  };

  // Handle cover image load error - try next fallback URL
  const handleCoverImageError = () => {
    console.warn('Cover image failed to load, trying fallback...');
    setCoverImageError(true);

    // Try next fallback URL if available
    try {
      if (coverFallbackUrls && coverFallbackUrls.length > 0 && currentCoverUrlIndex < coverFallbackUrls.length - 1) {
        setCurrentCoverUrlIndex(prev => prev + 1);
        setCoverImageError(false); // Reset error state to try next URL
      }
    } catch (error) {
      console.warn('Failed to check fallback URLs:', error);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      // Only update if audio is valid and has currentTime
      if (!audio || isNaN(audio.currentTime)) return;
      
      const newTime = audio.currentTime;
      
      // Only update if we have a valid positive time
      // Don't reset to 0 if we're paused and were at a different time
      // Only accept 0 if we're actually at the start of the song (and playing)
      if (newTime >= 0 && (!isNaN(newTime) && isFinite(newTime))) {
        // If newTime is 0, only update if:
        // 1. We're playing (song just started), OR
        // 2. The last known time was also 0 (we're at the start)
        if (newTime === 0) {
          if (!isPlaying && lastKnownTimeRef.current > 0) {
            // Don't update to 0 if we were at a different time and paused
            // This prevents glitches when audio reloads or fires spurious timeupdate events
            return;
          }
        }
        
        // Update last known time
        lastKnownTimeRef.current = newTime;
        
        // Update state and global audio state
        setCurrentTime(newTime);
        updateAudioState({ 
          currentTime: newTime,
          currentSongId: currentSong?.id || null,
          isPlaying 
        });
      }
    };
    
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        updateAudioState({ 
          duration: audio.duration,
          currentSongId: currentSong?.id || null,
          isPlaying 
        });
      }
    };
    
    const handleEnd = () => {
      if (repeatMode === 'one') {
        // For repeat one, restart the current song immediately
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        // For other modes, use the normal onSongEnd logic
        onSongEnd();
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnd);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('canplay', updateDuration);

    // Force initial duration update
    if (audio.duration && !isNaN(audio.duration)) {
      updateDuration();
    }

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnd);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('canplay', updateDuration);
    };
  }, [onSongEnd, currentSong?.id, repeatMode]);

  // Reset time when song changes (NOT when play/pause changes)
  // Use a ref to track the last song ID to prevent unnecessary resets
  const lastSongIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Only reset if the song actually changed (not just the object reference)
    if (currentSong && currentSong.id !== lastSongIdRef.current) {
      // Pause any currently playing audio before switching songs to prevent conflicts
      if (!audio.paused) {
        audio.pause();
      }
      
      lastSongIdRef.current = currentSong.id;
      lastKnownTimeRef.current = 0; // Reset tracked time for new song
      
      setCurrentTime(0);
      setDuration(0);
      setCurrentAudioUrlIndex(0); // Reset to first URL
      setPreviewTimeRemaining(20); // Reset preview timer
      setShowLoginPrompt(false); // Hide login prompt
      // Reset dismissed state when song changes
      loginPromptDismissedRef.current = { songId: currentSong?.id || null, dismissed: false };
      updateAudioState({ 
        currentTime: 0,
        duration: 0,
        currentSongId: currentSong.id,
        isPlaying: false // Reset playing state when song changes to prevent conflicts
      });
      
      // Refresh play status when song changes (to get updated play count and ownership)
      if (authenticated && currentSong.id) {
        // Check immediately and also after a delay to catch any updates
        checkPlayStatus(currentSong.id);
        const timer = setTimeout(() => {
          checkPlayStatus(currentSong.id);
        }, 500);
        return () => clearTimeout(timer);
      } else if (currentSong.id) {
        // Even if not authenticated, check play status (for non-auth users)
        checkPlayStatus(currentSong.id);
      }
    }
  }, [currentSong?.id, authenticated, checkPlayStatus]); // Only reset when song ID changes, not when isPlaying changes

  // Preview timer for non-logged-in users and authenticated users who exceeded free plays
  useEffect(() => {
    if (isPlaying && currentSong) {
      // Check if user should get preview (non-authenticated OR authenticated but exceeded free plays)
      const shouldPreview = !authenticated || 
        (authenticated && playStatus && !playStatus.isOwner && playStatus.playCount >= playStatus.maxFreePlays);
      
      if (shouldPreview) {
        // Reset preview timer when song changes or when starting preview
        if (loginPromptDismissedRef.current.songId !== currentSong.id) {
          setPreviewTimeRemaining(20);
          loginPromptDismissedRef.current = { songId: currentSong.id, dismissed: false };
        }
        
        // Only show preview timer if not dismissed
        if (!loginPromptDismissedRef.current.dismissed || loginPromptDismissedRef.current.songId !== currentSong.id) {
          const timer = setInterval(() => {
            setPreviewTimeRemaining(prev => {
              if (prev <= 1) {
                // Preview time is up, pause and show prompt
                const audio = audioRef.current;
                if (audio) {
                  audio.pause();
                }
                // Only show prompt if not dismissed
                if (!loginPromptDismissedRef.current.dismissed || loginPromptDismissedRef.current.songId !== currentSong.id) {
                  if (!authenticated) {
                    setShowLoginPrompt(true);
                  } else {
                    setShowOwnershipPrompt(true);
                  }
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          return () => clearInterval(timer);
        }
      }
    }
  }, [authenticated, isPlaying, currentSong, playStatus]);

  // Check play limits for authenticated users - Check frequently during playback
  // Note: If user exceeded free plays, they get 20-second preview (handled in preview timer above)
  useEffect(() => {
    if (authenticated && isPlaying && currentSong && playStatus) {
      // Check if user has exceeded play limit
      const currentPlayCount = playStatus.playCount || 0;
      const isOwner = playStatus.isOwner || false;
      const maxFreePlays = playStatus.maxFreePlays || 3;
      
      // If user exceeded free plays and doesn't own, they get preview (handled by preview timer)
      // Only stop full playback if they somehow got past the preview
      if (!isOwner && currentPlayCount >= maxFreePlays) {
        // Check if we're in preview mode (20 seconds)
        const audio = audioRef.current;
        if (audio && audio.currentTime > 20) {
          // Past preview time, stop playback
          console.log('🚫 Play limit exceeded, stopping after preview:', {
            playCount: currentPlayCount,
            maxFreePlays: maxFreePlays,
            isOwner: isOwner,
            currentTime: audio.currentTime
          });
          audio.pause();
          // Call onPlayPause to update the parent's isPlaying state
          if (isPlaying) {
            onPlayPause();
          }
          setShowOwnershipPrompt(true);
          return;
        }
      }
      
      // Also check periodically during playback to catch updates
      const checkInterval = setInterval(async () => {
        if (currentSong?.id) {
          await checkPlayStatus(currentSong.id);
        }
      }, 1000); // Check every 1 second during playback for faster detection
      
      return () => clearInterval(checkInterval);
    }
  }, [authenticated, isPlaying, currentSong, playStatus, checkPlayStatus]);

  // Record play when song starts playing (for authenticated users)
  // Use a ref to track if we've already recorded this continuous play session
  const playRecordedRef = useRef<{ songId: string | null; timestamp: number; isRecording: boolean }>({ songId: null, timestamp: 0, isRecording: false });
  
  useEffect(() => {
    if (authenticated && isPlaying && currentSong) {
      const isDifferentSong = playRecordedRef.current.songId !== currentSong.id;
      const wasRecording = playRecordedRef.current.isRecording;
      
      // Record if:
      // 1. Different song (always record new songs), OR
      // 2. Same song but we haven't recorded yet for this continuous play session
      if (isDifferentSong || !wasRecording) {
        // Mark as recording to prevent duplicate records
        playRecordedRef.current.isRecording = true;
        playRecordedRef.current.songId = currentSong.id;
        
        // Record the play after a short delay to ensure it's a real play
        const timer = setTimeout(async () => {
          try {
            await recordPlay(currentSong.id, 0);
            // Always check play status again after recording to update UI with latest count
            await checkPlayStatus(currentSong.id);
            
            // Wait for status to update, then check if we should stop playback
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if play limit was exceeded after recording this play
            // We need to check the updated playStatus
            if (playStatus) {
              const updatedPlayCount = playStatus.playCount || 0;
              const isOwner = playStatus.isOwner || false;
              const maxFreePlays = playStatus.maxFreePlays || 3;
              
              if (!isOwner && updatedPlayCount >= maxFreePlays) {
                // Play limit exceeded - stop playback immediately
                console.log('🚫 Play limit exceeded after recording play, stopping:', {
                  playCount: updatedPlayCount,
                  maxFreePlays: maxFreePlays
                });
                const audio = audioRef.current;
                if (audio && isPlaying) {
                  audio.pause();
                  // Call onPlayPause to update the parent's isPlaying state
                  onPlayPause();
                  setShowOwnershipPrompt(true);
                }
              }
            }
            
            playRecordedRef.current.timestamp = Date.now();
          } catch (error) {
            console.error('Failed to record play:', error);
            // Reset on error so we can retry
            playRecordedRef.current.isRecording = false;
          }
        }, 2000); // Record after 2 seconds of playing
        
        // Also refresh play status immediately when song starts playing
        // This ensures the play count updates right away (from increment_play_count in useAudioPlayer)
        const refreshTimer = setTimeout(async () => {
          if (authenticated && currentSong.id) {
            await checkPlayStatus(currentSong.id);
            
            // After refresh, check if we should stop playback
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (playStatus) {
              const currentPlayCount = playStatus.playCount || 0;
              const isOwner = playStatus.isOwner || false;
              const maxFreePlays = playStatus.maxFreePlays || 3;
              
              if (!isOwner && currentPlayCount >= maxFreePlays) {
                console.log('🚫 Play limit exceeded after refresh, stopping:', {
                  playCount: currentPlayCount,
                  maxFreePlays: maxFreePlays
                });
                const audio = audioRef.current;
                if (audio && isPlaying) {
                  audio.pause();
                  // Call onPlayPause to update the parent's isPlaying state
                  onPlayPause();
                  setShowOwnershipPrompt(true);
                }
              }
            }
          }
        }, 1000); // Check after 1 second to catch the increment_play_count update
        
        return () => {
          clearTimeout(timer);
          clearTimeout(refreshTimer);
        };
      }
    } else if (!isPlaying) {
      // Reset recording flag when playback stops so we can record again on next play
      // This ensures each new play (after pause/stop) gets recorded
      playRecordedRef.current.isRecording = false;
    }
  }, [authenticated, isPlaying, currentSong?.id, recordPlay, checkPlayStatus]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Prevent duplicate plays - check if audio is already playing
    if (isPlaying) {
      // Only play if not already playing
      if (audio.paused) {
        const title = currentAd?.title || currentSong?.title || 'Audio';
        toast({
          title: '▶️ Playing',
          description: title,
        });
        
        // Direct audio.play() call - works in both browser and PWA
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Audio playback error:", error);
            
            if (error.name === 'NotAllowedError') {
              toast({
                title: '🔒 Audio blocked',
                description: 'Please tap the play button to start audio',
                variant: 'destructive',
              });
            } else if (error.name === 'NotSupportedError') {
              toast({
                title: '❌ Audio format not supported',
                description: 'This audio format is not supported',
                variant: 'destructive',
              });
            } else {
              toast({
                title: '❌ Playback failed',
                description: error.message || 'Could not play audio',
                variant: 'destructive',
              });
            }
          });
        }
      }
    } else {
      // Only pause if actually playing
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, currentSong?.id, currentSong?.title, currentAd, toast]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration || isNaN(value[0])) return;
    
    const newTime = Math.min(value[0], duration);
    audio.currentTime = newTime;
    lastKnownTimeRef.current = newTime; // Update tracked time when seeking
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  // Ensure play/pause runs in a direct user gesture (iOS Safari and PWA requirement)
  const handlePlayPauseClick = async () => {
    const audio = audioRef.current;
    if (!audio) {
      onPlayPause();
      return;
    }
    
    if (isPlaying) {
      try { audio.pause(); } catch {}
      onPlayPause();
    } else {
      // Check play limits BEFORE starting playback
      if (authenticated && currentSong) {
        // Refresh play status immediately before playing
        await checkPlayStatus(currentSong.id);
        
        // Wait a moment for the status to update
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check play status again - we need to check the current playStatus state
        // If playCount is at or above maxFreePlays and user is not owner, block playback
        if (playStatus) {
          const currentPlayCount = playStatus.playCount || 0;
          const isOwner = playStatus.isOwner || false;
          const maxFreePlays = playStatus.maxFreePlays || 3;
          
          if (!isOwner && currentPlayCount >= maxFreePlays) {
            // User has exceeded play limit - allow 20-second preview
            console.log('🚫 Play limit reached, allowing 20-second preview only:', { 
              playCount: currentPlayCount, 
              maxFreePlays: maxFreePlays,
              isOwner: isOwner 
            });
            // Reset preview timer and dismissed state
            setPreviewTimeRemaining(20);
            loginPromptDismissedRef.current = { songId: currentSong.id, dismissed: false };
            // Allow playback to start (will be limited to 20 seconds by preview timer)
            // Don't block playback - let it start and the preview timer will handle it
          }
        }
      }
      
      // Use PWA-specific handler if in PWA mode, otherwise regular play
      try {
        if (isPWA) {
          console.log('🎵 PWA: Starting playback via PWA handler');
          await handlePWAAudioPlay(audio);
        } else {
          await audio.play();
        }
        onPlayPause();
      } catch (error: any) {
        console.error('Audio playback error:', error);
        
        // Enhanced error handling
        if (error.name === 'NotAllowedError') {
          toast({ 
            title: '🔒 Audio blocked', 
            description: isPWA ? 'Please tap the play button again to start audio in PWA mode' : 'Please tap the play button to start audio', 
            variant: 'destructive' 
          });
        } else if (error.name === 'NotSupportedError') {
          toast({ 
            title: '❌ Audio not supported', 
            description: 'This audio format is not supported', 
            variant: 'destructive' 
          });
        } else if (error.name === 'AbortError') {
          // AbortError can happen when switching songs quickly, retry
          console.log('🔄 AbortError, retrying...');
          setTimeout(async () => {
            try {
              if (isPWA) {
                await handlePWAAudioPlay(audio);
              } else {
                await audio.play();
              }
              onPlayPause();
            } catch (retryError) {
              console.error('Retry failed:', retryError);
            }
          }, 100);
        } else {
          toast({ 
            title: '❌ Playback failed', 
            description: error.message || 'Could not play audio', 
            variant: 'destructive' 
          });
        }
      }
    }
  };
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const preferredGateway = 'https://gateway.lighthouse.storage/ipfs';
  // Prefer Supabase IPFS proxy first for reliable streaming & CORS; fallback to direct gateways
  const proxyUrl = isAd 
    ? getIPFSGatewayUrl(currentAd.audio_cid, undefined, true)
    : (currentSong ? getIPFSGatewayUrl(currentSong.audio_cid, undefined, true) : '');
  const directPrimaryUrl = isAd
    ? getIPFSGatewayUrl(currentAd.audio_cid, preferredGateway, false)
    : (currentSong ? getIPFSGatewayUrl(currentSong.audio_cid, preferredGateway, false) : '');
  const baseFallbacks = isAd 
    ? getIPFSGatewayUrls(currentAd.audio_cid, getGatewayCount(), false) // Direct IPFS gateways
    : (currentSong ? getIPFSGatewayUrls(currentSong.audio_cid, getGatewayCount(), false) : []);
  // Build ordered sources: proxy first, then direct Lighthouse, then other gateways
  const sourceUrls = [proxyUrl, directPrimaryUrl, ...baseFallbacks]
    .filter((u): u is string => Boolean(u))
    .filter((url, idx, arr) => arr.indexOf(url) === idx); // dedupe

  const handleAudioError = () => {
    if (currentAudioUrlIndex < sourceUrls.length - 1) {
      const nextIndex = currentAudioUrlIndex + 1;
      setCurrentAudioUrlIndex(nextIndex);
      
      // Update the audio source
      const audio = audioRef.current;
      if (audio) {
        // Preserve current playback time before reloading
        const preservedTime = audio.currentTime || currentTime;
        
        try { audio.pause(); } catch {}
        audio.src = sourceUrls[nextIndex];
        audio.volume = isMuted ? 0 : volume; // Ensure volume is maintained
        audio.load();
        
        // Restore playback time after loading (but wait for metadata)
        const restoreTime = () => {
          if (audio && preservedTime > 0) {
            try {
              audio.currentTime = preservedTime;
            } catch (e) {
              // Ignore if seeking fails (audio might not be ready yet)
            }
          }
          audio.removeEventListener('loadedmetadata', restoreTime);
        };
        audio.addEventListener('loadedmetadata', restoreTime);
        
        if (isPlaying) {
          const p = audio.play();
          if (p && typeof (p as any).catch === 'function') {
            (p as Promise<void>).catch(() => {
              console.warn('Play() failed after switching fallback');
            });
          }
        }
      }
    } else {
      // All fallbacks exhausted
      console.error('❌ All audio gateways failed for:', displayTitle);
      toast({
        title: "Audio Loading Failed",
        description: "Unable to load audio from any gateway. Please check your connection.",
        variant: "destructive",
      });
    }
  };

  if (!currentSong && !currentAd) {
    return null;
  }

  return (
    <>
      
      {/* Minimized tab view */}
      {isMinimized && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 md:right-0">
          <div className="relative">
            <Button
              onClick={() => {
                hasUserInteractedRef.current = true;
                setIsMinimized(false);
              }}
              className="h-32 w-12 rounded-l-xl rounded-r-none bg-black/40 backdrop-blur-xl border border-white/10 border-r-0 hover:bg-black/60 hover:w-14 transition-all duration-300 flex flex-col items-center justify-center gap-2 shadow-2xl group"
            >
              <ChevronLeft className="h-5 w-5 text-neon-green group-hover:animate-pulse" />
              <div 
                className="flex flex-col items-center gap-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPauseClick();
                }}
              >
                <div className="w-8 h-8 rounded-full border-2 border-neon-green/50 flex items-center justify-center bg-neon-green/10">
                  {isPlaying ? (
                    <Pause className="h-4 w-4 text-neon-green" />
                  ) : (
                    <Play className="h-4 w-4 text-neon-green fill-neon-green" />
                  )}
                </div>
                {isPlaying && (
                  <div className="flex gap-0.5">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-neon-green rounded-full visualizer-bar"
                        style={{
                          animationDelay: `${i * 0.1}s`,
                          height: '12px'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="writing-mode-vertical text-xs font-mono text-muted-foreground max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
                {displayTitle.slice(0, 20)}
              </div>
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="absolute -top-8 right-0 h-6 w-6 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-black/60 text-muted-foreground hover:text-foreground"
                title="Close player"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Full player view */}
      {!isMinimized && (
    <Card className={`fixed ${isMobileNavVisible ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]' : 'bottom-0'} md:bottom-0 md:left-[var(--sidebar-width,16rem)] right-0 z-50 bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl overflow-visible transition-all duration-300 w-full max-w-full`}>

      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-neon-green/10 via-transparent to-neon-green/10 animate-pulse opacity-60" />

      {/* Top marquee header - scrolls across entire player width - Mobile only */}
      <div className="relative z-10 border-b border-white/10 px-3 py-1 md:hidden">
        <div className="marquee-container">
          <div className="marquee font-mono text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{displayTitle}</span>
            <span className="mx-2">—</span>
            <span>{displayArtist}</span>
            {!isAd && currentSong?.ticker && (
              <span className="ml-2 text-neon-green">${currentSong.ticker}</span>
            )}
            {authenticated && currentSong && playStatus && (
              <span className="ml-2 text-blue-400">
                <Music className="w-3 h-3 inline mr-1" />
                {playStatus.playCount} plays
              </span>
            )}
          </div>
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              hasUserInteractedRef.current = true;
              setIsMinimized(true);
            }}
            className="h-6 w-6 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground"
            title="Minimize player"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground"
              title="Close player"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Visualizer bars */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-1 flex items-end gap-0.5 px-2 opacity-30">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-neon-green rounded-t visualizer-bar"
              style={{
                animationDelay: `${i * 0.05}s`,
                animationDuration: `${0.5 + Math.random() * 0.5}s`
              }}
            />
          ))}
        </div>
      )}
      
      {/* Mobile Compact Player */}
      <div className="md:hidden relative z-10">
        <div className="flex items-center gap-3 p-3 pb-2">
          {coverCid && (
            <div
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-neon-green/30 shadow-lg flex-shrink-0 cursor-pointer hover:border-neon-green/60 transition-colors"
              onClick={() => setShowExpandedArt(true)}
              onDoubleClick={() => !isAd && currentSong && navigate(`/song/${currentSong.id}`)}
            >
              {coverImageError && (() => {
                try {
                  return currentCoverUrlIndex >= (coverFallbackUrls?.length || 0) - 1;
                } catch (error) {
                  console.warn('Failed to check cover fallback URLs in JSX:', error);
                  return true; // Show fallback icon if there's an error
                }
              })() ? (
                // Fallback: Show music icon when all URLs fail
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <Music className="h-8 w-8 text-neon-green" />
                </div>
              ) : (
                // Try to load image with fallback URLs
                <>
                  <img
                    src={currentCoverUrl}
                    alt={displayTitle}
                    className="w-full h-full object-cover"
                    onLoad={handleCoverImageLoad}
                    onError={handleCoverImageError}
                    style={{
                      display: coverImageLoaded ? 'block' : 'none'
                    }}
                  />
                  {/* Loading placeholder while image loads */}
                  {!coverImageLoaded && !coverImageError && (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                      <Music className="h-6 w-6 text-neon-green animate-pulse" />
                    </div>
                  )}
                </>
              )}
              {isPlaying && (
                <div className="absolute inset-0 bg-neon-green/20 animate-pulse" />
              )}
            </div>
          )}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {onShuffle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onShuffle}
                className={`h-8 w-8 ${shuffleEnabled ? 'text-neon-green' : 'text-muted-foreground'}`}
              >
                <Shuffle className="w-4 h-4" />
              </Button>
            )}
            {onPrevious && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                className="h-9 w-9 text-muted-foreground"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
               onClick={handlePlayPauseClick}
              className="h-12 w-12 rounded-full bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/50 transition-all hover:scale-110"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-neon-green" />
              ) : (
                <Play className="w-5 h-5 text-neon-green fill-neon-green" />
              )}
            </Button>
            {onNext && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onNext();
                }}
                className="h-8 w-8 text-muted-foreground"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            )}
            {currentSong && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/song/${currentSong.id}`)}
                className="h-8 px-3 font-mono text-xs"
              >
                Trade
              </Button>
            )}
            {onRepeat && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRepeat}
                className={`h-7 w-7 ${repeatMode !== 'off' ? 'text-neon-green' : 'text-muted-foreground'}`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-3 h-3" />
                ) : (
                  <Repeat className="w-3 h-3" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-7 w-7"
            >
              {isMuted ? (
                <VolumeX className="w-3 h-3 text-muted-foreground" />
              ) : (
                <Volume2 className="w-3 h-3 text-neon-green" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Mobile progress slider */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground min-w-[35px]">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="flex-1"
              onValueChange={handleSeek}
            />
            <span className="font-mono text-xs text-muted-foreground min-w-[35px]">
              {formatTime(duration)}
            </span>
          </div>
          
          {/* Preview indicator for mobile */}
          {isPlaying && currentSong && (
            (!authenticated || (authenticated && playStatus && !playStatus.isOwner && playStatus.playCount >= playStatus.maxFreePlays)) && (
              <div className="flex items-center justify-center gap-2 text-xs text-yellow-500 mt-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span>Preview: {previewTimeRemaining}s remaining</span>
                {authenticated && playStatus && !playStatus.isOwner && playStatus.playCount >= playStatus.maxFreePlays && (
                  <span className="text-xs text-muted-foreground ml-2">(Free plays used)</span>
                )}
              </div>
            )
          )}

          {/* Play limit indicator for mobile */}
          {authenticated && isPlaying && currentSong && playStatus && (
            <div className="flex items-center justify-center gap-2 text-xs mt-2">
              {playStatus.isOwner ? (
                <div className="flex items-center gap-2 text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>Owned - Unlimited plays</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-blue-500">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span>Free plays: {playStatus.remainingPlays}/{playStatus.maxFreePlays}</span>
                </div>
              )}
            </div>
          )}
          
          {/* User play count display for mobile */}
          {authenticated && currentSong && playStatus && (
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-1">
              <Music className="w-3 h-3" />
              <span className="font-mono">Your plays: {playStatus.playCount}</span>
            </div>
          )}
        </div>
        
        {/* Mobile volume slider and settings */}
        <div className="px-3 pb-2 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.1}
            className="flex-1"
            onValueChange={handleVolumeChange}
          />
          <span className="font-mono text-xs text-muted-foreground min-w-[30px]">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-neon-green flex-shrink-0"
            onClick={() => setShowAiFilterMenu(!showAiFilterMenu)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        
        {/* AI Filter Menu - Mobile (Dropdown) */}
        {showAiFilterMenu && (
          <div className="px-3 pb-3 border-t border-white/10 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-3 h-3 text-neon-green/50" />
              <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">AI FILTER</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`relative w-4 h-4 rounded border-2 transition-all duration-300 ${
                  aiFilter === 'all' 
                    ? 'bg-neon-green/20 border-neon-green shadow-[0_0_10px_rgba(0,255,159,0.5)]' 
                    : 'bg-black/40 border-white/20 group-hover:border-neon-green/40'
                }`}>
                  {aiFilter === 'all' && (
                    <Check className="absolute inset-0 w-full h-full p-0.5 text-neon-green" />
                  )}
                </div>
                <span className={`font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  aiFilter === 'all' ? 'text-neon-green' : 'text-white/50 group-hover:text-white/70'
                }`}>
                  ALL
                </span>
                <input
                  type="radio"
                  name="aiFilter"
                  checked={aiFilter === 'all'}
                  onChange={() => setAiFilter('all')}
                  className="sr-only"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`relative w-4 h-4 rounded border-2 transition-all duration-300 ${
                  aiFilter === 'partial' 
                    ? 'bg-neon-green/20 border-neon-green shadow-[0_0_10px_rgba(0,255,159,0.5)]' 
                    : 'bg-black/40 border-white/20 group-hover:border-neon-green/40'
                }`}>
                  {aiFilter === 'partial' && (
                    <Check className="absolute inset-0 w-full h-full p-0.5 text-neon-green" />
                  )}
                </div>
                <span className={`font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  aiFilter === 'partial' ? 'text-neon-green' : 'text-white/50 group-hover:text-white/70'
                }`}>
                  PARTIAL AI
                </span>
                <input
                  type="radio"
                  name="aiFilter"
                  checked={aiFilter === 'partial'}
                  onChange={() => setAiFilter('partial')}
                  className="sr-only"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`relative w-4 h-4 rounded border-2 transition-all duration-300 ${
                  aiFilter === 'no-ai' 
                    ? 'bg-neon-green/20 border-neon-green shadow-[0_0_10px_rgba(0,255,159,0.5)]' 
                    : 'bg-black/40 border-white/20 group-hover:border-neon-green/40'
                }`}>
                  {aiFilter === 'no-ai' && (
                    <Check className="absolute inset-0 w-full h-full p-0.5 text-neon-green" />
                  )}
                </div>
                <span className={`font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  aiFilter === 'no-ai' ? 'text-neon-green' : 'text-white/50 group-hover:text-white/70'
                }`}>
                  NO AI
                </span>
                <input
                  type="radio"
                  name="aiFilter"
                  checked={aiFilter === 'no-ai'}
                  onChange={() => setAiFilter('no-ai')}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Full Player - Compact single row layout */}
      <div className="hidden md:flex items-center gap-2 py-1.5 px-3 relative z-10">
        {/* Close and Dock buttons - Desktop */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              hasUserInteractedRef.current = true;
              setIsMinimized(true);
            }}
            className="h-7 w-7 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground"
            title="Minimize player"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground"
              title="Close player"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        
        {/* Left info area with cover art and title/artist */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {displayCover && (
            <div 
              className="relative w-12 h-12 rounded-lg overflow-hidden border border-neon-green/30 shadow-lg shadow-neon-green/20 cursor-pointer hover:border-neon-green/60 transition-all hover:scale-105 flex-shrink-0"
              onClick={() => setShowExpandedArt(true)}
              onDoubleClick={() => !isAd && currentSong && navigate(`/song/${currentSong.id}`)}
            >
              <img 
                src={displayCover}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-t from-neon-green/30 to-transparent animate-pulse" />
              )}
            </div>
          )}
          {/* Scrolling title/artist info - Desktop */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="marquee-container">
              <div className="marquee font-mono text-[10px] text-muted-foreground">
                <span className="text-foreground font-semibold">{displayTitle}</span>
                <span className="mx-2">—</span>
                <span>{displayArtist}</span>
                {!isAd && currentSong?.ticker && (
                  <span className="ml-2 text-neon-green">${currentSong.ticker}</span>
                )}
                {authenticated && currentSong && playStatus && (
                  <span className="ml-2 text-blue-400">
                    <Music className="w-2.5 h-2.5 inline mr-1" />
                    {playStatus.playCount} plays
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls + Progress bar - Single row on desktop */}
        <div className="flex items-center gap-2 flex-[2] max-w-3xl mx-auto min-w-0">
          {/* Main control buttons */}
          {onShuffle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onShuffle}
              className={`h-7 w-7 flex-shrink-0 transition-colors ${shuffleEnabled ? 'text-neon-green' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </Button>
          )}
          
          {onPrevious && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePlayPauseClick}
            className="h-9 w-9 flex-shrink-0 rounded-full bg-neon-green/20 hover:bg-neon-green/30 border-2 border-neon-green/50 transition-all hover:scale-110 shadow-lg shadow-neon-green/20"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-neon-green" />
            ) : (
              <Play className="w-4 h-4 text-neon-green fill-neon-green" />
            )}
          </Button>

          {onNext && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onNext();
              }}
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          )}

          {onRepeat && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRepeat}
              className={`h-7 w-7 flex-shrink-0 transition-colors ${repeatMode !== 'off' ? 'text-neon-green' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-3.5 h-3.5" />
              ) : (
                <Repeat className="w-3.5 h-3.5" />
              )}
            </Button>
          )}

          {/* Progress bar - Inline with controls */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="font-mono text-[10px] text-muted-foreground min-w-[28px] text-right flex-shrink-0">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="flex-1 min-w-0"
              onValueChange={handleSeek}
            />
            <span className="font-mono text-[10px] text-muted-foreground min-w-[28px] flex-shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {currentSong && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/song/${currentSong.id}`)}
              className="h-7 px-2 font-mono text-xs flex-shrink-0"
            >
              Trade
            </Button>
          )}
        </div>

        {/* Volume - Desktop */}
        <div className="flex items-center gap-2 justify-end flex-shrink-0 min-w-[140px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-7 w-7 flex-shrink-0 hover:bg-white/10"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.1}
            className="w-24 flex-shrink-0"
            onValueChange={handleVolumeChange}
          />
          <span className="font-mono text-[10px] text-muted-foreground min-w-[32px] flex-shrink-0 text-right">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
        </div>
      </div>
    </Card>
      )}

      {/* Hidden Audio Element - Always present to maintain playback state */}
      <audio
        key={(currentSong?.id || currentAd?.id) ?? 'no-media'}
        ref={audioRef}
        src={sourceUrls[currentAudioUrlIndex] || ''}
        preload={getPreloadStrategy()}
        playsInline
        controlsList="nodownload"
        x-webkit-airplay="allow"
        crossOrigin="anonymous"
        
        onError={(e) => {
          console.error('Audio error:', e);
          handleAudioError();
        }}
        onCanPlay={async () => {
          const audio = audioRef.current;
          if (audio) {
            // Ensure volume is set correctly when audio loads
            audio.volume = isMuted ? 0 : volume;
            
            // Check play limits before auto-playing
            if (authenticated && currentSong && isPlaying) {
              // Refresh play status before auto-play
              await checkPlayStatus(currentSong.id);
              
              // Wait a moment for the status to update
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Check if user can still play
              if (playStatus) {
                const currentPlayCount = playStatus.playCount || 0;
                const isOwner = playStatus.isOwner || false;
                const maxFreePlays = playStatus.maxFreePlays || 3;
                
                if (!isOwner && currentPlayCount >= maxFreePlays) {
                  // User has exceeded play limit - don't auto-play
                  console.log('🚫 Play limit reached, blocking auto-play:', { 
                    playCount: currentPlayCount, 
                    maxFreePlays: maxFreePlays,
                    isOwner: isOwner 
                  });
                  if (audio) {
                    audio.pause();
                  }
                  // Call onPlayPause to update the parent's isPlaying state
                  if (isPlaying) {
                    onPlayPause();
                  }
                  setShowOwnershipPrompt(true);
                  return;
                }
              }
            }
            
            if (isPlaying && audio.paused) {
              // Use PWA-specific handler if in PWA mode
              try {
                if (isPWA) {
                  console.log('🎵 PWA: Auto-playing via PWA handler');
                  await handlePWAAudioPlay(audio);
                } else {
                  await audio.play();
                }
              } catch (error: any) {
                console.error('Audio autoplay blocked:', error);
                if (error.name === 'NotAllowedError') {
                  toast({
                    title: '🔒 Autoplay blocked',
                    description: isPWA ? 'Tap play to start audio in PWA mode' : 'Tap play to start audio',
                    variant: 'destructive'
                  });
                } else if (error.name !== 'AbortError') {
                  // Ignore AbortError as it's common when switching songs
                  console.error('Unexpected autoplay error:', error);
                }
              }
            }
          }
        }}
        onLoadStart={() => {
          // Ensure volume is set when audio starts loading
          const audio = audioRef.current;
          if (audio) {
            audio.volume = isMuted ? 0 : volume;
          }
        }}
        onLoadedData={() => {
          // Ensure volume is set when audio data is loaded
          const audio = audioRef.current;
          if (audio) {
            audio.volume = isMuted ? 0 : volume;
          }
        }}
      />

      {/* Login Prompt Modal for Non-Authenticated Users */}
      {showLoginPrompt && !authenticated && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-card border border-border">
            <div className="p-6 text-center">
              <Music className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Preview Time Up!</h3>
              <p className="text-muted-foreground mb-6">
                You've heard 20 seconds of this song. Login to listen to the full track and discover more music!
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setShowLoginPrompt(false);
                    setShowLoginModal(true);
                  }}
                  className="w-full"
                >
                  Login to Continue
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowLoginPrompt(false);
                    // Mark as dismissed so it doesn't show again for this song
                    if (currentSong) {
                      loginPromptDismissedRef.current = { songId: currentSong.id, dismissed: true };
                    }
                    // Stop the audio
                    const audio = audioRef.current;
                    if (audio) {
                      audio.pause();
                    }
                    // Update parent state
                    if (isPlaying) {
                      onPlayPause();
                    }
                  }}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Login Modal */}
      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        onLogin={() => {
          setShowLoginModal(false);
          setShowLoginPrompt(false);
          // Resume playback after successful login
          if (currentSong) {
            const audio = audioRef.current;
            if (audio) {
              audio.play();
            }
          }
        }}
      />

      {/* Ownership Prompt Modal */}
      {showOwnershipPrompt && authenticated && currentSong && playStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-card border border-border">
            <div className="p-6 text-center">
              <Music className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Play Limit Reached!</h3>
              <p className="text-muted-foreground mb-4">
                You've played this song {playStatus.playCount} times. 
                {playStatus.remainingPlays > 0 ? ` You have ${playStatus.remainingPlays} free plays remaining.` : ' Purchase this song to play it unlimited times!'}
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setShowOwnershipPrompt(false);
                    // Navigate to song page for purchase
                    navigate(`/song/${currentSong.id}`);
                  }}
                  className="w-full"
                >
                  {playStatus.remainingPlays > 0 ? 'Continue Playing' : 'Purchase Song'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowOwnershipPrompt(false);
                    // Mark as dismissed so it doesn't show again for this song
                    if (currentSong) {
                      loginPromptDismissedRef.current = { songId: currentSong.id, dismissed: true };
                    }
                    // Stop the audio
                    const audio = audioRef.current;
                    if (audio) {
                      audio.pause();
                    }
                    // Update parent state
                    if (isPlaying) {
                      onPlayPause();
                    }
                  }}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Expanded Album Art Modal */}
      <Dialog open={showExpandedArt} onOpenChange={setShowExpandedArt}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border border-neon-green/20">
          <div className="relative">
            {/* Album Art */}
            {displayCover ? (
              <div className="relative w-full aspect-square overflow-hidden">
                <img 
                  src={displayCover}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                
                {/* Song Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-mono text-2xl md:text-3xl font-bold text-white mb-2 line-clamp-2">
                        {displayTitle}
                      </h2>
                      <p className="font-mono text-lg md:text-xl text-muted-foreground mb-3">
                        {displayArtist}
                      </p>
                      {!isAd && currentSong?.ticker && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-neon-green bg-neon-green/20 px-3 py-1 rounded border border-neon-green/50">
                            ${currentSong.ticker}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isAd && currentSong && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowExpandedArt(false);
                            navigate(`/song/${currentSong.id}`);
                          }}
                          className="bg-black/40 border-white/20 hover:bg-black/60 hover:border-neon-green/50"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Song
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowExpandedArt(false)}
                        className="bg-black/40 border border-white/20 hover:bg-black/60 hover:border-neon-green/50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative w-full aspect-square bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center">
                <Music className="h-24 w-24 text-neon-green/50" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-mono text-2xl md:text-3xl font-bold text-white mb-2">
                        {displayTitle}
                      </h2>
                      <p className="font-mono text-lg md:text-xl text-muted-foreground">
                        {displayArtist}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowExpandedArt(false)}
                      className="bg-black/40 border border-white/20 hover:bg-black/60"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AudioPlayer;