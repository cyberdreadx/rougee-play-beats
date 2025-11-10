import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { usePublicClient } from 'wagmi';

const BONDING_CURVE_ADDRESS = '0xCeE9c18C448487a1deAac3E14974C826142C50b5';
const XRGE_ADDRESS = '0x147120faEC9277ec02d957584CFCD92B56A24317' as Address;
const FEE_ADDRESS = '0xb787433e138893a0ed84d99e82c7da260a940b1e';

interface Song24hData {
  priceChange24h: number | null;
  volume24h: number;
  loading: boolean;
}

// In-memory cache with longer expiration to reduce RPC calls
const dataCache = new Map<string, { data: Song24hData; timestamp: number }>();
const CACHE_DURATION = 30 * 1000; // 30 seconds (increased to reduce RPC calls)

// Function to invalidate cache for a specific token (can be called after purchases)
export const invalidate24hDataCache = (tokenAddress: Address) => {
  const cacheKey = tokenAddress.toLowerCase();
  dataCache.delete(cacheKey);
  console.log('🗑️ useSong24hData: Cache invalidated for', tokenAddress);
};

/**
 * Hook for calculating real 24h price change and volume from blockchain data
 * Returns data and a refetch function to manually trigger recalculation
 * @param tokenAddress - The song token address
 * @param _bondingSupplyStr - Optional bonding supply string (unused, kept for compatibility)
 * @param bypassCache - If true, never use cached data (always fetch fresh data)
 */
export const useSong24hData = (tokenAddress: Address | null, _bondingSupplyStr?: string | null, bypassCache: boolean = false) => {
  const publicClient = usePublicClient();
  const [data, setData] = useState<Song24hData>({
    priceChange24h: null,
    volume24h: 0,
    loading: true
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const calculate24hData = async () => {
      
      if (!tokenAddress || !publicClient) {
        console.log('❌ useSong24hData: Missing required params', { tokenAddress, publicClient: !!publicClient });
        setData({ priceChange24h: null, volume24h: 0, loading: false });
        return;
      }
      
      // Check cache first (but respect refresh trigger to force refresh and bypassCache flag)
      const cacheKey = `${tokenAddress.toLowerCase()}`;
      const cached = dataCache.get(cacheKey);
      const now = Date.now();
      
      // Never use cache if bypassCache is true (for real-time trending data)
      if (!bypassCache && refreshTrigger === 0 && cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log('✅ useSong24hData: Using cached data', { tokenAddress, ...cached.data });
        setData(cached.data);
        return;
      }
      
      // Clear cache if refresh triggered or bypassCache is true
      if (refreshTrigger > 0 || bypassCache) {
        dataCache.delete(cacheKey);
        console.log('🔄 useSong24hData: Cache cleared, forcing refresh', { bypassCache });
      }
      
      try {
        setData(prev => ({ ...prev, loading: true }));
        
        const currentBlock = await publicClient.getBlockNumber();
        const blocksIn24h = 43200n; // Base: ~2 second block time
        const block24hAgo = currentBlock > blocksIn24h ? currentBlock - blocksIn24h : 0n;
        
        // Try historical price query first (most accurate if supported)
        if (block24hAgo > 0n) {
          try {
            // Get current price
            const currentPrice = await publicClient.readContract({
              address: BONDING_CURVE_ADDRESS as Address,
              abi: [{
                type: 'function',
                name: 'getCurrentPrice',
                inputs: [{ name: 'songToken', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view'
              }],
              functionName: 'getCurrentPrice',
              args: [tokenAddress]
            } as any);
            
            // Get historical price from 24h ago
            // Note: This might not work if the contract doesn't support historical queries
            try {
              const historicalPrice = await publicClient.readContract({
                address: BONDING_CURVE_ADDRESS as Address,
                abi: [{
                  type: 'function',
                  name: 'getCurrentPrice',
                  inputs: [{ name: 'songToken', type: 'address' }],
                  outputs: [{ name: '', type: 'uint256' }],
                  stateMutability: 'view'
                }],
                functionName: 'getCurrentPrice',
                args: [tokenAddress],
                blockNumber: block24hAgo
              } as any);
              
              if (currentPrice && historicalPrice) {
                const currentPriceNum = Number(currentPrice) / 1e18;
                const historicalPriceNum = Number(historicalPrice) / 1e18;
                
                if (historicalPriceNum > 0) {
                  const changePercent = ((currentPriceNum - historicalPriceNum) / historicalPriceNum) * 100;
                  
                  console.log(`📊 useSong24hData (historical): ${tokenAddress.slice(0, 8)}... price change: ${historicalPriceNum.toFixed(6)} → ${currentPriceNum.toFixed(6)} = ${changePercent.toFixed(2)}%`);
                  
                  const resultData = {
                    priceChange24h: changePercent,
                    volume24h: 0, // Historical price method doesn't give us volume
                    loading: false
                  };
                  
                  // Only cache if bypassCache is false (trending needs real-time data)
                  if (!bypassCache) {
                    dataCache.set(cacheKey, { data: resultData, timestamp: now });
                  }
                  setData(resultData);
                  return;
                }
              }
            } catch (histError) {
              // Historical queries not supported, fall through to trade-based calculation
              console.log(`⚠️ useSong24hData: Historical price query failed for ${tokenAddress.slice(0, 8)}..., using trade-based method`);
            }
          } catch (histError) {
            // Historical queries not supported, fall through to trade-based calculation
          }
        }
        
        // Fallback: Calculate from actual trades
        const fromBlock = currentBlock - BigInt(blocksIn24h);
        
        // Fetch song token Transfer events for 24h
        const songTokenLogs = await publicClient.getLogs({
          address: tokenAddress,
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
        
        // Calculate price change and volume from actual trades
        if (songTokenLogs.length > 0) {
          const trades: { timestamp: number; priceXRGE: number; volumeXRGE: number }[] = [];
          
          // Batch fetch blocks to reduce RPC calls
          const uniqueBlocks = new Set(songTokenLogs.map(log => log.blockNumber));
          const blockMap = new Map<bigint, number>();
          
          for (const blockNum of uniqueBlocks) {
            try {
              const block = await publicClient.getBlock({ blockNumber: blockNum });
              blockMap.set(blockNum, Number(block.timestamp));
            } catch (e) {
              console.warn('Failed to fetch block', blockNum, e);
            }
          }
          
          for (const log of songTokenLogs) {
            const { args } = log as any;
            const from = (args.from as string).toLowerCase();
            const to = (args.to as string).toLowerCase();
            const amount = Number(args.value as bigint) / 1e18;
            
            if (from === BONDING_CURVE_ADDRESS.toLowerCase() || to === BONDING_CURVE_ADDRESS.toLowerCase()) {
              const timestamp = (blockMap.get(log.blockNumber) || 0) * 1000;
              const xrgeAmount = xrgeByTx.get(log.transactionHash) || 0;
              const priceXRGE = amount > 0 ? xrgeAmount / amount : 0;
              
              if (priceXRGE > 0 && timestamp > 0) {
                trades.push({ timestamp, priceXRGE, volumeXRGE: xrgeAmount });
              }
            }
          }
          
          // Calculate price change
          let changePercent = null;
          if (trades.length >= 2) {
            trades.sort((a, b) => a.timestamp - b.timestamp);
            const firstPrice = trades[0].priceXRGE;
            const lastPrice = trades[trades.length - 1].priceXRGE;
            
            if (firstPrice > 0) {
              changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
              console.log(`📊 useSong24hData: ${tokenAddress.slice(0, 8)}... price change: ${firstPrice.toFixed(6)} → ${lastPrice.toFixed(6)} = ${changePercent.toFixed(2)}%`);
            } else {
              changePercent = 0;
            }
          } else if (trades.length === 1) {
            // Only 1 trade in 24h, show 0% change
            changePercent = 0;
          } else {
            // No trades - try historical price method as fallback
            console.log(`⚠️ useSong24hData: No trades found for ${tokenAddress.slice(0, 8)}..., trying historical price method`);
          }
          
          // Calculate total volume (sum of all XRGE traded)
          const totalVolume = trades.reduce((sum, trade) => sum + trade.volumeXRGE, 0);
          
          const resultData = {
            priceChange24h: changePercent,
            volume24h: totalVolume,
            loading: false
          };
          
          // Only cache if bypassCache is false (trending needs real-time data)
          if (!bypassCache) {
            dataCache.set(cacheKey, { data: resultData, timestamp: now });
          }
          
          setData(resultData);
        } else {
          // No trades in 24h
          const resultData = {
            priceChange24h: 0,
            volume24h: 0,
            loading: false
          };
          
          // Only cache if bypassCache is false (trending needs real-time data)
          if (!bypassCache) {
            dataCache.set(cacheKey, { data: resultData, timestamp: now });
          }
          
          setData(resultData);
        }
        
      } catch (error) {
        console.error('❌ useSong24hData: Error calculating data', error);
        setData({ priceChange24h: null, volume24h: 0, loading: false });
      }
    };
    
    calculate24hData();
  }, [tokenAddress, publicClient, refreshTrigger, bypassCache]);

  // Auto-refresh disabled - only fetch on mount or when dependencies change
  // Data uses 5-second cache and will refresh when:
  // 1. User navigates to a different song
  // 2. Cache expires (5 seconds)
  // 3. Manual refetch is called
  // This prevents excessive RPC calls while still keeping data reasonably fresh

  // Function to manually trigger a refresh (useful after purchases)
  const refetch = useCallback(() => {
    console.log('🔄 useSong24hData: Manual refresh triggered for', tokenAddress);
    // Invalidate cache for this token
    if (tokenAddress) {
      invalidate24hDataCache(tokenAddress);
    }
    setRefreshTrigger(prev => prev + 1);
  }, [tokenAddress]);

  return { ...data, refetch };
};