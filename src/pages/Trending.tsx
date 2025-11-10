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
  
  
  // Get current price from bonding curve (no auto-refresh to reduce RPC calls)
  const { price: priceData } = useSongPrice(song.token_address as Address, false);
  const priceInXRGE = priceData ? parseFloat(priceData) : undefined;
  
  // Get metadata and supply using proper hooks (no auto-refresh to reduce RPC calls)
  const { metadata: metadataData, isLoading: metadataLoading, error: metadataError } = useSongMetadata(song.token_address as Address);
  const { supply: bondingSupply, isLoading: supplyLoading, error: supplyError } = useBondingCurveSupply(song.token_address as Address, false);
  
  
  
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
      <div className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 via-white/3 to-white/0 backdrop-blur-2xl p-4 md:p-6 pb-6 md:pb-8 hover:bg-gradient-to-br hover:from-white/8 hover:via-white/5 hover:to-white/2 transition-all duration-300 min-h-full flex flex-col hover:scale-[1.02] active:scale-[0.98]"
           style={{
             border: '1px solid rgba(255, 255, 255, 0.15)',
             boxShadow: `
               0 0 0 1px rgba(0, 255, 159, 0.1),
               0 4px 16px rgba(0, 255, 159, 0.1),
               0 8px 32px rgba(0, 255, 159, 0.15),
               inset 0 1px 0 rgba(255, 255, 255, 0.1),
               inset 0 -1px 0 rgba(0, 0, 0, 0.2)
             `
           }}
           onMouseEnter={(e) => {
             e.currentTarget.style.boxShadow = `
               0 0 0 1px rgba(0, 255, 159, 0.3),
               0 8px 32px rgba(0, 255, 159, 0.2),
               0 16px 64px rgba(0, 255, 159, 0.25),
               inset 0 1px 0 rgba(255, 255, 255, 0.2),
               inset 0 -1px 0 rgba(0, 0, 0, 0.3)
             `;
             e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.3)';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.boxShadow = `
               0 0 0 1px rgba(0, 255, 159, 0.1),
               0 4px 16px rgba(0, 255, 159, 0.1),
               0 8px 32px rgba(0, 255, 159, 0.15),
               inset 0 1px 0 rgba(255, 255, 255, 0.1),
               inset 0 -1px 0 rgba(0, 0, 0, 0.2)
             `;
             e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.15)';
           }}>
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
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-3 md:mb-4">
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
          <div className="flex flex-wrap gap-3 mb-2 md:mb-4">
            <div className="bg-gradient-to-br from-black/40 via-black/30 to-black/20 rounded-lg px-3 py-2 transition-all duration-300 hover:scale-105 active:scale-95"
                 style={{
                   border: '1px solid rgba(255, 255, 255, 0.1)',
                   boxShadow: `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(0, 255, 159, 0.2)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(0, 255, 159, 0.1),
                     0 2px 8px rgba(0, 255, 159, 0.15),
                     inset 0 1px 0 rgba(0, 255, 159, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `;
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `;
                 }}>
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
            <div className="bg-black/40 rounded-lg px-3 py-2 transition-all duration-300"
                 style={{
                   border: '1px solid rgba(255, 255, 255, 0.05)',
                   boxShadow: `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(34, 197, 94, 0.2)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(34, 197, 94, 0.1),
                     0 2px 8px rgba(34, 197, 94, 0.15),
                     inset 0 1px 0 rgba(34, 197, 94, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `;
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `;
                 }}>
              <div className="text-xs text-muted-foreground font-mono">MKT CAP</div>
              <div className="text-sm font-bold font-mono text-green-400">
                ${marketCap < 1 ? marketCap.toFixed(2) : marketCap.toLocaleString(undefined, {maximumFractionDigits: 2})}
              </div>
            </div>
            <div className="bg-black/40 rounded-lg px-3 py-2 transition-all duration-300"
                 style={{
                   border: '1px solid rgba(255, 255, 255, 0.05)',
                   boxShadow: `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(96, 165, 250, 0.2)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(96, 165, 250, 0.1),
                     0 2px 8px rgba(96, 165, 250, 0.15),
                     inset 0 1px 0 rgba(96, 165, 250, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `;
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `;
                 }}>
              <div className="text-xs text-muted-foreground font-mono">VOLUME</div>
              <div className="text-sm font-bold font-mono text-blue-400">
                ${volumeUSD < 1 ? volumeUSD.toFixed(4) : volumeUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {volumeXRGE.toLocaleString(undefined, {maximumFractionDigits: 2})} XRGE
              </div>
            </div>
            <div className="bg-black/40 rounded-lg px-3 py-2 transition-all duration-300"
                 style={{
                   border: '1px solid rgba(255, 255, 255, 0.05)',
                   boxShadow: `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(251, 146, 60, 0.2)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(251, 146, 60, 0.1),
                     0 2px 8px rgba(251, 146, 60, 0.15),
                     inset 0 1px 0 rgba(251, 146, 60, 0.1),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `;
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                   e.currentTarget.style.boxShadow = `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(255, 255, 255, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                   `;
                 }}>
              <div className="text-xs text-muted-foreground font-mono">PLAYS</div>
              <div className="text-sm font-bold font-mono text-orange-400">
                <Flame className="w-3 h-3 inline mr-1" />
                {song.play_count}
              </div>
            </div>
          </div>
          
          {/* Price Chart - Collapsible with fixed height to prevent layout shift */}
          <div className="bg-black/40 rounded-lg px-4 py-3 transition-all duration-300 relative" 
               data-tour="featured-chart" 
               style={{ 
                 minHeight: isChartExpanded ? '300px' : 'auto',
                 border: '1px solid rgba(0, 255, 159, 0.2)',
                 boxShadow: `
                   0 0 0 1px rgba(0, 255, 159, 0.1),
                   0 2px 8px rgba(0, 255, 159, 0.1),
                   inset 0 1px 0 rgba(0, 255, 159, 0.1),
                   inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                 `
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.border = '1px solid rgba(0, 255, 159, 0.4)';
                 e.currentTarget.style.boxShadow = `
                   0 0 0 1px rgba(0, 255, 159, 0.2),
                   0 4px 16px rgba(0, 255, 159, 0.2),
                   inset 0 1px 0 rgba(0, 255, 159, 0.2),
                   inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                 `;
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.border = '1px solid rgba(0, 255, 159, 0.2)';
                 e.currentTarget.style.boxShadow = `
                   0 0 0 1px rgba(0, 255, 159, 0.1),
                   0 2px 8px rgba(0, 255, 159, 0.1),
                   inset 0 1px 0 rgba(0, 255, 159, 0.1),
                   inset 0 -1px 0 rgba(0, 0, 0, 0.5)
                 `;
               }}>
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
            <div className="relative" style={{ height: isChartExpanded ? '280px' : '0', overflow: 'hidden', transition: 'height 0.3s ease-in-out' }}>
              {isChartExpanded && song.token_address && (
                <div className="absolute inset-0">
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
                </div>
              )}
            </div>
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
  
  // Get current price from bonding curve (no auto-refresh to reduce RPC calls)
  const { price: priceData, isLoading: priceLoading } = useSongPrice(song.token_address as Address, false);
  const priceInXRGE = priceData ? parseFloat(priceData) : undefined;
  
  // Get metadata and supply using proper hooks (no auto-refresh to reduce RPC calls)
  const { metadata: metadataData, isLoading: metadataLoading } = useSongMetadata(song.token_address as Address);
  const { supply: bondingSupply, isLoading: supplyLoading } = useBondingCurveSupply(song.token_address as Address, false);
  
  
  // Convert bondingSupply to a stable string value to prevent infinite loops
  const bondingSupplyStr = bondingSupply ? bondingSupply.toString() : null;
  
  // Use shared 24h data hook for consistent data between mobile and desktop
  // Enable caching (5s cache) to improve performance and reduce RPC calls
  const { priceChange24h, volume24h, loading: change24hLoading } = useSong24hData(song.token_address as Address, bondingSupplyStr, false);
  
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
      <TableCell className="font-mono text-muted-foreground w-8 py-2 text-xs">
        #{index + 1}
      </TableCell>
      
      <TableCell className="py-2">
        <div className="flex items-center gap-2">
          {/* Play button */}
          {playSong && song.audio_cid && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playSong(song);
              }}
              className="w-7 h-7 rounded-full bg-neon-green hover:bg-neon-green/80 active:bg-neon-green/70 flex items-center justify-center transition-all hover:scale-110 active:scale-95 flex-shrink-0"
            >
              {isThisSongPlaying ? (
                <Pause className="w-3.5 h-3.5 text-black fill-black" />
              ) : (
                <Play className="w-3.5 h-3.5 text-black fill-black ml-0.5" />
              )}
            </button>
          )}
          
          <div className="relative flex-shrink-0">
            {song.cover_cid ? (
              <img
                src={getIPFSGatewayUrl(song.cover_cid)}
                alt={song.title}
                className="w-8 h-8 rounded object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-neon-green/10 flex items-center justify-center">
                <Music className="w-4 h-4 text-neon-green" />
              </div>
            )}
            {index < 3 && (
              <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1">
                <Flame className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold flex items-center gap-1.5 flex-wrap">
              <span className="truncate max-w-[200px]">{song.title}</span>
              {song.ticker && (
                <span className="text-[10px] text-neon-green font-mono flex-shrink-0">${song.ticker}</span>
              )}
              <AiBadge aiUsage={song.ai_usage} size="sm" />
              {change24h > 50 && (
                <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-mono font-bold flex-shrink-0">
                  🚀 HOT
                </span>
              )}
            </div>
            <div 
              className="text-[11px] text-muted-foreground hover:text-neon-green transition-colors cursor-pointer truncate"
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
      <TableCell className="py-2">
        {song.token_address && priceInXRGE !== undefined && bondingSupplyStr ? (
          <div className="w-24 h-7">
            <SongPriceSparkline 
              tokenAddress={song.token_address || undefined}
              bondingSupply={bondingSupplyStr || undefined}
              priceInXRGE={typeof priceInXRGE === 'number' ? priceInXRGE : undefined}
              height={28}
              showPercentChange={false}
              timeframeHours={24}
              percentChange={priceChange24h !== null ? priceChange24h : undefined}
              className="w-full"
            />
          </div>
        ) : (
          <div className="w-24 h-7 flex items-center justify-center bg-muted/10 rounded">
            <div className="w-full h-3/4 bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20 rounded" 
                 style={{ 
                   background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
                   backgroundSize: '200% 100%',
                   animation: 'shimmer 1.5s ease-in-out infinite'
                 }} />
          </div>
        )}
      </TableCell>
      
      <TableCell className="py-2">
        {song.audio_cid ? (
          <TrendingWaveform songId={song.id} audioCid={song.audio_cid} />
        ) : (
          <div className="w-full h-3 bg-muted/20 rounded flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">—</span>
          </div>
        )}
      </TableCell>
      
      <TableCell className="font-mono text-right py-2">
        {song.token_address ? (
          <div>
            <div className="font-semibold text-xs">
              ${currentPrice ? (currentPrice < 0.000001 ? currentPrice.toFixed(10) : currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(6)) : '$0.000000'}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {priceInXRGE ? (priceInXRGE < 0.000001 ? priceInXRGE.toFixed(10) : priceInXRGE.toFixed(8)) : '0.00000000'} XRGE
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-[10px]">Not deployed</span>
        )}
      </TableCell>
      
      <TableCell className={`font-mono text-right font-semibold text-xs py-2 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {song.token_address ? (
          change24hLoading || priceChange24h === null ? (
            <div className="h-4 bg-muted/20 rounded w-12 ml-auto animate-pulse" />
          ) : (
            <div className="flex items-center justify-end gap-0.5">
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span className="whitespace-nowrap">{isPositive ? '+' : ''}{Math.abs(change24h) < 0.01 ? change24h.toFixed(2) : change24h.toFixed(1)}%</span>
            </div>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      
      <TableCell className="font-mono text-right py-2">
        {song.token_address ? (
          change24hLoading || (volumeUSD === 0 && volumeXRGE === 0) ? (
            <div className="space-y-1">
              <div className="h-3 bg-muted/20 rounded w-16 ml-auto animate-pulse" />
              <div className="h-2 bg-muted/10 rounded w-20 ml-auto animate-pulse" />
            </div>
          ) : volumeUSD > 0 ? (
            <div>
              <div className="font-semibold text-xs">
                ${volumeUSD < 1 ? volumeUSD.toFixed(4) : volumeUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {volumeXRGE < 1000 ? volumeXRGE.toFixed(2) : volumeXRGE.toLocaleString(undefined, {maximumFractionDigits: 2})} XRGE
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px]">$0</span>
          )
        ) : (
          <span className="text-muted-foreground text-[10px]">Not deployed</span>
        )}
      </TableCell>
      
      <TableCell className="font-mono text-right py-2">
        {song.token_address ? (
          (priceLoading || metadataLoading || supplyLoading) && marketCap === 0 ? (
            <div className="h-4 bg-muted/20 rounded w-16 ml-auto animate-pulse" />
          ) : marketCap > 0 ? (
            <div className="font-semibold text-xs">
              ${marketCap < 1 ? marketCap.toFixed(6) : marketCap.toLocaleString(undefined, {maximumFractionDigits: 2})}
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px]">$0</span>
          )
        ) : (
          <span className="text-muted-foreground text-[10px]">Not deployed</span>
        )}
      </TableCell>
      
      <TableCell className="font-mono text-right text-muted-foreground py-2 text-xs">
        <Flame className="w-3 h-3 inline mr-0.5 text-orange-500" />
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
            <div className="mt-1 bg-black/30 rounded-lg p-1.5 transition-all duration-300"
                 style={{
                   border: '1px solid rgba(0, 255, 159, 0.1)',
                   boxShadow: `
                     0 0 0 1px rgba(0, 0, 0, 0.3),
                     inset 0 1px 0 rgba(0, 255, 159, 0.05),
                     inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                   `
                 }}>
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
  
  // Get current price from bonding curve (no auto-refresh to reduce RPC calls)
  const { price: priceInXRGENumber } = useSongPrice(song.token_address as Address, false);
  const priceInXRGE = priceInXRGENumber ? parseFloat(priceInXRGENumber) : undefined;
  
  // Get metadata and supply using proper hooks (no auto-refresh to reduce RPC calls)
  const { metadata: metadataData, isLoading: metadataLoading } = useSongMetadata(song.token_address as Address);
  const { supply: bondingSupply, isLoading: supplyLoading } = useBondingCurveSupply(song.token_address as Address, false);
  
  
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
      className="relative flex items-center gap-2 p-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/8 active:bg-white/10 active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_16px_0_rgba(0,255,159,0.05)]"
    >
      <div className="flex-shrink-0 text-xs font-mono text-muted-foreground w-5">
        #{index + 1}
      </div>
      
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
        {playSong && song.audio_cid && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              playSong(song);
            }}
            className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-neon-green hover:bg-neon-green/80 active:bg-neon-green/70 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
          >
            {isThisSongPlaying ? (
              <Pause className="w-2.5 h-2.5 text-black fill-black" />
            ) : (
              <Play className="w-2.5 h-2.5 text-black fill-black ml-0.5" />
            )}
          </button>
        )}
        {index < 3 && (
          <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-0.5">
            <Flame className="w-2 h-2 text-white" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold truncate">{song.title}</span>
          {song.ticker && (
            <span className="text-[9px] text-neon-green font-mono flex-shrink-0">${song.ticker}</span>
          )}
          <AiBadge aiUsage={song.ai_usage} size="sm" />
          {change24h > 50 && (
            <span className="text-[8px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded-full font-mono font-bold flex-shrink-0">
              🚀
            </span>
          )}
        </div>
        <div 
          className="text-[9px] text-muted-foreground hover:text-neon-green transition-colors cursor-pointer truncate"
          onClick={(e) => {
            e.stopPropagation();
            if (song.wallet_address) navigate(`/artist/${song.wallet_address}`);
          }}
        >
          {song.artist || 'Unknown'}
        </div>
        
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <Flame className="w-2.5 h-2.5 text-orange-500" />
            <span className="text-[9px] font-mono">{song.play_count || 0}</span>
          </div>
          
          <div className={`text-[9px] font-mono font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{change24h.toFixed(1)}%
          </div>
          
          <div className="text-[9px] font-mono text-muted-foreground">
            ${currentPrice ? (currentPrice < 0.000001 ? currentPrice.toFixed(8) : currentPrice < 0.01 ? currentPrice.toFixed(6) : currentPrice.toFixed(4)) : '$0.0000'}
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
    <div className="min-h-screen bg-background pb-24 md:pb-20 pt-16 md:pt-20">
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
        <div className="mb-4 md:mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 px-0 md:px-0">
          {loading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <div className="group relative bg-gradient-to-br from-white/5 via-white/2 to-white/0 backdrop-blur-xl rounded-xl p-3 md:p-5 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(0,255,159,0.3)] active:shadow-[0_0_10px_rgba(0,255,159,0.2)]"
                   style={{
                     border: '1px solid rgba(255, 255, 255, 0.1)',
                     boxShadow: `
                       0 0 0 1px rgba(0, 255, 159, 0.05),
                       0 4px 16px rgba(0, 255, 159, 0.1),
                       0 8px 32px rgba(0, 255, 159, 0.05),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                     `
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.border = '1px solid rgba(0, 255, 159, 0.3)';
                     e.currentTarget.style.boxShadow = `
                       0 0 0 1px rgba(0, 255, 159, 0.2),
                       0 8px 32px rgba(0, 255, 159, 0.2),
                       0 16px 64px rgba(0, 255, 159, 0.25),
                       inset 0 1px 0 rgba(0, 255, 159, 0.2),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                     `;
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                     e.currentTarget.style.boxShadow = `
                       0 0 0 1px rgba(0, 255, 159, 0.05),
                       0 4px 16px rgba(0, 255, 159, 0.1),
                       0 8px 32px rgba(0, 255, 159, 0.05),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                     `;
                   }}>
                <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-neon-green/10 rounded-full blur-2xl group-hover:bg-neon-green/20 transition-all" />
                <Music className="w-4 h-4 md:w-5 md:h-5 text-neon-green/70 mb-1 md:mb-2" />
                <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">TOTAL SONGS</div>
                <div className="text-2xl md:text-3xl font-bold font-mono neon-text drop-shadow-[0_0_8px_rgba(0,255,159,0.6)]">{songs.length}</div>
              </div>
              <div className="group relative bg-gradient-to-br from-white/5 via-purple-500/5 to-white/0 backdrop-blur-xl rounded-xl p-3 md:p-5 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] active:shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                   style={{
                     border: '1px solid rgba(255, 255, 255, 0.1)',
                     boxShadow: `
                       0 0 0 1px rgba(168, 85, 247, 0.05),
                       0 4px 16px rgba(168, 85, 247, 0.1),
                       0 8px 32px rgba(168, 85, 247, 0.05),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                     `
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.border = '1px solid rgba(168, 85, 247, 0.3)';
                     e.currentTarget.style.boxShadow = `
                       0 0 0 1px rgba(168, 85, 247, 0.2),
                       0 8px 32px rgba(168, 85, 247, 0.2),
                       0 16px 64px rgba(168, 85, 247, 0.25),
                       inset 0 1px 0 rgba(168, 85, 247, 0.2),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                     `;
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                     e.currentTarget.style.boxShadow = `
                       0 0 0 1px rgba(168, 85, 247, 0.05),
                       0 4px 16px rgba(168, 85, 247, 0.1),
                       0 8px 32px rgba(168, 85, 247, 0.05),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                     `;
                   }}>
                <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-purple-400/70 mb-1 md:mb-2" />
                <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">TOTAL VOLUME (24H)</div>
                <div className="text-2xl md:text-3xl font-bold font-mono text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                  {calculatingVolume ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    `$${totalVolumeUSD > 0 ? totalVolumeUSD.toLocaleString(undefined, {maximumFractionDigits: 0}) : '0'}`
                  )}
                </div>
              </div>
              <div className="group relative bg-gradient-to-br from-white/5 via-orange-500/5 to-white/0 backdrop-blur-xl rounded-xl p-3 md:p-5 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] active:shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                   style={{
                     border: '1px solid rgba(255, 255, 255, 0.1)',
                     boxShadow: `
                       0 0 0 1px rgba(249, 115, 22, 0.05),
                       0 4px 16px rgba(249, 115, 22, 0.1),
                       0 8px 32px rgba(249, 115, 22, 0.05),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                     `
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.border = '1px solid rgba(249, 115, 22, 0.3)';
                     e.currentTarget.style.boxShadow = `
                       0 0 0 1px rgba(249, 115, 22, 0.2),
                       0 8px 32px rgba(249, 115, 22, 0.2),
                       0 16px 64px rgba(249, 115, 22, 0.25),
                       inset 0 1px 0 rgba(249, 115, 22, 0.2),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                     `;
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                     e.currentTarget.style.boxShadow = `
                       0 0 0 1px rgba(249, 115, 22, 0.05),
                       0 4px 16px rgba(249, 115, 22, 0.1),
                       0 8px 32px rgba(249, 115, 22, 0.05),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                     `;
                   }}>
                <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all" />
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-orange-400/70 mb-1 md:mb-2" />
                <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">TOP GAINER</div>
                <div className="text-2xl md:text-3xl font-bold font-mono text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]">
                  {topGainerPercent > 0 ? `+${topGainerPercent.toFixed(1)}%` : '0%'}
                </div>
              </div>
              <div className="group relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/0 backdrop-blur-xl rounded-xl p-3 md:p-5 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] active:shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                   style={{
                     border: '1px solid rgba(255, 255, 255, 0.1)',
                     boxShadow: `
                       0 0 0 1px rgba(59, 130, 246, 0.05),
                       0 4px 16px rgba(59, 130, 246, 0.1),
                       0 8px 32px rgba(59, 130, 246, 0.05),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                     `
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.border = '1px solid rgba(59, 130, 246, 0.3)';
                     e.currentTarget.style.boxShadow = `
                       0 0 0 1px rgba(59, 130, 246, 0.2),
                       0 8px 32px rgba(59, 130, 246, 0.2),
                       0 16px 64px rgba(59, 130, 246, 0.25),
                       inset 0 1px 0 rgba(59, 130, 246, 0.2),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.4)
                     `;
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                     e.currentTarget.style.boxShadow = `
                       0 0 0 1px rgba(59, 130, 246, 0.05),
                       0 4px 16px rgba(59, 130, 246, 0.1),
                       0 8px 32px rgba(59, 130, 246, 0.05),
                       inset 0 1px 0 rgba(255, 255, 255, 0.1),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3)
                     `;
                   }}>
                <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-blue-400/70 mb-1 md:mb-2" />
                <div className="text-[10px] md:text-xs text-muted-foreground font-mono mb-1">ARTISTS</div>
                <div className="text-2xl md:text-3xl font-bold font-mono text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">{artists.length}</div>
              </div>
            </>
          )}
        </div>

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
                    pointerEvents: nextSong?.id === nextSongForPreload.id ? 'auto' : 'none',
                    height: '100%'
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
            {/* Enhanced Sort & Filter Controls */}
            <div className="flex flex-col gap-3 md:gap-4 mb-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 md:p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] md:text-xs text-muted-foreground font-mono flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  SORT BY:
                </span>
                <div className="flex items-center gap-1 md:gap-2 flex-wrap">
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
                      className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-mono transition-all flex items-center gap-1 ${
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
                <span className="text-[10px] md:text-xs text-muted-foreground font-mono flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  SHOW:
                </span>
                {[10, 20, 50].map((limit) => (
                  <button
                    key={limit}
                    onClick={() => setDisplayLimit(limit)}
                    className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-mono transition-all ${
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
                  className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-mono transition-all ${
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
                    <>
                      {displayedSongs.map((song, index) => (
                        <SongRow 
                          key={song.id} 
                          song={song} 
                          index={index} 
                          onStatsUpdate={handleStatsUpdate}
                          playSong={playSong}
                          currentSong={currentSong}
                          isPlaying={isPlaying}
                        />
                      ))}
                      {/* Loading indicator for infinite scroll */}
                      {!loading && visibleCount < (displayLimit ? Math.min(sortedSongs.length, displayLimit) : sortedSongs.length) && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-4">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground font-mono text-sm">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading more songs...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-1.5">
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
                <>
                  {displayedSongs.map((song, index) => (
                    <SongCard 
                      key={song.id} 
                      song={song}
                      index={index}
                      onStatsUpdate={handleStatsUpdate}
                      playSong={playSong}
                      currentSong={currentSong}
                      isPlaying={isPlaying}
                    />
                  ))}
                  {/* Loading indicator for infinite scroll */}
                  {!loading && visibleCount < (displayLimit ? Math.min(sortedSongs.length, displayLimit) : sortedSongs.length) && (
                    <div className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground font-mono text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading more...</span>
                      </div>
                    </div>
                  )}
                </>
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
