import { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { usePublicClient } from 'wagmi';
import { Address } from 'viem';

interface SongPriceSparklineProps {
  tokenAddress?: string;
  bondingSupply?: string;
  priceInXRGE?: number;
  className?: string;
  height?: number;
  strokeColor?: string;
  showPercentChange?: boolean;
  timeframeHours?: number; // Hours to look back for trades (e.g., 24 for 24h)
  percentChange?: number; // Optional: pass in pre-calculated percent change to ensure consistency
}

export const SongPriceSparkline = ({ 
  tokenAddress,
  bondingSupply, 
  priceInXRGE,
  className = "",
  height = 40,
  strokeColor = "#00ff9f",
  showPercentChange = false,
  timeframeHours = 24, // Default to 24 hours
  percentChange // Optional pre-calculated percent change
}: SongPriceSparklineProps) => {
  const { prices } = useTokenPrices();
  const publicClient = usePublicClient();
  const [tradeData, setTradeData] = useState<{ value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch actual trade data from blockchain with auto-refresh
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const fetchTradeHistory = async () => {
      if (!publicClient || !tokenAddress) {
        setLoading(false);
        return;
      }
      
      // If timeframeHours is very large (e.g., 999999), show bonding curve progression instead of trades
      if (timeframeHours > 1000 && bondingSupply && priceInXRGE) {
        console.log('📈 Showing full bonding curve progression (ALL time view)');
        
        const BONDING_CURVE_TOTAL = 990_000_000;
        const INITIAL_PRICE = 0.001; // XRGE
        const PRICE_INCREMENT = 0.000001; // XRGE per token
        
        // Calculate current tokens bought
        const currentTokensBought = parseFloat(bondingSupply) > 0
          ? BONDING_CURVE_TOTAL - parseFloat(bondingSupply)
          : 0;
        
        // Generate price points from 0 to current supply
        const points = [];
        const numPoints = 20; // 20 data points for sparkline
        
        for (let i = 0; i <= numPoints; i++) {
          const tokensBought = (currentTokensBought / numPoints) * i;
          const priceXRGE = INITIAL_PRICE + (tokensBought * PRICE_INCREMENT);
          const priceUSD = priceXRGE * (prices.xrge || 0);
          
          points.push({ value: priceUSD });
        }
        
        setTradeData(points);
        setLoading(false);
        return;
      }
      
      try {
        const BONDING_CURVE_ADDRESS = '0xCeE9c18C448487a1deAac3E14974C826142C50b5' as Address;
        const XRGE_ADDRESS = '0x147120faEC9277ec02d957584CFCD92B56A24317' as Address;

        // Calculate block range based on timeframe
        // Base has ~2 second block time
        const currentBlock = await publicClient.getBlockNumber();
        const blocksPerHour = 1800; // 3600 seconds / 2 seconds per block
        const blocksToLookBack = BigInt(Math.floor(blocksPerHour * timeframeHours));
        const fromBlock = currentBlock - blocksToLookBack;

        // Fetch Transfer events for the timeframe
        const transferLogs = await publicClient.getLogs({
          address: tokenAddress as Address,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { indexed: true, name: 'from', type: 'address' },
              { indexed: true, name: 'to', type: 'address' },
              { indexed: false, name: 'value', type: 'uint256' }
            ]
          },
          fromBlock: fromBlock,
          toBlock: 'latest'
        });

        // Fetch XRGE transfers for the same period
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
          fromBlock: fromBlock,
          toBlock: 'latest'
        });

        // Map XRGE amounts by transaction
        const xrgeByTx = new Map<string, { buy: number; sell: number }>();
        for (const log of xrgeLogs) {
          const { args } = log as any;
          const from = (args.from as string).toLowerCase();
          const to = (args.to as string).toLowerCase();
          const amount = Number(args.value as bigint) / 1e18;
          
          const isFeeAddress = from === '0xb787433e138893a0ed84d99e82c7da260a940b1e' || to === '0xb787433e138893a0ed84d99e82c7da260a940b1e';
          if (isFeeAddress) continue;
          
          const existing = xrgeByTx.get(log.transactionHash) || { buy: 0, sell: 0 };
          
          if (to === BONDING_CURVE_ADDRESS.toLowerCase()) {
            existing.buy += amount;
          } else if (from === BONDING_CURVE_ADDRESS.toLowerCase()) {
            existing.sell += amount;
          }
          
          xrgeByTx.set(log.transactionHash, existing);
        }

        // Process trades and calculate prices
        const trades: { timestamp: number; priceUSD: number }[] = [];
        
        for (const log of transferLogs) {
          const { args } = log as any;
          const from = (args.from as string).toLowerCase();
          const to = (args.to as string).toLowerCase();
          const amount = Number(args.value as bigint) / 1e18;
          
          if (from === BONDING_CURVE_ADDRESS.toLowerCase() || to === BONDING_CURVE_ADDRESS.toLowerCase()) {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            const timestamp = Number(block.timestamp) * 1000;
            const isBuy = from === BONDING_CURVE_ADDRESS.toLowerCase();
            
            const xrgeData = xrgeByTx.get(log.transactionHash);
            const xrgeAmount = isBuy ? (xrgeData?.buy || 0) : (xrgeData?.sell || 0);
            
            const priceInXRGE = amount > 0 ? xrgeAmount / amount : 0;
            const priceUSD = priceInXRGE * (prices.xrge || 0);
            
            if (priceUSD > 0) {
              trades.push({ timestamp, priceUSD });
            }
          }
        }

        // Sort by timestamp and sample down to ~20 points for sparkline
        trades.sort((a, b) => a.timestamp - b.timestamp);
        
        const sampledTrades = trades.length > 20
          ? trades.filter((_, i) => i % Math.ceil(trades.length / 20) === 0)
          : trades;
        
        // Add current price as last point if available
        if (priceInXRGE && prices.xrge) {
          sampledTrades.push({
            timestamp: Date.now(),
            priceUSD: priceInXRGE * prices.xrge
          });
        }

        const priceData = sampledTrades.map(t => ({ value: t.priceUSD }));
        
        // If no trades in timeframe but we have price data, generate fallback
        if (priceData.length < 2 && priceInXRGE !== undefined && prices.xrge) {
          console.log('⚠️ No trades in timeframe, showing flat line (no 24h change)');
          
          // No trades in 24h = flat price (0% change)
          // Show current price as a flat line
          const currentPriceUSD = priceInXRGE * prices.xrge;
          const fallbackPoints = Array(20).fill({ value: currentPriceUSD });
          
          setTradeData(fallbackPoints);
        } else if (priceData.length < 2 && bondingSupply && priceInXRGE !== undefined) {
          console.log('⚠️ No trades in timeframe, showing flat line (no 24h change)');
          
          // No trades in 24h = flat price (0% change)
          // Show current price as a flat line
          const currentPriceUSD = priceInXRGE * (prices.xrge || 0);
          const fallbackPoints = Array(20).fill({ value: currentPriceUSD });
          
          setTradeData(fallbackPoints);
        } else {
          setTradeData(priceData);
        }
      } catch (error) {
        console.error('Error fetching sparkline data:', error);
        setTradeData([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchTradeHistory();
    
    // Auto-refresh disabled - only fetch on mount or when dependencies change
    // Data will refresh when user buys/sells or navigates to different song
    // No cleanup needed
  }, [tokenAddress, publicClient, prices.xrge, priceInXRGE, timeframeHours, bondingSupply]);
  
  // Don't render if no meaningful data - wait for data to load first
  if (loading || !tokenAddress || !priceInXRGE || !bondingSupply) {
    return (
      <div className={`flex items-center justify-center ${className} bg-muted/10 rounded`} style={{ height }}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-full h-3/4 bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20 rounded" 
               style={{ 
                 background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
                 backgroundSize: '200% 100%',
                 animation: 'shimmer 1.5s ease-in-out infinite'
               }} />
        </div>
      </div>
    );
  }

  if (tradeData.length < 2) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-[8px] text-muted-foreground">—</div>
      </div>
    );
  }

  // Use pre-calculated percent change if provided, otherwise calculate from trade data
  const calculatedPercentChange = percentChange !== undefined 
    ? percentChange 
    : (() => {
        const firstPrice = tradeData[0].value;
        const lastPrice = tradeData[tradeData.length - 1].value;
        return ((lastPrice - firstPrice) / firstPrice) * 100;
      })();
  
  const isPositive = calculatedPercentChange >= 0;
  
  // Auto-set stroke color based on change if not explicitly set
  const finalStrokeColor = strokeColor === "#00ff9f" && !isPositive ? "#ef4444" : strokeColor;

  return (
    <div className={`${className} flex items-center gap-2`}>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={tradeData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <defs>
              <linearGradient id={`sparkline-gradient-${isPositive ? 'green' : 'red'}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#00ff00' : '#ef4444'} stopOpacity={0.6} />
                <stop offset="50%" stopColor={isPositive ? '#00ff00' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isPositive ? '#00ff00' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area 
              type="linear" 
              dataKey="value" 
              stroke={finalStrokeColor}
              strokeWidth={3}
              fill={`url(#sparkline-gradient-${isPositive ? 'green' : 'red'})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {showPercentChange && (
        <div className={`text-[10px] font-mono font-bold whitespace-nowrap ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{calculatedPercentChange.toFixed(1)}%
        </div>
      )}
    </div>
  );
};

