import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Share2, Heart, MoreVertical, Play, Pause, X, Check, Lock } from 'lucide-react';
import { getIPFSGatewayUrl } from '@/lib/ipfs';
import LikeButton from '@/components/LikeButton';
import RepostButton from '@/components/RepostButton';
import { SongComments } from '@/components/SongComments';
import { AudioWaveform } from '@/components/AudioWaveform';
import { useAudioStateForSong } from '@/hooks/useAudioState';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import TaggedText from '@/components/TaggedText';
import { XRGETierBadge } from '@/components/XRGETierBadge';
import { AiBadge } from '@/components/AiBadge';
import { useSongPrice } from '@/hooks/useSongBondingCurve';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { supabase } from '@/integrations/supabase/client';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from '@/hooks/use-toast';
import UnlockPostButton from '@/components/UnlockPostButton';

interface FeedSwipeViewProps {
  items: (SongPost | FeedPost)[];
  currentSong: any;
  isPlaying: boolean;
  playSong: (song: any) => void;
  onClose: () => void;
  type: 'songs' | 'posts';
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

interface SongPost {
  id: string;
  title: string;
  artist: string;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  ticker: string | null;
  token_address: string | null;
  created_at: string;
  ai_usage?: 'none' | 'partial' | 'full' | null;
  like_count?: number;
  comment_count?: number;
  profiles?: {
    artist_name: string | null;
    display_name: string | null;
    avatar_cid: string | null;
    verified: boolean | null;
  };
}

interface FeedPost {
  id: string;
  wallet_address: string;
  content_text: string | null;
  media_cid: string | null;
  media_type: string | null;
  song_id: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  repost_count?: number;
  is_locked?: boolean;
  unlock_price?: string | null;
  unlock_token_type?: string | null;
  unlock_token_address?: string | null;
  profiles?: {
    artist_name: string | null;
    display_name: string | null;
    avatar_cid: string | null;
    verified: boolean | null;
  };
  songs?: {
    id: string;
    title: string;
    artist: string;
    audio_cid: string;
    cover_cid: string | null;
  };
}

export default function FeedSwipeView({ 
  items, 
  currentSong, 
  isPlaying, 
  playSong, 
  onClose,
  type,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false
}: FeedSwipeViewProps) {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const fullAddress = user?.wallet?.address || '';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [copiedSongId, setCopiedSongId] = useState<string | null>(null);
  const [unlockedPosts, setUnlockedPosts] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const loadingCommentsRef = useRef<Set<string>>(new Set());
  const loadMoreTriggeredRef = useRef<Set<number>>(new Set()); // Track which indices have triggered load more
  const { xrgeUsdPrice } = useTokenPrices();

  const currentItem = items[currentIndex];
  
  // Get audio state for current song at top level (hooks must be called unconditionally)
  // Always call with a valid ID to prevent hook order issues
  const currentSongItem = currentItem && type === 'songs' && 'audio_cid' in currentItem ? currentItem as SongPost : null;
  const audioState = useAudioStateForSong(currentSongItem?.id || '');
  
  // Memoize current index to prevent unnecessary re-renders
  const memoizedCurrentIndex = useRef(currentIndex);
  useEffect(() => {
    memoizedCurrentIndex.current = currentIndex;
  }, [currentIndex]);

  // Handle touch events for swiping
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start dragging if touch started on an interactive element
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('.interactive')
    ) {
      return;
    }
    
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const offset = currentY - dragStartY;
    setDragOffset(offset);
  }, [isDragging, dragStartY]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    const deltaY = touchEndY - touchStartY.current;
    const deltaTime = touchEndTime - touchStartTime.current;
    const velocity = Math.abs(deltaY / deltaTime);

    // Swipe threshold: 100px or fast swipe (velocity > 0.3)
    const SWIPE_THRESHOLD = 100;
    const VELOCITY_THRESHOLD = 0.3;

    // Reset dragging state immediately
    setIsDragging(false);
    setDragOffset(0);
    
    // Update index only if it changed - use functional update to prevent stale closures
    if (Math.abs(deltaY) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      if (deltaY > 0) {
        // Swipe down - go to previous
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else {
        // Swipe up - go to next
        setCurrentIndex(prev => {
          const nextIndex = Math.min(items.length - 1, prev + 1);
          // Load more if we're near the end (within 2 items) and there's more to load
          // Only trigger once per index to prevent multiple loads
          if (nextIndex >= items.length - 2 && hasMore && onLoadMore && !isLoadingMore) {
            // Check if we've already triggered load more for this index
            if (!loadMoreTriggeredRef.current.has(nextIndex)) {
              console.log('📥 Near end of feed, loading more items...', { nextIndex, itemsLength: items.length });
              loadMoreTriggeredRef.current.add(nextIndex);
              onLoadMore();
            }
          }
          return nextIndex;
        });
      }
    }
  }, [isDragging, items.length, hasMore, onLoadMore, isLoadingMore]);

  // Auto-play song when item changes - debounced to prevent rapid changes
  const lastPlayedIndexRef = useRef<number>(-1);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear any pending play
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    
    // Only auto-play if index actually changed and it's a song
    if (type === 'songs' && currentItem && 'audio_cid' in currentItem && currentIndex !== lastPlayedIndexRef.current) {
      const songItem = currentItem as SongPost;
      if (playSong && songItem.audio_cid) {
        lastPlayedIndexRef.current = currentIndex;
        
        // Longer delay to prevent rapid play/pause when swiping
        playTimeoutRef.current = setTimeout(() => {
          playSong({
            id: songItem.id,
            title: songItem.title,
            artist: songItem.artist,
            audio_cid: songItem.audio_cid,
            cover_cid: songItem.cover_cid,
            token_address: songItem.token_address, // Include token_address for ownership detection
            wallet_address: songItem.wallet_address // Include wallet_address for creator check
          });
          playTimeoutRef.current = null;
        }, 300);
      }
    }
    
    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
    };
  }, [currentIndex, type, playSong]);

  // Prevent body scroll when swipe view is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Reset load more trigger when items change (new items loaded)
  useEffect(() => {
    // Clear triggers that are no longer near the end
    const currentLength = items.length;
    loadMoreTriggeredRef.current = new Set(
      Array.from(loadMoreTriggeredRef.current).filter(index => index >= currentLength - 5)
    );
  }, [items.length]);

  // Fetch unlock status for locked posts
  useEffect(() => {
    const fetchUnlockStatus = async () => {
      if (!fullAddress) return;
      
      const lockedPosts = items.filter(item => 
        type === 'posts' && 
        'is_locked' in item && 
        item.is_locked === true &&
        item.wallet_address !== fullAddress
      ) as FeedPost[];
      
      if (lockedPosts.length === 0) return;
      
      const lockedPostIds = lockedPosts.map(p => p.id);
      const { data: unlockData } = await supabase
        .from('feed_post_unlocks')
        .select('post_id')
        .eq('wallet_address', fullAddress.toLowerCase())
        .in('post_id', lockedPostIds);
      
      if (unlockData) {
        const unlockedIds = new Set(unlockData.map(u => u.post_id));
        setUnlockedPosts(unlockedIds);
      }
    };
    
    fetchUnlockStatus();
  }, [items, fullAddress, type]);

  // Load comments for a post
  const loadComments = useCallback(async (postId: string) => {
    if (loadingCommentsRef.current.has(postId)) return;
    if (comments[postId] && comments[postId].length > 0) return;
    
    loadingCommentsRef.current.add(postId);
    try {
      const { data, error } = await supabase
        .from('feed_comments')
        .select(`
          id,
          wallet_address,
          comment_text,
          created_at,
          profiles:wallet_address (
            artist_name,
            display_name,
            avatar_cid,
            verified
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setComments(prev => ({
        ...prev,
        [postId]: data || []
      }));
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      loadingCommentsRef.current.delete(postId);
    }
  }, [comments]);

  // Toggle comments for a post
  const toggleComments = useCallback(async (postId: string) => {
    const isExpanded = expandedComments.has(postId);
    if (isExpanded) {
      setExpandedComments(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    } else {
      setExpandedComments(prev => new Set(prev).add(postId));
      if (!comments[postId] || comments[postId].length === 0) {
        await loadComments(postId);
      }
    }
  }, [expandedComments, comments, loadComments]);

  // Handle sharing a post
  const handleSharePost = useCallback(async (post: FeedPost) => {
    const url = `${window.location.origin}/post/${post.id}`;
    const text = post.content_text ? post.content_text.slice(0, 140) : 'Check out this post on ROUGEE';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ROUGEE', text, url });
        toast({ title: 'Shared', description: 'Post shared successfully' });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedPostId(post.id);
        toast({ title: 'Link copied', description: 'Post link copied to clipboard' });
        setTimeout(() => setCopiedPostId(null), 1200);
      }
    } catch (_) {
      // ignore cancel
    }
  }, []);

  // Handle sharing a song
  const handleShareSong = useCallback(async (song: SongPost) => {
    const url = `${window.location.origin}/song/${song.id}`;
    const text = `Check out "${song.title}" by ${song.artist} on ROUGEE`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ROUGEE', text, url });
        toast({ title: 'Shared', description: 'Song shared successfully' });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedSongId(song.id);
        toast({ title: 'Link copied', description: 'Song link copied to clipboard' });
        setTimeout(() => setCopiedSongId(null), 1200);
      }
    } catch (_) {
      // ignore cancel
    }
  }, []);

  // Memoize render functions to prevent unnecessary re-renders
  const renderSongItem = useCallback((song: SongPost, audioStateForSong: any) => {
    const isCurrentlyPlaying = currentSong?.id === song.id && isPlaying;

    return (
      <div className="relative w-full h-full flex flex-col">
        {/* Cover Image Background */}
        {song.cover_cid && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${getIPFSGatewayUrl(song.cover_cid)})`,
              filter: 'blur(40px) brightness(0.3)',
              transform: 'scale(1.1)'
            }}
          />
        )}

        {/* Content Overlay */}
        <div className="relative z-10 flex-1 flex flex-col justify-between p-4 text-white">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className="text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">
                {currentIndex + 1} / {items.length}
              </span>
            </div>
          </div>

          {/* Center Content */}
          <div className="flex-1 flex flex-col justify-center items-center gap-6">
            {/* Cover Art */}
            {song.cover_cid && (
              <div className="relative w-64 h-64 rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={getIPFSGatewayUrl(song.cover_cid)}
                  alt={song.title}
                  className="w-full h-full object-cover"
                />
                {/* Play/Pause Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (playSong) {
                        playSong({
                          id: song.id,
                          title: song.title,
                          artist: song.artist,
                          audio_cid: song.audio_cid,
                          cover_cid: song.cover_cid,
                          token_address: song.token_address, // Include token_address for ownership detection
                          wallet_address: song.wallet_address // Include wallet_address for creator check
                        });
                      }
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
                  >
                    {isCurrentlyPlaying ? (
                      <Pause className="h-10 w-10" />
                    ) : (
                      <Play className="h-10 w-10 ml-1" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Song Info */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold font-mono">{song.title}</h2>
              <p className="text-lg text-white/80 font-mono">{song.artist}</p>
              {song.ticker && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-sm font-mono text-white/60">${song.ticker}</span>
                </div>
              )}
            </div>

            {/* Waveform */}
            {song.audio_cid && (
              <div className="w-full max-w-md">
                <AudioWaveform
                  audioCid={song.audio_cid}
                  height={30}
                  color="#00ff9f"
                  showProgress={true}
                  currentTime={audioStateForSong.currentTime}
                  duration={audioStateForSong.duration}
                />
              </div>
            )}

            {/* Comments Section */}
            {expandedComments.has(song.id) && (
              <div className="w-full max-w-md mt-4 pt-4 border-t border-white/20">
                <SongComments songId={song.id} />
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                <LikeButton
                  songId={song.id}
                  initialLikeCount={song.like_count || 0}
                  variant="ghost"
                  className="text-white hover:text-red-500"
                  entityType="song"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleComments(song.id);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                className="text-white hover:text-white/80 relative"
              >
                <MessageCircle className="h-6 w-6" />
                {song.comment_count > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs bg-red-500 rounded-full w-5 h-5 flex items-center justify-center">
                    {song.comment_count}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShareSong(song);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                className="text-white hover:text-white/80"
              >
                {copiedSongId === song.id ? <Check className="h-6 w-6" /> : <Share2 className="h-6 w-6" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {song.profiles?.avatar_cid && (
                <Avatar className="w-10 h-10 border-2 border-white">
                  <AvatarImage src={getIPFSGatewayUrl(song.profiles.avatar_cid)} />
                  <AvatarFallback>{song.artist[0]}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [currentSong, isPlaying, playSong, onClose, currentIndex, items.length]);

  // Color scheme function for cyberpunk styling (same as Feed.tsx)
  const getPostItColors = useCallback((id: string) => {
    const colorSchemes = [
      { 
        bg: 'from-neon-green/5 via-emerald-500/10 to-black/20', 
        glass: 'bg-black/40 backdrop-blur-xl border-neon-green/30', 
        circuit: 'border-neon-green/20',
        glow: 'shadow-[0_0_20px_rgba(0,255,159,0.3)]',
        text: 'text-neon-green/90' 
      },
      { 
        bg: 'from-blue-500/5 via-cyan-500/10 to-black/20', 
        glass: 'bg-black/40 backdrop-blur-xl border-cyan-500/30', 
        circuit: 'border-cyan-500/20',
        glow: 'shadow-[0_0_20px_rgba(0,255,255,0.3)]',
        text: 'text-cyan-400/90' 
      },
      { 
        bg: 'from-purple-500/5 via-pink-500/10 to-black/20', 
        glass: 'bg-black/40 backdrop-blur-xl border-pink-500/30', 
        circuit: 'border-pink-500/20',
        glow: 'shadow-[0_0_20px_rgba(255,0,255,0.3)]',
        text: 'text-pink-400/90' 
      },
      { 
        bg: 'from-orange-500/5 via-red-500/10 to-black/20', 
        glass: 'bg-black/40 backdrop-blur-xl border-orange-500/30', 
        circuit: 'border-orange-500/20',
        glow: 'shadow-[0_0_20px_rgba(255,165,0,0.3)]',
        text: 'text-orange-400/90' 
      },
    ];
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colorSchemes[hash % colorSchemes.length];
  }, []);

  const renderPostItem = (post: FeedPost) => {
    const isLocked = post.is_locked === true && !unlockedPosts.has(post.id) && post.wallet_address !== fullAddress;
    const colors = getPostItColors(post.id);
    const isTextOnly = !post.media_cid && !post.songs && post.content_text;
    
    return (
      <div className="relative w-full h-full flex flex-col bg-black">
        {/* Media Background */}
        {post.media_cid && (
          <div className="absolute inset-0">
            {isLocked ? (
              <>
                {/* Blurred preview for locked content */}
                <div className="absolute inset-0 blur-md pointer-events-none">
                  <img
                    src={getIPFSGatewayUrl(post.media_cid)}
                    alt="Post media"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/70" />
              </>
            ) : (
              <>
                <img
                  src={getIPFSGatewayUrl(post.media_cid)}
                  alt="Post media"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              </>
            )}
          </div>
        )}
        
        {/* Cyberpunk gradient background for text-only posts */}
        {isTextOnly && (
          <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg}`} />
        )}

        {/* Content Overlay */}
        <div className="relative z-10 flex-1 flex flex-col justify-between p-4 text-white">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className="text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">
                {currentIndex + 1} / {items.length}
              </span>
            </div>
          </div>

          {/* Center Content */}
          <div className="flex-1 flex flex-col justify-center relative">
            {isLocked ? (
              /* Lock Overlay - positioned absolutely to cover center area */
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-6 gap-4 z-30" style={{ top: '80px', bottom: '80px' }}>
                <Lock className="w-16 h-16 text-purple-400" />
                <p className="text-white font-mono font-bold text-xl">Premium Content</p>
                <p className="text-white/80 font-mono text-sm text-center">
                  Unlock for {post.unlock_price} {post.unlock_token_type}
                </p>
                <div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                  <UnlockPostButton
                    postId={post.id}
                    unlockPrice={post.unlock_price || '0'}
                    unlockTokenType={post.unlock_token_type || 'XRGE'}
                    unlockTokenAddress={post.unlock_token_address}
                    onUnlocked={() => {
                      setUnlockedPosts(prev => new Set(prev).add(post.id));
                      // Refresh to show unlocked content
                      window.location.reload();
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                {post.content_text && (
                  <div className={`max-w-2xl mx-auto relative ${isTextOnly ? 'p-8' : ''}`}>
                    {isTextOnly ? (
                      <>
                        {/* Cyberpunk Glass Panel */}
                        <div className={`absolute inset-0 ${colors.glass} border-2 ${colors.circuit} ${colors.glow} rounded-2xl`}>
                          {/* Circuit Lines - Horizontal */}
                          <div className={`absolute top-1/4 left-0 right-0 h-[1px] ${colors.circuit} border-t opacity-30`} />
                          <div className={`absolute top-1/2 left-0 right-0 h-[1px] ${colors.circuit} border-t opacity-20`} />
                          <div className={`absolute top-3/4 left-0 right-0 h-[1px] ${colors.circuit} border-t opacity-30`} />
                          
                          {/* Circuit Lines - Vertical */}
                          <div className={`absolute left-1/4 top-0 bottom-0 w-[1px] ${colors.circuit} border-l opacity-30`} />
                          <div className={`absolute left-1/2 top-0 bottom-0 w-[1px] ${colors.circuit} border-l opacity-20`} />
                          <div className={`absolute left-3/4 top-0 bottom-0 w-[1px] ${colors.circuit} border-l opacity-30`} />
                          
                          {/* Corner Accents */}
                          <div className={`absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 ${colors.circuit}`} />
                          <div className={`absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 ${colors.circuit}`} />
                          <div className={`absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 ${colors.circuit}`} />
                          <div className={`absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 ${colors.circuit}`} />
                        </div>
                        
                        {/* Text Content */}
                        <div className="relative z-10">
                          <div className={`text-lg md:text-xl whitespace-pre-wrap leading-relaxed font-mono font-semibold ${colors.text} drop-shadow-[0_0_10px_currentColor]`}>
                            <TaggedText text={post.content_text} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-white text-base md:text-lg whitespace-pre-wrap leading-relaxed">
                        <TaggedText text={post.content_text} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Comments Section */}
            {expandedComments.has(post.id) && (
              <div className="w-full max-w-md mt-4 pt-4 border-t border-white/20">
                {fullAddress && (
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Add a comment..."
                      value={commentText[post.id] || ''}
                      onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyPress={async (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const text = commentText[post.id]?.trim();
                          if (!text) return;
                          
                          try {
                            const { error } = await supabase
                              .from('feed_comments')
                              .insert({
                                post_id: post.id,
                                wallet_address: fullAddress.toLowerCase(),
                                comment_text: text
                              });
                            
                            if (error) throw error;
                            
                            setCommentText(prev => ({ ...prev, [post.id]: '' }));
                            await loadComments(post.id);
                          } catch (error) {
                            console.error('Error adding comment:', error);
                            toast({ title: 'Error', description: 'Failed to add comment', variant: 'destructive' });
                          }
                        }
                      }}
                      className="flex-1 bg-white/10 text-white placeholder:text-white/50 border-white/20"
                    />
                  </div>
                )}
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {comments[post.id]?.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      {comment.profiles?.avatar_cid && (
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={getIPFSGatewayUrl(comment.profiles.avatar_cid)} />
                          <AvatarFallback>
                            {comment.profiles.artist_name?.[0] || comment.profiles.display_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {comment.profiles?.artist_name || comment.profiles?.display_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-white/60">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-white/80">{comment.comment_text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                <LikeButton
                  songId={post.id}
                  initialLikeCount={post.like_count}
                  variant="ghost"
                  className="text-white hover:text-red-500"
                  entityType="post"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleComments(post.id);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                className="text-white hover:text-white/80 relative"
              >
                <MessageCircle className="h-6 w-6" />
                {post.comment_count > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs bg-red-500 rounded-full w-5 h-5 flex items-center justify-center">
                    {post.comment_count}
                  </span>
                )}
              </Button>
              <div onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                <RepostButton
                  postId={post.id}
                  initialRepostCount={post.repost_count || 0}
                  variant="ghost"
                  className="text-white hover:text-white/80"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSharePost(post);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                className="text-white hover:text-white/80"
              >
                {copiedPostId === post.id ? <Check className="h-6 w-6" /> : <Share2 className="h-6 w-6" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {post.profiles?.avatar_cid && (
                <Avatar className="w-10 h-10 border-2 border-white">
                  <AvatarImage src={getIPFSGatewayUrl(post.profiles.avatar_cid)} />
                  <AvatarFallback>
                    {post.profiles.artist_name?.[0] || post.profiles.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Memoize items to prevent unnecessary re-renders
  const renderedItems = useMemo(() => {
    return items.map((item, index) => {
      const isCurrentItem = index === currentIndex;
      const songItem = type === 'songs' && 'audio_cid' in item ? item as SongPost : null;
      // Only use audio state for current item to avoid hook violations
      const itemAudioState = isCurrentItem && songItem ? audioState : { currentTime: 0, duration: 0 };
      
      return {
        item,
        index,
        isCurrentItem,
        songItem,
        itemAudioState
      };
    });
  }, [items, currentIndex, type, audioState.currentTime, audioState.duration]);

  if (!currentItem) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black md:hidden overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `translateY(calc(-${currentIndex * 100}% + ${isDragging ? dragOffset : 0}px))`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: isDragging ? 'transform' : 'auto'
        }}
      >
        {renderedItems.map(({ item, index, isCurrentItem, songItem, itemAudioState }) => {
          // Only render visible items (current + adjacent) to improve performance
          const isVisible = Math.abs(index - currentIndex) <= 1;
          
          if (!isVisible) {
            return (
              <div
                key={item.id}
                className="absolute inset-0 w-full h-full"
                style={{
                  top: `${index * 100}%`,
                  visibility: 'hidden',
                  pointerEvents: 'none'
                }}
              />
            );
          }
          
          return (
            <div
              key={item.id}
              className="absolute inset-0 w-full h-full"
              style={{
                top: `${index * 100}%`,
                willChange: isCurrentItem ? 'transform' : 'auto'
              }}
            >
              {songItem ? renderSongItem(songItem, itemAudioState) : renderPostItem(item as FeedPost)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

