import React, { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageCircle, Share2, Image as ImageIcon, Send, CheckCircle, Check, CircleCheckBig, Music, Loader2, Play, Pause, Lock, ChevronsUpDown, X, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getIPFSGatewayUrl } from '@/lib/ipfs';
import StoriesBar from '@/components/StoriesBar';
import LikeButton from '@/components/LikeButton';
import { usePrivy } from '@privy-io/react-auth';
import TaggedText from '@/components/TaggedText';
import TagAutocomplete from '@/components/TagAutocomplete';
import { XRGETierBadge } from '@/components/XRGETierBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SongComments } from '@/components/SongComments';
import { AiBadge } from '@/components/AiBadge';
import gltchLogo from '@/assets/gltch-logo.png';
import gltchTabLogo from '@/assets/gltch-tab-logo.png';
import { useSongPrice } from '@/hooks/useSongBondingCurve';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { AudioWaveform } from '@/components/AudioWaveform';
import { useAudioStateForSong } from '@/hooks/useAudioState';
import CreatePostModal from '@/components/CreatePostModal';
import { useMobileNavVisibility } from '@/hooks/useMobileNavVisibility';

const XRGE_TOKEN_ADDRESS = "0x147120faEC9277ec02d957584CFCD92B56A24317" as const;

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const;
interface FeedComment {
  id: string;
  wallet_address: string;
  comment_text: string;
  created_at: string;
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
  profiles?: {
    artist_name: string | null;
    display_name: string | null;
    avatar_cid: string | null;
    verified: boolean | null;
  };
}

interface FeedProps {
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
}

// Generate consistent random colors for post-it notes based on post ID
const getPostItColors = (postId: string) => {
  // Simple hash function to convert post ID to a number
  let hash = 0;
  for (let i = 0; i < postId.length; i++) {
    hash = postId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % 7;
  
  const colorSchemes = [
    // Neon Green Cyberpunk
    {
      bg: 'from-neon-green/5 via-emerald-500/10 to-black/20',
      glass: 'bg-black/40 backdrop-blur-xl border-neon-green/30',
      circuit: 'border-neon-green/20',
      glow: 'shadow-[0_0_20px_rgba(0,255,159,0.3)]',
      text: 'text-neon-green/90',
    },
    // Electric Blue
    {
      bg: 'from-blue-500/5 via-cyan-500/10 to-black/20',
      glass: 'bg-black/40 backdrop-blur-xl border-cyan-500/30',
      circuit: 'border-cyan-500/20',
      glow: 'shadow-[0_0_20px_rgba(0,255,255,0.3)]',
      text: 'text-cyan-400/90',
    },
    // Hot Pink
    {
      bg: 'from-pink-500/5 via-fuchsia-500/10 to-black/20',
      glass: 'bg-black/40 backdrop-blur-xl border-pink-500/30',
      circuit: 'border-pink-500/20',
      glow: 'shadow-[0_0_20px_rgba(255,0,255,0.3)]',
      text: 'text-pink-400/90',
    },
    // Purple Haze
    {
      bg: 'from-purple-500/5 via-violet-500/10 to-black/20',
      glass: 'bg-black/40 backdrop-blur-xl border-purple-500/30',
      circuit: 'border-purple-500/20',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
      text: 'text-purple-400/90',
    },
    // Orange Flame
    {
      bg: 'from-orange-500/5 via-red-500/10 to-black/20',
      glass: 'bg-black/40 backdrop-blur-xl border-orange-500/30',
      circuit: 'border-orange-500/20',
      glow: 'shadow-[0_0_20px_rgba(255,165,0,0.3)]',
      text: 'text-orange-400/90',
    },
    // Teal Matrix
    {
      bg: 'from-teal-500/5 via-emerald-500/10 to-black/20',
      glass: 'bg-black/40 backdrop-blur-xl border-teal-500/30',
      circuit: 'border-teal-500/20',
      glow: 'shadow-[0_0_20px_rgba(20,184,166,0.3)]',
      text: 'text-teal-400/90',
    },
    // Yellow Electric
    {
      bg: 'from-yellow-500/5 via-amber-500/10 to-black/20',
      glass: 'bg-black/40 backdrop-blur-xl border-yellow-500/30',
      circuit: 'border-yellow-500/20',
      glow: 'shadow-[0_0_20px_rgba(255,255,0,0.3)]',
      text: 'text-yellow-400/90',
    },
  ];
  
  return colorSchemes[index];
};

// Skeleton components for Feed page
const PostCardSkeleton = memo(() => (
  <Card className="p-4 md:p-6 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-xl border border-white/10 rounded-2xl mb-4">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-white/10 rounded w-32 animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-24 animate-pulse" />
      </div>
    </div>
    <div className="space-y-3">
      <div className="h-24 bg-white/10 rounded-lg animate-pulse" />
      <div className="h-4 bg-white/10 rounded w-full animate-pulse" />
      <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
    </div>
    <div className="flex items-center gap-4 mt-4">
      <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
      <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
      <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
    </div>
  </Card>
));
PostCardSkeleton.displayName = 'PostCardSkeleton';

const SongCardFeedSkeleton = memo(() => (
  <Card className="p-4 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-xl border border-white/10 rounded-xl mb-4">
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded bg-white/10 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-white/10 rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-white/10 rounded w-1/2 animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-1/3 animate-pulse" />
      </div>
      <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
    </div>
  </Card>
));
SongCardFeedSkeleton.displayName = 'SongCardFeedSkeleton';

export default function Feed({ playSong, currentSong, isPlaying }: FeedProps = {}) {
  const navigate = useNavigate();
  
  // AI Filter state
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
  const {
    fullAddress,
    isConnected
  } = useWallet();
  const { getAccessToken } = usePrivy();
  const isMobileNavVisible = useMobileNavVisibility();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [songs, setSongs] = useState<SongPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [songsPage, setSongsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreSongs, setHasMoreSongs] = useState(true);
  const ITEMS_PER_PAGE = 5;
  const [posting, setPosting] = useState(false);
  const [contentText, setContentText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [expandedSongComments, setExpandedSongComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [songCommentCounts, setSongCommentCounts] = useState<Record<string, number>>({});
  const [selectedSong, setSelectedSong] = useState<SongPost | null>(null);
  const [songSearchOpen, setSongSearchOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [allSongs, setAllSongs] = useState<SongPost[]>([]);
  const [loadingAllSongs, setLoadingAllSongs] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  
  // Dismissible tip for feed page
  const [showFeedTip, setShowFeedTip] = useState(() => {
    const dismissed = localStorage.getItem('feed_tip_dismissed');
    return dismissed !== 'true';
  });

  // Check if user holds XRGE tokens
  const { data: xrgeBalance } = useReadContract({
    address: XRGE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: fullAddress ? [fullAddress as Address] : undefined,
    query: {
      enabled: !!fullAddress && isConnected,
    },
  });

  const hasXRGE = xrgeBalance ? Number(xrgeBalance) > 0 : false;
  useEffect(() => {
    loadPosts();
    loadSongs();
    if (isConnected && fullAddress) {
      loadLikedPosts();
    }
  }, [isConnected, fullAddress]);

  // Prefetch next page in background when user scrolls near bottom
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      
      // When user is 80% down the page, prefetch next batch
      if (scrollPosition >= pageHeight * 0.8) {
        if (hasMorePosts && !loadingMorePosts && !loading) {
          loadPosts(true);
        }
        if (hasMoreSongs && !loadingMoreSongs && !loadingSongs) {
          loadSongs(true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMorePosts, hasMoreSongs, loadingMorePosts, loadingMoreSongs, loading, loadingSongs]);
  const loadPosts = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMorePosts(true);
      } else {
        setLoading(true);
      }

      const page = loadMore ? postsPage + 1 : 1;
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const {
        data: postsData,
        error
      } = await supabase
        .from('feed_posts')
        .select(`
          *,
          songs (
            id,
            title,
            artist,
            audio_cid,
            cover_cid
          )
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Check if there are more posts
      const hasMore = postsData && postsData.length === ITEMS_PER_PAGE;
      setHasMorePosts(hasMore);

      // Fetch profiles separately (case-insensitive matching)
      const walletAddresses = [...new Set(postsData?.map(p => p.wallet_address) || [])];
      console.log('📋 Fetching profiles for wallet addresses:', walletAddresses);
      
      let profilesData: { wallet_address: string; artist_name: string | null; display_name: string | null; avatar_cid: string | null; verified: boolean | null }[] = [];
      if (walletAddresses.length) {
        const orFilter = walletAddresses.map((a) => `wallet_address.ilike.${a}`).join(',');
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('wallet_address, artist_name, display_name, avatar_cid, verified')
          .or(orFilter);
        
        if (profileError) {
          console.error('❌ Error fetching profiles:', profileError);
        } else {
          console.log('✅ Profiles fetched:', data);
        }
        
        profilesData = data || [];
      }
      
      console.log('👥 Profiles data for posts:', profilesData);

      // Merge data (normalize addresses to lowercase)
      const postsWithProfiles = postsData?.map(post => {
        const profile = profilesData?.find(p => p.wallet_address?.toLowerCase() === post.wallet_address?.toLowerCase());
        console.log(`🔗 Post ${post.id} (${post.wallet_address}) -> Profile:`, profile);
        return {
          ...post,
          profiles: profile || null
        };
      }) || [];

      if (loadMore) {
        setPosts(prev => [...prev, ...(postsWithProfiles as FeedPost[])]);
        setPostsPage(page);
      } else {
        setPosts(postsWithProfiles as FeedPost[]);
        setPostsPage(1);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      toast({
        title: 'Error loading feed',
        description: 'Failed to load posts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setLoadingMorePosts(false);
    }
  };

  const loadSongs = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMoreSongs(true);
      } else {
        setLoadingSongs(true);
      }

      const page = loadMore ? songsPage + 1 : 1;
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data: songsData, error } = await supabase
        .from('songs')
        .select('id, title, artist, wallet_address, audio_cid, cover_cid, ticker, token_address, created_at, ai_usage')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Check if there are more songs
      const hasMore = songsData && songsData.length === ITEMS_PER_PAGE;
      setHasMoreSongs(hasMore);

      // Fetch profiles separately (case-insensitive matching)
      const walletAddresses = [...new Set(songsData?.map(s => s.wallet_address) || [])];
      let profilesData: { wallet_address: string; artist_name: string | null; avatar_cid: string | null; verified: boolean | null }[] = [];
      if (walletAddresses.length) {
        const orFilter = walletAddresses.map((a) => `wallet_address.ilike.${a}`).join(',');
        const { data } = await supabase
          .from('profiles')
          .select('wallet_address, artist_name, display_name, avatar_cid, verified')
          .or(orFilter);
        profilesData = data || [];
      }

      // Merge data (normalize addresses to lowercase)
      const songsWithProfiles = songsData?.map(song => ({
        ...song,
        profiles: profilesData?.find(p => p.wallet_address?.toLowerCase() === song.wallet_address?.toLowerCase()) || null
      })) || [];

      if (loadMore) {
        setSongs(prev => [...prev, ...(songsWithProfiles as SongPost[])]);
        setSongsPage(page);
      } else {
        setSongs(songsWithProfiles as SongPost[]);
        setSongsPage(1);
      }
      
      // Initialize comment counts for all songs
      // Fetch comment counts in batch to prevent glitching
      const songIds = songsWithProfiles.map(s => s.id);
      if (songIds.length > 0) {
        const { data: commentCountsData } = await supabase
          .from('comments')
          .select('song_id')
          .in('song_id', songIds);
        
        // Count comments per song
        const counts: Record<string, number> = {};
        commentCountsData?.forEach(comment => {
          if (comment.song_id) {
            counts[comment.song_id] = (counts[comment.song_id] || 0) + 1;
          }
        });
        
        // Update comment counts state
        setSongCommentCounts(prev => ({ ...prev, ...counts }));
      }
    } catch (error) {
      console.error('Error loading songs:', error);
      toast({
        title: 'Error loading songs',
        description: 'Failed to load songs',
        variant: 'destructive'
      });
    } finally {
      setLoadingSongs(false);
      setLoadingMoreSongs(false);
    }
  };

  // Load all songs for search dropdown
  const loadAllSongsForSearch = async () => {
    if (allSongs.length > 0) return; // Already loaded
    
    setLoadingAllSongs(true);
    try {
      // Load first 500 songs for search
      const { data: songsData, error } = await supabase
        .from('songs')
        .select('id, title, artist, audio_cid, cover_cid, wallet_address')
        .order('created_at', { ascending: false })
        .limit(500);
        
      if (error) throw error;
      setAllSongs(songsData as SongPost[] || []);
    } catch (error) {
      console.error('Error loading all songs:', error);
    } finally {
      setLoadingAllSongs(false);
    }
  };

  const loadLikedPosts = async () => {
    if (!fullAddress) return;
    try {
      const {
        data,
        error
      } = await supabase.from('feed_likes').select('post_id').eq('wallet_address', fullAddress);
      if (error) throw error;
      setLikedPosts(new Set(data?.map(like => like.post_id) || []));
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  };
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handlePost = async () => {
    if (!isConnected || !fullAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to post',
        variant: 'destructive'
      });
      return;
    }
    if (!contentText && !mediaFile) {
      toast({
        title: 'Empty post',
        description: 'Please add text or media',
        variant: 'destructive'
      });
      return;
    }
    if (!selectedSong) {
      toast({
        title: 'Song required',
        description: 'Please select a song to play with your post',
        variant: 'destructive'
      });
      return;
    }
    setPosting(true);
    try {
      const token = await getAccessToken();
      
      const formData = new FormData();
      if (contentText) formData.append('content_text', contentText);
      if (mediaFile) formData.append('media', mediaFile);
      if (fullAddress) formData.append('walletAddress', fullAddress);
      if (selectedSong) formData.append('song_id', selectedSong.id);
      
      const response = await fetch('https://phybdsfwycygroebrsdx.supabase.co/functions/v1/create-feed-post', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create post');
      }
      toast({
        title: 'Posted!',
        description: 'Your post was uploaded to IPFS and published'
      });
      setContentText('');
      setMediaFile(null);
      setMediaPreview(null);
      setSelectedSong(null);
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Post failed',
        description: error instanceof Error ? error.message : 'Failed to create post',
        variant: 'destructive'
      });
    } finally {
      setPosting(false);
    }
  };
  const toggleComments = async (postId: string) => {
    const isExpanded = expandedComments.has(postId);
    if (isExpanded) {
      setExpandedComments(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    } else {
      setExpandedComments(prev => new Set(prev).add(postId));
      await loadComments(postId);
    }
  };

  const toggleSongComments = React.useCallback((songId: string) => {
    setExpandedSongComments(prev => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  }, []);
  const loadComments = async (postId: string) => {
    try {
      const {
        data: commentsData,
        error
      } = await supabase.from('feed_comments').select('*').eq('post_id', postId).order('created_at', {
        ascending: false
      });
      if (error) throw error;

      // Fetch profiles for comment authors (case-insensitive)
      const walletAddresses = [...new Set(commentsData?.map(c => c.wallet_address) || [])];
      let profilesData: { wallet_address: string; artist_name: string | null; avatar_cid: string | null; verified: boolean | null }[] = [];
      
      if (walletAddresses.length) {
        const orFilter = walletAddresses.map((a) => `wallet_address.ilike.${a}`).join(',');
        const { data } = await supabase
          .from('profiles')
          .select('wallet_address, artist_name, display_name, avatar_cid, verified')
          .or(orFilter);
        profilesData = data || [];
      }
      
      console.log('Comment profiles data:', profilesData);
      const commentsWithProfiles = commentsData?.map(comment => ({
        ...comment,
        profiles: profilesData?.find(p => p.wallet_address?.toLowerCase() === comment.wallet_address?.toLowerCase()) || null
      })) || [];
      setComments(prev => ({
        ...prev,
        [postId]: commentsWithProfiles as FeedComment[]
      }));

      // Sync the comment count with actual comments after loading
      setPosts(prevPosts => 
        prevPosts.map(p => 
          p.id === postId 
            ? { ...p, comment_count: commentsData?.length || 0 }
            : p
        )
      );
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };
  const handleAddComment = async (postId: string) => {
    if (!isConnected || !fullAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to comment',
        variant: 'destructive'
      });
      return;
    }
    const text = commentText[postId]?.trim();
    if (!text) return;
    try {
      const token = await getAccessToken();
      const { error } = await supabase.functions.invoke('add-comment', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          postId,
          commentText: text,
          walletAddress: fullAddress,
        },
      });
      if (error) throw error;
      setCommentText(prev => ({
        ...prev,
        [postId]: ''
      }));
      await loadComments(postId);
      loadPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Failed to add comment',
        variant: 'destructive'
      });
    }
  };
  const toggleLike = async (postId: string) => {
    if (!isConnected || !fullAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to like posts',
        variant: 'destructive'
      });
      return;
    }
    const isLiked = likedPosts.has(postId);
    try {
      const token = await getAccessToken();
      const { error } = await supabase.functions.invoke('like-post', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { 
          postId, 
          action: isLiked ? 'unlike' : 'like' 
        },
      });
      
      if (error) throw error;

      if (isLiked) {
        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      } else {
        setLikedPosts(prev => new Set(prev).add(postId));
      }
      loadPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };
  const handleSharePost = async (post: FeedPost) => {
    const url = `https://rougee.app/post/${post.id}`;
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
  };
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Waveform component for feed page
  const FeedWaveform = ({ songId, audioCid }: { songId: string; audioCid: string }) => {
    const audioState = useAudioStateForSong(songId);
    
    return (
      <AudioWaveform
        audioCid={audioCid}
        height={25}
        color="#00ff9f"
        backgroundColor="rgba(0, 0, 0, 0.1)"
        className="rounded border border-neon-green/10"
        showProgress={audioState.isCurrentSong && audioState.isPlaying}
        currentTime={audioState.currentTime}
        duration={audioState.duration}
        onSeek={(time) => {
          console.log('Seek to:', time);
        }}
      />
    );
  };

  // Song Card Component with Price
  const SongCard = ({ song }: { song: SongPost }) => {
    const { prices } = useTokenPrices();
    const { price: priceInXRGE } = useSongPrice(song.token_address as Address);
    const priceUSD = (parseFloat(priceInXRGE) || 0) * (prices.xrge || 0);

    return (
      <Card className="p-4 md:p-6 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,255,159,0.1)] hover:shadow-[0_12px_48px_0_rgba(0,255,159,0.2)] hover:border-neon-green/20 w-full md:rounded-2xl rounded-none border-x-0 md:border-x border-b md:border-b mb-0 md:mb-4 hover:bg-white/8 active:bg-white/10 active:scale-[0.98] transition-all duration-300 group">
        {/* Song Post Header */}
        <div className="flex items-start gap-3 mb-4">
          {/* Artist Avatar */}
          <div 
            className="flex-shrink-0 cursor-pointer hover:scale-110 transition-transform duration-200 relative group/avatar"
            onClick={() => navigate(`/artist/${song.wallet_address}`)}
          >
            {song.profiles?.avatar_cid ? (
              <div className="relative">
                <img
                  src={getIPFSGatewayUrl(song.profiles.avatar_cid)}
                  alt="Avatar"
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-neon-green/20 group-hover/avatar:border-neon-green/60 transition-all duration-300"
                />
                <div className="absolute inset-0 rounded-full bg-neon-green/0 group-hover/avatar:bg-neon-green/10 transition-colors duration-300" />
              </div>
            ) : (
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center border-2 border-neon-green/20 group-hover/avatar:border-neon-green/60 transition-all duration-300">
                <span className="text-neon-green text-base md:text-lg font-bold">
                  {song.profiles?.artist_name?.[0] || song.profiles?.display_name?.[0] || '?'}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Artist Name and Action */}
            <div className="flex items-center gap-2 mb-1">
              <p
                className="font-semibold text-sm md:text-base cursor-pointer hover:text-neon-green transition-colors duration-200"
                onClick={() => navigate(`/artist/${song.wallet_address}`)}
              >
                {(() => {
                  const name = song.profiles?.artist_name || song.profiles?.display_name;
                  // Filter out wallet addresses - they start with 0x and are 42 chars
                  const isValidName = name && !name.toLowerCase().startsWith('0x') && name.length < 42;
                  // Never show wallet address - always show Anonymous if no valid name
                  return isValidName ? name : 'Anonymous';
                })()}
              </p>
              {song.profiles?.verified && (
                <CircleCheckBig className="h-4 w-4 text-blue-500 flex-shrink-0 animate-pulse" aria-label="Verified artist" />
              )}
              <XRGETierBadge walletAddress={song.wallet_address} size="sm" />
              <span className="text-xs md:text-sm text-muted-foreground ml-1">posted a track</span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {formatTimeAgo(song.created_at)}
            </p>
          </div>
        </div>

        {/* Song Content */}
        <div className="flex gap-3 mb-3">
          {/* Album Cover with Play Button */}
          <div className="relative group/cover flex-shrink-0">
            {song.cover_cid ? (
              <div className="relative">
                <img
                  src={getIPFSGatewayUrl(song.cover_cid)}
                  alt={song.title}
                  loading="lazy"
                  decoding="async"
                  className="w-24 h-24 md:w-28 md:h-28 rounded-xl object-cover cursor-pointer border-2 border-neon-green/20 group-hover/cover:border-neon-green/60 transition-all duration-300 shadow-lg group-hover/cover:scale-105"
                  onClick={() => song.token_address ? navigate(`/song/${song.id}`) : null}
                />
                <div className="absolute inset-0 rounded-xl bg-neon-green/0 group-hover/cover:bg-neon-green/10 transition-colors duration-300" />
              </div>
            ) : (
              <div 
                className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center cursor-pointer border-2 border-neon-green/20 group-hover/cover:border-neon-green/60 transition-all duration-300 shadow-lg"
                onClick={() => song.token_address ? navigate(`/song/${song.id}`) : null}
              >
                <Music className="w-10 h-10 md:w-12 md:h-12 text-neon-green" />
              </div>
            )}
            
            {/* Enhanced Play Button Overlay */}
            {playSong && song.audio_cid && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playSong(song);
                }}
                className="absolute bottom-2 right-2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-neon-green hover:bg-neon-green/90 active:bg-neon-green/80 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(0,255,159,0.6)] hover:shadow-[0_0_30px_rgba(0,255,159,0.8)] z-10 border-2 border-white/20"
              >
                {currentSong?.id === song.id && isPlaying ? (
                  <Pause className="w-5 h-5 md:w-6 md:h-6 text-black fill-black" />
                ) : (
                  <Play className="w-5 h-5 md:w-6 md:h-6 text-black fill-black ml-0.5" />
                )}
              </button>
            )}
          </div>

          {/* Song Info */}
          <div 
            className="flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => song.token_address ? navigate(`/song/${song.id}`) : null}
          >
            <h3 className="font-bold text-base md:text-lg mb-2 truncate flex items-center gap-2">
              <span className="truncate text-foreground">{song.title}</span>
              <AiBadge aiUsage={song.ai_usage} size="sm" />
            </h3>
            <p className="text-sm md:text-base text-muted-foreground mb-2">
              {song.artist}
            </p>
            {song.ticker && (
              <p className="text-xs md:text-sm text-neon-green font-mono mb-2 font-semibold">
                ${song.ticker}
              </p>
            )}
            {song.token_address && priceUSD > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Price:</span>
                <span className="font-mono font-semibold text-neon-green">
                  ${priceUSD < 0.000001 ? priceUSD.toFixed(10) : priceUSD < 0.01 ? priceUSD.toFixed(8) : priceUSD.toFixed(6)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Audio Waveform */}
        {song.audio_cid && (
          <div className="mb-3">
            <FeedWaveform songId={song.id} audioCid={song.audio_cid} />
          </div>
        )}

        {/* Song Actions */}
        <div className="flex items-center gap-4 pt-4 border-t border-border/50">
          <LikeButton 
            songId={song.id} 
            size="sm" 
            showCount={true} 
          />

          <button 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleSongComments(song.id);
            }} 
            className="flex items-center gap-1.5 text-sm hover:text-neon-green transition-colors duration-200"
          >
            <MessageCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
            <span className="font-mono min-w-[20px] text-right">{songCommentCounts[song.id] ?? 0}</span>
          </button>

          {song.token_address && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/song/${song.id}`)}
              className="ml-auto border-neon-green/30 hover:border-neon-green/60 hover:bg-neon-green/10 transition-all duration-200"
            >
              Trade
            </Button>
          )}
        </div>

        {/* Comments Section */}
        {expandedSongComments.has(song.id) && (
          <div className="mt-4 pt-4 border-t border-primary/10">
            <SongComments 
              key={song.id} 
              songId={song.id} 
              onCommentCountChange={React.useCallback((count: number) => {
                setSongCommentCounts(prev => {
                  // Only update if count actually changed to prevent unnecessary re-renders
                  if (prev[song.id] === count) return prev;
                  return { ...prev, [song.id]: count };
                });
              }, [song.id])}
            />
          </div>
        )}
      </Card>
    );
  };
  return <>
      <StoriesBar hasXRGE={hasXRGE} />
      <div className="min-h-screen bg-background pt-0 pb-24 md:pb-32 px-0 md:px-4">
        <div className="w-full md:max-w-7xl md:mx-auto">
          <div className="text-center mb-8 md:mb-12 px-4 pt-4 md:pt-8 pb-8 md:pb-12">
            <div className="relative flex justify-center items-center mb-6">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 md:w-60 md:h-60 bg-neon-green/10 rounded-full blur-3xl animate-pulse" />
              </div>
              <img 
                src={gltchLogo} 
                alt="GLTCH" 
                className="relative h-32 md:h-48 w-auto drop-shadow-[0_0_40px_rgba(0,255,159,0.8)] hover:drop-shadow-[0_0_60px_rgba(0,255,159,1)] transition-all duration-500 hover:scale-110"
              />
            </div>
            <p className="text-base md:text-lg text-muted-foreground font-mono tracking-wide animate-fade-in">
              Decentralized social feed on IPFS
            </p>
          </div>

          {/* Feed Tip Card */}
          {showFeedTip && (
            <Card className="mx-4 md:mx-auto md:max-w-2xl mb-6 p-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl border border-blue-500/30 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 flex-shrink-0">
                  <Music className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold font-mono text-blue-400 mb-1">💡 Feed Tips</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    • Click the <span className="text-neon-green font-semibold">+ button</span> to create posts
                    <br />
                    • Audio player auto-docks on this page for better scrolling
                    <br />
                    • Click the side tab to expand the player anytime
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowFeedTip(false);
                    localStorage.setItem('feed_tip_dismissed', 'true');
                  }}
                  className="h-6 w-6 p-0 hover:bg-blue-500/20 flex-shrink-0"
                >
                  <X className="h-4 w-4 text-blue-400" />
                </Button>
              </div>
            </Card>
          )}

          {/* Floating Action Button */}
          {isConnected && (
            <Button
              onClick={() => setShowCreatePostModal(true)}
              className={`fixed right-6 md:right-8 h-14 w-14 rounded-full shadow-[0_8px_32px_0_rgba(0,255,159,0.4)] hover:shadow-[0_12px_48px_0_rgba(0,255,159,0.6)] bg-gradient-to-br from-neon-green to-emerald-500 hover:from-neon-green/90 hover:to-emerald-500/90 z-40 hover:scale-110 active:scale-95 ${
                isMobileNavVisible ? 'bottom-24 md:bottom-8' : 'bottom-6 md:bottom-8'
              } transition-all duration-300`}
              size="icon"
            >
              <Plus className="h-6 w-6" />
            </Button>
          )}

          {/* Create Post Modal */}
          <CreatePostModal
            open={showCreatePostModal}
            onOpenChange={setShowCreatePostModal}
            hasXRGE={hasXRGE}
            playSong={playSong}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPostCreated={() => {
              loadPosts();
              loadSongs();
            }}
          />

          {/* Old Post Creator - REMOVED */}
          {false && isConnected && (
            <Card className="relative z-50 p-4 md:p-6 space-y-4 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,255,159,0.1)] hover:shadow-[0_12px_48px_0_rgba(0,255,159,0.2)] hover:border-neon-green/20 w-full md:max-w-2xl md:mx-auto mb-6 md:rounded-2xl rounded-none border-x-0 md:border-x transition-all duration-300">
              {!hasXRGE && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <Lock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-mono font-semibold text-yellow-400 mb-1">
                      XRGE Holder Required
                    </p>
                    <p className="text-xs font-mono text-yellow-400/80">
                      You need to hold XRGE tokens to post on GLTCH.{' '}
                      <button
                        onClick={() => navigate('/swap')}
                        className="underline hover:text-yellow-300 transition-colors"
                      >
                        Get XRGE →
                      </button>
                    </p>
                  </div>
                </div>
              )}
              
              <TagAutocomplete
                value={contentText}
                onChange={setContentText}
                placeholder="What's on your mind? Use $ to tag artists and songs..."
                className="min-h-[100px] resize-none w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasXRGE}
              />

              {mediaPreview && (
                <div className="relative">
                  <img src={mediaPreview} alt="Preview" className="max-h-64 rounded-lg mx-auto" />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}>
                    Remove
                  </Button>
                </div>
              )}

              {/* Song Selection - MANDATORY */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Music className="w-4 h-4 text-neon-green" />
                  Select a song for your post <span className="text-red-400">*</span>
                </label>
                {selectedSong ? (
                  <div className="flex items-center gap-2 p-3 bg-neon-green/10 border border-neon-green/20 rounded-lg">
                    {selectedSong.cover_cid && (
                      <img 
                        src={getIPFSGatewayUrl(selectedSong.cover_cid)} 
                        alt={selectedSong.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{selectedSong.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedSong.artist}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSong(null)}
                      disabled={!hasXRGE}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Popover open={songSearchOpen} onOpenChange={(open) => {
                    setSongSearchOpen(open);
                    if (open) {
                      loadAllSongsForSearch();
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={songSearchOpen}
                        className="w-full justify-between"
                        disabled={!hasXRGE}
                      >
                        <span className="text-muted-foreground">Search for a song...</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search songs..." 
                          value={songSearchQuery}
                          onValueChange={setSongSearchQuery}
                        />
                        <CommandList>
                          {loadingAllSongs ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                              Loading songs...
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>No songs found.</CommandEmpty>
                              <CommandGroup>
                                {(songSearchQuery ? allSongs : allSongs.slice(0, 20))
                                  .filter(song => 
                                    !songSearchQuery || 
                                    song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
                                    song.artist.toLowerCase().includes(songSearchQuery.toLowerCase())
                                  )
                                  .slice(0, 50)
                                  .map(song => {
                                    const isCurrentlyPlaying = currentSong?.id === song.id && isPlaying;
                                    return (
                                      <CommandItem
                                        key={song.id}
                                        value={`${song.title} ${song.artist}`.toLowerCase()}
                                        onSelect={() => {
                                          setSelectedSong(song);
                                          setSongSearchOpen(false);
                                          setSongSearchQuery('');
                                        }}
                                        className="flex items-center gap-2 group"
                                      >
                                        {song.cover_cid && (
                                          <img 
                                            src={getIPFSGatewayUrl(song.cover_cid)} 
                                            alt={song.title}
                                            className="w-8 h-8 rounded object-cover flex-shrink-0"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-sm truncate">{song.title}</p>
                                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (playSong) {
                                                playSong(song);
                                              }
                                            }}
                                            disabled={!playSong}
                                          >
                                            {isCurrentlyPlaying ? (
                                              <Pause className="h-3 w-3" />
                                            ) : (
                                              <Play className="h-3 w-3" />
                                            )}
                                          </Button>
                                          <Check className={selectedSong?.id === song.id ? "h-4 w-4" : "h-4 w-4 opacity-0"} />
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="flex gap-2">
                <Input type="file" accept="image/*" onChange={handleMediaChange} className="hidden" id="media-upload" disabled={!hasXRGE} />
                <label htmlFor="media-upload">
                  <Button variant="outline" size="sm" asChild disabled={!hasXRGE}>
                    <span className={hasXRGE ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Add Media
                    </span>
                  </Button>
                </label>

                <Button onClick={handlePost} disabled={posting || !selectedSong || !contentText && !mediaFile || !hasXRGE} className="ml-auto">
                  <Send className="w-4 h-4 mr-2" />
                  {posting ? 'Posting to IPFS...' : 'Post'}
                </Button>
              </div>
            </Card>
          )}

          {/* Feed with Tabs */}
          <Tabs defaultValue="songs" className="w-full md:max-w-2xl md:mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-4 md:mb-6 mx-auto max-w-xs md:max-w-full md:mx-0 bg-black/60 backdrop-blur-xl border border-neon-green/20 shadow-[0_0_20px_rgba(0,255,159,0.15)] p-1 rounded-lg">
              <TabsTrigger 
                value="songs"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-neon-green/20 data-[state=active]:to-emerald-500/20 data-[state=active]:text-neon-green data-[state=active]:shadow-[0_0_15px_rgba(0,255,159,0.5)] data-[state=active]:border data-[state=active]:border-neon-green/50 data-[state=inactive]:text-white/50 data-[state=inactive]:hover:text-white/80 transition-all duration-300 font-mono font-bold uppercase"
              >
                Songs
              </TabsTrigger>
              <TabsTrigger 
                value="posts" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-neon-green/20 data-[state=active]:to-emerald-500/20 data-[state=active]:shadow-[0_0_15px_rgba(0,255,159,0.5)] data-[state=active]:border data-[state=active]:border-neon-green/50 data-[state=inactive]:opacity-50 data-[state=inactive]:hover:opacity-80 transition-all duration-300"
              >
                <img src={gltchTabLogo} alt="GLTCH" className="h-6 w-auto" />
              </TabsTrigger>
            </TabsList>

            {/* Posts Tab */}
            <TabsContent value="posts" className="space-y-0 md:space-y-4">
              {loading ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <PostCardSkeleton key={`skeleton-post-${i}`} />
                  ))}
                </>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground px-4">
                  No posts yet. Be the first to post!
                </div>
              ) : (
                posts.map(post => (
                  <Card key={post.id} className="p-4 md:p-6 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,255,159,0.1)] hover:shadow-[0_12px_48px_0_rgba(0,255,159,0.2)] hover:border-neon-green/20 flex flex-col w-full md:rounded-2xl rounded-none border-x-0 md:border-x border-b md:border-b mb-0 md:mb-4 hover:bg-white/8 active:bg-white/10 active:scale-[0.98] transition-all duration-300 group">
                  {/* Post Header - Updated to hide wallet addresses */}
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="cursor-pointer hover:scale-110 transition-transform duration-200 relative group/avatar"
                      onClick={() => navigate(`/artist/${post.wallet_address}`)}
                    >
                      {post.profiles?.avatar_cid ? (
                        <div className="relative">
                          <img 
                            src={getIPFSGatewayUrl(post.profiles.avatar_cid)} 
                            alt="Avatar" 
                            loading="lazy" 
                            decoding="async" 
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-neon-green/20 group-hover/avatar:border-neon-green/60 transition-all duration-300" 
                          />
                          <div className="absolute inset-0 rounded-full bg-neon-green/0 group-hover/avatar:bg-neon-green/10 transition-colors duration-300" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center border-2 border-neon-green/20 group-hover/avatar:border-neon-green/60 transition-all duration-300">
                          <span className="text-neon-green text-sm md:text-base font-bold">
                            {post.profiles?.artist_name?.[0] || post.profiles?.display_name?.[0] || '?'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p 
                          className="font-semibold text-sm md:text-base cursor-pointer hover:text-neon-green transition-colors duration-200"
                          onClick={() => navigate(`/artist/${post.wallet_address}`)}
                        >
                          {(() => {
                            const name = post.profiles?.artist_name || post.profiles?.display_name;
                            // Filter out wallet addresses - they start with 0x and are 42 chars
                            const isValidName = name && !name.toLowerCase().startsWith('0x') && name.length < 42;
                            // Never show wallet address - always show Anonymous if no valid name
                            return isValidName ? name : 'Anonymous';
                          })()}
                        </p>
                        {post.profiles?.verified && (
                          <CircleCheckBig className="h-4 w-4 text-blue-500 flex-shrink-0 animate-pulse" aria-label="Verified artist" />
                        )}
                        <XRGETierBadge walletAddress={post.wallet_address} size="sm" />
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {formatTimeAgo(post.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Post Content Text - Shows for posts with text but not the styled version */}
                  {post.content_text && !(!post.media_cid && post.songs) && (
                    <div className="mb-4 text-sm md:text-base whitespace-pre-wrap line-clamp-6 text-foreground/90 leading-relaxed">
                      <TaggedText text={post.content_text} />
                    </div>
                  )}

                  {/* Post Media with Song Player Overlay */}
                  {post.media_cid && post.songs && (
                    <div 
                      className="mb-4 rounded-xl overflow-hidden relative group/media cursor-pointer"
                      onClick={() => {
                        if (playSong) {
                          playSong({
                            id: post.songs.id,
                            title: post.songs.title,
                            artist: post.songs.artist,
                            audio_cid: post.songs.audio_cid,
                            cover_cid: post.songs.cover_cid
                          });
                        }
                      }}
                    >
                      <div className="relative">
                        <img 
                          src={getIPFSGatewayUrl(post.media_cid)} 
                          alt="Post media" 
                          loading="lazy" 
                          decoding="async" 
                          className="w-full max-h-[600px] object-contain bg-gradient-to-br from-black/10 to-black/5 rounded-xl group-hover/media:scale-[1.02] transition-transform duration-500" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity duration-300" />
                      </div>
                      
                      {/* Small Play/Pause Indicator - Top Right */}
                      <div className="absolute top-3 right-3">
                        <div className="bg-black/70 backdrop-blur-md transition-all duration-300 p-2 rounded-full opacity-60 group-hover/media:opacity-100 border border-white/20 group-hover/media:border-neon-green/50 shadow-[0_0_15px_rgba(0,255,159,0.3)]">
                          {currentSong?.id === post.songs.id && isPlaying ? (
                            <Pause className="w-4 h-4 text-white" />
                          ) : (
                            <Play className="w-4 h-4 text-white ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Bottom Song Scroller */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/song/${post.songs.id}`);
                        }}
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 cursor-pointer hover:bg-black/98 transition-all duration-300 backdrop-blur-sm"
                      >
                        <div className="flex items-center gap-2">
                          {post.songs.cover_cid && (
                            <img 
                              src={getIPFSGatewayUrl(post.songs.cover_cid)} 
                              alt={post.songs.title}
                              className="w-10 h-10 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Music className="w-3 h-3 text-neon-green flex-shrink-0" />
                              <p className="font-semibold text-white text-sm truncate">
                                {post.songs.title}
                              </p>
                            </div>
                            <p className="text-xs text-gray-300 truncate">
                              {post.songs.artist}
                            </p>
                          </div>
                          {currentSong?.id === post.songs.id && isPlaying && (
                            <div className="flex gap-0.5 items-end h-4">
                              <div className="w-0.5 bg-neon-green animate-pulse" style={{ height: '60%' }}></div>
                              <div className="w-0.5 bg-neon-green animate-pulse" style={{ height: '100%', animationDelay: '0.2s' }}></div>
                              <div className="w-0.5 bg-neon-green animate-pulse" style={{ height: '80%', animationDelay: '0.4s' }}></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Post Media without Song */}
                  {post.media_cid && !post.songs && (
                    <div className="mb-4 rounded-xl overflow-hidden relative">
                      <img 
                        src={getIPFSGatewayUrl(post.media_cid)} 
                        alt="Post media" 
                        loading="lazy" 
                        decoding="async" 
                        className="w-full max-h-[600px] object-contain bg-gradient-to-br from-black/10 to-black/5 rounded-xl" 
                      />
                    </div>
                  )}

                  {/* Text Post with Song - Cyberpunk Glass Effect */}
                  {!post.media_cid && post.content_text && post.songs && (() => {
                    const colors = getPostItColors(post.id);
                    return (
                      <div 
                        className={`mb-4 rounded-xl overflow-hidden relative group/media min-h-[300px] flex items-center justify-center bg-gradient-to-br ${colors.bg} cursor-pointer`}
                        onClick={() => {
                          if (playSong) {
                            playSong({
                              id: post.songs.id,
                              title: post.songs.title,
                              artist: post.songs.artist,
                              audio_cid: post.songs.audio_cid,
                              cover_cid: post.songs.cover_cid
                            });
                          }
                        }}
                      >
                        {/* Cyberpunk Glass Panel */}
                        <div className={`absolute inset-0 ${colors.glass} border-2 ${colors.circuit} ${colors.glow}`}>
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
                      <div className="relative z-10 p-6 md:p-8 w-full">
                        <div className={`text-base md:text-lg whitespace-pre-wrap leading-relaxed font-mono font-semibold ${colors.text} drop-shadow-[0_0_10px_currentColor]`}>
                          <TaggedText text={post.content_text} />
                        </div>
                      </div>

                      {/* Small Play/Pause Indicator - Top Right */}
                      <div className="absolute top-3 right-3 z-20">
                        <div className="bg-black/70 backdrop-blur-md transition-all duration-300 p-2 rounded-full opacity-60 group-hover/media:opacity-100 border border-white/20 group-hover/media:border-neon-green/50 shadow-[0_0_15px_rgba(0,255,159,0.3)]">
                          {currentSong?.id === post.songs.id && isPlaying ? (
                            <Pause className="w-4 h-4 text-white" />
                          ) : (
                            <Play className="w-4 h-4 text-white ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Bottom Song Scroller - Same as Image Posts */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/song/${post.songs.id}`);
                        }}
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 cursor-pointer hover:bg-black/98 transition-all duration-300 backdrop-blur-sm z-20"
                      >
                        <div className="flex items-center gap-2">
                          {post.songs.cover_cid && (
                            <img 
                              src={getIPFSGatewayUrl(post.songs.cover_cid)} 
                              alt={post.songs.title}
                              className="w-10 h-10 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Music className="w-3 h-3 text-neon-green flex-shrink-0" />
                              <p className="font-semibold text-white text-sm truncate">
                                {post.songs.title}
                              </p>
                            </div>
                            <p className="text-xs text-gray-300 truncate">
                              {post.songs.artist}
                            </p>
                          </div>
                          {currentSong?.id === post.songs.id && isPlaying && (
                            <div className="flex gap-0.5 items-end h-4">
                              <div className="w-0.5 bg-neon-green animate-pulse" style={{ height: '60%' }}></div>
                              <div className="w-0.5 bg-neon-green animate-pulse" style={{ height: '100%', animationDelay: '0.2s' }}></div>
                              <div className="w-0.5 bg-neon-green animate-pulse" style={{ height: '80%', animationDelay: '0.4s' }}></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })()}

                  {/* Text Only Post (No Song) */}
                  {!post.media_cid && !post.songs && post.content_text && (
                    <div className="mb-4 text-sm md:text-base whitespace-pre-wrap line-clamp-6 text-foreground/90 leading-relaxed">
                      <TaggedText text={post.content_text} />
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center gap-4 pt-3 mt-auto border-t border-border">
                    <LikeButton songId={post.id} initialLikeCount={post.like_count} size="sm" showCount={true} entityType="post" />

                    <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
                      <MessageCircle className="w-4 h-4" />
                      <span>{comments[post.id]?.length || post.comment_count || 0}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSharePost(post)}
                        title="Share"
                      >
                        {copiedPostId === post.id ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Comments Section */}
                  {expandedComments.has(post.id) && (
                    <div className="pt-4 mt-4 border-t border-border space-y-4">
                      {/* Add Comment */}
                      {isConnected && (
                        <div className="flex gap-2">
                          <Input placeholder="Add a comment..." value={commentText[post.id] || ''} onChange={e => setCommentText(prev => ({
                  ...prev,
                  [post.id]: e.target.value
                }))} onKeyPress={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment(post.id);
                  }
                }} className="flex-1 text-base" />
                          <Button size="sm" onClick={() => handleAddComment(post.id)} disabled={!commentText[post.id]?.trim()}>
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      {/* Comments List */}
                      <div className="space-y-3">
                        {comments[post.id]?.map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <div 
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => navigate(`/artist/${comment.wallet_address}`)}
                            >
                              {comment.profiles?.avatar_cid ? <img src={getIPFSGatewayUrl(comment.profiles.avatar_cid)} alt="Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-primary text-xs">
                                    {comment.profiles?.artist_name?.[0] || '?'}
                                  </span>
                                </div>}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <p 
                                  className="text-sm font-semibold cursor-pointer hover:text-neon-green transition-colors"
                                  onClick={() => navigate(`/artist/${comment.wallet_address}`)}
                                >
                                  {(() => {
                                    const name = comment.profiles?.artist_name || comment.profiles?.display_name;
                                    // Filter out wallet addresses - they start with 0x and are 42 chars
                                    const isValidName = name && !name.toLowerCase().startsWith('0x') && name.length < 42;
                                    // Never show wallet address - always show Anonymous if no valid name
                                    return isValidName ? name : 'Anonymous';
                                  })()}
                                </p>
                                {comment.profiles?.verified && (
                                  <CircleCheckBig className="h-3 w-3 text-blue-500 flex-shrink-0" aria-label="Verified artist" />
                                )}
                                <XRGETierBadge walletAddress={comment.wallet_address} size="sm" />
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <TaggedText text={comment.comment_text} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimeAgo(comment.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )))}
              {/* Load More Posts Button */}
              {!loading && posts.length > 0 && hasMorePosts && (
                <div className="flex justify-center py-4 px-4 md:px-0 md:pt-4">
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      loadPosts(true);
                    }}
                    type="button"
                    disabled={loadingMorePosts}
                    variant="outline"
                    size="lg"
                    className="w-full md:max-w-md"
                  >
                    {loadingMorePosts ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Songs Tab */}
            <TabsContent value="songs" className="space-y-0 md:space-y-4">
              {/* AI Filter Controls */}
              <div className="mb-4 md:mb-6 flex flex-wrap gap-3 md:gap-4 px-4 md:px-0">
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
                  <span className={`font-mono text-xs uppercase tracking-wider transition-colors ${
                    aiFilter === 'all' ? 'text-neon-green' : 'text-white/50 group-hover:text-white/70'
                  }`}>
                    ALL
                  </span>
                  <input
                    type="radio"
                    name="aiFilter"
                    checked={aiFilter === 'all'}
                    onChange={() => {
                      setAiFilter('all');
                      localStorage.setItem('audioPlayer_aiFilter', 'all');
                    }}
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
                  <span className={`font-mono text-xs uppercase tracking-wider transition-colors ${
                    aiFilter === 'partial' ? 'text-neon-green' : 'text-white/50 group-hover:text-white/70'
                  }`}>
                    PARTIAL AI
                  </span>
                  <input
                    type="radio"
                    name="aiFilter"
                    checked={aiFilter === 'partial'}
                    onChange={() => {
                      setAiFilter('partial');
                      localStorage.setItem('audioPlayer_aiFilter', 'partial');
                    }}
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
                  <span className={`font-mono text-xs uppercase tracking-wider transition-colors ${
                    aiFilter === 'no-ai' ? 'text-neon-green' : 'text-white/50 group-hover:text-white/70'
                  }`}>
                    NO AI
                  </span>
                  <input
                    type="radio"
                    name="aiFilter"
                    checked={aiFilter === 'no-ai'}
                    onChange={() => {
                      setAiFilter('no-ai');
                      localStorage.setItem('audioPlayer_aiFilter', 'no-ai');
                    }}
                    className="sr-only"
                  />
                </label>
              </div>

              {loadingSongs ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <SongCardFeedSkeleton key={`skeleton-song-feed-${i}`} />
                  ))}
                </>
              ) : (() => {
        // Filter songs based on AI filter
        const filteredSongs = songs.filter(song => {
          if (aiFilter === 'all') return true;
          if (aiFilter === 'no-ai') return song.ai_usage === 'none' || !song.ai_usage;
          if (aiFilter === 'partial') {
            return song.ai_usage === 'partial';
          }
          return true;
        });

                return filteredSongs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground px-4">
                    No songs match the selected filter.
                  </div>
                ) : (
                  filteredSongs.map(song => <SongCard key={song.id} song={song} />)
                );
              })()}

              {/* Load More Songs Button */}
              {!loadingSongs && songs.length > 0 && hasMoreSongs && (
                <div className="flex justify-center py-4 px-4 md:px-0 md:pt-4">
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      loadSongs(true);
                    }}
                    type="button"
                    disabled={loadingMoreSongs}
                    variant="outline"
                    size="lg"
                    className="w-full md:max-w-md"
                  >
                    {loadingMoreSongs ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>;
}