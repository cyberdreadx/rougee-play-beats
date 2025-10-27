import { useState, useEffect } from 'react';
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

// In-memory cache with 1-minute expiration (for testing)
const dataCache = new Map<string, { data: Song24hData; timestamp: number }>();
const CACHE_DURATION = 1 * 60 * 1000; // 1 minute

/**
 * Hook for calculating real 24h price change and volume from blockchain data
 */
export const useSong24hData = (tokenAddress: Address | null, _bondingSupplyStr?: string | null) => {
  const publicClient = usePublicClient();
  const [data, setData] = useState<Song24hData>({
    priceChange24h: null,
    volume24h: 0,
    loading: true
  });

  useEffect(() => {
    const calculate24hData = async () => {
      console.log('🔍 useSong24hData: Starting calculation for', { tokenAddress });
      
      if (!tokenAddress || !publicClient) {
        console.log('❌ useSong24hData: Missing required params', { tokenAddress, publicClient: !!publicClient });
        setData({ priceChange24h: null, volume24h: 0, loading: false });
        return;
      }
      
      // Check cache first
      const cacheKey = `${tokenAddress.toLowerCase()}`;
      const cached = dataCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log('✅ useSong24hData: Using cached data', { tokenAddress, ...cached.data });
        setData(cached.data);
        return;
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
              const changePercent = ((Number(currentPrice) - Number(historicalPrice)) / Number(historicalPrice)) * 100;
              
              const resultData = {
                priceChange24h: changePercent,
                volume24h: 0, // Historical price method doesn't give us volume
                loading: false
              };
              
              dataCache.set(cacheKey, { data: resultData, timestamp: now });
              setData(resultData);
              return;
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
            changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
          } else if (trades.length === 1) {
            // Only 1 trade in 24h, show 0% change
            changePercent = 0;
          }
          
          // Calculate total volume (sum of all XRGE traded)
          const totalVolume = trades.reduce((sum, trade) => sum + trade.volumeXRGE, 0);
          
          const resultData = {
            priceChange24h: changePercent,
            volume24h: totalVolume,
            loading: false
          };
          
          // Cache the result
          dataCache.set(cacheKey, { data: resultData, timestamp: now });
          
          setData(resultData);
        } else {
          // No trades in 24h
          const resultData = {
            priceChange24h: 0,
            volume24h: 0,
            loading: false
          };
          
          // Cache the result
          dataCache.set(cacheKey, { data: resultData, timestamp: now });
          
          setData(resultData);
        }
        
      } catch (error) {
        console.error('❌ useSong24hData: Error calculating data', error);
        setData({ priceChange24h: null, volume24h: 0, loading: false });
      }
    };
    
    calculate24hData();
  }, [tokenAddress, publicClient]);

  return data;
};