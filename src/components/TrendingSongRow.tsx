import { useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Music, Play, Pause, TrendingUp, TrendingDown } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSongPrice, useSongMetadata, useBondingCurveSupply } from "@/hooks/useSongBondingCurve";
import { useSong24hData } from "@/hooks/useSong24hData";
import { Address } from "viem";
import { AiBadge } from "@/components/AiBadge";
import { SongPriceSparkline } from "@/components/SongPriceSparkline";
import { TableRow, TableCell } from "@/components/ui/table";
import { AudioWaveform } from "@/components/AudioWaveform";
import { useAudioStateForSong } from "@/hooks/useAudioState";

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
  ai_usage?: 'none' | 'partial' | 'full' | null;
}

interface TrendingSongRowProps {
  song: Song;
  index: number;
  onStatsUpdate?: (songId: string, volume: number, change: number, marketCap: number, price: number) => void;
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
  style?: React.CSSProperties;
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

const TrendingSongRow = memo(({ song, index, onStatsUpdate, playSong, currentSong, isPlaying, style }: TrendingSongRowProps) => {
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
  return (
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
              <AiBadge aiUsage={song.ai_usage || undefined} size="sm" />
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
});
TrendingSongRow.displayName = 'TrendingSongRow';

export default TrendingSongRow;

