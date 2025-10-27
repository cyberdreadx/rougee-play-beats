import { useState, useEffect, useCallback } from 'react';
import { TradeData } from '@/components/SongTradingHistory';

interface CacheEntry {
  data: TradeData[];
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const CACHE_KEY_PREFIX = 'trade_data_cache_';

export const useTradeDataCache = (tokenAddress: string | undefined) => {
  const [cachedData, setCachedData] = useState<TradeData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get cache key for this token
  const getCacheKey = useCallback(() => {
    if (!tokenAddress) return null;
    return `${CACHE_KEY_PREFIX}${tokenAddress.toLowerCase()}`;
  }, [tokenAddress]);

  // Load from cache on mount
  useEffect(() => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return;

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - entry.timestamp < CACHE_DURATION) {
          setCachedData(entry.data);
        } else {
          // Cache expired, remove it
          sessionStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.error('Failed to load trade data from cache:', error);
    }
  }, [getCacheKey]);

  // Save to cache
  const saveToCache = useCallback((data: TradeData[]) => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return;

    try {
      const entry: CacheEntry = {
        data,
        timestamp: Date.now()
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(entry));
      setCachedData(data);
    } catch (error) {
      console.error('Failed to save trade data to cache:', error);
    }
  }, [getCacheKey]);

  // Clear cache for this token
  const clearCache = useCallback(() => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return;

    try {
      sessionStorage.removeItem(cacheKey);
      setCachedData(null);
    } catch (error) {
      console.error('Failed to clear trade data cache:', error);
    }
  }, [getCacheKey]);

  return {
    cachedData,
    saveToCache,
    clearCache,
    isLoading
  };
};
