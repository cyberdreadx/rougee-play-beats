import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, CheckCircle, Music, X, ChevronRight, ChevronLeft, Filter, Check, Settings } from "lucide-react";
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
  const { toast } = useToast();
  const { isPWA, audioSupported, handlePWAAudioPlay, isAudioUnlocked } = usePWAAudio();
  const { isConnected } = useWallet();
  const { authenticated } = usePrivy();
  const { playStatus, recordPlay, checkPlayStatus } = usePlayTracking(
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
    // Only reset if the song actually changed (not just the object reference)
    if (currentSong && currentSong.id !== lastSongIdRef.current) {
      lastSongIdRef.current = currentSong.id;
      lastKnownTimeRef.current = 0; // Reset tracked time for new song
      
      setCurrentTime(0);
      setDuration(0);
      setCurrentAudioUrlIndex(0); // Reset to first URL
      setPreviewTimeRemaining(20); // Reset preview timer
      setShowLoginPrompt(false); // Hide login prompt
      updateAudioState({ 
        currentTime: 0,
        duration: 0,
        currentSongId: currentSong.id,
        isPlaying 
      });
    }
  }, [currentSong?.id]); // Only reset when song ID changes, not when isPlaying changes

  // Preview timer for non-logged-in users
  useEffect(() => {
    if (!authenticated && isPlaying && currentSong) {
      const timer = setInterval(() => {
        setPreviewTimeRemaining(prev => {
          if (prev <= 1) {
            // Preview time is up, pause and show login prompt
            const audio = audioRef.current;
            if (audio) {
              audio.pause();
            }
            setShowLoginPrompt(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [authenticated, isPlaying, currentSong]);

  // Check play limits for authenticated users
  useEffect(() => {
    if (authenticated && isPlaying && currentSong && playStatus) {
      // Only enforce limits if the database functions are working properly
      if (playStatus.playCount > 0 && !playStatus.canPlay && playStatus.playCount >= playStatus.maxFreePlays) {
        // User has exceeded play limit and doesn't own the song
        const audio = audioRef.current;
        if (audio) {
          audio.pause();
        }
        setShowOwnershipPrompt(true);
      }
    }
  }, [authenticated, isPlaying, currentSong, playStatus]);

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
        const timer = setTimeout(() => {
          recordPlay(currentSong.id, 0).then(() => {
            // Always check play status again after recording to update UI with latest count
            checkPlayStatus(currentSong.id);
            playRecordedRef.current.timestamp = Date.now();
          }).catch((error) => {
            console.error('Failed to record play:', error);
            // Reset on error so we can retry
            playRecordedRef.current.isRecording = false;
          });
        }, 2000); // Record after 2 seconds of playing

        return () => clearTimeout(timer);
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

    if (isPlaying) {
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
    } else {
      audio.pause();
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
    <Card className={`fixed ${isMobileNavVisible ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]' : 'bottom-0'} md:bottom-0 md:left-[var(--sidebar-width,16rem)] right-0 z-50 bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 w-full max-w-full`}>

      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-neon-green/10 via-transparent to-neon-green/10 animate-pulse opacity-60" />

      {/* Top marquee header - scrolls across entire player width */}
      <div className="relative z-10 border-b border-white/10 px-3 py-1">
        <div className="marquee-container">
          <div className="marquee font-mono text-xs md:text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{displayTitle}</span>
            <span className="mx-2">—</span>
            <span>{displayArtist}</span>
            {!isAd && currentSong?.ticker && (
              <span className="ml-2 text-neon-green">${currentSong.ticker}</span>
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
              onClick={() => !isAd && currentSong && navigate(`/song/${currentSong.id}`)}
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
          {!authenticated && isPlaying && currentSong && (
            <div className="flex items-center justify-center gap-2 text-xs text-yellow-500 mt-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>Preview: {previewTimeRemaining}s remaining</span>
            </div>
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

      {/* Desktop Full Player */}
      <div className="hidden md:flex items-center gap-4 p-4 relative z-10">
        {/* Left info area with cover art */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {displayCover && (
            <div 
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-neon-green/30 shadow-lg shadow-neon-green/20 cursor-pointer hover:border-neon-green/60 transition-all hover:scale-105"
              onClick={() => !isAd && currentSong && navigate(`/song/${currentSong.id}`)}
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
        </div>

        {/* Controls + Trade button (center column) */}
        <div className="flex flex-col items-center gap-2 flex-[2] max-w-3xl mx-auto">
          {/* Main control buttons */}
          <div className="flex items-center gap-3">
            {onShuffle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onShuffle}
                className={`h-8 w-8 transition-colors ${shuffleEnabled ? 'text-neon-green' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Shuffle className="w-4 h-4" />
              </Button>
            )}
            
            {onPrevious && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                className="h-9 w-9 text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPauseClick}
              className="h-12 w-12 rounded-full bg-neon-green/20 hover:bg-neon-green/30 border-2 border-neon-green/50 transition-all hover:scale-110 shadow-lg shadow-neon-green/20"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-neon-green" />
              ) : (
                <Play className="w-6 h-6 text-neon-green fill-neon-green" />
              )}
            </Button>

            {onNext && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onNext();
                }}
                className="h-9 w-9 text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            )}

            {onRepeat && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRepeat}
                className={`h-8 w-8 transition-colors ${repeatMode !== 'off' ? 'text-neon-green' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </Button>
            )}
            {currentSong && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/song/${currentSong.id}`)}
                className="h-8 px-3 font-mono text-xs ml-2"
              >
                Trade
              </Button>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 w-full">
            <span className="font-mono text-xs text-muted-foreground min-w-[40px] text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="flex-1"
              onValueChange={handleSeek}
            />
            <span className="font-mono text-xs text-muted-foreground min-w-[40px]">
              {formatTime(duration)}
            </span>
          </div>

          {/* Preview indicator for non-authenticated users */}
          {!authenticated && isPlaying && currentSong && (
            <div className="flex items-center gap-2 text-xs text-yellow-500">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span>Preview: {previewTimeRemaining}s remaining</span>
            </div>
          )}

          {/* Play limit indicator for authenticated users */}
          {authenticated && isPlaying && currentSong && playStatus && (
            <div className="flex items-center gap-2 text-xs">
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
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 justify-end flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.1}
            className="w-20"
            onValueChange={handleVolumeChange}
          />
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
                    // Stop the audio
                    const audio = audioRef.current;
                    if (audio) {
                      audio.pause();
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
                    // Stop the audio
                    const audio = audioRef.current;
                    if (audio) {
                      audio.pause();
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
    </>
  );
};

export default AudioPlayer;