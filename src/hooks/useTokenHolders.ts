import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';

interface HolderData {
  holderCount: number;
  loading: boolean;
  error: string | null;
}

// Cache holder counts for 60 seconds to reduce blockchain calls
const holderCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_DURATION = 60 * 1000; // 60 seconds

/**
 * Hook to fetch token holder count using blockchain queries
 * Falls back to database count if blockchain query fails
 * Uses client-side caching to minimize RPC calls
 * 
 * @param tokenAddress - The ERC20 token address
 * @param songId - The song ID for database queries
 */
export const useTokenHolders = (tokenAddress: Address | null | undefined, songId?: string): HolderData => {
  const [holderCount, setHolderCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!tokenAddress) {
      setLoading(false);
      setHolderCount(0);
      return;
    }

    const fetchHolderCount = async () => {
      const cacheKey = tokenAddress.toLowerCase();
      
      // Check cache first
      const cached = holderCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        setHolderCount(cached.count);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Method 1: Get unique buyers from database (fast but may be incomplete)
        // Only query if we have a song ID
        let dbHolderCount = 0;
        let uniqueAddresses: string[] = [];
        
        if (songId) {
          const { data: purchases } = await supabase
            .from('song_purchases')
            .select('buyer_wallet_address')
            .eq('song_id', songId)
            .limit(1000);
          
          uniqueAddresses = Array.from(new Set(purchases?.map(p => p.buyer_wallet_address.toLowerCase()) || []));
          dbHolderCount = uniqueAddresses.length;
          
          console.log('📊 useTokenHolders: DB holders for', songId, ':', dbHolderCount, uniqueAddresses);
        } else {
          console.log('⚠️ useTokenHolders: No songId provided, skipping database query');
        }
        
        // If we have blockchain client, do direct balance checks for more accuracy
        if (publicClient && dbHolderCount > 0 && dbHolderCount < 50) {
          // Only do direct checks if holder count is reasonable (< 50)
          
          const balanceChecks = await Promise.all(
            uniqueAddresses.map(async (address) => {
              try {
                const balance = await publicClient.readContract({
                  address: tokenAddress,
                  abi: [{
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: 'balance', type: 'uint256' }]
                  }],
                  functionName: 'balanceOf',
                  args: [address as Address]
                } as any);
                
                return BigInt(balance as any) > BigInt(0);
              } catch {
                return false;
              }
            })
          );
          
          const actualHolderCount = balanceChecks.filter(Boolean).length;
          
          // Cache the result
          holderCache.set(cacheKey, { count: actualHolderCount, timestamp: now });
          setHolderCount(actualHolderCount);
        } else {
          // Use database count if no blockchain client or too many holders
          holderCache.set(cacheKey, { count: dbHolderCount, timestamp: now });
          setHolderCount(dbHolderCount);
        }
      } catch (err) {
        console.error('Error fetching holder count:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHolderCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchHolderCount();
  }, [tokenAddress, songId, publicClient]);

  return { holderCount, loading, error };
};

// Function to invalidate cache for a specific token (call after trades)
export const invalidateHolderCache = (tokenAddress: Address) => {
  holderCache.delete(tokenAddress.toLowerCase());
};

