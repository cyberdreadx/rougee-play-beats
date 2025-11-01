import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NetworkInfo from "@/components/NetworkInfo";
import { Loader2, TrendingUp, TrendingDown, Flame, Music, Play, Pause, ChevronDown, ChevronUp, Clock, Zap, BarChart3, Sparkles } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import logo from "@/assets/logo.png";
import MusicBars from "@/components/MusicBars";
import { AppTutorial } from "@/components/AppTutorial";
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
import { useSongPrice, useSongMetadata, useBondingCurveSupply } from "@/hooks/useSongBondingCurve";
import { useSong24hData } from "@/hooks/useSong24hData";
import { usePublicClient } from "wagmi";
import { Address } from "viem";
import { AiBadge } from "@/components/AiBadge";
import { SongPriceSparkline } from "@/components/SongPriceSparkline";
import { SongTradingChart } from "@/components/SongTradingChart";
import { AudioWaveform } from "@/components/AudioWaveform";
import { useAudioStateForSong } from "@/hooks/useAudioState";
import SongTradingHistory, { TradeData } from "@/components/SongTradingHistory";
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
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,255,159,0.15)] p-6 pb-8">
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
    <div className="group relative bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 rounded-xl p-5">
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-2xl" />
      <div className="h-5 w-5 bg-white/10 rounded mb-2 animate-pulse" />
      <div className="h-4 bg-white/10 rounded w-20 mb-2 animate-pulse" />
      <div className="h-8 bg-white/10 rounded w-16 animate-pulse" />
    </div>
  ));
  StatsCardSkeleton.displayName = 'StatsCardSkeleton';

  // Skeleton for table row (desktop)
  const SongRowSkeleton = memo(() => (
    <TableRow className="hover:bg-transparent">
      <TableCell className="w-12">
        <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
          <div className="w-10 h-10 rounded bg-white/10 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/10 rounded w-32 animate-pulse" />
            <div className="h-3 bg-white/10 rounded w-24 animate-pulse" />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="w-32 h-10 bg-white/10 rounded animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="w-32 h-4 bg-white/10 rounded animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-right">
          <div className="h-4 bg-white/10 rounded w-20 ml-auto animate-pulse" />
          <div className="h-3 bg-white/10 rounded w-16 ml-auto animate-pulse" />
        </div>
      </TableCell>
      <TableCell>
        <div className="h-4 bg-white/10 rounded w-16 ml-auto animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="h-4 bg-white/10 rounded w-20 ml-auto animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="h-4 bg-white/10 rounded w-20 ml-auto animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="h-4 bg-white/10 rounded w-16 ml-auto animate-pulse" />
      </TableCell>
    </TableRow>
  ));
  SongRowSkeleton.displayName = 'SongRowSkeleton';

  // Skeleton for song card (mobile)
  const SongCardSkeleton = memo(() => (
    <div className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded bg-white/10 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse" />
        </div>
        <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
      </div>
      <div className="h-24 bg-white/5 rounded-lg animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="h-3 bg-white/10 rounded w-12 animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-16 animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-20 animate-pulse" />
      </div>
    </div>
  ));
  SongCardSkeleton.displayName = 'SongCardSkeleton';

  // Skeleton for artist row
  const ArtistRowSkeleton = memo(() => (
    <TableRow className="hover:bg-transparent">
      <TableCell className="w-12">
        <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded w-32 animate-pulse" />
            <div className="h-3 bg-white/10 rounded w-16 animate-pulse" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="h-4 bg-white/10 rounded w-16 animate-pulse" />
      </TableCell>
      <TableCell className="text-right">
        <div className="h-4 bg-white/10 rounded w-8 ml-auto animate-pulse" />
      </TableCell>
      <TableCell className="text-right">
        <div className="h-4 bg-white/10 rounded w-12 ml-auto animate-pulse" />
      </TableCell>
    </TableRow>
  ));
  ArtistRowSkeleton.displayName = 'ArtistRowSkeleton';

  // Component for featured banner with real data
  const FeaturedSong = memo(({ song, playSong, currentSong, isPlaying, rank }: { song: Song; playSong?: (song: any) => void; currentSong?: any; isPlaying?: boolean; rank?: number }) => {
  const navigate = useNavigate();
  const { prices } = useTokenPrices();
  const publicClient = usePublicClient();
  const [change24h, setChange24h] = useState<number>(0);
  const [volume24h, setVolume24h] = useState<number>(0);
  const [recentTrades, setRecentTrades] = useState<TradeData[]>([]);
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(false);
  
  
  const isCurrentSong = currentSong?.id === song.id;
  const isThisSongPlaying = isCurrentSong && isPlaying;
  
  
  // Get current price from bonding curve with auto-refresh for real-time trending
  const { price: priceData } = useSongPrice(song.token_address as Address, true);
  const priceInXRGE = priceData ? parseFloat(priceData) : undefined;
  
  // Get metadata and supply using proper hooks with auto-refresh for real-time trending
  const { metadata: metadataData, isLoading: metadataLoading, error: metadataError } = useSongMetadata(song.token_address as Address);
  const { supply: bondingSupply, isLoading: supplyLoading, error: supplyError } = useBondingCurveSupply(song.token_address as Address, true);
  
  
  
  const bondingSupplyStr = bondingSupply ? bondingSupply.toString() : null;
  
  // Calculate 24h change based on bonding curve position
  useEffect(() => {
    const calculate24hChange = async () => {
      if (!publicClient || !song.token_address) return;
      
      try {
        // Get current bonding curve data
        const currentSupply = parseFloat(bondingSupplyStr || '0');
        const currentPriceCalc = priceInXRGE || 0;
        
        // For now, use a simple calculation based on bonding curve position
        // A higher supply means more tokens have been bought, indicating price increase
        const baseSupply = 1000000; // 1M tokens as baseline
        const supplyChange = currentSupply - baseSupply;
        
        // Calculate percentage change based on supply change
        // More supply = higher price = positive change
        const changePercent = supplyChange > 0 ? 
          Math.min((supplyChange / baseSupply) * 100, 1000) : // Cap at 1000%
          Math.max((supplyChange / baseSupply) * 100, -90); // Cap at -90%
        
        setChange24h(changePercent);
      } catch (error) {
        console.error('Failed to calculate 24h change:', error);
        setChange24h(0);
      }
    };
    
    calculate24hChange();
  }, [publicClient, song.token_address, bondingSupplyStr, priceInXRGE]);
  
  // EXACTLY match SongTrade page calculations
  const currentPrice = priceInXRGE && prices.xrge ? priceInXRGE * prices.xrge : undefined;
  const xrgeUsdPrice = prices.xrge || 0;
  const activeTradingSupply = bondingSupply ? parseFloat(bondingSupply) : undefined;
  const totalSupply = metadataData?.totalSupply ? parseFloat(metadataData.totalSupply) : undefined;
  const xrgeRaisedNum = metadataData?.xrgeRaised ? parseFloat(metadataData.xrgeRaised) : 0;
  
  // Volume = actual 24h trading volume, fallback to realized value if no 24h data
  const volumeXRGE = xrgeRaisedNum > 0 ? xrgeRaisedNum : 0; // Use xrgeRaised as fallback for featured song
  const volumeUSD = volumeXRGE * xrgeUsdPrice;
  
  
  // Calculate tokens sold - EXACTLY match SongTrade
  const tokensSold = activeTradingSupply !== undefined ? (990_000_000 - activeTradingSupply) : undefined;
  
  // Market Cap = Fully Diluted Valuation (current price × total supply / 10) - EXACTLY match SongTrade
  const fullyDilutedValue = currentPrice && totalSupply ? (currentPrice * totalSupply) / 10 : undefined;
  const marketCapUSD = fullyDilutedValue || 0; // Use fully diluted value as market cap (divided by 10)
  const realizedValueXRGE = xrgeRaisedNum; // Actual XRGE spent by traders
  const realizedValueUSD = xrgeRaisedNum * xrgeUsdPrice; // Convert to USD
  
  // Use fully diluted value as the market cap - EXACTLY match SongTrade
  const marketCap = marketCapUSD;
  
  return (
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,255,159,0.15)] p-6 pb-8 hover:bg-white/8 hover:border-white/30 hover:shadow-[0_8px_32px_0_rgba(0,255,159,0.25)] transition-all duration-300">
      {/* Faded background album cover */}
      {song.cover_cid && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10 blur-sm"
          style={{ backgroundImage: `url(${getIPFSGatewayUrl(song.cover_cid)})` }}
        />
      )}
      
      {/* Content overlay */}
      <div className="relative z-10">
        <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-mono font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <Flame className="w-3 h-3" />
          #{rank || 1} TRENDING
        </div>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
        <div className="relative group">
          {song.cover_cid ? (
            <img
              src={getIPFSGatewayUrl(song.cover_cid)}
              alt={song.title}
              className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover shadow-2xl group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl bg-neon-green/10 flex items-center justify-center">
              <Music className="w-12 h-12 text-neon-green" />
            </div>
          )}
          
          {/* Play button overlay */}
          {playSong && song.audio_cid && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playSong(song);
              }}
              className="absolute bottom-2 right-2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-neon-green hover:bg-neon-green/80 active:bg-neon-green/70 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-2xl shadow-neon-green/50 z-20"
              data-tour="play-button"
            >
              {isThisSongPlaying ? (
                <Pause className="w-6 h-6 md:w-7 md:h-7 text-black fill-black" />
              ) : (
                <Play className="w-6 h-6 md:w-7 md:h-7 text-black fill-black ml-0.5" />
              )}
            </button>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-2xl md:text-3xl font-bold font-mono neon-text mb-2 flex items-center gap-2">
            <span>{song.title}</span>
            <AiBadge aiUsage={song.ai_usage} size="md" />
          </h3>
          <p className="text-muted-foreground font-mono mb-3">
            By {song.artist || 'Unknown'} • {song.ticker && `$${song.ticker}`}
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="bg-black/40 rounded-lg px-3 py-2 border border-white/5 hover:border-neon-green/20 transition-colors">
              <div className="text-xs text-muted-foreground font-mono">PRICE (USD)</div>
              <div className="text-sm font-bold font-mono neon-text">
                ${currentPrice ? (currentPrice < 0.000001 ? currentPrice.toFixed(10) : currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(6)) : '$0.000000'}
              </div>
              {priceInXRGE && (
                <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                  {priceInXRGE < 0.000001 ? priceInXRGE.toFixed(10) : priceInXRGE.toFixed(8)} XRGE
                </div>
              )}
            </div>
            <div className="bg-black/40 rounded-lg px-3 py-2 border border-white/5 hover:border-green-400/20 transition-colors">
              <div className="text-xs text-muted-foreground font-mono">MKT CAP</div>
              <div className="text-sm font-bold font-mono text-green-400">
                ${marketCap < 1 ? marketCap.toFixed(2) : marketCap.toLocaleString(undefined, {maximumFractionDigits: 2})}
              </div>
            </div>
            <div className="bg-black/40 rounded-lg px-3 py-2 border border-white/5 hover:border-blue-400/20 transition-colors">
              <div className="text-xs text-muted-foreground font-mono">VOLUME</div>
              <div className="text-sm font-bold font-mono text-blue-400">
                ${volumeUSD < 1 ? volumeUSD.toFixed(4) : volumeUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {volumeXRGE.toLocaleString(undefined, {maximumFractionDigits: 2})} XRGE
              </div>
            </div>
            <div className="bg-black/40 rounded-lg px-3 py-2 border border-white/5 hover:border-orange-400/20 transition-colors">
              <div className="text-xs text-muted-foreground font-mono">PLAYS</div>
              <div className="text-sm font-bold font-mono text-orange-400">
                <Flame className="w-3 h-3 inline mr-1" />
                {song.play_count}
              </div>
            </div>
          </div>
          
          {/* Price Chart - Collapsible */}
          <div className="bg-black/40 rounded-lg px-4 py-3 border border-neon-green/20 hover:border-neon-green/40 transition-colors" data-tour="featured-chart">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-neon-green" />
                PRICE CHART
              </div>
              <button
                onClick={() => setIsChartExpanded(!isChartExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-green transition-colors font-mono px-2 py-1 rounded hover:bg-white/5"
              >
                {isChartExpanded ? 'HIDE' : 'SHOW'}
                {isChartExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>
            {isChartExpanded && song.token_address && (
              <>
                {/* Hidden - Trading History Data Loader (EXACTLY like SongTrade page) */}
                <div className="hidden">
                  <SongTradingHistory 
                    tokenAddress={song.token_address as Address}
                    xrgeUsdPrice={xrgeUsdPrice}
                    songTicker={song.ticker || undefined}
                    coverCid={song.cover_cid || undefined}
                    currentPriceInXRGE={priceInXRGE}
                    onVolumeCalculated={setVolume24h}
                    showRecentTrades={false}
                    onTradesLoaded={(trades) => {
                      setRecentTrades(trades);
                    }}
                  />
                </div>
                
                {/* Trading Chart with Real Trade Data */}
                <SongTradingChart 
                  songTokenAddress={song.token_address as Address}
                  priceInXRGE={priceInXRGE}
                  bondingSupply={bondingSupply}
                  trades={recentTrades}
                />
              </>
            )}
          </div>
          
          {/* Audio Waveform */}
          {song.audio_cid && (
            <div className="bg-black/40 rounded-lg px-4 py-3 border border-neon-green/20 mt-3">
              <div className="text-xs text-muted-foreground font-mono mb-2">AUDIO WAVEFORM</div>
              <TrendingWaveform songId={song.id} audioCid={song.audio_cid} />
            </div>
          )}
        </div>
        <button 
          onClick={() => navigate(`/song/${song.id}`)}
          className="bg-neon-green hover:bg-neon-green/80 text-black font-mono font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 shadow-lg shadow-neon-green/20 mt-4 md:mt-0 md:ml-auto"
        >
          TRADE NOW →
        </button>
      </div>
      </div>
    </div>
  );
});
FeaturedSong.displayName = 'FeaturedSong';

// Component for individual song row with real-time data
const SongRow = memo(({ song, index, onStatsUpdate, playSong, currentSong, isPlaying, style }: { song: Song; index: number; onStatsUpdate?: (songId: string, volume: number, change: number, marketCap: number, price: number) => void; playSong?: (song: any) => void; currentSong?: any; isPlaying?: boolean; style?: React.CSSProperties }) => {
  const navigate = useNavigate();
  const { prices } = useTokenPrices();
  
  const isCurrentSong = currentSong?.id === song.id;
  const isThisSongPlaying = isCurrentSong && isPlaying;
  
  // Get current price from bonding curve with auto-refresh for real-time trending
  const { price: priceData } = useSongPrice(song.token_address as Address, true);
  const priceInXRGE = priceData ? parseFloat(priceData) : undefined;
  
  // Get metadata and supply using proper hooks with auto-refresh for real-time trending
  const { metadata: metadataData, isLoading: metadataLoading } = useSongMetadata(song.token_address as Address);
  const { supply: bondingSupply, isLoading: supplyLoading } = useBondingCurveSupply(song.token_address as Address, true);
  
  
  // Convert bondingSupply to a stable string value to prevent infinite loops
  const bondingSupplyStr = bondingSupply ? bondingSupply.toString() : null;
  
  // Use shared 24h data hook for consistent data between mobile and desktop
  // bypassCache=true ensures real-time trending data (no caching)
  const { priceChange24h, volume24h } = useSong24hData(song.token_address as Address, bondingSupplyStr, true);
  
  // EXACTLY match SongTrade page calculations
  const currentPrice = priceInXRGE && prices.xrge ? priceInXRGE * prices.xrge : undefined;
  const xrgeUsdPrice = prices.xrge || 0;
  const activeTradingSupply = bondingSupply ? parseFloat(bondingSupply) : undefined;
  const totalSupply = metadataData?.totalSupply ? parseFloat(metadataData.totalSupply) : undefined;
  const xrgeRaisedNum = metadataData?.xrgeRaised ? parseFloat(metadataData.xrgeRaised) : 0;
  
  // Volume = actual 24h trading volume, fallback to realized value if no 24h data
  const volumeXRGE = volume24h > 0 ? volume24h : (xrgeRaisedNum > 0 ? xrgeRaisedNum : 0);
  const volumeUSD = volumeXRGE * xrgeUsdPrice;
  
  // Calculate tokens sold - EXACTLY match SongTrade
  const tokensSold = activeTradingSupply !== undefined ? (990_000_000 - activeTradingSupply) : undefined;
  
  // Market Cap = Fully Diluted Valuation (current price × total supply / 10) - EXACTLY match SongTrade
  const fullyDilutedValue = currentPrice && totalSupply ? (currentPrice * totalSupply) / 10 : undefined;
  const marketCapUSD = fullyDilutedValue || 0; // Use fully diluted value as market cap (divided by 10)
  const realizedValueXRGE = xrgeRaisedNum; // Actual XRGE spent by traders
  const realizedValueUSD = xrgeRaisedNum * xrgeUsdPrice; // Convert to USD
  
  // Use fully diluted value as the market cap - EXACTLY match SongTrade
  const marketCap = marketCapUSD;
  
  
  // Use real 24h price change (fetched from blockchain)
  const change24h = priceChange24h ?? 0;
  const isPositive = change24h > 0;
  
  // Report stats to parent for aggregation
  useEffect(() => {
    if (onStatsUpdate) {
      onStatsUpdate(song.id, volumeUSD, change24h, marketCap, currentPrice || 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, volumeUSD, change24h, marketCap, currentPrice]);
  
  // Desktop: Table Row
  const desktopView = (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => navigate(`/song/${song.id}`)}
      style={style}
    >
      <TableCell className="font-mono text-muted-foreground w-12">
        #{index + 1}
      </TableCell>
      
      <TableCell>
        <div className="flex items-center gap-3">
          {/* Play button */}
          {playSong && song.audio_cid && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playSong(song);
              }}
              className="w-8 h-8 rounded-full bg-neon-green hover:bg-neon-green/80 active:bg-neon-green/70 flex items-center justify-center transition-all hover:scale-110 active:scale-95 flex-shrink-0"
            >
              {isThisSongPlaying ? (
                <Pause className="w-4 h-4 text-black fill-black" />
              ) : (
                <Play className="w-4 h-4 text-black fill-black ml-0.5" />
              )}
            </button>
          )}
          
          <div className="relative flex-shrink-0">
            {song.cover_cid ? (
              <img
                src={getIPFSGatewayUrl(song.cover_cid)}
                alt={song.title}
                className="w-10 h-10 rounded object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-neon-green/10 flex items-center justify-center">
                <Music className="w-5 h-5 text-neon-green" />
              </div>
            )}
            {index < 3 && (
              <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1">
                <Flame className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              <span>{song.title}</span>
              {song.ticker && (
                <span className="text-xs text-neon-green font-mono flex-shrink-0">${song.ticker}</span>
              )}
              <AiBadge aiUsage={song.ai_usage} size="sm" />
              {change24h > 50 && (
                <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-mono font-bold flex-shrink-0">
                  🚀 HOT
                </span>
              )}
            </div>
            <div 
              className="text-sm text-muted-foreground hover:text-neon-green transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (song.wallet_address) navigate(`/artist/${song.wallet_address}`);
              }}
            >
              {song.artist || 'Unknown'}
            </div>
          </div>
        </div>
      </TableCell>
      
      {/* Chart Column - Only render when we have price data */}
      <TableCell>
        {song.token_address && priceInXRGE !== undefined && bondingSupplyStr ? (
          <div className="w-32 h-10">
            <SongPriceSparkline 
              tokenAddress={song.token_address || undefined}
              bondingSupply={bondingSupplyStr || undefined}
              priceInXRGE={typeof priceInXRGE === 'number' ? priceInXRGE : undefined}
              height={40}
              showPercentChange={false}
              timeframeHours={24}
              percentChange={priceChange24h !== null ? priceChange24h : undefined}
              className="w-full"
            />
          </div>
        ) : (
          <div className="w-32 h-10 flex items-center justify-center">
            <div className="text-[8px] text-muted-foreground animate-pulse">...</div>
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {song.audio_cid ? (
          <TrendingWaveform songId={song.id} audioCid={song.audio_cid} />
        ) : (
          <div className="w-full h-4 bg-muted/20 rounded flex items-center justify-center">
            <span className="text-xs text-muted-foreground">—</span>
          </div>
        )}
      </TableCell>
      
      <TableCell className="font-mono text-right">
        {song.token_address ? (
          <div>
            <div className="font-semibold text-sm">
              ${currentPrice ? (currentPrice < 0.000001 ? currentPrice.toFixed(10) : currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(6)) : '$0.000000'}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {priceInXRGE ? (priceInXRGE < 0.000001 ? priceInXRGE.toFixed(10) : priceInXRGE.toFixed(8)) : '0.00000000'} XRGE
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Not deployed</span>
        )}
      </TableCell>
      
      <TableCell className={`font-mono text-right font-semibold text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {song.token_address ? (
          <div className="flex items-center justify-end gap-1">
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="whitespace-nowrap">{isPositive ? '+' : ''}{Math.abs(change24h) < 0.01 ? change24h.toFixed(2) : change24h.toFixed(1)}%</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      
      <TableCell className="font-mono text-right">
        {song.token_address && volumeUSD > 0 ? (
          <div>
            <div className="font-semibold text-sm">
              ${volumeUSD < 1 ? volumeUSD.toFixed(4) : volumeUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {volumeXRGE < 1000 ? volumeXRGE.toFixed(2) : volumeXRGE.toLocaleString(undefined, {maximumFractionDigits: 2})} XRGE
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">$0</span>
        )}
      </TableCell>
      
      <TableCell className="font-mono text-right">
        {song.token_address && marketCap > 0 ? (
          <div className="font-semibold text-sm">
            ${marketCap < 1 ? marketCap.toFixed(6) : marketCap.toLocaleString(undefined, {maximumFractionDigits: 2})}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">$0</span>
        )}
      </TableCell>
      
      <TableCell className="font-mono text-right text-muted-foreground">
        <Flame className="w-4 h-4 inline mr-1 text-orange-500" />
        {song.play_count}
      </TableCell>
    </TableRow>
  );

  // Mobile: Card View
  const mobileView = (
    <div
      onClick={() => navigate(`/song/${song.id}`)}
      className="bg-black/10 backdrop-blur-xl border border-white/10 rounded-xl p-3 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all"
    >
      <div className="flex items-start gap-3">
        {/* Rank & Cover */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-neon-green font-mono font-bold text-xs">#{index + 1}</span>
          <div className="relative">
            {song.cover_cid ? (
              <img
                src={getIPFSGatewayUrl(song.cover_cid)}
                alt={song.title}
                className="w-16 h-16 rounded object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded bg-neon-green/10 flex items-center justify-center">
                <Music className="w-8 h-8 text-neon-green" />
              </div>
            )}
            {index < 3 && (
              <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1">
                <Flame className="w-3 h-3 text-white" />
              </div>
            )}
            {/* Play button overlay */}
            {playSong && song.audio_cid && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playSong(song);
                }}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-neon-green hover:bg-neon-green/80 flex items-center justify-center transition-all hover:scale-110"
              >
                {isThisSongPlaying ? (
                  <Pause className="w-3 h-3 text-black fill-black" />
                ) : (
                  <Play className="w-3 h-3 text-black fill-black ml-0.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-1 flex-wrap mb-0.5">
                <span className="break-words">{song.title}</span>
                {song.ticker && (
                  <span className="text-[10px] text-neon-green font-mono flex-shrink-0">${song.ticker}</span>
                )}
                <AiBadge aiUsage={song.ai_usage} size="sm" />
              </div>
              <div className="text-xs text-muted-foreground mb-2">{song.artist || 'Unknown'}</div>
            </div>
            
            {/* 24H% Badge */}
            {song.token_address && (
              <div className={`flex items-center gap-0.5 font-mono font-bold text-xs px-2 py-1 rounded-lg ${
                isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{isPositive ? '+' : ''}{change24h.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-3 text-xs font-mono mb-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Flame className="w-3 h-3 text-orange-500" />
              <span>{song.play_count}</span>
            </div>
            {song.token_address && (
              <>
                <div className="text-muted-foreground">•</div>
                <div className="text-neon-green">
                  ${currentPrice ? (currentPrice < 0.000001 ? currentPrice.toFixed(8) : currentPrice.toFixed(6)) : '$0.000000'}
                </div>
              </>
            )}
            {change24h > 50 && (
              <>
                <div className="text-muted-foreground">•</div>
                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">
                  🚀 HOT
                </span>
              </>
            )}
          </div>

          {/* Sparkline Chart - Only render when we have price data */}
          {song.token_address && priceInXRGE !== undefined && bondingSupplyStr && (
            <div className="mt-1 bg-black/30 rounded-lg p-1.5 border border-neon-green/10">
              <SongPriceSparkline 
                tokenAddress={song.token_address || undefined}
                bondingSupply={bondingSupplyStr || undefined}
                priceInXRGE={typeof priceInXRGE === 'number' ? priceInXRGE : undefined}
                height={24}
                showPercentChange={true}
                timeframeHours={24}
                percentChange={priceChange24h !== null ? priceChange24h : undefined}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Return desktop view
  return desktopView;
});
SongRow.displayName = 'SongRow';

// Separate mobile card component
const SongCard = memo(({ song, index, onStatsUpdate, playSong, currentSong, isPlaying }: { song: Song; index: number; onStatsUpdate?: (songId: string, volume: number, change: number, marketCap: number, price: number) => void; playSong?: (song: any) => void; currentSong?: any; isPlaying?: boolean }) => {
  const navigate = useNavigate();
  const { prices } = useTokenPrices();
  const [recentTrades, setRecentTrades] = useState<TradeData[]>([]);
  const isCurrentSong = currentSong?.id === song.id;
  const isThisSongPlaying = isCurrentSong && isPlaying;
  
  // Get current price from bonding curve with auto-refresh for real-time trending
  const { price: priceInXRGENumber } = useSongPrice(song.token_address as Address, true);
  const priceInXRGE = priceInXRGENumber ? parseFloat(priceInXRGENumber) : undefined;
  
  // Get metadata and supply using proper hooks with auto-refresh for real-time trending
  const { metadata: metadataData, isLoading: metadataLoading } = useSongMetadata(song.token_address as Address);
  const { supply: bondingSupply, isLoading: supplyLoading } = useBondingCurveSupply(song.token_address as Address, true);
  
  
  const bondingSupplyStr = bondingSupply ? bondingSupply.toString() : null;
  
  // Use shared 24h data hook for consistent data between mobile and desktop
  // bypassCache=true ensures real-time trending data (no caching)
  const { priceChange24h, volume24h } = useSong24hData(song.token_address as Address, bondingSupplyStr, true);
  
  
  // EXACTLY match SongTrade page calculations
  const currentPrice = priceInXRGE && prices.xrge ? priceInXRGE * prices.xrge : undefined;
  const xrgeUsdPrice = prices.xrge || 0;
  const activeTradingSupply = bondingSupply ? parseFloat(bondingSupply) : undefined;
  const totalSupply = metadataData?.totalSupply ? parseFloat(metadataData.totalSupply) : undefined;
  const xrgeRaisedNum = metadataData?.xrgeRaised ? parseFloat(metadataData.xrgeRaised) : 0;
  
  // Volume = actual 24h trading volume, fallback to realized value if no 24h data
  const volumeXRGE = volume24h > 0 ? volume24h : (xrgeRaisedNum > 0 ? xrgeRaisedNum : 0);
  const volumeUSD = volumeXRGE * xrgeUsdPrice;
  
  // Calculate tokens sold - EXACTLY match SongTrade
  const tokensSold = activeTradingSupply !== undefined ? (990_000_000 - activeTradingSupply) : undefined;
  
  // Market Cap = Fully Diluted Valuation (current price × total supply / 10) - EXACTLY match SongTrade
  const fullyDilutedValue = currentPrice && totalSupply ? (currentPrice * totalSupply) / 10 : undefined;
  const marketCapUSD = fullyDilutedValue || 0; // Use fully diluted value as market cap (divided by 10)
  const realizedValueXRGE = xrgeRaisedNum; // Actual XRGE spent by traders
  const realizedValueUSD = xrgeRaisedNum * xrgeUsdPrice; // Convert to USD
  
  // Use fully diluted value as the market cap - EXACTLY match SongTrade
  const marketCap = marketCapUSD;
  const change24h = priceChange24h ?? 0;
  const isPositive = change24h > 0;
  
  useEffect(() => {
    if (onStatsUpdate) {
      onStatsUpdate(song.id, volumeUSD, change24h, marketCap, currentPrice || 0);
    }
  }, [song.id, volumeUSD, change24h, marketCap, currentPrice]);
  
  return (
    <div
      onClick={() => navigate(`/song/${song.id}`)}
      className="relative flex items-center gap-2 p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/8 active:bg-white/10 active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_16px_0_rgba(0,255,159,0.05)]"
    >
      <div className="flex-shrink-0 text-xs font-mono text-muted-foreground w-6">
        #{index + 1}
      </div>
      
      <div className="relative flex-shrink-0">
        {song.cover_cid ? (
          <img
            src={getIPFSGatewayUrl(song.cover_cid)}
            alt={song.title}
            className="w-12 h-12 rounded object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded bg-neon-green/10 flex items-center justify-center">
            <Music className="w-6 h-6 text-neon-green" />
          </div>
        )}
        {playSong && song.audio_cid && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              playSong(song);
            }}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-neon-green hover:bg-neon-green/80 active:bg-neon-green/70 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
          >
            {isThisSongPlaying ? (
              <Pause className="w-3 h-3 text-black fill-black" />
            ) : (
              <Play className="w-3 h-3 text-black fill-black ml-0.5" />
            )}
          </button>
        )}
        {index < 3 && (
          <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1">
            <Flame className="w-2 h-2 text-white" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold truncate">{song.title}</span>
          {song.ticker && (
            <span className="text-[10px] text-neon-green font-mono flex-shrink-0">${song.ticker}</span>
          )}
          <AiBadge aiUsage={song.ai_usage} size="sm" />
          {change24h > 50 && (
            <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-mono font-bold flex-shrink-0">
              🚀
            </span>
          )}
        </div>
        <div 
          className="text-[10px] text-muted-foreground hover:text-neon-green transition-colors cursor-pointer truncate"
          onClick={(e) => {
            e.stopPropagation();
            if (song.wallet_address) navigate(`/artist/${song.wallet_address}`);
          }}
        >
          {song.artist || 'Unknown'}
        </div>
        
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="text-[10px] font-mono">{song.play_count || 0}</span>
          </div>
          
          <div className={`text-[10px] font-mono font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{change24h.toFixed(1)}%
          </div>
          
          <div className="text-[10px] font-mono text-muted-foreground">
            ${currentPrice ? (currentPrice < 0.000001 ? currentPrice.toFixed(10) : currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(6)) : '$0.000000'}
          </div>
        </div>
      </div>
    </div>
  );
});
SongCard.displayName = 'SongCard';

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
  const [displayLimit, setDisplayLimit] = useState<number | null>(50); // Start with 50 to load all data, user can change
  const [timeFilter, setTimeFilter] = useState<'24H' | '7D' | '30D' | 'ALL'>('ALL');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');
  
  // Calculate aggregated stats from individual song stats
  const totalVolume = Array.from(songStats.values()).reduce((sum, stat) => sum + stat.volume, 0);
  const topGainerPercent = Array.from(songStats.values()).reduce((max, stat) => Math.max(max, stat.change), 0);
  
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
    if (!stats) return song.play_count; // Fallback to play count if no stats yet
    
    // Weighted scoring algorithm (all values normalized to USD for fair comparison):
    // - Volume (40%): Recent trading activity
    // - Price Change (25%): Momentum (scaled by market cap)
    // - Market Cap (20%): Overall value
    // - Plays (15%): Popularity (scaled to USD equivalent: $0.01 per play)
    
    const volumeScore = stats.volume * 0.4;
    const changeScore = Math.max(0, stats.change / 100) * stats.marketCap * 0.25; // % change scaled by market cap
    const marketCapScore = stats.marketCap * 0.2;
    const playsScore = (song.play_count * 0.01) * 0.15; // $0.01 per play
    
    return volumeScore + changeScore + marketCapScore + playsScore;
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

  useEffect(() => {
    const fetchTrendingData = async () => {
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
              .limit(50),
            supabase
              .from("songs")
              .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
              .not("token_address", "is", null) // Only show deployed songs
              .or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%,ticker.ilike.%${searchQuery}%`)
              .order("play_count", { ascending: false })
              .limit(50)
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
              .limit(50),
            supabase
              .from("songs")
              .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
              .not("token_address", "is", null) // Only show deployed songs
              .order("play_count", { ascending: false })
              .limit(50)
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
    };

    fetchTrendingData();
  }, [searchQuery]);

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
  
  // Separate displayed songs (applies displayLimit)
  const displayedSongs = useMemo(() => {
    return displayLimit ? sortedSongs.slice(0, displayLimit) : sortedSongs;
  }, [sortedSongs, displayLimit]);
  
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
  
  // Reset index when top 5 songs change (e.g., new data loaded)
  useEffect(() => {
    if (top5Songs.length > 0 && featuredSongIndex >= top5Songs.length) {
      setFeaturedSongIndex(0);
    }
  }, [top5Songs, featuredSongIndex]);
  
  // Pre-load next song index (for pre-rendering)
  const nextSongIndexForPreload = top5Songs.length > 0 ? (featuredSongIndex + 1) % top5Songs.length : null;
  const nextSongForPreload = nextSongIndexForPreload !== null ? top5Songs[nextSongIndexForPreload] : null;
  
  // Cycle through top 5 songs every 8 seconds
  useEffect(() => {
    if (top5Songs.length === 0) return;
    
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
  }, [top5Songs.length, featuredSongIndex]);
  
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
    <div className="min-h-screen bg-background pb-24 md:pb-20">
      <AppTutorial />
      <NetworkInfo />
      
      {/* Stunning Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/20 via-purple-500/10 to-pink-500/10 blur-3xl opacity-50 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
        
        <div className="relative z-20 text-center px-4 md:px-6 pt-8 md:pt-12 pb-8">
          <div className="mb-4 flex justify-center items-center gap-3">
            <MusicBars bars={6} className="h-8 md:h-12 flex-shrink-0 animate-pulse" />
            <div className="relative">
              <img src={logo} alt="ROUGEE Logo" className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-neon-green/30 shadow-[0_0_30px_rgba(0,255,159,0.3)] animate-pulse" />
              <div className="absolute inset-0 bg-neon-green/20 rounded-full animate-ping" />
            </div>
            <MusicBars bars={6} className="h-8 md:h-12 flex-shrink-0 animate-pulse" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-neon-green via-purple-400 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(0,255,159,0.5)]">
            TRENDING
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Discover the hottest tracks and rising artists on the decentralized music platform
          </p>
        </div>
      </div>
      
      <main className="w-full px-0 md:container md:mx-auto md:px-4 py-6 md:py-8" data-tour="trending">
        {/* Enhanced Live Stats Ticker */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4 px-4 md:px-0">
          {loading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <div className="group relative bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] hover:bg-white/10 hover:border-neon-green/30 hover:shadow-[0_8px_32px_0_rgba(0,255,159,0.25)] transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-neon-green/10 rounded-full blur-2xl group-hover:bg-neon-green/20 transition-all" />
                <Music className="w-5 h-5 text-neon-green/70 mb-2" />
                <div className="text-xs text-muted-foreground font-mono mb-1">TOTAL SONGS</div>
                <div className="text-3xl font-bold font-mono neon-text drop-shadow-[0_0_8px_rgba(0,255,159,0.6)]">{songs.length}</div>
              </div>
              <div className="group relative bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-[0_4px_16px_0_rgba(168,85,247,0.1)] hover:bg-white/10 hover:border-purple-400/30 hover:shadow-[0_8px_32px_0_rgba(168,85,247,0.25)] transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                <BarChart3 className="w-5 h-5 text-purple-400/70 mb-2" />
                <div className="text-xs text-muted-foreground font-mono mb-1">TOTAL VOLUME</div>
                <div className="text-3xl font-bold font-mono text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                  ${totalVolume > 0 ? totalVolume.toLocaleString(undefined, {maximumFractionDigits: 0}) : '...'}
                </div>
              </div>
              <div className="group relative bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-[0_4px_16px_0_rgba(249,115,22,0.1)] hover:bg-white/10 hover:border-orange-400/30 hover:shadow-[0_8px_32px_0_rgba(249,115,22,0.25)] transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all" />
                <Zap className="w-5 h-5 text-orange-400/70 mb-2" />
                <div className="text-xs text-muted-foreground font-mono mb-1">TOP GAINER</div>
                <div className="text-3xl font-bold font-mono text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]">
                  {topGainerPercent > 0 ? `+${topGainerPercent.toFixed(1)}%` : '0%'}
                </div>
              </div>
              <div className="group relative bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-[0_4px_16px_0_rgba(59,130,246,0.1)] hover:bg-white/10 hover:border-blue-400/30 hover:shadow-[0_8px_32px_0_rgba(59,130,246,0.25)] transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                <Sparkles className="w-5 h-5 text-blue-400/70 mb-2" />
                <div className="text-xs text-muted-foreground font-mono mb-1">ARTISTS</div>
                <div className="text-3xl font-bold font-mono text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">{artists.length}</div>
              </div>
            </>
          )}
        </div>

        {/* Featured/Promoted Banner with Real Data - Cycles through top 5 songs */}
        {loading ? (
          <div className="mb-20 px-4 md:px-0">
            <FeaturedSongSkeleton />
          </div>
        ) : featuredSong && top5Songs.length > 0 ? (
          <div className="relative mb-20 px-4 md:px-0" style={{ zIndex: 1 }}>
            {/* Container for both cards during transition - ensures proper height */}
            <div className="relative w-full" style={{ minHeight: '450px' }}>
              {/* Skeleton loader - shows during transition */}
              {isTransitioning && (
                <div
                  className="absolute top-0 left-0 right-0 w-full transition-opacity duration-300 ease-in-out"
                  style={{
                    zIndex: 4,
                    opacity: 1
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
                    pointerEvents: nextSong ? 'none' : 'auto'
                  }}
                >
                  <FeaturedSong 
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
                    pointerEvents: nextSong?.id === nextSongForPreload.id ? 'auto' : 'none'
                  }}
                >
                  <FeaturedSong 
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
            )}
          </div>
        ) : null}

        {/* Time Filter & Section Header */}
        <div className="mb-8 px-4 md:px-0 relative" style={{ zIndex: 10 }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-mono mb-2 neon-text flex items-center gap-3">
                <Flame className="w-8 h-8 text-orange-500 animate-pulse" />
                {searchQuery ? `SEARCH RESULTS` : `TRENDING`}
              </h1>
              <p className="text-muted-foreground font-mono text-sm">
                {searchQuery 
                  ? `Search results for "${searchQuery}"` 
                  : `Top artists and songs ranked by trading activity & plays`
                }
              </p>
            </div>
            
            {/* Time Filter Buttons */}
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-1">
              <Clock className="w-4 h-4 text-muted-foreground mr-1" />
              <button
                onClick={() => setTimeFilter('24H')}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${
                  timeFilter === '24H'
                    ? 'bg-neon-green text-black shadow-[0_0_12px_rgba(0,255,159,0.5)]'
                    : 'text-muted-foreground hover:text-neon-green hover:bg-white/5'
                }`}
              >
                24H
              </button>
              <button
                onClick={() => setTimeFilter('7D')}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${
                  timeFilter === '7D'
                    ? 'bg-neon-green text-black shadow-[0_0_12px_rgba(0,255,159,0.5)]'
                    : 'text-muted-foreground hover:text-neon-green hover:bg-white/5'
                }`}
              >
                7D
              </button>
              <button
                onClick={() => setTimeFilter('30D')}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${
                  timeFilter === '30D'
                    ? 'bg-neon-green text-black shadow-[0_0_12px_rgba(0,255,159,0.5)]'
                    : 'text-muted-foreground hover:text-neon-green hover:bg-white/5'
                }`}
              >
                30D
              </button>
              <button
                onClick={() => setTimeFilter('ALL')}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${
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

        <Tabs defaultValue="songs" className="w-full px-4 md:px-0 relative" style={{ zIndex: 10 }}>
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-1 relative" style={{ zIndex: 10 }}>
            <TabsTrigger 
              value="songs"
              className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green font-mono rounded-lg transition-all"
            >
              SONGS
            </TabsTrigger>
            <TabsTrigger 
              value="artists"
              className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green font-mono rounded-lg transition-all"
            >
              ARTISTS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="songs" className="space-y-4">
            {/* Enhanced Sort & Filter Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  SORT BY:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { field: 'trending' as SortField, label: '🔥 TRENDING', icon: Flame },
                    { field: 'price' as SortField, label: 'PRICE', icon: TrendingUp },
                    { field: 'change' as SortField, label: '24H%', icon: TrendingUp },
                    { field: 'volume' as SortField, label: 'VOLUME', icon: BarChart3 },
                    { field: 'plays' as SortField, label: 'PLAYS', icon: Music },
                  ].map(({ field, label, icon: Icon }) => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                        sortField === field 
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-[0_0_8px_rgba(0,255,159,0.3)]' 
                          : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30 hover:text-neon-green'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label} {sortField === field && (sortDirection === 'desc' ? '↓' : '↑')}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Display Limit Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  SHOW:
                </span>
                {[10, 20, 50].map((limit) => (
                  <button
                    key={limit}
                    onClick={() => setDisplayLimit(limit)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                      displayLimit === limit
                        ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-[0_0_8px_rgba(0,255,159,0.3)]' 
                        : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30 hover:text-neon-green'
                    }`}
                  >
                    TOP {limit}
                  </button>
                ))}
                <button
                  onClick={() => setDisplayLimit(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    displayLimit === null
                      ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-[0_0_8px_rgba(0,255,159,0.3)]' 
                      : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30 hover:text-neon-green'
                  }`}
                >
                  ALL
                </button>
              </div>
            </div>
            
            {/* Enhanced Desktop Table View */}
            <div className="hidden md:block md:rounded-xl border border-white/20 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,255,159,0.1)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="font-mono text-muted-foreground w-12">#</TableHead>
                    <TableHead className="font-mono text-muted-foreground">NAME</TableHead>
                    <TableHead className="font-mono text-muted-foreground text-center w-32">CHART</TableHead>
                    <TableHead className="font-mono text-muted-foreground text-center w-32">WAVEFORM</TableHead>
                    <TableHead 
                      className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        PRICE
                        {sortField === 'price' && (
                          <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                      onClick={() => handleSort('change')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        24H%
                        {sortField === 'change' && (
                          <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                      onClick={() => handleSort('volume')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        VOLUME
                        {sortField === 'volume' && (
                          <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                      onClick={() => handleSort('marketCap')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        MKT CAP
                        {sortField === 'marketCap' && (
                          <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                      onClick={() => handleSort('plays')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        PLAYS
                        {sortField === 'plays' && (
                          <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <>
                      {[...Array(10)].map((_, i) => (
                        <SongRowSkeleton key={`skeleton-row-${i}`} />
                      ))}
                    </>
                  ) : displayedSongs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <Music className="w-12 h-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground font-mono">
                            {searchQuery ? 'No songs found matching your search' : 'No deployed songs yet'}
                          </p>
                          {searchQuery && (
                            <p className="text-xs text-muted-foreground/70 font-mono">
                              Try a different search term
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedSongs.map((song, index) => (
                      <SongRow 
                        key={song.id} 
                        song={song} 
                        index={index} 
                        onStatsUpdate={handleStatsUpdate} 
                        playSong={playSong} 
                        currentSong={currentSong} 
                        isPlaying={isPlaying} 
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-2">
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <SongCardSkeleton key={`skeleton-card-${i}`} />
                  ))}
                </>
              ) : displayedSongs.length === 0 ? (
                <div className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Music className="w-12 h-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground font-mono">
                      {searchQuery ? 'No songs found matching your search' : 'No deployed songs yet'}
                    </p>
                    {searchQuery && (
                      <p className="text-xs text-muted-foreground/70 font-mono">
                        Try a different search term
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                displayedSongs.map((song, index) => (
                  <SongCard 
                    key={song.id} 
                    song={song} 
                    index={index} 
                    onStatsUpdate={handleStatsUpdate} 
                    playSong={playSong} 
                    currentSong={currentSong} 
                    isPlaying={isPlaying} 
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="artists" className="space-y-4">
            {/* Display Limit Filter for Artists */}
            <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
              <span className="text-xs text-muted-foreground font-mono">SHOW:</span>
              <button
                onClick={() => setDisplayLimit(10)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                  displayLimit === 10
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
                    : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
                }`}
              >
                TOP 10
              </button>
              <button
                onClick={() => setDisplayLimit(20)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                  displayLimit === 20
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
                    : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
                }`}
              >
                TOP 20
              </button>
              <button
                onClick={() => setDisplayLimit(50)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                  displayLimit === 50
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
                    : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
                }`}
              >
                TOP 50
              </button>
              <button
                onClick={() => setDisplayLimit(null)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                  displayLimit === null
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
                    : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
                }`}
              >
                ALL
              </button>
            </div>
            
            <div className="md:rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="font-mono text-muted-foreground w-8 md:w-12 text-xs md:text-sm px-2 md:px-4">#</TableHead>
                    <TableHead className="font-mono text-muted-foreground text-xs md:text-sm px-2 md:px-4">ARTIST</TableHead>
                    <TableHead className="font-mono text-muted-foreground text-xs md:text-sm px-2 md:px-4 hidden md:table-cell">TICKER</TableHead>
                    <TableHead className="font-mono text-muted-foreground text-right text-xs md:text-sm px-2 md:px-4">SONGS</TableHead>
                    <TableHead className="font-mono text-muted-foreground text-right text-xs md:text-sm px-2 md:px-4">PLAYS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <>
                      {[...Array(10)].map((_, i) => (
                        <ArtistRowSkeleton key={`skeleton-artist-${i}`} />
                      ))}
                    </>
                  ) : artists.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <Music className="w-12 h-12 text-muted-foreground/50" />
                          <p className="text-muted-foreground font-mono">
                            {searchQuery ? 'No artists found matching your search' : 'No artists yet'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    artists.slice(0, displayLimit || undefined).map((artist, index) => (
                      <TableRow
                        key={artist.wallet_address}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/artist/${artist.wallet_address}`)}
                      >
                        <TableCell className="font-mono text-muted-foreground text-xs md:text-sm px-2 md:px-4">
                          #{index + 1}
                        </TableCell>
                        <TableCell className="px-2 md:px-4">
                          <div className="flex items-center gap-2 md:gap-3">
                            {artist.avatar_cid ? (
                              <img
                                src={getIPFSGatewayUrl(artist.avatar_cid)}
                                alt={artist.artist_name}
                                className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-neon-green/10 flex items-center justify-center flex-shrink-0">
                                <span className="font-bold text-neon-green text-xs md:text-base">
                                  {artist.artist_name[0]}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs md:text-sm truncate">{artist.artist_name}</div>
                              {/* Show ticker on mobile under name */}
                              {artist.artist_ticker && (
                                <div className="md:hidden text-[10px] font-mono text-neon-green">
                                  ${artist.artist_ticker}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 md:px-4 hidden md:table-cell">
                          {artist.artist_ticker && (
                            <span className="text-xs font-mono text-neon-green">
                              ${artist.artist_ticker}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-right text-xs md:text-sm px-2 md:px-4">
                          {artist.total_songs}
                        </TableCell>
                        <TableCell className="font-mono text-right text-xs md:text-sm px-2 md:px-4">
                          <Flame className="w-3 h-3 md:w-4 md:h-4 inline mr-1 text-orange-500" />
                          {artist.total_plays}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Trending;
