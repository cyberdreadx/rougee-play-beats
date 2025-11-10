import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debounce } from "@/lib/throttle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, Flame, Music, Play, Pause, ChevronDown, ChevronUp, Clock, Zap, BarChart3, Sparkles } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import logo from "@/assets/logo.png";
import MusicBars from "@/components/MusicBars";
import { AppTutorial } from "@/components/AppTutorial";
import LiveStreams from "@/components/LiveStreams";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSongPrice, useSongMetadata, useBondingCurveSupply, BONDING_CURVE_ADDRESS, XRGE_TOKEN_ADDRESS } from "@/hooks/useSongBondingCurve";
import { useSong24hData } from "@/hooks/useSong24hData";
import { usePublicClient } from "wagmi";
import { Address } from "viem";
import { AiBadge } from "@/components/AiBadge";
import { SongPriceSparkline } from "@/components/SongPriceSparkline";
import { SongTradingChart } from "@/components/SongTradingChart";
import { AudioWaveform } from "@/components/AudioWaveform";
import { useAudioStateForSong } from "@/hooks/useAudioState";
import SongTradingHistory, { TradeData } from "@/components/SongTradingHistory";
import TrendingFeaturedSong from "@/components/TrendingFeaturedSong";
import TrendingSongRow from "@/components/TrendingSongRow";
import TrendingSongCard from "@/components/TrendingSongCard";
import TrendingHero from "@/components/TrendingHero";
import TrendingSongsTable from "@/components/TrendingSongsTable";
import TrendingArtistsTable from "@/components/TrendingArtistsTable";
import { SongRowSkeleton } from "@/components/TrendingSongRowSkeleton";
import { SongCardSkeleton } from "@/components/TrendingSongCardSkeleton";
import { memo } from "react";

interface Artist {
  wallet_address: string;
  artist_name: string;
  artist_ticker: string | null;
  avatar_cid: string | null;
  total_songs: number;
  total_plays: number;
  verified: boolean;
}

interface Song {
  id: string;
  title: string;
  artist: string | null;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  play_count: number;
  token_address?: string | null;
  ticker: string | null;
  genre: string | null;
  created_at: string;
  ai_usage?: 'none' | 'partial' | 'full' | null;
}


  // Waveform component for trending page
  const TrendingWaveform = memo(({ songId, audioCid }: { songId: string; audioCid: string }) => {
    const audioState = useAudioStateForSong(songId);
    
    return (
      <AudioWaveform
        audioCid={audioCid}
        height={30}
        color="#00ff9f"
        backgroundColor="rgba(0, 0, 0, 0.1)"
        className="rounded border border-neon-green/10"
        showProgress={audioState.isCurrentSong && audioState.isPlaying}
        currentTime={audioState.currentTime}
        duration={audioState.duration}
        onSeek={() => {}}
      />
    );
  });
  TrendingWaveform.displayName = 'TrendingWaveform';

  // Skeleton loader for featured song
  const FeaturedSongSkeleton = memo(() => {
    return (
      <div className="mb-6 relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-2xl p-6 pb-8 h-full flex flex-col"
           style={{
             border: '1px solid rgba(255, 255, 255, 0.2)',
             boxShadow: `
               0 0 0 1px rgba(0, 255, 159, 0.1),
               0 4px 16px rgba(0, 255, 159, 0.1),
               0 8px 32px rgba(0, 255, 159, 0.15),
               inset 0 1px 0 rgba(255, 255, 255, 0.1),
               inset 0 -1px 0 rgba(0, 0, 0, 0.2)
             `
           }}>
        {/* Faded background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 opacity-50" />
        
        <div className="relative z-10">
          {/* Badge skeleton */}
          <div className="absolute top-2 right-2 bg-white/10 rounded-full w-24 h-6 animate-pulse" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
            {/* Cover image skeleton */}
            <div className="relative group">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl bg-white/10 animate-pulse" />
              <div className="absolute bottom-2 right-2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 animate-pulse" />
            </div>
            
            <div className="flex-1 w-full">
              {/* Title skeleton */}
              <div className="h-8 bg-white/10 rounded-lg mb-3 w-3/4 animate-pulse" />
              {/* Artist skeleton */}
              <div className="h-5 bg-white/10 rounded-lg mb-3 w-1/2 animate-pulse" />
              
              {/* Stats skeleton */}
              <div className="flex flex-wrap gap-3 mb-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-black/40 rounded-lg px-3 py-2 border border-white/5">
                    <div className="h-3 bg-white/10 rounded mb-2 w-16 animate-pulse" />
                    <div className="h-5 bg-white/10 rounded w-20 animate-pulse" />
                  </div>
                ))}
              </div>
              
              {/* Chart skeleton */}
              <div className="bg-black/40 rounded-lg px-4 py-3 border border-neon-green/20 mt-3">
                <div className="h-4 bg-white/10 rounded mb-2 w-24 animate-pulse" />
                <div className="h-32 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
            
            {/* Button skeleton */}
            <div className="bg-neon-green/20 rounded-xl h-12 w-32 mt-4 md:mt-0 md:ml-auto animate-pulse" />
          </div>
        </div>
      </div>
    );
  });
  FeaturedSongSkeleton.displayName = 'FeaturedSongSkeleton';

  // Skeleton for stats cards
  const StatsCardSkeleton = memo(() => (
    <div className="group relative bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl rounded-xl p-5"
         style={{
           border: '1px solid rgba(255, 255, 255, 0.1)',
           boxShadow: `
             0 0 0 1px rgba(0, 0, 0, 0.2),
             0 2px 8px rgba(0, 255, 159, 0.05),
             inset 0 1px 0 rgba(255, 255, 255, 0.08),
             inset 0 -1px 0 rgba(0, 0, 0, 0.3)
           `
         }}>
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-2xl" />
      <div className="h-5 w-5 bg-white/10 rounded mb-2 animate-pulse" />
      <div className="h-4 bg-white/10 rounded w-20 mb-2 animate-pulse" />
      <div className="h-8 bg-white/10 rounded w-16 animate-pulse" />
    </div>
  ));
  StatsCardSkeleton.displayName = 'StatsCardSkeleton';






type SortField = 'trending' | 'price' | 'change' | 'volume' | 'marketCap' | 'plays';
type SortDirection = 'asc' | 'desc';

interface TrendingProps {
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
}

const Trending = ({ playSong, currentSong, isPlaying }: TrendingProps = {}) => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [songStats, setSongStats] = useState<Map<string, { volume: number; change: number; marketCap: number; price: number }>>(new Map());
  const [sortField, setSortField] = useState<SortField>('trending');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [displayLimit, setDisplayLimit] = useState<number | null>(20); // Start with TOP 20 for faster initial load
  const [timeFilter, setTimeFilter] = useState<'24H' | '7D' | '30D' | 'ALL'>('ALL');
  const [visibleCount, setVisibleCount] = useState(5); // Start with 5 items visible
  const [totalVolumeUSD, setTotalVolumeUSD] = useState<number>(0); // True total across all songs
  const [calculatingVolume, setCalculatingVolume] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');
  const { prices } = useTokenPrices();
  const publicClient = usePublicClient();
  
  // Calculate top gainer from visible songs' stats
  // This updates as songs load and report their stats
  const topGainerPercent = useMemo(() => {
    if (songStats.size === 0) return 0;
    
    const maxChange = Array.from(songStats.values()).reduce((max, stat) => {
      // Only count positive changes (gains)
      const change = stat.change || 0;
      return change > max ? change : max;
    }, 0);
    
    console.log('📈 Top gainer calculation:', {
      totalSongs: songStats.size,
      maxChange,
      allChanges: Array.from(songStats.values()).map(s => s.change)
    });
    
    return maxChange;
  }, [songStats]);
  
  const handleStatsUpdate = (songId: string, volume: number, change: number, marketCap: number, price: number) => {
    setSongStats(prev => {
      const newMap = new Map(prev);
      newMap.set(songId, { volume, change, marketCap, price });
      return newMap;
    });
  };
  
  // Calculate trending score for a song (memoized to prevent recalculation)
  const calculateTrendingScore = useCallback((song: Song): number => {
    const stats = songStats.get(song.id);
    
    // Boost new songs (created in last 24h) to ensure they appear in trending
    const songAge = song.created_at ? Date.now() - new Date(song.created_at).getTime() : Infinity;
    const isNewSong = songAge < 24 * 60 * 60 * 1000; // 24 hours
    const newSongBoost = isNewSong ? 1000 : 0; // Boost new songs by 1000 points
    
    if (!stats) {
      // If no stats yet, use play count + new song boost
      return song.play_count + newSongBoost;
    }
    
    // Weighted scoring algorithm (all values normalized to USD for fair comparison):
    // - Volume (40%): Recent trading activity
    // - Price Change (25%): Momentum (scaled by market cap)
    // - Market Cap (20%): Overall value
    // - Plays (15%): Popularity (scaled to USD equivalent: $0.01 per play)
    // - New Song Boost: Extra points for songs created in last 24h
    
    const volumeScore = stats.volume * 0.4;
    const changeScore = Math.max(0, stats.change / 100) * stats.marketCap * 0.25; // % change scaled by market cap
    const marketCapScore = stats.marketCap * 0.2;
    const playsScore = (song.play_count * 0.01) * 0.15; // $0.01 per play
    
    return volumeScore + changeScore + marketCapScore + playsScore + newSongBoost;
  }, [songStats]);
  
  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Memoize fetch function to avoid recreating on every render
  const fetchTrendingData = useCallback(async () => {
    try {
      setLoading(true);
      
      if (searchQuery) {
        // Perform search when search query is provided
        const searchTerm = `%${searchQuery}%`;
        
        const [artistsResponse, songsResponse] = await Promise.all([
          supabase
            .from("public_profiles")
            .select("wallet_address, artist_name, artist_ticker, avatar_cid, total_songs, total_plays, verified")
            .not("artist_name", "is", null)
            .ilike("artist_name", searchTerm)
            .order("total_plays", { ascending: false })
            .limit(100),
          supabase
            .from("songs")
            .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
            .not("token_address", "is", null) // Only show deployed songs
            .or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%,ticker.ilike.%${searchQuery}%`)
            .order("play_count", { ascending: false })
            .limit(100) // Fetch more than displayLimit to allow user to view all
        ]);

        if (artistsResponse.error) throw artistsResponse.error;
        if (songsResponse.error) throw songsResponse.error;
        
        setArtists(artistsResponse.data || []);
        setSongs(songsResponse.data || []);
      } else {
        // Show trending data when no search query
        const [artistsResponse, songsResponse] = await Promise.all([
          supabase
            .from("public_profiles")
            .select("wallet_address, artist_name, artist_ticker, avatar_cid, total_songs, total_plays, verified")
            .not("artist_name", "is", null)
            .gt("total_songs", 0)
            .order("total_plays", { ascending: false })
            .limit(100),
          supabase
            .from("songs")
            .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
            .not("token_address", "is", null) // Only show deployed songs
            .order("created_at", { ascending: false }) // Order by newest first to include new songs
            .limit(200) // Fetch more songs to ensure we get all trending ones
        ]);

        if (artistsResponse.error) throw artistsResponse.error;
        if (songsResponse.error) throw songsResponse.error;
        
        setArtists(artistsResponse.data || []);
        setSongs(songsResponse.data || []);
      }
    } catch (error) {
      console.error("Error fetching trending data:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Debounce search queries to avoid excessive API calls
  const debouncedFetch = useMemo(
    () => debounce(() => {
      fetchTrendingData();
    }, 500), // 500ms debounce for search
    [fetchTrendingData]
  );

  useEffect(() => {
    if (searchQuery) {
      // For search queries, use debounced fetch
      debouncedFetch();
    } else {
      // For initial load, fetch immediately
      fetchTrendingData();
    }
    
    // Cleanup debounced function on unmount
    return () => {
      // Clear any pending debounced calls
    };
  }, [searchQuery, debouncedFetch, fetchTrendingData]);

  // Periodic refresh (rate limited to avoid spam)
  useEffect(() => {
    // Only refresh if not searching (search has its own debounced refresh)
    if (searchQuery) return;
    
    // Refresh data every 60 seconds to catch new songs
    const refreshInterval = setInterval(() => {
      console.log('🔄 Refreshing trending data to catch new songs...');
      fetchTrendingData();
    }, 60 * 1000); // 60 seconds (increased from 30s to reduce load)
    
    return () => clearInterval(refreshInterval);
  }, [searchQuery, fetchTrendingData]);

  // Calculate true total volume across ALL songs (not just visible ones)
  useEffect(() => {
    let mounted = true;
    
    const calculateTotalVolume = async () => {
      if (!prices.xrge || prices.xrge === 0) {
        console.log('⏳ Waiting for XRGE price...');
        return;
      }
      
      try {
        setCalculatingVolume(true);
        console.log('💰 Calculating total volume across all songs...');
        
        // Fetch ALL songs with token addresses from database
        const { data: allSongs, error } = await supabase
          .from('songs')
          .select('id, token_address')
          .not('token_address', 'is', null)
          .limit(1000); // Reasonable limit
        
        if (error) {
          console.error('❌ Error fetching songs:', error);
          if (mounted) setTotalVolumeUSD(0);
          return;
        }
        
        if (!allSongs || allSongs.length === 0) {
          console.log('⚠️ No songs with token addresses found');
          if (mounted) setTotalVolumeUSD(0);
          return;
        }
        
        console.log(`💰 Fetched ${allSongs.length} songs with token addresses`);
        
        // Check if song_trades table exists, if not use song_purchases as fallback
        // song_trades uses trade_timestamp (BIGINT Unix milliseconds), not created_at
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000); // Unix timestamp in milliseconds
        
        // Try song_trades first (if it exists)
        let allTrades: any[] = [];
        let tradesError: any = null;
        
        // Query song_trades - trade_timestamp is BIGINT (Unix milliseconds)
        // Note: Supabase might need the value as a string for BIGINT comparison
        const { data: tradesData, error: tradesErr } = await supabase
          .from('song_trades')
          .select('song_id, xrge_amount, trade_timestamp')
          .in('song_id', allSongs.map(s => s.id))
          .gte('trade_timestamp', twentyFourHoursAgo) // BIGINT comparison
          .limit(10000);
        
        if (tradesErr) {
          console.error('❌ Error fetching song_trades:', tradesErr);
          console.warn('⚠️ Trying fallback to song_purchases...');
          
          // Fallback: Try to get any trades without time filter to see if table exists
          const { data: allTradesCheck, error: checkErr } = await supabase
            .from('song_trades')
            .select('id')
            .limit(1);
          
          if (checkErr) {
            console.error('❌ song_trades table does not exist or is inaccessible:', checkErr);
            if (mounted) setTotalVolumeUSD(0);
            return;
          }
          
          // Table exists but query failed - try without time filter
          console.warn('⚠️ Time-filtered query failed, trying all trades...');
          const { data: allTradesData, error: allTradesErr } = await supabase
            .from('song_trades')
            .select('song_id, xrge_amount, trade_timestamp')
            .in('song_id', allSongs.map(s => s.id))
            .limit(10000);
          
          if (allTradesErr) {
            console.error('❌ Error fetching all trades:', allTradesErr);
            if (mounted) setTotalVolumeUSD(0);
            return;
          }
          
          // Filter in JavaScript instead
          allTrades = (allTradesData || []).filter((trade: any) => {
            const timestamp = typeof trade.trade_timestamp === 'string' 
              ? parseInt(trade.trade_timestamp) 
              : trade.trade_timestamp;
            return timestamp >= twentyFourHoursAgo;
          });
        } else {
          allTrades = tradesData || [];
        }
        
        console.log(`💰 Found ${allTrades.length} trades in last 24h from database`);
        
        let totalVolumeXRGE = 0;
        
        if (allTrades.length > 0) {
          // Sum up 24h volume per song from database
          const volumeBySong: Record<string, number> = {};
          allTrades.forEach(trade => {
            if (trade.song_id && trade.xrge_amount) {
              const amount = typeof trade.xrge_amount === 'string' ? parseFloat(trade.xrge_amount) : trade.xrge_amount;
              volumeBySong[trade.song_id] = (volumeBySong[trade.song_id] || 0) + amount;
            }
          });
          
          totalVolumeXRGE = Object.values(volumeBySong).reduce((sum, vol) => sum + vol, 0);
        } else {
          // Fallback: Query XRGE Transfer events to/from bonding curve contract
          console.warn('⚠️ No trades in database - querying XRGE Transfer events directly...');
          
          if (publicClient && allSongs.length > 0) {
            try {
              const XRGE_TOKEN_ADDRESS = '0x147120faec9277ec02d957584cfcd92b56a24317' as Address;
              const FEE_ADDRESS = '0xb787433e138893a0ed84d99e82c7da260a940b1e'.toLowerCase();
              
              // Query XRGE Transfer events for last 24h
              const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
              const blockTime = 2000; // Base block time ~2 seconds
              const blocksAgo = Math.floor((Date.now() - twentyFourHoursAgo) / blockTime);
              
              const currentBlock = await publicClient.getBlockNumber();
              const fromBlock = currentBlock - BigInt(Math.min(blocksAgo, 500000)); // Max 500k blocks (~11.5 days)
              
              console.log(`📡 Querying XRGE Transfer events from block ${fromBlock.toString()} to ${currentBlock.toString()}`);
              
              // Get all XRGE Transfer events
              const ERC20_TRANSFER_ABI = [{
                anonymous: false,
                inputs: [
                  { indexed: true, name: 'from', type: 'address' },
                  { indexed: true, name: 'to', type: 'address' },
                  { indexed: false, name: 'value', type: 'uint256' }
                ],
                name: 'Transfer',
                type: 'event'
              }] as const;
              
              const xrgeLogs = await publicClient.getLogs({
                address: XRGE_TOKEN_ADDRESS,
                event: ERC20_TRANSFER_ABI[0],
                fromBlock,
                toBlock: 'latest'
              });
              
              console.log(`📊 Found ${xrgeLogs.length} XRGE Transfer events in last 24h`);
              
              // Group by transaction hash and filter for bonding curve trades
              const bondingCurveLower = BONDING_CURVE_ADDRESS.toLowerCase();
              const volumeByTx = new Map<string, number>();
              
              for (const log of xrgeLogs) {
                try {
                  const { args } = log as any;
                  const from = (args.from as string).toLowerCase();
                  const to = (args.to as string).toLowerCase();
                  const amount = Number(args.value as bigint) / 1e18;
                  
                  // Skip fee transfers
                  if (from === FEE_ADDRESS || to === FEE_ADDRESS) continue;
                  
                  // BUY: User sends XRGE TO bonding curve (to === bonding curve) - count this as volume
                  // SELL: User receives XRGE FROM bonding curve (from === bonding curve) - count this as volume
                  // For volume calculation, we count the XRGE that flows through the bonding curve
                  const txHash = log.transactionHash;
                  
                  if (to === bondingCurveLower) {
                    // BUY: User pays XRGE to bonding curve
                    const existing = volumeByTx.get(txHash) || 0;
                    volumeByTx.set(txHash, existing + amount);
                  } else if (from === bondingCurveLower) {
                    // SELL: User receives XRGE from bonding curve
                    const existing = volumeByTx.get(txHash) || 0;
                    volumeByTx.set(txHash, existing + amount);
                  }
                } catch (err) {
                  // Skip this log if there's an error
                  continue;
                }
              }
              
              // Filter to only transactions within 24h by checking block timestamps
              let volumeXRGE = 0;
              let validTxs = 0;
              
              // Get unique block numbers to batch timestamp queries
              const uniqueBlocks = new Set(Array.from(xrgeLogs).map(log => log.blockNumber));
              const blockTimestamps = new Map<bigint, number>();
              
              // Batch fetch block timestamps (limit to 50 to avoid timeout)
              const blockArray = Array.from(uniqueBlocks).slice(0, 50);
              for (const blockNum of blockArray) {
                try {
                  const block = await publicClient.getBlock({ blockNumber: blockNum });
                  blockTimestamps.set(blockNum, Number(block.timestamp) * 1000);
                } catch (err) {
                  // Skip if error
                }
              }
              
              // Sum volume from transactions within 24h
              for (const [txHash, amount] of volumeByTx.entries()) {
                const log = xrgeLogs.find(l => l.transactionHash === txHash);
                if (!log) continue;
                
                const timestamp = blockTimestamps.get(log.blockNumber);
                if (timestamp && timestamp >= twentyFourHoursAgo) {
                  volumeXRGE += amount;
                  validTxs++;
                } else if (!timestamp) {
                  // If we don't have timestamp, include it anyway (within our block range)
                  volumeXRGE += amount;
                  validTxs++;
                }
              }
              
              console.log(`💰 Calculated ${volumeXRGE.toFixed(2)} XRGE from ${validTxs} valid transactions in last 24h`);
              
              totalVolumeXRGE = volumeXRGE;
            } catch (blockchainErr) {
              console.error('❌ Error calculating volume from blockchain:', blockchainErr);
              totalVolumeXRGE = 0;
            }
          } else {
            console.warn('⚠️ No blockchain client available - cannot calculate volume');
            totalVolumeXRGE = 0;
          }
        }
        
        // Calculate total volume in USD
        const totalVolumeInUSD = totalVolumeXRGE * prices.xrge;
        
        console.log(`💰 Total 24h Volume: ${totalVolumeXRGE.toFixed(2)} XRGE = $${totalVolumeInUSD.toLocaleString()}`);
        
        if (mounted) {
          setTotalVolumeUSD(totalVolumeInUSD);
        }
      } catch (error) {
        console.error('❌ Error calculating total volume:', error);
        if (mounted) setTotalVolumeUSD(0);
      } finally {
        if (mounted) {
          setCalculatingVolume(false);
        }
      }
    };
    
    // Calculate on mount and when XRGE price changes (but only once per price change)
    calculateTotalVolume();
    
    return () => {
      mounted = false;
    };
  }, [prices.xrge]); // Removed calculatingVolume from dependencies to prevent infinite loop


  // Sort songs based on selected field (reactive to songStats changes)
  const sortedSongs = useMemo(() => {
    const sorted = [...songs].sort((a, b) => {
      let aValue: number;
      let bValue: number;
      
      switch (sortField) {
        case 'trending':
          aValue = calculateTrendingScore(a);
          bValue = calculateTrendingScore(b);
          break;
        case 'price':
          aValue = songStats.get(a.id)?.price || 0;
          bValue = songStats.get(b.id)?.price || 0;
          break;
        case 'change':
          aValue = songStats.get(a.id)?.change || 0;
          bValue = songStats.get(b.id)?.change || 0;
          break;
        case 'volume':
          aValue = songStats.get(a.id)?.volume || 0;
          bValue = songStats.get(b.id)?.volume || 0;
          break;
        case 'marketCap':
          aValue = songStats.get(a.id)?.marketCap || 0;
          bValue = songStats.get(b.id)?.marketCap || 0;
          break;
        case 'plays':
          aValue = a.play_count;
          bValue = b.play_count;
          break;
        default:
          aValue = calculateTrendingScore(a);
          bValue = calculateTrendingScore(b);
      }
      
      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });
    
    // Apply display limit if set (but always return full sorted list for data loading)
    return sorted;
  }, [songs, sortField, sortDirection, songStats, calculateTrendingScore]);
  
  // Separate displayed songs (applies displayLimit and visibleCount for lazy loading)
  const displayedSongs = useMemo(() => {
    const limited = displayLimit ? sortedSongs.slice(0, displayLimit) : sortedSongs;
    // Only show visibleCount items for lazy loading
    return limited.slice(0, visibleCount);
  }, [sortedSongs, displayLimit, visibleCount]);
  
  // Get top 5 songs for cycling featured card - only recalc when songs list or calculation function changes
  // Note: calculateTrendingScore already depends on songStats, so we don't need songStats here
  const top5Songs = useMemo(() => {
    if (songs.length === 0) return [];
    
    return [...songs]
      .sort((a, b) => calculateTrendingScore(b) - calculateTrendingScore(a))
      .slice(0, 5); // Top 5 songs
  }, [songs, calculateTrendingScore]);
  
  // State to track which song is currently showing in featured card (cycles through top 5)
  const [featuredSongIndex, setFeaturedSongIndex] = useState(0);
  const [nextSongIndex, setNextSongIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAutoCyclePaused, setIsAutoCyclePaused] = useState(() => {
    // Load pause state from localStorage
    const saved = localStorage.getItem('trending_autoCycle_paused');
    return saved === 'true';
  });
  
  // Reset index when top 5 songs change (e.g., new data loaded)
  useEffect(() => {
    if (top5Songs.length > 0 && featuredSongIndex >= top5Songs.length) {
      setFeaturedSongIndex(0);
    }
  }, [top5Songs, featuredSongIndex]);
  
  // Pre-load next song index (for pre-rendering)
  const nextSongIndexForPreload = top5Songs.length > 0 ? (featuredSongIndex + 1) % top5Songs.length : null;
  const nextSongForPreload = nextSongIndexForPreload !== null ? top5Songs[nextSongIndexForPreload] : null;
  
  // Save pause state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('trending_autoCycle_paused', String(isAutoCyclePaused));
  }, [isAutoCyclePaused]);

  // Infinite scroll: Load more songs as user scrolls
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      
      // Use different thresholds for mobile vs desktop
      // Mobile: trigger at 50% (earlier) for better UX
      // Desktop: trigger at 70% (still earlier than before)
      const isMobile = window.innerWidth < 768;
      const threshold = isMobile ? 0.5 : 0.7;
      
      // When user scrolls to threshold, load 5 more items
      if (scrollPosition >= pageHeight * threshold) {
        const totalAvailable = displayLimit ? Math.min(sortedSongs.length, displayLimit) : sortedSongs.length;
        if (visibleCount < totalAvailable) {
          setVisibleCount(prev => Math.min(prev + 5, totalAvailable));
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, sortedSongs.length, displayLimit]);

  // Reset visible count when displayLimit or sortedSongs changes
  useEffect(() => {
    setVisibleCount(5); // Reset to 5 items when filters change
  }, [displayLimit, sortField, sortDirection, searchQuery]);

  // Cycle through top 5 songs every 8 seconds (only when not paused)
  useEffect(() => {
    if (top5Songs.length === 0 || isAutoCyclePaused) return;
    
    const interval = setInterval(() => {
      const next = (featuredSongIndex + 1) % top5Songs.length;
      // Start transition: the pre-loaded component will become visible
      setIsTransitioning(true);
      setNextSongIndex(next);
      // Show skeleton briefly, then fade in new song
      setTimeout(() => {
        setFeaturedSongIndex(next);
        // Clear nextSong after a brief delay to ensure smooth handoff
        setTimeout(() => {
          setNextSongIndex(null);
          // Hide skeleton after new song is visible
          setTimeout(() => {
            setIsTransitioning(false);
          }, 200);
        }, 100);
      }, 750); // Match transition duration (700ms) + small buffer
    }, 8000); // Cycle every 8 seconds
    
    return () => clearInterval(interval);
  }, [top5Songs.length, featuredSongIndex, isAutoCyclePaused]);
  
  // Handle manual navigation
  const handleFeaturedSongChange = (index: number) => {
    if (index === featuredSongIndex) return;
    setIsTransitioning(true);
    setNextSongIndex(index);
    setTimeout(() => {
      setFeaturedSongIndex(index);
      setTimeout(() => {
        setNextSongIndex(null);
        // Hide skeleton after new song is visible
        setTimeout(() => {
          setIsTransitioning(false);
        }, 200);
      }, 100);
    }, 750);
  };
  
  // Current featured song (cycles through top 5)
  const featuredSong = top5Songs[featuredSongIndex] || null;
  const nextSong = nextSongIndex !== null ? top5Songs[nextSongIndex] : null;

  // Don't show full page loading - show skeleton instead

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-20 pt-0">
        <AppTutorial />
        
        {/* Stunning Hero Section */}
        <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/20 via-purple-500/10 to-pink-500/10 blur-3xl opacity-50 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
        
        <div className="relative z-20 text-center px-4 md:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
          <div className="mb-3 md:mb-4 flex justify-center items-center gap-2 md:gap-3">
            <MusicBars bars={6} className="h-6 md:h-12 flex-shrink-0 animate-pulse" />
            <div className="relative">
              <img src={logo} alt="ROUGEE Logo" className="w-10 h-10 md:w-16 md:h-16 rounded-full object-cover border-2 border-neon-green/30 shadow-[0_0_30px_rgba(0,255,159,0.3)] animate-pulse" />
              <div className="absolute inset-0 bg-neon-green/20 rounded-full animate-ping" />
            </div>
            <MusicBars bars={6} className="h-6 md:h-12 flex-shrink-0 animate-pulse" />
          </div>
          <h1 className="text-2xl md:text-5xl font-bold mb-2 md:mb-3 bg-gradient-to-r from-neon-green via-purple-400 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(0,255,159,0.5)]">
            TRENDING
          </h1>
          <p className="text-xs md:text-base text-muted-foreground max-w-2xl mx-auto leading-tight">
            Discover the hottest tracks and rising artists on the decentralized music platform
          </p>
        </div>
      </div>
      
      <main className="w-full px-0 md:px-0 md:container md:mx-auto py-2 md:py-4" data-tour="trending">
        {/* Enhanced Live Stats Ticker */}
        {loading ? (
          <div className="mb-4 md:mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 px-0 md:px-0">
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </div>
        ) : (
          <TrendingHero
            songsCount={songs.length}
            totalVolumeUSD={totalVolumeUSD}
            calculatingVolume={calculatingVolume}
            topGainerPercent={topGainerPercent}
            artistsCount={artists.length}
          />
        )}

        {/* Featured/Promoted Banner with Real Data - Cycles through top 5 songs */}
        {loading ? (
          <div className="mb-6 md:mb-10 px-4 md:px-0">
            <FeaturedSongSkeleton />
          </div>
        ) : featuredSong && top5Songs.length > 0 ? (
          <div className="relative mb-6 md:mb-10 px-0 md:px-0" style={{ zIndex: 1 }}>
            {/* Container for both cards during transition - dynamic height prevents content cutoff */}
            <div className="relative w-full overflow-hidden min-h-[380px] md:h-[520px]">
              {/* Skeleton loader - shows during transition */}
              {isTransitioning && (
                <div
                  className="absolute top-0 left-0 right-0 w-full transition-opacity duration-300 ease-in-out"
                  style={{
                    zIndex: 4,
                    opacity: 1,
                    height: '100%'
                  }}
                >
                  <FeaturedSongSkeleton />
                </div>
              )}
              
              {/* Current song - always mounted with stable key */}
              {featuredSong && (
                <div
                  key={`featured-${featuredSongIndex}`}
                  className={`w-full transition-all duration-[700ms] ease-in-out ${nextSong ? 'absolute top-0 left-0 right-0' : 'relative'}`}
                  style={{
                    zIndex: nextSong ? (isTransitioning ? 0 : 2) : 3,
                    opacity: nextSong ? 0 : 1,
                    transform: nextSong ? 'translateX(-32px) scale(0.98)' : 'translateX(0) scale(1)',
                    filter: nextSong ? 'blur(4px)' : 'blur(0)',
                    pointerEvents: nextSong ? 'none' : 'auto',
                    height: nextSong ? '100%' : 'auto'
                  }}
                >
                  <TrendingFeaturedSong 
                    key={featuredSong.id}
                    song={featuredSong} 
                    playSong={playSong} 
                    currentSong={currentSong} 
                    isPlaying={isPlaying}
                    rank={featuredSongIndex + 1}
                  />
                </div>
              )}
              
              {/* Next song - always mounted (pre-loaded) but hidden until transition */}
              {nextSongForPreload && nextSongForPreload.id !== featuredSong?.id && (
                <div
                  key={`preload-${nextSongIndexForPreload}`}
                  className={`absolute top-0 left-0 right-0 w-full transition-all duration-[700ms] ease-in-out ${nextSong?.id === nextSongForPreload.id ? '' : 'pointer-events-none'}`}
                  style={{
                    zIndex: nextSong?.id === nextSongForPreload.id ? (isTransitioning ? 0 : 3) : 1,
                    opacity: nextSong?.id === nextSongForPreload.id ? (isTransitioning ? 0 : 1) : 0,
                    transform: nextSong?.id === nextSongForPreload.id ? 'translateX(0) scale(1)' : 'translateX(30px) scale(0.98)',
                    filter: nextSong?.id === nextSongForPreload.id ? 'blur(0)' : 'blur(4px)',
                    pointerEvents: nextSong?.id === nextSongForPreload.id ? 'auto' : 'none',
                    height: '100%'
                  }}
                >
                  <TrendingFeaturedSong 
                    key={nextSongForPreload.id}
                    song={nextSongForPreload} 
                    playSong={playSong} 
                    currentSong={currentSong} 
                    isPlaying={isPlaying}
                    rank={(nextSongIndexForPreload ?? 0) + 1}
                  />
                </div>
              )}
            </div>
            
            {top5Songs.length > 1 && (
              <>
                {/* Navigation Dots */}
                <div className="absolute top-4 left-6 md:left-4 flex gap-1.5 z-50 bg-black/60 backdrop-blur-md px-2 py-1.5 rounded-full border border-white/10">
                  {top5Songs.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => handleFeaturedSongChange(index)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === featuredSongIndex 
                          ? 'w-8 bg-neon-green shadow-[0_0_8px_rgba(0,255,159,0.6)]' 
                          : 'w-2 bg-white/30 hover:bg-white/50 hover:w-3'
                      }`}
                      aria-label={`Show featured song ${index + 1}`}
                    />
                  ))}
                </div>
                {/* Pause/Resume Button */}
                <div className="absolute top-4 right-6 md:right-4 z-50">
                  <button
                    onClick={() => setIsAutoCyclePaused(!isAutoCyclePaused)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:border-neon-green/50 hover:bg-black/80 transition-all font-mono text-xs uppercase text-white/70 hover:text-neon-green group"
                    title={isAutoCyclePaused ? 'Resume auto-cycling' : 'Pause auto-cycling'}
                  >
                    {isAutoCyclePaused ? (
                      <>
                        <Play className="w-3 h-3 group-hover:scale-110 transition-transform" />
                        <span>RESUME</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3 h-3 group-hover:scale-110 transition-transform" />
                        <span>PAUSE</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* Time Filter & Section Header */}
        <div className="mb-6 md:mb-8 px-0 md:px-0 relative" style={{ zIndex: 10 }}>
          <div className="flex flex-col gap-4 mb-4 md:mb-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold font-mono mb-2 neon-text flex items-center gap-2 md:gap-3">
                <Flame className="w-6 md:w-8 h-6 md:h-8 text-orange-500 animate-pulse" />
                {searchQuery ? `SEARCH RESULTS` : `TRENDING`}
              </h1>
              <p className="text-muted-foreground font-mono text-xs md:text-sm">
                {searchQuery 
                  ? `Search results for "${searchQuery}"` 
                  : `Top artists and songs ranked by trading activity & plays`
                }
              </p>
            </div>
            
            {/* Time Filter Buttons */}
            <div className="flex items-center gap-1 md:gap-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-1 w-fit">
              <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground ml-1" />
              <button
                onClick={() => setTimeFilter('24H')}
                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-mono transition-all ${
                  timeFilter === '24H'
                    ? 'bg-neon-green text-black shadow-[0_0_12px_rgba(0,255,159,0.5)]'
                    : 'text-muted-foreground hover:text-neon-green hover:bg-white/5'
                }`}
              >
                24H
              </button>
              <button
                onClick={() => setTimeFilter('7D')}
                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-mono transition-all ${
                  timeFilter === '7D'
                    ? 'bg-neon-green text-black shadow-[0_0_12px_rgba(0,255,159,0.5)]'
                    : 'text-muted-foreground hover:text-neon-green hover:bg-white/5'
                }`}
              >
                7D
              </button>
              <button
                onClick={() => setTimeFilter('30D')}
                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-mono transition-all ${
                  timeFilter === '30D'
                    ? 'bg-neon-green text-black shadow-[0_0_12px_rgba(0,255,159,0.5)]'
                    : 'text-muted-foreground hover:text-neon-green hover:bg-white/5'
                }`}
              >
                30D
              </button>
              <button
                onClick={() => setTimeFilter('ALL')}
                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-mono transition-all ${
                  timeFilter === 'ALL'
                    ? 'bg-neon-green text-black shadow-[0_0_12px_rgba(0,255,159,0.5)]'
                    : 'text-muted-foreground hover:text-neon-green hover:bg-white/5'
                }`}
              >
                ALL
              </button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="songs" className="w-full px-0 md:px-0 relative" style={{ zIndex: 10 }}>
          <TabsList className="grid w-full max-w-sm md:max-w-md grid-cols-2 mb-4 md:mb-6 bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-1 relative" style={{ zIndex: 10 }}>
            <TabsTrigger 
              value="songs"
              className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green font-mono rounded-lg transition-all text-xs md:text-sm"
            >
              SONGS
            </TabsTrigger>
            <TabsTrigger 
              value="artists"
              className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green font-mono rounded-lg transition-all text-xs md:text-sm"
            >
              ARTISTS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="songs" className="space-y-4">
            <TrendingSongsTable
              songs={songs}
              displayedSongs={displayedSongs}
              loading={loading}
              searchQuery={searchQuery}
              sortField={sortField}
              sortDirection={sortDirection}
              displayLimit={displayLimit}
              visibleCount={visibleCount}
              sortedSongs={sortedSongs}
              onSort={handleSort}
              onDisplayLimitChange={setDisplayLimit}
              onStatsUpdate={handleStatsUpdate}
              playSong={playSong}
              currentSong={currentSong}
              isPlaying={isPlaying}
            />
          </TabsContent>

          <TabsContent value="artists" className="space-y-4">
            <TrendingArtistsTable
              artists={artists}
              loading={loading}
              searchQuery={searchQuery}
              displayLimit={displayLimit}
              onDisplayLimitChange={setDisplayLimit}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Trending;
