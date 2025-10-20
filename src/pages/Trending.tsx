import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NetworkInfo from "@/components/NetworkInfo";
import { Loader2, TrendingUp, TrendingDown, Flame, Music, Play, Pause } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import logo from "@/assets/logo.png";
import MusicBars from "@/components/MusicBars";
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
import { useSongPrice } from "@/hooks/useSongBondingCurve";
import { useReadContract, usePublicClient } from "wagmi";
import { Address, formatEther } from "viem";
import { AiBadge } from "@/components/AiBadge";
import { SongPriceSparkline } from "@/components/SongPriceSparkline";

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

const SONG_TOKEN_ABI = [
  {
    inputs: [],
    name: 'totalXRGERaised',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'bondingCurveSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Component for featured banner with real data
const FeaturedSong = ({ song }: { song: Song }) => {
  const navigate = useNavigate();
  const { prices } = useTokenPrices();
  const publicClient = usePublicClient();
  const [volume24h, setVolume24h] = useState<number>(0);
  
  const { price: priceInXRGE } = useSongPrice(song.token_address as Address);
  const { data: xrgeRaised } = useReadContract({
    address: song.token_address as Address,
    abi: SONG_TOKEN_ABI,
    functionName: 'totalXRGERaised',
    query: { enabled: !!song.token_address }
  });
  
  const { data: bondingSupply } = useReadContract({
    address: song.token_address as Address,
    abi: SONG_TOKEN_ABI,
    functionName: 'bondingCurveSupply',
    query: { enabled: !!song.token_address }
  });
  
  const bondingSupplyStr = bondingSupply ? bondingSupply.toString() : null;
  
  // Fetch 24h volume from blockchain
  useEffect(() => {
    const fetch24hVolume = async () => {
      if (!publicClient || !song.token_address) return;
      
      const BONDING_CURVE_ADDRESS = '0xCeE9c18C448487a1deAac3E14974C826142C50b5' as Address;
      const XRGE_ADDRESS = '0x147120faEC9277ec02d957584CFCD92B56A24317' as Address;
      
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const blocksIn24h = 43200;
        const fromBlock = currentBlock - BigInt(blocksIn24h);
        
        // Fetch song token Transfer events for 24h
        const songTokenLogs = await publicClient.getLogs({
          address: song.token_address as Address,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: false, name: 'value' }
            ]
          },
          fromBlock,
          toBlock: currentBlock
        });
        
        // Fetch XRGE Transfer events for 24h
        const xrgeLogs = await publicClient.getLogs({
          address: XRGE_ADDRESS,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: false, name: 'value' }
            ]
          },
          fromBlock,
          toBlock: currentBlock
        });
        
        // Build a map of XRGE transfers by transaction hash
        const xrgeByTx = new Map<string, number>();
        const FEE_ADDRESS = '0xb787433e138893a0ed84d99e82c7da260a940b1e';
        
        for (const log of xrgeLogs) {
          const { args } = log as any;
          const from = (args.from as string).toLowerCase();
          const to = (args.to as string).toLowerCase();
          const amount = Number(args.value as bigint) / 1e18;
          
          if (from === FEE_ADDRESS.toLowerCase() || to === FEE_ADDRESS.toLowerCase()) continue;
          
          if (to === BONDING_CURVE_ADDRESS.toLowerCase() || from === BONDING_CURVE_ADDRESS.toLowerCase()) {
            const existing = xrgeByTx.get(log.transactionHash) || 0;
            xrgeByTx.set(log.transactionHash, existing + amount);
          }
        }
        
        // Calculate 24h volume by correlating song token transfers with XRGE transfers
        let volume = 0;
        for (const log of songTokenLogs) {
          const { args } = log as any;
          const from = (args.from as string).toLowerCase();
          const to = (args.to as string).toLowerCase();
          
          // Only count transfers involving the bonding curve
          if (from === BONDING_CURVE_ADDRESS.toLowerCase() || to === BONDING_CURVE_ADDRESS.toLowerCase()) {
            const xrgeAmount = xrgeByTx.get(log.transactionHash) || 0;
            volume += xrgeAmount;
          }
        }
        
        setVolume24h(volume);
      } catch (error) {
        console.error('Failed to fetch 24h volume:', error);
      }
    };
    
    fetch24hVolume();
  }, [publicClient, song.token_address]);
  
  const priceUSD = (parseFloat(priceInXRGE) || 0) * (prices.xrge || 0);
  const volumeUSD = volume24h * (prices.xrge || 0);
  
  return (
    <div className="mb-6 relative overflow-hidden md:rounded-2xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,255,159,0.15)] p-6 hover:bg-white/8 transition-all duration-300">
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
          #1 TRENDING
        </div>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
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
            <div className="bg-black/40 rounded-lg px-3 py-2">
              <div className="text-xs text-muted-foreground font-mono">PRICE</div>
              <div className="text-sm font-bold font-mono neon-text">
                ${priceUSD < 0.000001 ? priceUSD.toFixed(10) : priceUSD < 0.01 ? priceUSD.toFixed(8) : priceUSD.toFixed(6)}
              </div>
            </div>
            <div className="bg-black/40 rounded-lg px-3 py-2">
              <div className="text-xs text-muted-foreground font-mono">VOLUME</div>
              <div className="text-sm font-bold font-mono text-purple-400">
                ${volumeUSD < 1 ? volumeUSD.toFixed(2) : volumeUSD.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </div>
            </div>
            <div className="bg-black/40 rounded-lg px-3 py-2">
              <div className="text-xs text-muted-foreground font-mono">PLAYS</div>
              <div className="text-sm font-bold font-mono text-orange-400">
                <Flame className="w-3 h-3 inline mr-1" />
                {song.play_count}
              </div>
            </div>
          </div>
          
          {/* Big Sparkline */}
          <div className="bg-black/40 rounded-lg px-4 py-3 border border-neon-green/20">
            <div className="text-xs text-muted-foreground font-mono mb-2">24H PRICE CHART</div>
            <SongPriceSparkline 
              tokenAddress={song.token_address || undefined}
              bondingSupply={bondingSupplyStr || undefined}
              priceInXRGE={parseFloat(priceInXRGE) || undefined}
              height={60}
              showPercentChange={true}
              timeframeHours={24}
              className="w-full"
            />
          </div>
        </div>
        <button 
          onClick={() => navigate(`/song/${song.id}`)}
          className="bg-neon-green hover:bg-neon-green/80 text-black font-mono font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 shadow-lg shadow-neon-green/20"
        >
          TRADE NOW →
        </button>
      </div>
      </div>
    </div>
  );
};

// Component for individual song row with real-time data
const SongRow = ({ song, index, onStatsUpdate, playSong, currentSong, isPlaying }: { song: Song; index: number; onStatsUpdate?: (songId: string, volume: number, change: number, marketCap: number, price: number) => void; playSong?: (song: any) => void; currentSong?: any; isPlaying?: boolean }) => {
  const navigate = useNavigate();
  const { prices } = useTokenPrices();
  const publicClient = usePublicClient();
  
  const isCurrentSong = currentSong?.id === song.id;
  const isThisSongPlaying = isCurrentSong && isPlaying;
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [volume24h, setVolume24h] = useState<number>(0); // Track actual 24h volume in XRGE
  
  // Get current price from bonding curve
  const { price: priceInXRGENumber } = useSongPrice(song.token_address as Address);
  const priceInXRGE = priceInXRGENumber !== null ? priceInXRGENumber : null;
  
  // Get XRGE raised and supply
  const { data: xrgeRaised } = useReadContract({
    address: song.token_address as Address,
    abi: SONG_TOKEN_ABI,
    functionName: 'totalXRGERaised',
    query: { enabled: !!song.token_address }
  });
  
  const { data: bondingSupply } = useReadContract({
    address: song.token_address as Address,
    abi: SONG_TOKEN_ABI,
    functionName: 'bondingCurveSupply',
    query: { enabled: !!song.token_address }
  });
  
  // Convert bondingSupply to a stable string value to prevent infinite loops
  const bondingSupplyStr = bondingSupply ? bondingSupply.toString() : null;
  
  // Fetch 24h price change and volume from blockchain
  useEffect(() => {
    const fetch24hData = async () => {
      if (!publicClient || !song.token_address || !bondingSupplyStr) return;
      
      const BONDING_CURVE_ADDRESS = '0xCeE9c18C448487a1deAac3E14974C826142C50b5' as Address;
      const XRGE_ADDRESS = '0x147120faEC9277ec02d957584CFCD92B56A24317' as Address;
      
      try {
        // Get current block
        const currentBlock = await publicClient.getBlockNumber();
        
        // Base has ~2 second block time, so 24h = ~43,200 blocks
        const blocksIn24h = 43200;
        const fromBlock = currentBlock - BigInt(blocksIn24h);
        
        // Fetch song token Transfer events for 24h
        const songTokenLogs = await publicClient.getLogs({
          address: song.token_address as Address,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: false, name: 'value' }
            ]
          },
          fromBlock,
          toBlock: currentBlock
        });
        
        // Fetch XRGE Transfer events for 24h
        const xrgeLogs = await publicClient.getLogs({
          address: XRGE_ADDRESS,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: false, name: 'value' }
            ]
          },
          fromBlock,
          toBlock: currentBlock
        });
        
        // Build a map of XRGE transfers by transaction hash
        const xrgeByTx = new Map<string, number>();
        const FEE_ADDRESS = '0xb787433e138893a0ed84d99e82c7da260a940b1e';
        
        for (const log of xrgeLogs) {
          const { args } = log as any;
          const from = (args.from as string).toLowerCase();
          const to = (args.to as string).toLowerCase();
          const amount = Number(args.value as bigint) / 1e18;
          
          // Skip fee transfers
          if (from === FEE_ADDRESS.toLowerCase() || to === FEE_ADDRESS.toLowerCase()) continue;
          
          // Only count XRGE going to or from bonding curve
          if (to === BONDING_CURVE_ADDRESS.toLowerCase() || from === BONDING_CURVE_ADDRESS.toLowerCase()) {
            const existing = xrgeByTx.get(log.transactionHash) || 0;
            xrgeByTx.set(log.transactionHash, existing + amount);
          }
        }
        
        // Calculate 24h volume by correlating song token transfers with XRGE transfers
        let volume = 0;
        for (const log of songTokenLogs) {
          const { args } = log as any;
          const from = (args.from as string).toLowerCase();
          const to = (args.to as string).toLowerCase();
          
          // Only count transfers involving the bonding curve
          if (from === BONDING_CURVE_ADDRESS.toLowerCase() || to === BONDING_CURVE_ADDRESS.toLowerCase()) {
            const xrgeAmount = xrgeByTx.get(log.transactionHash) || 0;
            volume += xrgeAmount;
          }
        }
        
        setVolume24h(volume);
        
        // Try to get bonding supply from 24h ago for price change (requires archive node)
        try {
          const supply24hAgo = await publicClient.readContract({
            address: song.token_address as Address,
            abi: SONG_TOKEN_ABI,
            functionName: 'bondingCurveSupply',
            blockNumber: fromBlock
          } as any);
          
          if (supply24hAgo) {
            // Calculate tokens sold then vs now
            const BONDING_CURVE_TOTAL = 990_000_000;
            const INITIAL_PRICE = 0.001;
            const PRICE_INCREMENT = 0.000001;
            
            const tokensSold24hAgo = BONDING_CURVE_TOTAL - Number(supply24hAgo) / 1e18;
            const tokensSoldNow = BONDING_CURVE_TOTAL - Number(bondingSupplyStr) / 1e18;
            
            const price24hAgo = INITIAL_PRICE + (tokensSold24hAgo * PRICE_INCREMENT);
            const priceNow = INITIAL_PRICE + (tokensSoldNow * PRICE_INCREMENT);
            
            if (price24hAgo > 0) {
              const change = ((priceNow - price24hAgo) / price24hAgo) * 100;
              setPriceChange24h(change);
            }
          }
        } catch (error: any) {
          // Silently handle historical state query errors (common with basic RPC providers)
          if (!error?.message?.includes('not supported') && !error?.code) {
            console.warn('Historical price data not available, calculating from trades');
          }
          
          // Calculate price change from actual trades instead of hardcoded fallback
          if (songTokenLogs.length > 0) {
            // Find first and last trade prices
            const trades: { timestamp: number; priceXRGE: number }[] = [];
            
            for (const log of songTokenLogs) {
              const { args } = log as any;
              const from = (args.from as string).toLowerCase();
              const to = (args.to as string).toLowerCase();
              const amount = Number(args.value as bigint) / 1e18;
              
              if (from === BONDING_CURVE_ADDRESS.toLowerCase() || to === BONDING_CURVE_ADDRESS.toLowerCase()) {
                const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                const timestamp = Number(block.timestamp) * 1000;
                const xrgeAmount = xrgeByTx.get(log.transactionHash) || 0;
                const priceXRGE = amount > 0 ? xrgeAmount / amount : 0;
                
                if (priceXRGE > 0) {
                  trades.push({ timestamp, priceXRGE });
                }
              }
            }
            
            if (trades.length >= 2) {
              trades.sort((a, b) => a.timestamp - b.timestamp);
              const firstPrice = trades[0].priceXRGE;
              const lastPrice = trades[trades.length - 1].priceXRGE;
              const change = ((lastPrice - firstPrice) / firstPrice) * 100;
              setPriceChange24h(change);
            } else if (priceInXRGE) {
              // If fewer than 2 trades in 24h but token has history,
              // show 0% (no 24h activity = no change in last 24h)
              setPriceChange24h(0);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch 24h data:', error);
      }
    };
    
    fetch24hData();
  }, [publicClient, song.token_address, bondingSupplyStr]);
  
  const priceXRGE = parseFloat(priceInXRGE) || 0;
  const priceUSD = priceXRGE * (prices.xrge || 0);
  const xrgeRaisedNum = xrgeRaised ? Number(xrgeRaised) / 1e18 : 0;
  
  // Volume = actual 24h trading volume (not all-time XRGE raised)
  const volumeUSD = volume24h * (prices.xrge || 0);
  
  // Calculate tokens sold
  const tokensSold = bondingSupply ? (990_000_000 - Number(bondingSupply) / 1e18) : 0;
  
  // Market Cap = Total Value Locked (TVL) = actual XRGE spent (all-time)
  // NOT currentPrice × tokensSold (incorrect for bonding curves since price increases)
  const marketCap = xrgeRaisedNum * (prices.xrge || 0);
  
  // Use real 24h price change (fetched from blockchain)
  const change24h = priceChange24h ?? 0;
  const isPositive = change24h > 0;
  
  // Report stats to parent for aggregation
  useEffect(() => {
    if (onStatsUpdate) {
      onStatsUpdate(song.id, volumeUSD, change24h, marketCap, priceUSD);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, volumeUSD, change24h, marketCap, priceUSD]);
  
  // Desktop: Table Row
  const desktopView = (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => navigate(`/song/${song.id}`)}
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
      
      <TableCell>
        <SongPriceSparkline 
          tokenAddress={song.token_address || undefined}
          bondingSupply={bondingSupplyStr || undefined}
          priceInXRGE={typeof priceInXRGE === 'number' ? priceInXRGE : undefined}
          height={18}
          showPercentChange={true}
          timeframeHours={24}
          percentChange={priceChange24h !== null ? priceChange24h : undefined}
        />
      </TableCell>
      
      <TableCell className="font-mono text-right">
        {song.token_address ? (
          <div>
            <div className="font-semibold text-sm">
              ${priceUSD < 0.000001 ? priceUSD.toFixed(10) : priceUSD < 0.01 ? priceUSD.toFixed(8) : priceUSD.toFixed(4)}
            </div>
            <div className="text-xs text-muted-foreground">
              {priceXRGE.toFixed(6)} XRGE
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
            <span className="whitespace-nowrap">{isPositive ? '+' : ''}{change24h.toFixed(1)}%</span>
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
            <div className="text-xs text-muted-foreground">
              {volume24h.toLocaleString(undefined, {maximumFractionDigits: 2})} XRGE
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
                  ${priceUSD < 0.000001 ? priceUSD.toFixed(8) : priceUSD.toFixed(6)}
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

          {/* Sparkline Chart */}
          {song.token_address && (
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

  // Return only desktop view (to be used in table)
  // Mobile view will be handled separately in parent
  return desktopView;
};

// Separate mobile card component
const SongCard = ({ song, index, onStatsUpdate, playSong, currentSong, isPlaying }: { song: Song; index: number; onStatsUpdate?: (songId: string, volume: number, change: number, marketCap: number, price: number) => void; playSong?: (song: any) => void; currentSong?: any; isPlaying?: boolean }) => {
  const navigate = useNavigate();
  const { prices } = useTokenPrices();
  const publicClient = usePublicClient();
  
  const isCurrentSong = currentSong?.id === song.id;
  const isThisSongPlaying = isCurrentSong && isPlaying;
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [volume24h, setVolume24h] = useState<number>(0);
  
  const { price: priceInXRGENumber } = useSongPrice(song.token_address as Address);
  const priceInXRGE = priceInXRGENumber !== null ? priceInXRGENumber : null;
  
  const { data: xrgeRaised } = useReadContract({
    address: song.token_address as Address,
    abi: SONG_TOKEN_ABI,
    functionName: 'totalXRGERaised',
    query: { enabled: !!song.token_address }
  });
  
  const { data: bondingSupply } = useReadContract({
    address: song.token_address as Address,
    abi: SONG_TOKEN_ABI,
    functionName: 'bondingCurveSupply',
    query: { enabled: !!song.token_address }
  });
  
  const bondingSupplyStr = bondingSupply ? bondingSupply.toString() : null;
  
  // Same 24h data fetching logic
  useEffect(() => {
    const fetch24hData = async () => {
      if (!publicClient || !song.token_address || !bondingSupplyStr) return;
      
      const BONDING_CURVE_ADDRESS = '0xCeE9c18C448487a1deAac3E14974C826142C50b5' as Address;
      const XRGE_ADDRESS = '0x147120faEC9277ec02d957584CFCD92B56A24317' as Address;
      
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const blocksIn24h = 43200;
        const fromBlock = currentBlock - BigInt(blocksIn24h);
        
        const songTokenLogs = await publicClient.getLogs({
          address: song.token_address as Address,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: false, name: 'value' }
            ]
          },
          fromBlock,
          toBlock: 'latest'
        });

        const xrgeLogs = await publicClient.getLogs({
          address: XRGE_ADDRESS,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: false, name: 'value' }
            ]
          },
          args: {
            from: BONDING_CURVE_ADDRESS
          },
          fromBlock,
          toBlock: 'latest'
        });

        const trades: any[] = [];
        for (const songLog of songTokenLogs) {
          if (songLog.args.to === BONDING_CURVE_ADDRESS) {
            const xrgeLog = xrgeLogs.find(log => log.transactionHash === songLog.transactionHash);
            if (xrgeLog) {
              const songAmount = Number(formatEther(songLog.args.value as bigint));
              const xrgeAmount = Number(formatEther(xrgeLog.args.value as bigint));
              const priceXRGE = xrgeAmount / songAmount;
              trades.push({
                timestamp: Number(songLog.blockNumber),
                priceXRGE,
                volumeXRGE: xrgeAmount
              });
            }
          }
        }

        if (trades.length >= 2) {
          trades.sort((a, b) => a.timestamp - b.timestamp);
          const firstPrice = trades[0].priceXRGE;
          const lastPrice = trades[trades.length - 1].priceXRGE;
          const change = ((lastPrice - firstPrice) / firstPrice) * 100;
          setPriceChange24h(change);
          
          const totalVolume = trades.reduce((sum, t) => sum + t.volumeXRGE, 0);
          setVolume24h(totalVolume);
        } else if (priceInXRGE) {
          setPriceChange24h(0);
        }
      } catch (error) {
        console.error('Error fetching 24h data:', error);
      }
    };

    fetch24hData();
  }, [publicClient, song.token_address, bondingSupplyStr, priceInXRGE]);
  
  const xrgeRaisedNum = xrgeRaised ? Number(formatEther(xrgeRaised)) : 0;
  const priceUSD = (priceInXRGE || 0) * (prices.xrge || 0);
  const volumeUSD = volume24h * (prices.xrge || 0);
  const marketCap = xrgeRaisedNum * (prices.xrge || 0);
  const change24h = priceChange24h ?? 0;
  const isPositive = change24h > 0;
  
  useEffect(() => {
    if (onStatsUpdate) {
      onStatsUpdate(song.id, volumeUSD, change24h, marketCap, priceUSD);
    }
  }, [song.id, volumeUSD, change24h, marketCap, priceUSD]);
  
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
            ${priceUSD < 0.000001 ? priceUSD.toFixed(10) : priceUSD < 0.01 ? priceUSD.toFixed(8) : priceUSD.toFixed(6)}
          </div>
        </div>
        
        {bondingSupplyStr && (
          <div className="mt-2 bg-black/30 rounded-lg p-1.5 border border-neon-green/10">
            <SongPriceSparkline 
              tokenAddress={song.token_address || undefined}
              bondingSupply={bondingSupplyStr}
              priceInXRGE={typeof priceInXRGE === 'number' ? priceInXRGE : undefined}
              height={24}
              showPercentChange={false}
              timeframeHours={24}
              percentChange={priceChange24h !== null ? priceChange24h : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [displayLimit, setDisplayLimit] = useState<number | null>(10); // null = show all
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
              .or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%`)
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
    
    // Apply display limit if set
    return displayLimit ? sorted.slice(0, displayLimit) : sorted;
  }, [songs, sortField, sortDirection, songStats, calculateTrendingScore, displayLimit]);
  
  // Featured song is always the top trending song (by trending score)
  const featuredSong = useMemo(() => {
    if (songs.length === 0) return null;
    
    // Debug: Log trending scores
    const songsWithScores = songs.map(song => ({
      title: song.title,
      score: calculateTrendingScore(song),
      stats: songStats.get(song.id)
    }));
    console.log('🔥 Trending Scores:', songsWithScores);
    
    return [...songs].sort((a, b) => calculateTrendingScore(b) - calculateTrendingScore(a))[0];
  }, [songs, songStats, calculateTrendingScore]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24 md:pb-20">
        <NetworkInfo />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-20">
      <NetworkInfo />
      
      {/* Compact hero header with logo */}
      <div className="text-center px-4 md:px-6 pt-2 md:pt-3 pb-4">
        <div className="mb-2 flex justify-center items-center gap-3">
          <MusicBars bars={6} className="h-6 md:h-8 flex-shrink-0" />
          <img src={logo} alt="ROUGEE PLAY Logo" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-primary/20" />
          <MusicBars bars={6} className="h-6 md:h-8 flex-shrink-0" />
        </div>
        <h1 className="text-lg md:text-xl font-bold mb-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
          ROUGEE PLAY
        </h1>
        <p className="text-[11px] md:text-sm text-muted-foreground mb-0">
          The decentralized music platform where artists own their content and fans discover amazing beats
        </p>
      </div>
      
      <main className="w-full px-0 md:container md:mx-auto md:px-4 py-6 md:py-8">
        {/* Live Stats Ticker */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 px-4 md:px-0">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] hover:bg-white/8 transition-all duration-300">
            <div className="text-xs text-muted-foreground font-mono mb-1">TOTAL SONGS</div>
            <div className="text-2xl font-bold font-mono neon-text drop-shadow-[0_0_8px_rgba(0,255,159,0.6)]">{songs.length}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-[0_4px_16px_0_rgba(168,85,247,0.1)] hover:bg-white/8 transition-all duration-300">
            <div className="text-xs text-muted-foreground font-mono mb-1">TOTAL VOLUME</div>
            <div className="text-2xl font-bold font-mono text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
              ${totalVolume > 0 ? totalVolume.toLocaleString(undefined, {maximumFractionDigits: 0}) : '...'}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-[0_4px_16px_0_rgba(249,115,22,0.1)] hover:bg-white/8 transition-all duration-300">
            <div className="text-xs text-muted-foreground font-mono mb-1">TOP GAINER</div>
            <div className="text-2xl font-bold font-mono text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]">
              {loading ? '...' : topGainerPercent > 0 ? `+${topGainerPercent.toFixed(1)}%` : '0%'}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-[0_4px_16px_0_rgba(59,130,246,0.1)] hover:bg-white/8 transition-all duration-300">
            <div className="text-xs text-muted-foreground font-mono mb-1">ARTISTS</div>
            <div className="text-2xl font-bold font-mono text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">{artists.length}</div>
          </div>
        </div>

        {/* Featured/Promoted Banner with Real Data */}
        {featuredSong && <FeaturedSong song={featuredSong} />}

        <div className="mb-6 px-4 md:px-0">
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

        <Tabs defaultValue="songs" className="w-full px-4 md:px-0">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 bg-black/20 backdrop-blur-xl border border-white/10 rounded-xl p-1">
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
            {/* Sort & Filter Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">SORT BY:</span>
                <button
                  onClick={() => handleSort('trending')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                    sortField === 'trending' 
                      ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
                      : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
                  }`}
                >
                  🔥 TRENDING {sortField === 'trending' && (sortDirection === 'desc' ? '↓' : '↑')}
                </button>
              </div>
              
              {/* Display Limit Filter */}
              <div className="flex items-center gap-2">
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
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block md:rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="font-mono text-muted-foreground w-12">#</TableHead>
                    <TableHead className="font-mono text-muted-foreground">NAME</TableHead>
                    <TableHead className="font-mono text-muted-foreground text-center w-32">CHART</TableHead>
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
                  {sortedSongs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No deployed songs yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSongs.map((song, index) => (
                      <SongRow key={song.id} song={song} index={index} onStatsUpdate={handleStatsUpdate} playSong={playSong} currentSong={currentSong} isPlaying={isPlaying} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-2">
              {sortedSongs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No deployed songs yet
                </div>
              ) : (
                sortedSongs.map((song, index) => (
                  <SongCard key={song.id} song={song} index={index} onStatsUpdate={handleStatsUpdate} playSong={playSong} currentSong={currentSong} isPlaying={isPlaying} />
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
                  {artists.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No artists yet
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
