import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { supabase } from '@/integrations/supabase/client';
import { TradeData } from '@/components/SongTradingHistory';

interface SongTrade {
  id: string;
  transaction_hash: string;
  trade_timestamp: number; // Unix timestamp in milliseconds
  trader_address: string;
  trade_type: 'buy' | 'sell' | 'deploy';
  token_amount: string;
  xrge_amount: string;
  price_in_xrge: string;
}

/**
 * Hook to fetch trades from database instead of blockchain
 * Much faster and more efficient than querying blockchain logs
 */
export const useSongTradesFromDB = (
  tokenAddress: Address | null | undefined,
  xrgeUsdPrice: number,
  hours: number = 24
) => {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!tokenAddress) {
      setTrades([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Query database directly for better performance
      // Timestamp is stored as BIGINT (milliseconds) in the database
      const now = Date.now();
      const timeFilter = hours * 60 * 60 * 1000; // Convert hours to milliseconds
      const minTimestamp = now - timeFilter;
      
      let query = supabase
        .from('song_trades')
        .select('*')
        .eq('token_address', tokenAddress.toLowerCase())
        .gte('trade_timestamp', minTimestamp)
        .order('trade_timestamp', { ascending: true });

      const { data, error: dbError } = await query;

      if (dbError) {
        console.error('Error fetching trades from DB:', dbError);
        setError(new Error(dbError.message));
        setTrades([]);
        return;
      }

      // Convert database format to TradeData format
      const formattedTrades: TradeData[] = (data || []).map((trade: any) => {
        // Handle timestamp - column is named trade_timestamp to avoid PostgreSQL reserved word
        const tradeTimestamp = typeof trade.trade_timestamp === 'number' 
          ? trade.trade_timestamp 
          : typeof trade.trade_timestamp === 'string'
          ? parseInt(trade.trade_timestamp)
          : Date.now();
        
        return {
          timestamp: tradeTimestamp,
          price: parseFloat(trade.price_in_xrge || '0'),
          type: trade.trade_type as 'buy' | 'sell' | 'deploy',
          amount: parseFloat(trade.token_amount || '0'),
          priceUSD: parseFloat(trade.price_in_xrge || '0') * xrgeUsdPrice,
          trader: trade.trader_address || '',
          xrgeAmount: parseFloat(trade.xrge_amount || '0')
        };
      }).sort((a, b) => a.timestamp - b.timestamp);

      setTrades(formattedTrades);
    } catch (err) {
      console.error('Error in useSongTradesFromDB:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, xrgeUsdPrice, hours]);

  useEffect(() => {
    fetchTrades();
    
    // Set up auto-refresh every 3 seconds for real-time updates
    const intervalId = setInterval(() => {
      console.log('🔄 useSongTradesFromDB: Auto-refreshing trades');
      fetchTrades();
    }, 3 * 1000); // 3 seconds
    
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchTrades]);

  return {
    trades,
    loading,
    error,
    refetch: fetchTrades
  };
};

/**
 * Hook to index a trade after it happens
 * Call this after a buy/sell transaction completes
 */
export const useIndexSongTrade = () => {
  const indexTrade = useCallback(async (
    transactionHash: string,
    tokenAddress: Address,
    songId?: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('index-song-trade', {
        body: {
          transactionHash,
          tokenAddress: tokenAddress.toLowerCase(),
          songId
        }
      });

      if (error) {
        console.error('Error indexing trade:', error);
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Failed to index trade:', err);
      throw err;
    }
  }, []);

  return { indexTrade };
};

