import { useQuery } from "@tanstack/react-query";
import { KTA_TOKEN_ADDRESS } from "@/hooks/useXRGESwap";

interface TokenPrices {
  eth: number;
  xrge: number;
  kta: number;
  usdc: number;
}

const XRGE_TOKEN_ADDRESS = "0x147120faEC9277ec02d957584CFCD92B56A24317";

// Helper to fetch with timeout
const fetchWithTimeout = async (url: string, timeoutMs: number = 5000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Helper to validate price (must be positive number)
const isValidPrice = (price: number): boolean => {
  return typeof price === 'number' && price > 0 && isFinite(price);
};

export const useTokenPrices = () => {
  const { data: prices, isLoading, error } = useQuery<TokenPrices>({
    queryKey: ['token-prices'],
    queryFn: async (): Promise<TokenPrices> => {
      // Fetch all prices in parallel with better error handling
      const [ethResult, xrgeResult, ktaResult] = await Promise.allSettled([
        // Fetch ETH price from CoinGecko
        fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', 5000),
        // Fetch XRGE price from DEX Screener
        fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${XRGE_TOKEN_ADDRESS}`, 5000),
        // Fetch KTA price from DEX Screener
        fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${KTA_TOKEN_ADDRESS}`, 5000),
      ]);

      let ethPrice = 0;
      if (ethResult.status === 'fulfilled') {
        try {
          const ethData = await ethResult.value.json();
          const price = ethData.ethereum?.usd || 0;
          if (isValidPrice(price)) {
            ethPrice = price;
          }
        } catch (e) {
          console.warn('Failed to parse ETH price:', e);
        }
      } else {
        console.warn('ETH price fetch failed:', ethResult.reason);
      }

      let xrgePrice = 0;
      if (xrgeResult.status === 'fulfilled') {
        try {
          const xrgeData = await xrgeResult.value.json();
          if (xrgeData.pairs && xrgeData.pairs.length > 0) {
            // Sort pairs by liquidity (highest first) and filter for Base chain
            const basePairs = xrgeData.pairs
              .filter((pair: any) => pair.chainId === 'base')
              .sort((a: any, b: any) => {
                const aLiq = parseFloat(a.liquidity?.usd || '0');
                const bLiq = parseFloat(b.liquidity?.usd || '0');
                return bLiq - aLiq;
              });
            
            const bestPair = basePairs[0] || xrgeData.pairs[0];
            if (bestPair?.priceUsd) {
              const price = parseFloat(bestPair.priceUsd);
              if (isValidPrice(price)) {
                xrgePrice = price;
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse XRGE price:', e);
        }
      } else {
        console.warn('XRGE price fetch failed:', xrgeResult.reason);
      }

      let ktaPrice = 0;
      if (ktaResult.status === 'fulfilled') {
        try {
          const ktaData = await ktaResult.value.json();
          const basePair = ktaData.pairs?.find((pair: any) => 
            pair.chainId === 'base'
          ) || ktaData.pairs?.[0];
          
          if (basePair?.priceUsd) {
            const price = parseFloat(basePair.priceUsd);
            if (isValidPrice(price)) {
              ktaPrice = price;
            }
          }
        } catch (e) {
          console.warn('Failed to parse KTA price:', e);
        }
      } else {
        console.warn('KTA price fetch failed:', ktaResult.reason);
      }

      // If all prices failed, throw error to keep previous data
      if (ethPrice === 0 && xrgePrice === 0 && ktaPrice === 0) {
        throw new Error('All price fetches failed');
      }

      return {
        eth: ethPrice || 0, // Keep 0 if fetch failed (will use previous value)
        xrge: xrgePrice || 0,
        kta: ktaPrice || 0,
        usdc: 1, // USDC is pegged to $1
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds (more frequent)
    staleTime: 15000, // Consider data stale after 15 seconds
    gcTime: 300000, // Keep unused data for 5 minutes
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when network reconnects
    // Keep previous data if query fails (instead of showing 0s)
    placeholderData: (previousData) => previousData,
  });

  const calculateUsdValue = (tokenAmount: number, tokenSymbol: keyof TokenPrices) => {
    if (!prices) return 0;
    const price = prices[tokenSymbol];
    if (!price || price <= 0) return 0; // Don't show value if price is invalid
    return tokenAmount * price;
  };

  // Use previous prices if current fetch failed or returned 0s
  const safePrices: TokenPrices = prices || { eth: 0, xrge: 0, kta: 0, usdc: 1 };
  
  // If prices are 0 and we have an error, log it
  if (error && safePrices.eth === 0 && safePrices.xrge === 0 && safePrices.kta === 0) {
    console.warn('⚠️ Token prices unavailable - using fallback values');
  }

  return {
    prices: safePrices,
    isLoading,
    calculateUsdValue,
    hasError: !!error && safePrices.eth === 0 && safePrices.xrge === 0 && safePrices.kta === 0,
  };
};
