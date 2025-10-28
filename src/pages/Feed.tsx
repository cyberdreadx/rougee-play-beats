import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageCircle, Share2, Image as ImageIcon, Send, CheckCircle, Check, CircleCheckBig, Music, Loader2, Play, Pause, Lock, ChevronsUpDown, X } from 'lucide-react';
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
import { useSongPrice } from '@/hooks/useSongBondingCurve';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { AudioWaveform } from '@/components/AudioWaveform';
import { useAudioStateForSong } from '@/hooks/useAudioState';

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
    avatar_cid: string | null;
    verified: boolean | null;
  };
}

interface FeedProps {
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
}

export default function Feed({ playSong, currentSong, isPlaying }: FeedProps = {}) {
  const navigate = useNavigate();
  const {
    fullAddress,
    isConnected
  } = useWallet();
  const { getAccessToken } = usePrivy();
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
      let profilesData: { wallet_address: string; artist_name: string | null; avatar_cid: string | null; verified: boolean | null }[] = [];
      if (walletAddresses.length) {
        const orFilter = walletAddresses.map((a) => `wallet_address.ilike.${a}`).join(',');
        const { data } = await supabase
          .from('profiles')
          .select('wallet_address, artist_name, avatar_cid, verified')
          .or(orFilter);
        profilesData = data || [];
      }
      
      console.log('Profiles data:', profilesData);

      // Merge data (normalize addresses to lowercase)
      const postsWithProfiles = postsData?.map(post => ({
        ...post,
        profiles: profilesData?.find(p => p.wallet_address?.toLowerCase() === post.wallet_address?.toLowerCase()) || null
      })) || [];

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
          .select('wallet_address, artist_name, avatar_cid, verified')
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

  const toggleSongComments = (songId: string) => {
    const isExpanded = expandedSongComments.has(songId);
    if (isExpanded) {
      setExpandedSongComments(prev => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
    } else {
      setExpandedSongComments(prev => new Set(prev).add(songId));
    }
  };
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
          .select('wallet_address, artist_name, avatar_cid, verified')
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
    const url = `https://rougee.app/feed#post-${post.id}`;
    const text = post.content_text ? post.content_text.slice(0, 140) : 'Check out this post on ROUGEE PLAY';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ROUGEE PLAY', text, url });
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
      <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,255,159,0.1)] w-full md:rounded-2xl rounded-none border-x-0 md:border-x border-b md:border-b mb-0 md:mb-4 hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300">
        {/* Song Post Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Artist Avatar */}
          <div 
            className="flex-shrink-0 cursor-pointer"
            onClick={() => navigate(`/artist/${song.wallet_address}`)}
          >
            {song.profiles?.avatar_cid ? (
              <img
                src={getIPFSGatewayUrl(song.profiles.avatar_cid)}
                alt="Avatar"
                loading="lazy"
                decoding="async"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary text-sm">
                  {song.profiles?.artist_name?.[0] || '?'}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Artist Name and Action */}
            <div className="flex items-center gap-1.5 mb-1">
              <p 
                className="font-semibold text-sm cursor-pointer hover:text-neon-green transition-colors"
                onClick={() => navigate(`/artist/${song.wallet_address}`)}
              >
                {song.profiles?.artist_name || `${song.wallet_address.slice(0, 6)}...${song.wallet_address.slice(-4)}`}
              </p>
              {song.profiles?.verified && (
                <CircleCheckBig className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" aria-label="Verified artist" />
              )}
              <XRGETierBadge walletAddress={song.wallet_address} size="sm" />
              <span className="text-xs text-muted-foreground">posted a track</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatTimeAgo(song.created_at)}
            </p>
          </div>
        </div>

        {/* Song Content */}
        <div className="flex gap-3 mb-3">
          {/* Album Cover with Play Button */}
          <div className="relative group flex-shrink-0">
            {song.cover_cid ? (
              <img
                src={getIPFSGatewayUrl(song.cover_cid)}
                alt={song.title}
                loading="lazy"
                decoding="async"
                className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => song.token_address ? navigate(`/song/${song.id}`) : null}
              />
            ) : (
              <div 
                className="w-20 h-20 rounded-lg bg-primary/20 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => song.token_address ? navigate(`/song/${song.id}`) : null}
              >
                <Music className="w-8 h-8 text-primary" />
              </div>
            )}
            
            {/* Play Button Overlay */}
            {playSong && song.audio_cid && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playSong(song);
                }}
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-neon-green hover:bg-neon-green/80 active:bg-neon-green/70 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg shadow-neon-green/50 z-10"
              >
                {currentSong?.id === song.id && isPlaying ? (
                  <Pause className="w-4 h-4 text-black fill-black" />
                ) : (
                  <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                )}
              </button>
            )}
          </div>

          {/* Song Info */}
          <div 
            className="flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => song.token_address ? navigate(`/song/${song.id}`) : null}
          >
            <h3 className="font-bold text-base mb-1 truncate flex items-center gap-2">
              <span className="truncate">{song.title}</span>
              <AiBadge aiUsage={song.ai_usage} size="sm" />
            </h3>
            <p className="text-sm text-muted-foreground mb-1">
              {song.artist}
            </p>
            {song.ticker && (
              <p className="text-xs text-neon-green font-mono mb-1">
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
        <div className="flex items-center gap-4 pt-3 border-t border-border">
          <LikeButton 
            songId={song.id} 
            size="sm" 
            showCount={true} 
          />

          <button 
            onClick={() => toggleSongComments(song.id)} 
            className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{songCommentCounts[song.id] || 0}</span>
          </button>

          {song.token_address && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/song/${song.id}`)}
              className="ml-auto"
            >
              Trade
            </Button>
          )}
        </div>

        {/* Comments Section */}
        {expandedSongComments.has(song.id) && (
          <div className="mt-4 pt-4 border-t border-primary/10">
            <SongComments 
              songId={song.id} 
              onCommentCountChange={(count) => {
                setSongCommentCounts(prev => ({ ...prev, [song.id]: count }));
              }}
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
          <div className="text-center mb-8 md:mb-12 px-4 pt-0 pb-8 md:pb-12">
            <div className="flex justify-center items-center mb-6">
              <img 
                src={gltchLogo} 
                alt="GLTCH" 
                className="h-32 md:h-48 w-auto drop-shadow-[0_0_40px_rgba(0,255,159,0.8)] hover:drop-shadow-[0_0_60px_rgba(0,255,159,1)] transition-all duration-300 hover:scale-105"
              />
            </div>
            <p className="text-base md:text-lg text-muted-foreground font-mono tracking-wide">
              Decentralized social feed on IPFS
            </p>
          </div>

          {/* Post Creator */}
          {isConnected && <Card className="relative z-50 p-4 md:p-6 space-y-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,255,159,0.1)] w-full md:max-w-2xl md:mx-auto mb-6 md:rounded-2xl rounded-none border-x-0 md:border-x">
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

              {mediaPreview && <div className="relative">
                  <img src={mediaPreview} alt="Preview" className="max-h-64 rounded-lg mx-auto" />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => {
              setMediaFile(null);
              setMediaPreview(null);
            }}>
                    Remove
                  </Button>
                </div>}

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
                                  .map(song => (
                                    <CommandItem
                                      key={song.id}
                                      value={`${song.title} ${song.artist}`.toLowerCase()}
                                      onSelect={() => {
                                        setSelectedSong(song);
                                        setSongSearchOpen(false);
                                        setSongSearchQuery('');
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      {song.cover_cid && (
                                        <img 
                                          src={getIPFSGatewayUrl(song.cover_cid)} 
                                          alt={song.title}
                                          className="w-8 h-8 rounded object-cover"
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{song.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                                      </div>
                                      <Check className={selectedSong?.id === song.id ? "h-4 w-4" : "h-4 w-4 opacity-0"} />
                                    </CommandItem>
                                  ))}
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
            </Card>}

          {/* Feed with Tabs */}
          <Tabs defaultValue="songs" className="w-full md:max-w-2xl md:mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-4 md:mb-6 mx-auto max-w-xs md:max-w-full md:mx-0 md:rounded-lg rounded-md">
              <TabsTrigger value="songs">Songs</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
            </TabsList>

            {/* Posts Tab */}
            <TabsContent value="posts" className="space-y-0 md:space-y-4">
              {loading ? <div className="text-center py-8 text-muted-foreground px-4">Loading feed...</div> : posts.length === 0 ? <div className="text-center py-8 text-muted-foreground px-4">
                  No posts yet. Be the first to post!
                </div> : posts.map(post => <Card key={post.id} className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,255,159,0.1)] flex flex-col w-full md:rounded-2xl rounded-none border-x-0 md:border-x border-b md:border-b mb-0 md:mb-4 hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300">
                  {/* Post Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/artist/${post.wallet_address}`)}
                    >
                      {post.profiles?.avatar_cid ? <img src={getIPFSGatewayUrl(post.profiles.avatar_cid)} alt="Avatar" loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary text-xs">
                            {post.profiles?.artist_name?.[0] || '?'}
                          </span>
                        </div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p 
                          className="font-semibold text-sm cursor-pointer hover:text-neon-green transition-colors"
                          onClick={() => navigate(`/artist/${post.wallet_address}`)}
                        >
                          {post.profiles?.artist_name || `${post.wallet_address.slice(0, 6)}...${post.wallet_address.slice(-4)}`}
                        </p>
                        {post.profiles?.verified && (
                          <CircleCheckBig className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" aria-label="Verified artist" />
                        )}
                        <XRGETierBadge walletAddress={post.wallet_address} size="sm" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(post.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Post Content */}
                  {post.content_text && (
                    <div className="mb-3 text-sm whitespace-pre-wrap line-clamp-6">
                      <TaggedText text={post.content_text} />
                    </div>
                  )}

                  {/* Post Media with Song Player Overlay */}
                  {post.media_cid && post.songs && (
                    <div className="mb-3 rounded-lg overflow-hidden relative group">
                      <img 
                        src={getIPFSGatewayUrl(post.media_cid)} 
                        alt="Post media" 
                        loading="lazy" 
                        decoding="async" 
                        className="w-full max-h-[600px] object-contain bg-black/5 rounded-lg" 
                      />
                      
                      {/* Opaque Play/Pause Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <button
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
                          className="pointer-events-auto bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-all p-6 rounded-full opacity-0 group-hover:opacity-100"
                        >
                          {currentSong?.id === post.songs.id && isPlaying ? (
                            <Pause className="w-12 h-12 text-white" />
                          ) : (
                            <Play className="w-12 h-12 text-white" />
                          )}
                        </button>
                      </div>

                      {/* Bottom Song Scroller */}
                      <div 
                        onClick={() => navigate(`/song/${post.songs.id}`)}
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3 cursor-pointer hover:bg-black/95 transition-all"
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

                  {/* Song Player Card for Text-Only Posts */}
                  {!post.media_cid && post.songs && (
                    <div 
                      className="mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-neon-green/5 to-purple-500/5 border border-neon-green/10 p-4 cursor-pointer hover:border-neon-green/30 transition-all group"
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
                      <div className="flex items-center gap-3">
                        {/* Song Cover */}
                        {post.songs.cover_cid && (
                          <div className="relative flex-shrink-0">
                            <img 
                              src={getIPFSGatewayUrl(post.songs.cover_cid)} 
                              alt={post.songs.title}
                              className="w-16 h-16 rounded object-cover"
                            />
                            {/* Play/Pause Overlay on Cover */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-all rounded">
                              {currentSong?.id === post.songs.id && isPlaying ? (
                                <Pause className="w-8 h-8 text-white" />
                              ) : (
                                <Play className="w-8 h-8 text-white" />
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Song Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Music className="w-4 h-4 text-neon-green flex-shrink-0" />
                            <p className="font-semibold text-base truncate">
                              {post.songs.title}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {post.songs.artist}
                          </p>
                          <p className="text-xs text-neon-green/70 mt-1">
                            {currentSong?.id === post.songs.id && isPlaying ? 'Now Playing' : 'Click to play'}
                          </p>
                        </div>

                        {/* Playing Animation */}
                        {currentSong?.id === post.songs.id && isPlaying && (
                          <div className="flex gap-0.5 items-end h-6 flex-shrink-0">
                            <div className="w-1 bg-neon-green animate-pulse rounded-full" style={{ height: '60%' }}></div>
                            <div className="w-1 bg-neon-green animate-pulse rounded-full" style={{ height: '100%', animationDelay: '0.2s' }}></div>
                            <div className="w-1 bg-neon-green animate-pulse rounded-full" style={{ height: '80%', animationDelay: '0.4s' }}></div>
                          </div>
                        )}
                      </div>
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
                  {expandedComments.has(post.id) && <div className="pt-4 mt-4 border-t border-border space-y-4">
                      {/* Add Comment */}
                      {isConnected && <div className="flex gap-2">
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
                        </div>}

                      {/* Comments List */}
                      <div className="space-y-3">
                        {comments[post.id]?.map(comment => <div key={comment.id} className="flex gap-3">
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
                                  {comment.profiles?.artist_name || `${comment.wallet_address.slice(0, 6)}...${comment.wallet_address.slice(-4)}`}
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
                      </div>)}
                  </div>
                </div>}
            </Card>)}

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
              {loadingSongs ? (
                <div className="text-center py-8 text-muted-foreground px-4">Loading songs...</div>
              ) : songs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground px-4">
                  No songs uploaded yet.
                </div>
              ) : (
                songs.map(song => <SongCard key={song.id} song={song} />)
              )}

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