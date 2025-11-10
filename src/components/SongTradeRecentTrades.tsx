import { Card } from "@/components/ui/card";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { TradeData } from "@/components/SongTradingHistory";

interface Song {
  cover_cid: string | null;
  ticker: string | null;
}

interface SongTradeRecentTradesProps {
  trades: TradeData[];
  song: Song | null;
}

export default function SongTradeRecentTrades({
  trades,
  song,
}: SongTradeRecentTradesProps) {
  if (trades.length === 0) return null;

  return (
    <div className="mb-6 md:mb-8">
      <Card className="p-3 sm:p-4 md:p-6 console-bg tech-border">
        <h3 className="font-mono font-bold text-base sm:text-lg mb-3 sm:mb-4 text-cyan-400">RECENT TRADES</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {trades.slice(-10).reverse().map((trade, i) => {
            const coverUrl = song?.cover_cid ? getIPFSGatewayUrl(song.cover_cid) : '/placeholder-cover.png';
            const xrgeAmount = trade.xrgeAmount 
              ? trade.xrgeAmount.toLocaleString(undefined, {maximumFractionDigits: 2})
              : (trade.amount * trade.price).toLocaleString(undefined, {maximumFractionDigits: 2});
            const shortAddress = trade.trader 
              ? `${trade.trader.slice(0, 4)}...${trade.trader.slice(-4)}`
              : 'Unknown';
            
            return (
              <div 
                key={i}
                className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 bg-background/50 border border-border rounded hover:bg-background/80 transition-colors"
              >
                {/* Badge in bottom-left corner */}
                <div className={`absolute bottom-2 left-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-mono text-[10px] sm:text-xs font-bold ${
                  trade.type === 'buy' 
                    ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                    : 'bg-red-500/20 text-red-500 border border-red-500/30'
                }`}>
                  {trade.type === 'buy' ? '↑ BUY' : '↓ SELL'}
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3 flex-1">
                  <img 
                    src={coverUrl} 
                    alt={song?.ticker || 'Song'} 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-cover.png';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs sm:text-sm font-mono text-muted-foreground">
                        {shortAddress}
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                      {new Date(trade.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <div className="text-right pl-12 sm:pl-0">
                  <div className="text-xs sm:text-sm font-mono font-bold">
                    {trade.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} ${song?.ticker?.toUpperCase()}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                    {xrgeAmount} XRGE
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

