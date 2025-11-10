import { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Music, Play, Pause, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSongPrice, useSongMetadata, useBondingCurveSupply } from "@/hooks/useSongBondingCurve";
import { usePublicClient } from "wagmi";
import { Address } from "viem";
import { AiBadge } from "@/components/AiBadge";
import { SongTradingChart } from "@/components/SongTradingChart";
import SongTradingHistory, { TradeData } from "@/components/SongTradingHistory";
import { AudioWaveform } from "@/components/AudioWaveform";
import { useAudioStateForSong } from "@/hooks/useAudioState";
import TwinklingStars from "@/components/TwinklingStars";

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

interface TrendingFeaturedSongProps {
  song: Song;
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
  rank?: number;
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

const TrendingFeaturedSong = memo(({ song, playSong, currentSong, isPlaying, rank }: TrendingFeaturedSongProps) => {
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
  const { metadata: metadataData } = useSongMetadata(song.token_address as Address);
  const { supply: bondingSupply } = useBondingCurveSupply(song.token_address as Address, false);
  
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
      
      {/* Twinkling Stars Background */}
      <TwinklingStars className="rounded-2xl" count={25} />
      
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
            <AiBadge aiUsage={song.ai_usage || undefined} size="md" />
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
TrendingFeaturedSong.displayName = 'TrendingFeaturedSong';

export default TrendingFeaturedSong;

