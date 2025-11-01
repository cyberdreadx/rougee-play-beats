import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import NetworkInfo from "@/components/NetworkInfo";
import { useArtistProfile } from "@/hooks/useArtistProfile";
import { useWallet } from "@/hooks/useWallet";
import StoriesBar from "@/components/StoriesBar";
import LikeButton from "@/components/LikeButton";
import { ReportButton } from "@/components/ReportButton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, Edit, Music, Play, Pause, Calendar, Instagram, Globe, Users, Wallet, MessageSquare, Send, CheckCircle, Upload, CircleCheckBig } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { HoldersModal } from "@/components/HoldersModal";
import { XRGETierBadge } from "@/components/XRGETierBadge";
import { AiBadge } from "@/components/AiBadge";
import { SongComments } from "@/components/SongComments";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSongPrice } from "@/hooks/useSongBondingCurve";
import { AudioWaveform } from "@/components/AudioWaveform";
import { useAudioStateForSong } from "@/hooks/useAudioState";
import { TipButton } from "@/components/TipButton";

interface Song {
  id: string;
  title: string;
  artist: string;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  token_address?: string | null;
  play_count: number;
  created_at: string;
  ticker?: string | null;
  ai_usage?: 'none' | 'partial' | 'full' | null;
}

interface FeedPost {
  id: string;
  content_text: string | null;
  media_cid: string | null;
  media_type: string | null;
  wallet_address: string;
  created_at: string;
  like_count: number;
  comment_count: number;
}

interface FeedComment {
  id: string;
  wallet_address: string;
  comment_text: string;
  created_at: string;
  profiles?: {
    artist_name: string | null;
    avatar_cid: string | null;
  };
}

interface ArtistProps {
  playSong: (song: Song) => void;
  currentSong: Song | null;
  isPlaying: boolean;
}

// Song Card Component with Price
// Waveform component for artist page
const ArtistWaveform = ({ songId, audioCid }: { songId: string; audioCid: string }) => {
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

const ArtistSongCard = ({ song, coverUrl, isThisSongPlaying, navigate, playSong, toggleSongComments, expandedSongComments }: {
  song: Song;
  coverUrl: string | null;
  isThisSongPlaying: boolean;
  navigate: any;
  playSong: (song: Song) => void;
  toggleSongComments: (id: string) => void;
  expandedSongComments: Set<string>;
}) => {
  const { prices } = useTokenPrices();
  const { price: priceInXRGENumber } = useSongPrice(song.token_address as Address);
  const priceInXRGE = priceInXRGENumber !== null ? Number(priceInXRGENumber) : 0;
  const priceUSD = priceInXRGE * (prices.xrge || 0);

  return (
    <Card
      className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] p-4 md:p-6 hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300 group rounded-2xl cursor-pointer"
      onClick={() => navigate(`/song/${song.id}`)}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Album Artwork with Play Button */}
        <div className="relative flex-shrink-0 mx-auto md:mx-0">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden bg-black/30">
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt={song.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="h-8 w-8 md:h-10 md:w-10 text-neon-green" />
              </div>
            )}
          </div>
          {/* Play Button */}
          <button
            className="absolute bottom-1 right-1 w-8 h-8 md:w-10 md:h-10 rounded-full bg-neon-green hover:bg-neon-green/80 active:bg-neon-green/70 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
            onClick={(e) => { 
              e.stopPropagation(); 
              playSong(song); 
            }}
            aria-label="Play"
          >
            {isThisSongPlaying ? (
              <Pause className="h-4 w-4 md:h-5 md:w-5 text-black fill-black" />
            ) : (
              <Play className="h-4 w-4 md:h-5 md:w-5 text-black fill-black ml-0.5" />
            )}
          </button>
        </div>
        
        {/* Song Info */}
        <div className="flex-1 min-w-0 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
            <h3 className="font-mono font-bold text-base md:text-lg truncate group-hover:text-neon-green transition-colors">
              {song.title}
            </h3>
            <div className="flex items-center justify-center md:justify-start gap-2">
              {song.ticker && (
                <span className="text-neon-green text-xs md:text-sm font-mono flex-shrink-0">${song.ticker}</span>
              )}
              <AiBadge aiUsage={song.ai_usage} size="sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs md:text-sm font-mono text-muted-foreground">
              {song.play_count} plays • uploaded {new Date(song.created_at).toLocaleDateString()}
            </p>
            {song.token_address && priceUSD > 0 && (
              <p className="text-xs md:text-sm font-mono text-neon-green font-bold">
                ${priceUSD < 0.000001 ? priceUSD.toFixed(10) : priceUSD < 0.01 ? priceUSD.toFixed(8) : priceUSD.toFixed(6)}
              </p>
            )}
          </div>
        </div>

        {/* Audio Waveform */}
        {song.audio_cid && (
          <div className="w-full mb-3">
            <ArtistWaveform songId={song.id} audioCid={song.audio_cid} />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 flex-shrink-0">
          <LikeButton songId={song.id} size="sm" showCount={true} />
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleSongComments(song.id);
            }}
            className="gap-1"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <ReportButton songId={song.id} />
        </div>
      </div>

      {/* Comments Section */}
      {expandedSongComments.has(song.id) && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <SongComments songId={song.id} />
        </div>
      )}
    </Card>
  );
};

const Artist = ({ playSong, currentSong, isPlaying }: ArtistProps) => {
  const { walletAddress } = useParams<{ walletAddress: string }>();
  const navigate = useNavigate();
  const { fullAddress } = useWallet();
  const { profile, loading, error } = useArtistProfile(walletAddress || null);
  const publicClient = usePublicClient();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [songsPage, setSongsPage] = useState(1);
  const [hasMoreSongs, setHasMoreSongs] = useState(true);
  const [totalSongsCount, setTotalSongsCount] = useState(0);
  const SONGS_PER_PAGE = 12;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [holdersCount, setHoldersCount] = useState<number>(0);
  const [holdingsCount, setHoldingsCount] = useState<number>(0);
  const [holderWallets, setHolderWallets] = useState<string[]>([]);
  const [holdingWallets, setHoldingWallets] = useState<string[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [expandedSongComments, setExpandedSongComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [showHoldersModal, setShowHoldersModal] = useState(false);
  const [showHoldingsModal, setShowHoldingsModal] = useState(false);

  const isOwnProfile = fullAddress?.toLowerCase() === walletAddress?.toLowerCase();

  const fetchArtistSongs = async (loadMore = false) => {
    if (!walletAddress) return;
      try {
        setLoadingSongs(true);
        const page = loadMore ? songsPage + 1 : 1;
        const from = (page - 1) * SONGS_PER_PAGE;
        const to = from + SONGS_PER_PAGE - 1;
        const { data, error, count } = await supabase
          .from("songs")
          .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, created_at, ai_usage", { count: 'exact' })
          .ilike("wallet_address", walletAddress)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) throw error;
        setTotalSongsCount(count || 0);
        if (loadMore) {
          setSongs(prev => [...prev, ...(data || [])]);
          setSongsPage(page);
        } else {
          setSongs(data || []);
          setSongsPage(1);
        }
        setHasMoreSongs((data?.length || 0) === SONGS_PER_PAGE && (songs.length + (data?.length || 0)) < (count || 0));
      } catch (err) {
        console.error("Error fetching artist songs:", err);
        toast({ title: "Error loading songs", description: "Failed to load artist's music", variant: "destructive" });
      } finally {
        setLoadingSongs(false);
      }
    };

    // Toggle song comments (used in music tab)
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

    // Toggle post comments (used in posts tab)
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

  // Fetch artist songs on mount
  useEffect(() => {
    fetchArtistSongs();
  }, [walletAddress]);

  // Fetch artist posts (same approach as Feed page)
  useEffect(() => {
    const fetchArtistPosts = async () => {
      if (!walletAddress) return;
      try {
        setLoadingPosts(true);
        
        // Fetch posts with song data (same as Feed page)
        const { data: postsData, error } = await supabase
          .from("feed_posts")
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
          .ilike("wallet_address", walletAddress)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Fetch profile data (same as Feed page)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('wallet_address, artist_name, avatar_cid, verified')
          .ilike('wallet_address', walletAddress)
          .maybeSingle();

        // Merge data (same as Feed page)
        const postsWithProfiles = postsData?.map(post => ({
          ...post,
          profiles: profileData || null
        })) || [];

        setPosts(postsWithProfiles);
      } catch (err) {
        console.error("Error fetching artist posts:", err);
      } finally {
        setLoadingPosts(false);
      }
    };
    fetchArtistPosts();
  }, [walletAddress, refreshKey]);

  // Fetch holders and holdings from blockchain
  useEffect(() => {
    const fetchBlockchainStats = async () => {
      if (!walletAddress || !publicClient) return;

      try {
        setLoadingStats(true);
        
        // Get all artist's songs with token addresses
        const { data: artistSongs, error: songsError } = await supabase
          .from("songs")
          .select("id, token_address, created_at")
          .ilike("wallet_address", walletAddress)
          .not('token_address', 'is', null);

        if (songsError) throw songsError;

        if (!artistSongs || artistSongs.length === 0) {
          setHoldersCount(0);
          setHoldingsCount(0);
          setLoadingStats(false);
          return;
        }

        // ERC20 Transfer event ABI
        const ERC20_TRANSFER_ABI = [
          {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { name: 'from', type: 'address', indexed: true },
              { name: 'to', type: 'address', indexed: true },
              { name: 'value', type: 'uint256', indexed: false }
            ]
          }
        ] as const;

        const allHolders = new Set<string>();
        const currentBlock = await publicClient.getBlockNumber();

        // Fetch holders for each of this artist's song tokens
        for (const song of artistSongs) {
          if (!song.token_address) continue;

          try {
            const blocksSinceCreation = song.created_at 
              ? Math.min(Math.floor((Date.now() - new Date(song.created_at).getTime()) / 2000), 100000)
              : 50000;
            
            const fromBlock = currentBlock - BigInt(blocksSinceCreation);

            const logs = await publicClient.getLogs({
              address: song.token_address as Address,
              event: ERC20_TRANSFER_ABI[0],
              fromBlock,
              toBlock: 'latest'
            });

            const holderBalances: Record<string, bigint> = {};
            
            for (const log of logs) {
              const { args } = log as any;
              const from = args.from?.toLowerCase();
              const to = args.to?.toLowerCase();
              const value = BigInt(args.value || 0);
              
              const zeroAddress = '0x0000000000000000000000000000000000000000';
              
              if (from && from !== zeroAddress) {
                holderBalances[from] = (holderBalances[from] || BigInt(0)) - value;
              }
              
              if (to && to !== zeroAddress) {
                holderBalances[to] = (holderBalances[to] || BigInt(0)) + value;
              }
            }

            Object.entries(holderBalances).forEach(([address, balance]) => {
              if (balance > BigInt(0)) {
                allHolders.add(address.toLowerCase());
              }
            });
          } catch (tokenError) {
            console.error(`Error fetching holders for token ${song.token_address}:`, tokenError);
          }
        }

        setHoldersCount(allHolders.size);
        setHolderWallets(Array.from(allHolders));

        // Now fetch holdings (what this wallet holds)
        try {
          const { data: allSongs, error: allSongsError } = await supabase
            .from("songs")
            .select("id, title, artist, token_address, wallet_address")
            .not('token_address', 'is', null);

          if (allSongsError) throw allSongsError;

          const holdingsSet = new Set<string>();
          const holdingsData: Array<{type: 'artist' | 'song', id: string, name: string, wallet_address: string}> = [];

          for (const song of (allSongs || [])) {
            if (!song.token_address) continue;

            try {
              // Check balance of this wallet for this token
              const balance = await publicClient.readContract({
                address: song.token_address as Address,
                abi: [{
                  name: 'balanceOf',
                  type: 'function',
                  stateMutability: 'view',
                  inputs: [{ name: 'account', type: 'address' }],
                  outputs: [{ name: 'balance', type: 'uint256' }]
                }],
                functionName: 'balanceOf',
                args: [walletAddress as Address]
              } as any);

              if (balance && BigInt(balance as any) > BigInt(0)) {
                // Add artist to holdings
                holdingsSet.add(song.wallet_address.toLowerCase());
                holdingsData.push({
                  type: 'artist',
                  id: song.wallet_address,
                  name: song.artist,
                  wallet_address: song.wallet_address
                });
                
                // Add song to holdings
                holdingsSet.add(`song_${song.id}`);
                holdingsData.push({
                  type: 'song',
                  id: song.id,
                  name: song.title,
                  wallet_address: song.wallet_address
                });
              }
            } catch (balanceError) {
              console.error(`Error checking balance for ${song.token_address}:`, balanceError);
            }
          }

          setHoldingsCount(holdingsSet.size);
          setHoldingWallets(Array.from(holdingsSet));
        } catch (holdingsError) {
          console.error('Error fetching holdings:', holdingsError);
          setHoldingsCount(0);
        }

      } catch (err) {
        console.error("Error fetching blockchain stats:", err);
        setHoldersCount(0);
        setHoldingsCount(0);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchBlockchainStats();
  }, [walletAddress, publicClient]);

  const loadComments = async (postId: string) => {
    try {
      const { data: commentsData, error } = await supabase
        .from('feed_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const walletAddresses = [...new Set(commentsData?.map(c => c.wallet_address) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('wallet_address, artist_name, avatar_cid')
        .in('wallet_address', walletAddresses);

      const commentsWithProfiles = commentsData?.map(comment => ({
        ...comment,
        profiles: profilesData?.find(p => p.wallet_address?.toLowerCase() === comment.wallet_address?.toLowerCase()) || null,
      })) || [];

      setComments(prev => ({ ...prev, [postId]: commentsWithProfiles as FeedComment[] }));
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!fullAddress) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to comment',
        variant: 'destructive',
      });
      return;
    }

    const text = commentText[postId]?.trim();
    if (!text) return;

    try {
      const { error } = await supabase
        .from('feed_comments')
        .insert({
          post_id: postId,
          wallet_address: fullAddress,
          comment_text: text,
        });

      if (error) throw error;

      setCommentText(prev => ({ ...prev, [postId]: '' }));
      await loadComments(postId);
      
      // Update comment count in local state
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
      ));
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Failed to add comment',
        variant: 'destructive',
      });
    }
  };

  const formatDuration = (song: Song) => {
    // Duration is typically stored in metadata or calculated from audio
    // For now, return a placeholder - can be enhanced later with audio metadata
    return "N/A";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="font-mono text-muted-foreground">Artist profile not found</p>
          <Button variant="neon" onClick={() => navigate("/")}>
            GO HOME
          </Button>
        </div>
      </div>
    );
  }

  const coverUrl = profile.cover_cid ? getIPFSGatewayUrl(profile.cover_cid) : null;
  const avatarUrl = profile.avatar_cid ? getIPFSGatewayUrl(profile.avatar_cid) : null;
  const coverPosition = profile.social_links?.coverPosition || 50; // Default to center (50%)

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <NetworkInfo />

      {/* Modern Profile Header */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        <div className="relative">
          {/* Background with subtle gradient */}
          <div 
            className="absolute inset-0 rounded-3xl overflow-hidden opacity-20"
            style={coverUrl ? {
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: `center ${coverPosition}%`,
              filter: 'blur(40px)'
            } : {
              background: 'linear-gradient(135deg, rgba(0,255,159,0.1) 0%, rgba(147,51,234,0.1) 100%)'
            }}
          />
          
          {/* Main Content Card */}
          <Card className="relative bg-gradient-to-br from-white/5 via-white/5 to-white/0 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              {/* Avatar Section */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <Avatar className="h-32 w-32 md:h-40 md:w-40 ring-4 ring-neon-green/20 ring-offset-4 ring-offset-background/50 shadow-2xl rounded-2xl overflow-hidden">
                    <AvatarImage src={avatarUrl || undefined} alt={profile.artist_name || profile.display_name || 'Profile avatar'} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-neon-green/20 to-purple-500/20 text-neon-green font-mono text-4xl md:text-5xl">
                      {(profile.artist_name || profile.display_name || profile.wallet_address || '??').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {profile.verified && (
                    <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1 shadow-lg">
                      <CircleCheckBig 
                        className="h-6 w-6 text-blue-400" 
                        aria-label="Verified artist"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Info Section */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
                      {profile.artist_name || profile.display_name}
                    </h1>
                    <XRGETierBadge walletAddress={walletAddress || null} size="md" />
                  </div>
                  {profile.display_name && profile.display_name !== profile.artist_name && (
                    <p className="text-base md:text-lg text-white/70 mb-2 font-medium">
                      aka {profile.display_name}
                    </p>
                  )}
                  {profile.artist_ticker && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl font-mono text-neon-green font-bold">
                        ${profile.artist_ticker}
                      </span>
                    </div>
                  )}
                  
                  {/* Quick Stats Row */}
                  <div className="flex items-center gap-6 flex-wrap mt-4">
                    <button
                      onClick={() => setShowHoldersModal(true)}
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-neon-green transition-colors cursor-pointer"
                    >
                      <Users className="h-4 w-4" />
                      <span className="font-semibold">{loadingStats ? '...' : holdersCount.toLocaleString()}</span>
                      <span className="text-white/50">followers</span>
                    </button>
                    <button
                      onClick={() => setShowHoldingsModal(true)}
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-neon-green transition-colors cursor-pointer"
                    >
                      <Wallet className="h-4 w-4" />
                      <span className="font-semibold">{loadingStats ? '...' : holdingsCount.toLocaleString()}</span>
                      <span className="text-white/50">holding</span>
                    </button>
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Music className="h-4 w-4" />
                      <span className="font-semibold">{totalSongsCount.toLocaleString()}</span>
                      <span className="text-white/50">tracks</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Play className="h-4 w-4" />
                      <span className="font-semibold">{(profile.total_plays || 0).toLocaleString()}</span>
                      <span className="text-white/50">plays</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6 flex-wrap">
                  {isOwnProfile ? (
                    <>
                      <Button 
                        variant="default" 
                        onClick={() => navigate("/upload")}
                        className="bg-neon-green hover:bg-neon-green/80 text-black font-semibold"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        UPLOAD
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => navigate("/profile/edit")}
                        className="border-white/20 hover:border-neon-green/50"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        EDIT PROFILE
                      </Button>
                    </>
                  ) : (
                    <>
                      {fullAddress && (
                        <Button 
                          variant="outline" 
                          onClick={() => navigate(`/messages?to=${walletAddress}`)}
                          className="border-white/20 hover:border-neon-green/50"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          MESSAGE
                        </Button>
                      )}
                      <TipButton
                        artistId={walletAddress || ''}
                        artistWalletAddress={walletAddress || ''}
                        artistName={profile.artist_name || 'this artist'}
                        variant="default"
                        size="default"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Bio Section */}
            {profile.bio && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-sm md:text-base text-white/80 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}

            {/* Social Links */}
            {profile.social_links && (profile.social_links.website || profile.social_links.twitter || profile.social_links.instagram || profile.social_links.soundcloud) && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex gap-4 flex-wrap">
                  {profile.social_links.website && (
                    <a
                      href={profile.social_links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-neon-green transition-colors"
                    >
                      <Globe className="h-4 w-4" />
                      Website
                    </a>
                  )}
                  {profile.social_links.twitter && (
                    <a
                      href={profile.social_links.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-neon-green transition-colors"
                    >
                      <FaXTwitter className="h-4 w-4" />
                      Twitter
                    </a>
                  )}
                  {profile.social_links.instagram && (
                    <a
                      href={profile.social_links.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-neon-green transition-colors"
                    >
                      <Instagram className="h-4 w-4" />
                      Instagram
                    </a>
                  )}
                  {profile.social_links.soundcloud && (
                    <a
                      href={profile.social_links.soundcloud}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-neon-green transition-colors"
                    >
                      <Music className="h-4 w-4" />
                      SoundCloud
                    </a>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Content Navigation Tabs & Main Content */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-6">
        <Tabs defaultValue="all" className="w-full">
          {/* Modern Navigation Tabs */}
          <div className="mb-8">
            <TabsList className="h-auto p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl inline-flex">
              <TabsTrigger 
                value="all" 
                className="px-5 py-2.5 font-medium text-sm data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white rounded-xl transition-all"
              >
                ALL
              </TabsTrigger>
              <TabsTrigger 
                value="popular" 
                className="px-5 py-2.5 font-medium text-sm data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white rounded-xl transition-all"
              >
                POPULAR
              </TabsTrigger>
              <TabsTrigger 
                value="tracks" 
                className="px-5 py-2.5 font-medium text-sm data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white rounded-xl transition-all"
              >
                TRACKS
              </TabsTrigger>
              <TabsTrigger 
                value="albums" 
                className="px-5 py-2.5 font-medium text-sm data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white rounded-xl transition-all"
              >
                ALBUMS
              </TabsTrigger>
              <TabsTrigger 
                value="playlists" 
                className="px-5 py-2.5 font-medium text-sm data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white rounded-xl transition-all"
              >
                PLAYLISTS
              </TabsTrigger>
              <TabsTrigger 
                value="reposts" 
                className="px-5 py-2.5 font-medium text-sm data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white rounded-xl transition-all"
              >
                REPOSTS
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Main Content Area */}
          <div className="pb-6">
            <TabsContent value="all" className="mt-0">
              {loadingSongs ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
                </div>
              ) : songs.length === 0 ? (
                <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                  <Music className="h-12 w-12 mx-auto mb-4 text-white/40" />
                  <p className="font-medium text-white/60">No songs uploaded yet</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {songs.map((song, index) => {
                    const coverUrl = song.cover_cid ? getIPFSGatewayUrl(song.cover_cid) : null;
                    const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
                    
                    return (
                      <Card
                        key={song.id}
                        className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 hover:border-neon-green/30 transition-all cursor-pointer"
                        onClick={() => navigate(`/song/${song.id}`)}
                      >
                        {/* Cover Image */}
                        <div className="relative aspect-square bg-gradient-to-br from-neon-green/10 to-purple-500/10">
                          {coverUrl ? (
                            <img 
                              src={coverUrl} 
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="h-16 w-16 text-neon-green/40" />
                            </div>
                          )}
                          
                          {/* Play Overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              className="w-16 h-16 rounded-full bg-neon-green hover:bg-neon-green/80 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                playSong(song); 
                              }}
                            >
                              {isThisSongPlaying ? (
                                <Pause className="h-6 w-6 text-black fill-black" />
                              ) : (
                                <Play className="h-6 w-6 text-black fill-black ml-1" />
                              )}
                            </button>
                          </div>
                          
                          {/* Waveform Overlay */}
                          {song.audio_cid && isThisSongPlaying && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <ArtistWaveform songId={song.id} audioCid={song.audio_cid} />
                            </div>
                          )}
                        </div>
                        
                        {/* Song Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-white truncate mb-1 group-hover:text-neon-green transition-colors">
                            {song.title}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs text-white/60 truncate">
                              {profile.artist_name || profile.display_name}
                            </p>
                            {song.ticker && (
                              <span className="text-xs text-neon-green font-mono">${song.ticker}</span>
                            )}
                          </div>
                          
                          {/* Meta */}
                          <div className="flex items-center gap-3 text-xs text-white/40">
                            <LikeButton songId={song.id} size="sm" showCount={true} />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSongComments(song.id);
                              }}
                              className="flex items-center gap-1 hover:text-neon-green transition-colors"
                            >
                              <MessageSquare className="h-3 w-3" />
                            </button>
                            <span>► {song.play_count}</span>
                            <span>{formatDuration(song)}</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            
            {/* Other tab contents */}
            <TabsContent value="popular" className="mt-0">
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/60">Popular tracks coming soon</p>
              </Card>
            </TabsContent>
            <TabsContent value="tracks" className="mt-0">
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/60">All tracks</p>
              </Card>
            </TabsContent>
            <TabsContent value="albums" className="mt-0">
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/60">Albums coming soon</p>
              </Card>
            </TabsContent>
            <TabsContent value="playlists" className="mt-0">
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/60">Playlists coming soon</p>
              </Card>
            </TabsContent>
            <TabsContent value="reposts" className="mt-0">
              <Card className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/60">Reposts coming soon</p>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Modals */}
      <HoldersModal
        open={showHoldersModal}
        onOpenChange={setShowHoldersModal}
        walletAddresses={holderWallets}
        title="Holders"
      />
      <HoldersModal
        open={showHoldingsModal}
        onOpenChange={setShowHoldingsModal}
        walletAddresses={holdingWallets}
        title="Holdings"
      />
    </div>
  );
};

export default Artist;
