import { useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Music, Play, Pause } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSongPrice, useSongMetadata, useBondingCurveSupply } from "@/hooks/useSongBondingCurve";
import { useSong24hData } from "@/hooks/useSong24hData";
import { Address } from "viem";
import { AiBadge } from "@/components/AiBadge";

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

interface TrendingSongCardProps {
  song: Song;
  index: number;
  onStatsUpdate?: (songId: string, volume: number, change: number, marketCap: number, price: number) => void;
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
}

const TrendingSongCard = memo(({ song, index, onStatsUpdate, playSong, currentSong, isPlaying }: TrendingSongCardProps) => {
  const navigate = useNavigate();
  const { prices } = useTokenPrices();
  const isCurrentSong = currentSong?.id === song.id;
  const isThisSongPlaying = isCurrentSong && isPlaying;
  
  // Get current price from bonding curve (no auto-refresh to reduce RPC calls)
  const { price: priceInXRGENumber } = useSongPrice(song.token_address as Address, false);
  const priceInXRGE = priceInXRGENumber ? parseFloat(priceInXRGENumber) : undefined;
  
  // Get metadata and supply using proper hooks (no auto-refresh to reduce RPC calls)
  const { metadata: metadataData } = useSongMetadata(song.token_address as Address);
  const { supply: bondingSupply } = useBondingCurveSupply(song.token_address as Address, false);
  
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
  }, [song.id, volumeUSD, change24h, marketCap, currentPrice, onStatsUpdate]);
  
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
          <AiBadge aiUsage={song.ai_usage || undefined} size="sm" />
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
TrendingSongCard.displayName = 'TrendingSongCard';

export default TrendingSongCard;

