import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePublicClient } from 'wagmi';
import { Address } from 'viem';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getIPFSGatewayUrl } from '@/lib/ipfs';
import { useSongTradesFromDB } from '@/hooks/useSongTradesFromDB';

export interface TradeData {
  timestamp: number;
  price: number;
  type: 'buy' | 'sell' | 'deploy';
  amount: number;
  priceUSD: number;
  trader?: string; // Wallet address of buyer/seller
  xrgeAmount?: number; // Actual XRGE transferred
}

interface ChartDataPoint {
  time: string;
  price: number;
  volume: number;
}

interface SongTradingHistoryProps {
  tokenAddress: Address;
  xrgeUsdPrice: number;
  songTicker?: string;
  coverCid?: string;
  currentPriceInXRGE?: number;
  onVolumeCalculated?: (volume24h: number) => void; // Callback to pass 24h volume
  showRecentTrades?: boolean; // Whether to show the recent trades section
  onTradesLoaded?: (trades: TradeData[]) => void; // Callback to pass trades data
  refreshTrigger?: number; // Increment this to trigger a refetch
}

const SongTradingHistory = ({ 
  tokenAddress, 
  xrgeUsdPrice, 
  currentPriceInXRGE, 
  songTicker, 
  coverCid, 
  onVolumeCalculated,
  showRecentTrades = true,
  onTradesLoaded,
  refreshTrigger
}: SongTradingHistoryProps) => {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'1H' | '24H' | '7D' | '30D' | 'ALL'>('ALL');
  const publicClient = usePublicClient();
  
  // Try database first (much faster), fallback to blockchain if no data
  const { 
    trades: dbTrades, 
    loading: dbLoading, 
    error: dbError,
    refetch: refetchDB 
  } = useSongTradesFromDB(tokenAddress, xrgeUsdPrice, timeFilter === 'ALL' ? 8760 : 
    timeFilter === '1H' ? 1 : 
    timeFilter === '24H' ? 24 : 
    timeFilter === '7D' ? 168 : 720); // 30 days

  // Define blockchain fetch function before using it in useEffect
  const fetchTradingHistoryFromBlockchain = useCallback(async () => {
    if (!publicClient || !tokenAddress) return;
    
    setLoading(true);
    
    try {
      const XRGE_ADDRESS = '0x147120faEC9277ec02d957584CFCD92B56A24317' as Address;
      const BONDING_CURVE_ADDRESS = '0xCeE9c18C448487a1deAac3E14974C826142C50b5' as Address;

      // Fetch Transfer events
      const transferLogs = await publicClient.getLogs({
        address: tokenAddress,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' }
          ]
        },
        fromBlock: 'earliest',
        toBlock: 'latest'
      });

      // Fetch XRGE transfers
      const xrgeLogs = await publicClient.getLogs({
        address: XRGE_ADDRESS,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' }
          ]
        },
        fromBlock: 'earliest',
        toBlock: 'latest'
      });

      // Group XRGE transfers by transaction
      // For BUYS: only count user -> bonding curve (not bonding -> user refunds)
      // For SELLS: only count bonding curve -> user (not user -> bonding curve)
      const xrgeByTx = new Map<string, { buy: number; sell: number }>();
      for (const log of xrgeLogs) {
        const { args } = log as any;
        const from = (args.from as string).toLowerCase();
        const to = (args.to as string).toLowerCase();
        const amount = Number(args.value as bigint) / 1e18;
        
        const isFeeAddress = from === '0xb787433e138893a0ed84d99e82c7da260a940b1e' || to === '0xb787433e138893a0ed84d99e82c7da260a940b1e';
        
        if (isFeeAddress) continue; // Skip fee transfers
        
        const existing = xrgeByTx.get(log.transactionHash) || { buy: 0, sell: 0 };
        
        // User -> Bonding Curve = BUY (user pays XRGE)
        if (to === BONDING_CURVE_ADDRESS.toLowerCase()) {
          existing.buy += amount;
        }
        // Bonding Curve -> User = SELL (user receives XRGE)
        else if (from === BONDING_CURVE_ADDRESS.toLowerCase()) {
          existing.sell += amount;
        }
        
        xrgeByTx.set(log.transactionHash, existing);
      }

      // Process trades
      const allTrades: TradeData[] = [];
      
      for (const log of transferLogs) {
        const { args } = log as any;
        const from = (args.from as string).toLowerCase();
        const to = (args.to as string).toLowerCase();
        const amount = Number(args.value as bigint) / 1e18;
        
        if (from === BONDING_CURVE_ADDRESS.toLowerCase() || to === BONDING_CURVE_ADDRESS.toLowerCase()) {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          const timestamp = Number(block.timestamp) * 1000;
          const isBuy = from === BONDING_CURVE_ADDRESS.toLowerCase();
          const trader = isBuy ? to : from; // Buyer or seller address
          
          // Get the correct XRGE amount based on trade type
          const xrgeData = xrgeByTx.get(log.transactionHash);
          const xrgeAmount = isBuy ? (xrgeData?.buy || 0) : (xrgeData?.sell || 0);
          
          const priceInXRGE = amount > 0 ? xrgeAmount / amount : 0;
          const priceUSD = priceInXRGE * xrgeUsdPrice;
          
          allTrades.push({
            timestamp,
            price: priceInXRGE,
            type: isBuy ? 'buy' : 'sell',
            amount,
            priceUSD,
            trader,
            xrgeAmount // Store the actual XRGE amount
          });
        }
      }

      allTrades.sort((a, b) => a.timestamp - b.timestamp);
      
      // Mark the first sell as "deploy" (bonding curve initialization)
      const firstSellIndex = allTrades.findIndex(trade => trade.type === 'sell');
      if (firstSellIndex !== -1) {
        allTrades[firstSellIndex].type = 'deploy';
      }
      
      setTrades(allTrades);
      
      // Aggregate to 5-minute intervals
      const intervalMs = 5 * 60 * 1000;
      const intervalMap = new Map<number, { prices: number[]; volume: number }>();

      allTrades.forEach(trade => {
        const intervalKey = Math.floor(trade.timestamp / intervalMs);
        const existing = intervalMap.get(intervalKey) || { prices: [], volume: 0 };
        existing.prices.push(trade.priceUSD);
        existing.volume += trade.amount;
        intervalMap.set(intervalKey, existing);
      });

      const chartPoints = Array.from(intervalMap.entries())
        .map(([intervalKey, data]) => {
          const timestamp = intervalKey * intervalMs;
          const date = new Date(timestamp);
          const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          return {
            time: timeStr,
            price: data.prices[data.prices.length - 1], // Last price in interval
            volume: data.volume
          };
        })
        .slice(-288);

      // Add current price
      if (currentPriceInXRGE && currentPriceInXRGE > 0) {
        const currentPriceUSD = currentPriceInXRGE * xrgeUsdPrice;
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        chartPoints.push({
          time: timeStr + ' (Now)',
          price: currentPriceUSD,
          volume: 0
        });
      }

      // Chart data will be updated by the useEffect that watches trades
      // No need to setChartData here since setTrades will trigger the effect
    } catch (error) {
      console.error('Error fetching trading history from blockchain:', error);
    } finally {
      setLoading(false);
    }
  }, [publicClient, tokenAddress, xrgeUsdPrice, currentPriceInXRGE]);

  // Use database trades if available, otherwise fallback to blockchain
  useEffect(() => {
    if (dbTrades && dbTrades.length > 0) {
      // Database has trades - use them
      console.log('✅ Using database trades:', dbTrades.length);
      setTrades(dbTrades);
      setLoading(dbLoading);
    } else if (!dbLoading && dbTrades.length === 0 && !dbError) {
      // Database is empty but no error - fallback to blockchain
      console.log('⚠️ No database trades, falling back to blockchain');
      fetchTradingHistoryFromBlockchain();
    } else if (dbError) {
      // Database error - fallback to blockchain
      console.warn('Database query error, falling back to blockchain:', dbError);
      fetchTradingHistoryFromBlockchain();
    } else {
      // Still loading database
      setLoading(dbLoading);
    }
  }, [dbTrades, dbLoading, dbError, fetchTradingHistoryFromBlockchain]);

  // Pass trades data to parent whenever it changes
  useEffect(() => {
    if (onTradesLoaded && trades.length > 0) {
      onTradesLoaded(trades);
    }
  }, [trades, onTradesLoaded]);

  // Calculate 24h volume whenever trades change
  useEffect(() => {
    if (trades.length > 0 && onVolumeCalculated) {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      const volume24h = trades
        .filter(trade => trade.timestamp >= oneDayAgo)
        .reduce((sum, trade) => sum + (trade.xrgeAmount || 0), 0);
      
      onVolumeCalculated(volume24h);
    }
  }, [trades, onVolumeCalculated]);

  // Auto-refresh disabled - only fetch on mount or when song changes
  // Data will refresh when user buys/sells via the trade form
  // For real-time updates, implement Supabase real-time subscriptions instead
  // (Auto-refresh interval removed - was causing excessive requests every 3 seconds)
  
  // Trigger blockchain fetch when refreshTrigger changes (manual refresh)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refetchDB(); // Try database first
      if (dbTrades.length === 0) {
        fetchTradingHistoryFromBlockchain(); // Fallback if needed
      }
    }
  }, [refreshTrigger, refetchDB, fetchTradingHistoryFromBlockchain, dbTrades.length]);
  
  // Update chart data whenever trades change (for both database and blockchain trades)
  useEffect(() => {
    if (trades.length === 0) {
      setChartData([]);
      return;
    }
    
    // Aggregate to 5-minute intervals
    const intervalMs = 5 * 60 * 1000;
    const intervalMap = new Map<number, { prices: number[]; volume: number }>();

    trades.forEach(trade => {
      const intervalKey = Math.floor(trade.timestamp / intervalMs);
      const existing = intervalMap.get(intervalKey) || { prices: [], volume: 0 };
      existing.prices.push(trade.priceUSD);
      existing.volume += trade.amount;
      intervalMap.set(intervalKey, existing);
    });

    const chartPoints = Array.from(intervalMap.entries())
      .map(([intervalKey, data]) => {
        const timestamp = intervalKey * intervalMs;
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        return {
          time: timeStr,
          price: data.prices[data.prices.length - 1], // Last price in interval
          volume: data.volume
        };
      })
      .slice(-288);

    // Add current price
    if (currentPriceInXRGE && currentPriceInXRGE > 0) {
      const currentPriceUSD = currentPriceInXRGE * xrgeUsdPrice;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      chartPoints.push({
        time: timeStr + ' (Now)',
        price: currentPriceUSD,
        volume: 0
      });
    }

    setChartData(chartPoints);
  }, [trades, currentPriceInXRGE, xrgeUsdPrice]);

  // Filter chart data based on time range
  const filteredChartData = useMemo(() => {
    if (timeFilter === 'ALL' || chartData.length === 0) {
      return chartData;
    }
    
    // Calculate how many data points to show based on time filter
    const pointsToShow = {
      '1H': 12,   // 12 * 5min = 1 hour
      '24H': 288,  // 288 * 5min = 24 hours
      '7D': 2016,  // 7 days of 5-min intervals
      '30D': 8640  // 30 days of 5-min intervals
    }[timeFilter];
    
    return chartData.slice(-pointsToShow);
  }, [chartData, timeFilter]);
  
  // Check if there's enough data to make filtering meaningful
  const hasEnoughDataForFiltering = chartData.length > 12;

  if (loading) {
    return (
      <Card className="p-6 console-bg tech-border">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
          <span className="ml-3 font-mono text-muted-foreground">Loading chart...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 md:p-6 console-bg tech-border">
        <div className="mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
            <h3 className="font-mono font-bold text-base sm:text-lg neon-text">PRICE HISTORY (5m)</h3>
            
            {/* Time Filter Buttons */}
            <div className="flex gap-1 flex-wrap">
              {(['1H', '24H', '7D', '30D', 'ALL'] as const).map((filter) => {
                const isDisabled = !hasEnoughDataForFiltering && filter !== 'ALL';
                
                return (
                  <Button
                    key={filter}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (isDisabled) {
                        toast.info('⏳ Not enough data yet', {
                          description: `Need at least 12 data points (1 hour of trading activity). Currently have ${chartData.length} points.`
                        });
                      } else {
                        setTimeFilter(filter);
                      }
                    }}
                    variant={timeFilter === filter ? "default" : "outline"}
                    size="sm"
                    className={`
                      h-6 px-2 text-[10px] sm:text-xs font-mono
                      ${timeFilter === filter 
                        ? 'bg-neon-green text-black hover:bg-neon-green/90' 
                        : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
                      }
                      ${isDisabled ? 'opacity-50' : ''}
                    `}
                  >
                    {filter}
                  </Button>
                );
              })}
            </div>
          </div>
          
          {currentPriceInXRGE && (
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-400 border-2 border-neon-green"></div>
              <span className="text-muted-foreground">Current Price</span>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={filteredChartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff00" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#00ff00" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="#666"
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
              tick={{ fill: '#666' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#666"
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
              tickFormatter={(value) => value < 0.000001 ? `$${value.toFixed(10)}` : `$${value.toFixed(8)}`}
              tick={{ fill: '#666' }}
              width={65}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#000',
                border: '1px solid #00ff00',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '10px',
                padding: '4px 6px'
              }}
              labelStyle={{ fontSize: '9px', color: '#00ff9f' }}
              formatter={(value: any) => {
                const num = Number(value);
                return num < 0.000001 ? [`$${num.toFixed(10)}`, 'Price'] : [`$${num.toFixed(8)}`, 'Price'];
              }}
            />
            <Area 
              type="monotone"
              dataKey="price" 
              stroke="#00ff00" 
              strokeWidth={2.5}
              fill="url(#priceGradient)"
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                const isCurrent = payload.time?.includes('(Now)');
                if (!isCurrent) return null;
                return (
                  <g key={`current-price-${index}`}>
                    <circle cx={cx} cy={cy} r={6} fill="#ffff00" stroke="#00ff00" strokeWidth={2} />
                    <circle cx={cx} cy={cy} r={3} fill="#ffff00" className="animate-pulse" />
                  </g>
                );
              }}
              activeDot={{ r: 6, fill: '#00ff00', stroke: '#000', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-3 sm:p-4 md:p-6 console-bg tech-border">
        <h3 className="font-mono font-bold text-base sm:text-lg mb-3 sm:mb-4 text-purple-400">VOLUME</h3>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={filteredChartData}>
            <defs>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="#666"
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
              tick={{ fill: '#666' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#666"
              style={{ fontSize: '10px', fontFamily: 'monospace' }}
              tickFormatter={(value) => value.toLocaleString()}
              tick={{ fill: '#666' }}
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#000',
                border: '1px solid #a855f7',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '10px',
                padding: '4px 6px'
              }}
              labelStyle={{ fontSize: '9px', color: '#a855f7' }}
              formatter={(value: any) => [Number(value).toLocaleString(undefined, {maximumFractionDigits: 0}), 'Tokens']}
            />
            <Area 
              type="monotone" 
              dataKey="volume" 
              stroke="#a855f7" 
              strokeWidth={2}
              fill="url(#volumeGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Trades */}
      {showRecentTrades && (
        <Card className="p-3 sm:p-4 md:p-6 console-bg tech-border">
          <h3 className="font-mono font-bold text-base sm:text-lg mb-3 sm:mb-4 text-cyan-400">RECENT TRADES</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
          {trades.length === 0 ? (
            <p className="text-muted-foreground font-mono text-xs sm:text-sm text-center py-4">No trades yet</p>
          ) : (
            trades.slice(-10).reverse().map((trade, i) => {
              const coverUrl = coverCid ? getIPFSGatewayUrl(coverCid) : '/placeholder-cover.png';
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
                      : trade.type === 'deploy'
                      ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                      : 'bg-red-500/20 text-red-500 border border-red-500/30'
                  }`}>
                    {trade.type.toUpperCase()}
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 sm:ml-20">
                    <img 
                      src={coverUrl} 
                      alt={songTicker || 'Song'} 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-cover.png';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs sm:text-sm font-bold truncate">
                        {trade.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} ${songTicker?.toUpperCase() || 'SONG'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-mono flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2 truncate">
                        <span className="hidden sm:inline">{new Date(trade.timestamp).toLocaleString()}</span>
                        <span className="sm:hidden">{new Date(trade.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-cyan-400 truncate">by {shortAddress}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 self-end sm:self-auto">
                    <div className="font-mono text-xs sm:text-sm font-bold text-neon-green">
                      ${trade.priceUSD < 0.000001 ? trade.priceUSD.toFixed(10) : trade.priceUSD.toFixed(8)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                      {xrgeAmount} XRGE
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
      )}
    </div>
  );
};

export default SongTradingHistory;
