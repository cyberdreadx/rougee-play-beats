import React, { useRef, useState, useEffect, memo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useNavigate } from "react-router-dom";
import NetworkInfo from "@/components/NetworkInfo";
import SearchBar from "@/components/SearchBar";
import TrendingArtists from "@/components/TrendingArtists";
import TopSongs, { TopSongsRef } from "@/components/TopSongs";
import StoriesBar from "@/components/StoriesBar";
import LandingHero from "@/components/LandingHero";
import MusicBars from "@/components/MusicBars";
import GenresList from "@/components/GenresList";
import { supabase } from "@/integrations/supabase/client";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import logo from "@/assets/logo.png";
import { RadioToggle } from "@/components/RadioToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, TrendingUp, Sparkles, Clock, Flame, Radio, Music, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
}

interface IndexProps {
  playSong: (song: Song) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  isRadioMode?: boolean;
  onToggleRadio?: () => void;
}

interface FeedPost {
  id: string;
  content_text: string | null;
  media_cid: string | null;
  wallet_address: string;
  created_at: string;
  like_count: number;
  songs?: {
    id: string;
    title: string;
    artist: string | null;
    cover_cid: string | null;
    audio_cid: string | null;
  } | null;
}

// Skeleton components for Index page
const FeaturedCardSkeleton = memo(() => (
  <Card className="mb-6 overflow-hidden border-neon-green/20 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-xl rounded-2xl">
    <div className="relative h-48 md:h-64 overflow-hidden">
      <div className="w-full h-full bg-white/10 animate-pulse" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="h-6 w-24 bg-white/10 rounded-full mb-3 animate-pulse" />
        <div className="h-8 bg-white/10 rounded w-3/4 mb-2 animate-pulse" />
        <div className="h-5 bg-white/10 rounded w-1/2 mb-4 animate-pulse" />
        <div className="flex gap-3">
          <div className="h-10 bg-white/10 rounded-full w-32 animate-pulse" />
          <div className="h-10 bg-white/10 rounded-full w-24 animate-pulse" />
        </div>
      </div>
    </div>
  </Card>
));
FeaturedCardSkeleton.displayName = 'FeaturedCardSkeleton';

const SongGridCardSkeleton = memo(() => (
  <Card className="border-neon-green/10 hover:border-neon-green/30 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl overflow-hidden group">
    <div className="relative aspect-square">
      <div className="w-full h-full bg-white/10 animate-pulse" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/20 animate-pulse opacity-0 group-hover:opacity-100" />
      </div>
    </div>
    <div className="p-3">
      <div className="h-4 bg-white/10 rounded w-3/4 mb-2 animate-pulse" />
      <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse" />
    </div>
  </Card>
));
SongGridCardSkeleton.displayName = 'SongGridCardSkeleton';

const PostGridCardSkeleton = memo(() => (
  <Card className="border-neon-green/10 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl overflow-hidden">
    <div className="relative aspect-square">
      <div className="w-full h-full bg-white/10 animate-pulse" />
    </div>
    <div className="p-3">
      <div className="h-4 bg-white/10 rounded w-3/4 mb-2 animate-pulse" />
      <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse" />
    </div>
  </Card>
));
PostGridCardSkeleton.displayName = 'PostGridCardSkeleton';

const Index = ({ playSong, currentSong, isPlaying, isRadioMode, onToggleRadio }: IndexProps) => {
  const [activeTab, setActiveTab] = React.useState("artists");
  const topSongsRef = useRef<TopSongsRef>(null);
  const tabsContentRef = useRef<HTMLDivElement>(null);
  const { isConnected } = useWallet();
  const navigate = useNavigate();
  const [featuredSong, setFeaturedSong] = useState<Song | null>(null);
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [newReleases, setNewReleases] = useState<Song[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<FeedPost[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingTrendingPosts, setLoadingTrendingPosts] = useState(true);

  const handlePlayCountUpdate = () => {
    topSongsRef.current?.refreshSongs();
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Scroll to tabs content section when tab changes
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.getElementById('tabs-section');
        if (element) {
          const yOffset = -100; // Offset for fixed headers
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
      }, 100);
    });
  };

  // Fetch featured and trending content
  useEffect(() => {
    const fetchFeaturedContent = async () => {
      try {
        // Get top song for featured
        const { data: topSongs } = await supabase
          .from('songs')
          .select('id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, token_address, created_at')
          .not('token_address', 'is', null)
          .order('play_count', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (topSongs) {
          setFeaturedSong(topSongs);
        }

        // Get trending songs (top 6)
        const { data: trending } = await supabase
          .from('songs')
          .select('id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, token_address, created_at')
          .not('token_address', 'is', null)
          .order('play_count', { ascending: false })
          .limit(6);
        
        if (trending) {
          setTrendingSongs(trending.slice(1) || []); // Skip first one as it's featured
        }

        // Get new releases (last 6 songs)
        const { data: newSongs } = await supabase
          .from('songs')
          .select('id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, token_address, created_at')
          .not('token_address', 'is', null)
          .order('created_at', { ascending: false })
          .limit(6);
        
        if (newSongs) {
          setNewReleases(newSongs);
        }

        // Get trending posts (top by like_count)
        setLoadingTrendingPosts(true);
        const { data: topPosts } = await supabase
          .from('feed_posts')
          .select(`id, content_text, media_cid, wallet_address, created_at, like_count, songs ( id, title, artist, cover_cid, audio_cid )`)
          .order('like_count', { ascending: false })
          .limit(6);
        setTrendingPosts((topPosts || []) as unknown as FeedPost[]);
        setLoadingTrendingPosts(false);
      } catch (error) {
        console.error('Error fetching featured content:', error);
      } finally {
        setLoadingFeatured(false);
      }
    };

    if (isConnected) {
      fetchFeaturedContent();
    }
  }, [isConnected]);

  // Show landing page for non-connected wallets
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-24 md:pb-20">
        <LandingHero />
        
        {/* Discovery Sections */}
        <div className="flex-1 w-full overflow-x-hidden space-y-6 pb-8">
          <div className="px-4">
            <h2 className="text-lg font-bold font-mono mb-3 text-primary">
              🔥 TRENDING ARTISTS
            </h2>
          </div>
          <TrendingArtists />
          
          <div className="px-4">
            <h2 className="text-lg font-bold font-mono mb-3 text-primary">
              🎵 TOP SONGS
            </h2>
          </div>
          <TopSongs 
            ref={topSongsRef}
            onPlaySong={playSong}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlayCountUpdate={handlePlayCountUpdate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-20 flex flex-col overflow-x-hidden">
      <NetworkInfo />
      <div className="flex items-center justify-between px-4 md:px-6 py-4 gap-3">
        {onToggleRadio && (
          <RadioToggle 
            isRadioMode={isRadioMode || false} 
            onToggle={onToggleRadio}
          />
        )}
      </div>
      <div className="flex-1 w-full overflow-x-hidden">
        {/* Enhanced Hero Section with Featured Content */}
        <div className="relative px-4 md:px-6 pt-4 md:pt-6 pb-8">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-neon-green/10 via-purple-500/5 to-pink-500/10 blur-3xl opacity-50" />
          
          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mb-3 flex justify-center">
                <div className="relative">
                  <img src={logo} alt="ROUGEE Logo" className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-neon-green/30 shadow-[0_0_30px_rgba(0,255,159,0.3)]" />
                  <div className="absolute inset-0 rounded-full bg-neon-green/20 animate-pulse" />
                </div>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent font-mono">
                DISCOVER
              </h1>
              <p className="text-sm md:text-base text-muted-foreground font-mono">
                Find your next favorite track
              </p>
            </div>

            {/* Featured Song Card */}
            {loadingFeatured ? (
              <FeaturedCardSkeleton />
            ) : featuredSong ? (
              <Card className="mb-6 overflow-hidden border-neon-green/20 bg-gradient-to-br from-white/5 via-white/3 to-transparent backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,255,159,0.2)] hover:shadow-[0_12px_48px_0_rgba(0,255,159,0.3)] transition-all duration-300 group">
                <div className="relative h-48 md:h-64 overflow-hidden">
                  {featuredSong.cover_cid && (
                    <img 
                      src={getIPFSGatewayUrl(featuredSong.cover_cid)} 
                      alt={featuredSong.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                  
                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <Badge className="mb-3 bg-neon-green/20 text-neon-green border-neon-green/30">
                      <Flame className="w-3 h-3 mr-1" />
                      #1 TRENDING
                    </Badge>
                    <h2 className="text-xl md:text-3xl font-bold mb-2 font-mono text-white">
                      {featuredSong.title}
                    </h2>
                    <p className="text-sm md:text-base text-gray-300 mb-4 font-mono">
                      {featuredSong.artist || 'Unknown Artist'}
                    </p>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => playSong(featuredSong)}
                        className="bg-neon-green hover:bg-neon-green/90 text-black font-bold rounded-full px-6 shadow-[0_0_20px_rgba(0,255,159,0.5)]"
                      >
                        {currentSong?.id === featuredSong.id && isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            PAUSED
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2 fill-black" />
                            PLAY NOW
                          </>
                        )}
                      </Button>
                      {featuredSong.token_address && (
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/song/${featuredSong.id}`)}
                          className="border-neon-green/30 hover:border-neon-green/60 hover:bg-neon-green/10"
                        >
                          Trade
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            {/* Quick Access Filters */}
            <div className="mb-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveTab("artists");
                    setTimeout(() => {
                      const element = document.getElementById('tabs-section');
                      if (element) {
                        const yOffset = -100;
                        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                      }
                    }, 200);
                  }}
                  className="flex-shrink-0 border-neon-green/30 hover:border-neon-green/60 hover:bg-neon-green/10"
                >
                  <Sparkles className="w-3 h-3 mr-2" />
                  Trending
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveTab("songs");
                    setTimeout(() => {
                      const element = document.getElementById('tabs-section');
                      if (element) {
                        const yOffset = -100;
                        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                      }
                    }, 200);
                  }}
                  className="flex-shrink-0 border-neon-green/30 hover:border-neon-green/60 hover:bg-neon-green/10"
                >
                  <TrendingUp className="w-3 h-3 mr-2" />
                  Top Charts
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveTab("genres");
                    setTimeout(() => {
                      const element = document.getElementById('tabs-section');
                      if (element) {
                        const yOffset = -100;
                        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                      }
                    }, 200);
                  }}
                  className="flex-shrink-0 border-neon-green/30 hover:border-neon-green/60 hover:bg-neon-green/10"
                >
                  <Music className="w-3 h-3 mr-2" />
                  Genres
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/trending')}
                  className="flex-shrink-0 border-neon-green/30 hover:border-neon-green/60 hover:bg-neon-green/10"
                >
                  <Flame className="w-3 h-3 mr-2" />
                  Hot Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/feed')}
                  className="flex-shrink-0 border-neon-green/30 hover:border-neon-green/60 hover:bg-neon-green/10"
                >
                  <Radio className="w-3 h-3 mr-2" />
                  GLTCH Feed
                </Button>
              </div>
            </div>

            {/* Search bar */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <MusicBars bars={6} className="h-6 md:h-8 flex-shrink-0" />
              <div className="max-w-2xl w-full">
                <SearchBar />
              </div>
            </div>

            {/* Stories */}
            <div className="mb-6">
              <StoriesBar />
            </div>
          </div>
        </div>

        {/* Trending Songs Grid */}
        {loadingFeatured ? (
          <div className="px-4 md:px-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-neon-green" />
              <h2 className="text-lg md:text-xl font-bold font-mono">Trending Now</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {[...Array(6)].map((_, i) => (
                <SongGridCardSkeleton key={`skeleton-trending-${i}`} />
              ))}
            </div>
          </div>
        ) : trendingSongs.length > 0 ? (
          <div className="px-4 md:px-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-neon-green" />
              <h2 className="text-lg md:text-xl font-bold font-mono">Trending Now</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {trendingSongs.map((song) => (
                <Card
                  key={song.id}
                  className="group cursor-pointer border-neon-green/10 hover:border-neon-green/30 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_32px_0_rgba(0,255,159,0.2)]"
                  onClick={() => song.token_address && navigate(`/song/${song.id}`)}
                >
                  <div className="relative aspect-square">
                    {song.cover_cid ? (
                      <img 
                        src={getIPFSGatewayUrl(song.cover_cid)} 
                        alt={song.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center">
                        <Music className="w-8 h-8 text-neon-green" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center">
                      <Button
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(song);
                        }}
                        className="opacity-0 group-hover:opacity-100 bg-neon-green hover:bg-neon-green/90 text-black rounded-full w-12 h-12 transition-opacity duration-300 shadow-lg"
                      >
                        {currentSong?.id === song.id && isPlaying ? (
                          <Pause className="w-5 h-5 fill-black" />
                        ) : (
                          <Play className="w-5 h-5 fill-black ml-0.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate mb-1">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist || 'Unknown'}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {/* New Releases */}
        {loadingFeatured ? (
          <div className="px-4 md:px-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-neon-green" />
              <h2 className="text-lg md:text-xl font-bold font-mono">New Releases</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {[...Array(6)].map((_, i) => (
                <SongGridCardSkeleton key={`skeleton-new-${i}`} />
              ))}
            </div>
          </div>
        ) : newReleases.length > 0 ? (
          <div className="px-4 md:px-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-neon-green" />
              <h2 className="text-lg md:text-xl font-bold font-mono">New Releases</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {newReleases.map((song) => (
                <Card
                  key={song.id}
                  className="group cursor-pointer border-neon-green/10 hover:border-neon-green/30 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_32px_0_rgba(0,255,159,0.2)]"
                  onClick={() => song.token_address && navigate(`/song/${song.id}`)}
                >
                  <div className="relative aspect-square">
                    {song.cover_cid ? (
                      <img 
                        src={getIPFSGatewayUrl(song.cover_cid)} 
                        alt={song.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center">
                        <Music className="w-8 h-8 text-neon-green" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center">
                      <Button
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(song);
                        }}
                        className="opacity-0 group-hover:opacity-100 bg-neon-green hover:bg-neon-green/90 text-black rounded-full w-12 h-12 transition-opacity duration-300 shadow-lg"
                      >
                        {currentSong?.id === song.id && isPlaying ? (
                          <Pause className="w-5 h-5 fill-black" />
                        ) : (
                          <Play className="w-5 h-5 fill-black ml-0.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate mb-1">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist || 'Unknown'}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {/* Trending Posts */}
        <div className="px-4 md:px-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-neon-green" />
            <h2 className="text-lg md:text-xl font-bold font-mono">Trending Posts</h2>
          </div>
          {loadingTrendingPosts ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {[...Array(6)].map((_, i) => (
                <PostGridCardSkeleton key={`skeleton-post-${i}`} />
              ))}
            </div>
          ) : trendingPosts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {trendingPosts.map((post) => (
                <Card 
                  key={post.id}
                  className="group cursor-pointer border-neon-green/10 hover:border-neon-green/30 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  <div className="relative aspect-square">
                    {post.media_cid ? (
                      <img
                        src={getIPFSGatewayUrl(post.media_cid)}
                        alt="Post media"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center p-3 text-sm text-white/80 text-center">
                        {post.content_text?.slice(0, 90) || 'Post'}
                      </div>
                    )}
                    {post.songs && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center">
                        <Button
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSong({
                              id: post.songs!.id,
                              title: post.songs!.title,
                              artist: post.songs!.artist || null,
                              audio_cid: post.songs!.audio_cid || '',
                              cover_cid: post.songs!.cover_cid || null,
                              wallet_address: post.wallet_address,
                              play_count: 0,
                              created_at: post.created_at,
                            } as any);
                          }}
                          className="opacity-0 group-hover:opacity-100 bg-neon-green hover:bg-neon-green/90 text-black rounded-full w-12 h-12 transition-opacity duration-300 shadow-lg"
                        >
                          {currentSong?.id === post.songs.id && isPlaying ? (
                            <Pause className="w-5 h-5 fill-black" />
                          ) : (
                            <Play className="w-5 h-5 fill-black ml-0.5" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  {post.songs && (
                    <div className="p-3 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        {post.songs.cover_cid ? (
                          <img src={getIPFSGatewayUrl(post.songs.cover_cid)} alt={post.songs.title} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-white/10" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{post.songs.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{post.songs.artist || 'Unknown'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No trending posts yet.</div>
          )}
        </div>
        
        {/* Tabs for different discovery sections */}
        <div ref={tabsContentRef} id="tabs-section" className="scroll-mt-20">
          <Tabs defaultValue="artists" value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="px-4 md:px-6 mb-6">
              <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-1">
                <TabsTrigger 
                  value="artists" 
                  className="font-mono data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(0,255,159,0.5)] rounded-lg transition-all"
                >
                  ARTISTS
                </TabsTrigger>
                <TabsTrigger 
                  value="songs" 
                  className="font-mono data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(0,255,159,0.5)] rounded-lg transition-all"
                >
                  SONGS
                </TabsTrigger>
                <TabsTrigger 
                  value="genres" 
                  className="font-mono data-[state=active]:bg-neon-green data-[state=active]:text-black data-[state=active]:shadow-[0_0_20px_rgba(0,255,159,0.5)] rounded-lg transition-all"
                >
                  GENRES
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="artists" className="px-2 md:px-0 mt-0">
              <TrendingArtists />
            </TabsContent>

            <TabsContent value="songs" className="px-2 md:px-0 mt-0">
              <TopSongs 
                ref={topSongsRef}
                onPlaySong={playSong}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlayCountUpdate={handlePlayCountUpdate}
              />
            </TabsContent>

            <TabsContent value="genres" className="px-2 md:px-0 mt-0">
              <GenresList playSong={playSong} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;