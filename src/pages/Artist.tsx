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

  // Fetch artist posts
  useEffect(() => {
    const fetchArtistPosts = async () => {
      if (!walletAddress) return;
      try {
        setLoadingPosts(true);
        const { data, error } = await supabase
          .from("feed_posts")
          .select("*")
          .ilike("wallet_address", walletAddress)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setPosts(data || []);
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

      {/* Cover Photo Hero */}
      <div 
        className="relative h-64 w-full"
        style={coverUrl ? {
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: `center ${coverPosition}%`
        } : undefined}
      >
        {!coverUrl && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-background to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Avatar Overlapping Cover */}
        <div className="absolute bottom-0 left-8 transform translate-y-1/2">
          <Avatar className="h-32 w-32 border-4 border-background shadow-2xl">
            <AvatarImage src={avatarUrl || undefined} alt={profile.artist_name || profile.display_name || 'Profile avatar'} className="object-cover" />
            <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-4xl">
              {(profile.artist_name || profile.display_name || profile.wallet_address || '??').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Profile Info */}
      <div className="max-w-6xl mx-auto px-6 py-8 pt-20">
        <StoriesBar />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-mono font-bold neon-text">
                {profile.artist_name}
              </h1>
              {profile.verified && (
                <CircleCheckBig 
                  className="h-5 w-5 text-blue-500" 
                  aria-label="Verified artist"
                />
              )}
              <XRGETierBadge walletAddress={walletAddress || null} size="md" />
            </div>
            {profile.artist_ticker && (
              <p className="text-2xl font-mono text-neon-green mb-2">
                ${profile.artist_ticker}
              </p>
            )}
            <button 
              className="text-sm font-mono text-muted-foreground hover:text-neon-green transition-colors flex items-center gap-2 group"
              onClick={() => {
                if (walletAddress) {
                  navigator.clipboard.writeText(walletAddress);
                  toast({ title: "Wallet address copied!", description: walletAddress });
                }
              }}
            >
              {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {isOwnProfile ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button variant="neon" onClick={() => {
                console.log('Upload button clicked');
                navigate("/upload");
              }}>
                <Upload className="h-4 w-4 mr-2" />
                UPLOAD MUSIC
              </Button>
              <Button variant="outline" onClick={() => {
                console.log('Edit profile button clicked');
                navigate("/profile/edit");
              }}>
                <Edit className="h-4 w-4 mr-2" />
                EDIT PROFILE
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {fullAddress && (
                <Button 
                  variant="outline" 
                  className="font-mono"
                  onClick={() => navigate(`/messages?to=${walletAddress}`)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  MESSAGE
                </Button>
              )}
              <TipButton
                artistId={walletAddress || ''}
                artistWalletAddress={walletAddress || ''}
                artistName={profile.artist_name || 'this artist'}
                variant="neon"
                size="default"
              />
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <Card className="console-bg tech-border p-4 text-center">
            <Music className="h-6 w-6 mx-auto mb-2 text-neon-green" />
            <p className="text-2xl font-mono font-bold">{totalSongsCount}</p>
            <p className="text-xs font-mono text-muted-foreground">SONGS</p>
          </Card>
          <Card className="console-bg tech-border p-4 text-center">
            <Play className="h-6 w-6 mx-auto mb-2 text-neon-green" />
            <p className="text-2xl font-mono font-bold">
              {profile.total_plays || 0}
            </p>
            <p className="text-xs font-mono text-muted-foreground">PLAYS</p>
          </Card>
          <Card 
            className="console-bg tech-border p-4 text-center cursor-pointer hover:border-neon-green transition-colors"
            onClick={() => setShowHoldersModal(true)}
          >
            <Users className="h-6 w-6 mx-auto mb-2 text-neon-green" />
            <p className="text-2xl font-mono font-bold">
              {loadingStats ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : holdersCount}
            </p>
            <p className="text-xs font-mono text-muted-foreground">HOLDERS</p>
          </Card>
          <Card 
            className="console-bg tech-border p-4 text-center cursor-pointer hover:border-neon-green transition-colors"
            onClick={() => setShowHoldingsModal(true)}
          >
            <Wallet className="h-6 w-6 mx-auto mb-2 text-neon-green" />
            <p className="text-2xl font-mono font-bold">
              {loadingStats ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : holdingsCount}
            </p>
            <p className="text-xs font-mono text-muted-foreground">HOLDINGS</p>
          </Card>
          <Card className="console-bg tech-border p-4 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-neon-green" />
            <p className="text-xs font-mono font-bold">
              {new Date(profile.created_at).toLocaleDateString()}
            </p>
            <p className="text-xs font-mono text-muted-foreground">MEMBER SINCE</p>
          </Card>
          {profile.profile_metadata_cid && (
            <Card className="console-bg tech-border p-4 text-center">
              <a
                href={getIPFSGatewayUrl(profile.profile_metadata_cid)}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-neon-green transition-colors"
              >
                <ExternalLink className="h-6 w-6 mx-auto mb-2" />
                <p className="text-xs font-mono font-bold">VIEW ON</p>
                <p className="text-xs font-mono text-muted-foreground">IPFS</p>
              </a>
            </Card>
          )}
        </div>

        {/* Bio & Social Links */}
        {(profile.bio || profile.social_links) && (
          <Card className="console-bg tech-border p-6 mb-8">
            {profile.bio && (
              <p className="font-mono text-sm mb-4 whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
            {profile.social_links && (
              <div className="flex gap-4">
                {profile.social_links.twitter && (
                  <a
                    href={profile.social_links.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-neon-green transition-colors"
                  >
                    <FaXTwitter className="h-5 w-5" />
                  </a>
                )}
                {profile.social_links.instagram && (
                  <a
                    href={profile.social_links.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-neon-green transition-colors"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {profile.social_links.website && (
                  <a
                    href={profile.social_links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-neon-green transition-colors"
                  >
                    <Globe className="h-5 w-5" />
                  </a>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Tabs for Music and Posts */}
        <Tabs defaultValue="music" className="w-full">
          <TabsList className="w-full justify-start mb-6 bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl">
            <TabsTrigger 
              value="music" 
              className="font-mono data-[state=active]:bg-white/10 data-[state=active]:text-neon-green data-[state=active]:shadow-lg data-[state=active]:shadow-neon-green/20 data-[state=active]:border data-[state=active]:border-neon-green/30 data-[state=inactive]:text-white/60 data-[state=inactive]:hover:text-white/80 data-[state=inactive]:hover:bg-white/5 transition-all duration-300 rounded-xl px-6 py-3 backdrop-blur-sm"
            >
              <Music className="h-4 w-4 mr-2" />
              MUSIC
            </TabsTrigger>
            <TabsTrigger 
              value="posts" 
              className="font-mono data-[state=active]:bg-white/10 data-[state=active]:text-neon-green data-[state=active]:shadow-lg data-[state=active]:shadow-neon-green/20 data-[state=active]:border data-[state=active]:border-neon-green/30 data-[state=inactive]:text-white/60 data-[state=inactive]:hover:text-white/80 data-[state=inactive]:hover:bg-white/5 transition-all duration-300 rounded-xl px-6 py-3 backdrop-blur-sm"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              POSTS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="music">
            {loadingSongs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
              </div>
            ) : songs.length === 0 ? (
              <Card className="console-bg tech-border p-6 text-center">
                <p className="font-mono text-muted-foreground">No songs uploaded yet</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {songs.map((song) => {
                  const coverUrl = song.cover_cid ? getIPFSGatewayUrl(song.cover_cid) : null;
                  const isThisSongPlaying = currentSong?.id === song.id && isPlaying;
                  
                  return (
                    <ArtistSongCard 
                      key={song.id}
                      song={song}
                      coverUrl={coverUrl}
                      isThisSongPlaying={isThisSongPlaying}
                      navigate={navigate}
                      playSong={playSong}
                      toggleSongComments={toggleSongComments}
                      expandedSongComments={expandedSongComments}
                    />
                  );
                })}
                
                {/* Load More Button */}
                {hasMoreSongs && !loadingSongs && (
                  <div className="flex justify-center pt-6">
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        fetchArtistSongs(true);
                      }}
                      variant="outline"
                      className="font-mono"
                      type="button"
                    >
                      Load More Songs
                    </Button>
                  </div>
                )}
                
                {loadingSongs && songs.length > 0 && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-neon-green" />
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="posts">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-mono text-lg">Posts ({posts.length})</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setRefreshKey(prev => prev + 1)}
                disabled={loadingPosts}
              >
                {loadingPosts ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
            
            {loadingPosts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
              </div>
            ) : posts.length === 0 ? (
              <Card className="console-bg tech-border p-6 text-center">
                <p className="font-mono text-muted-foreground">No posts yet</p>
                <p className="font-mono text-xs text-muted-foreground mt-2">
                  Posts you create will appear here
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <Card key={post.id} className="console-bg tech-border p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-mono text-sm text-muted-foreground">
                        {profile.artist_name || profile.display_name} posted {formatTimeAgo(post.created_at)}
                      </span>
                    </div>
                    {post.content_text && (
                      <p className="font-mono text-sm mb-4 whitespace-pre-wrap">
                        {post.content_text}
                      </p>
                    )}
                    
                    {post.media_cid && post.media_type && (
                      <div className="mb-4">
                        {post.media_type.startsWith('image') ? (
                          <img 
                            src={getIPFSGatewayUrl(post.media_cid)}
                            alt="Post media"
                            className="w-full rounded tech-border"
                          />
                        ) : post.media_type.startsWith('video') ? (
                          <video 
                            src={getIPFSGatewayUrl(post.media_cid)}
                            controls
                            className="w-full rounded tech-border"
                          />
                        ) : null}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono border-t border-border pt-4 mt-4">
                      <div className="flex items-center gap-2">
                        <LikeButton songId={post.id} size="sm" showCount={true} entityType="post" />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center gap-1 font-mono"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>{post.comment_count}</span>
                      </Button>
                    </div>

                    {/* Comments Section */}
                    {expandedComments.has(post.id) && (
                      <div className="mt-4 space-y-4 border-t border-border pt-4">
                        {/* Add Comment Input */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a comment..."
                            value={commentText[post.id] || ''}
                            onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(post.id);
                              }
                            }}
                            className="font-mono text-sm"
                          />
                          <Button
                            size="sm"
                            variant="neon"
                            onClick={() => handleAddComment(post.id)}
                            disabled={!commentText[post.id]?.trim()}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Comments List */}
                        <div className="space-y-3">
                          {comments[post.id]?.map((comment) => (
                            <div key={comment.id} className="flex gap-3">
                              <div 
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => navigate(`/artist/${comment.wallet_address}`)}
                              >
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarImage 
                                    src={comment.profiles?.avatar_cid ? getIPFSGatewayUrl(comment.profiles.avatar_cid) : undefined} 
                                  />
                                  <AvatarFallback className="bg-primary/20 text-neon-green text-xs">
                                    {(comment.profiles?.artist_name || comment.wallet_address).substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span 
                                    className="font-mono text-xs font-semibold cursor-pointer hover:text-neon-green transition-colors"
                                    onClick={() => navigate(`/artist/${comment.wallet_address}`)}
                                  >
                                    {comment.profiles?.artist_name || `${comment.wallet_address.slice(0, 6)}...${comment.wallet_address.slice(-4)}`}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimeAgo(comment.created_at)}
                                  </span>
                                </div>
                                <p className="font-mono text-sm">{comment.comment_text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
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
