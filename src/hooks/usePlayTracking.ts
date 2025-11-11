import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from './useWallet';
import { useSongTokenBalance, useSongPrice } from './useSongBondingCurve';
import { usePrivyToken } from './usePrivyToken';
import { useTokenPrices } from './useTokenPrices';
import type { Address } from 'viem';

interface PlayStatus {
  canPlay: boolean;
  isOwner: boolean;
  playCount: number;
  remainingPlays: number;
  maxFreePlays: number;
}

interface UsePlayTrackingReturn {
  playStatus: PlayStatus | null;
  isLoading: boolean;
  recordPlay: (songId: string, durationSeconds?: number) => Promise<boolean>;
  checkPlayStatus: (songId: string) => Promise<void>;
  refetchBalance: () => void;
  error: string | null;
}

export const usePlayTracking = (songId?: string, songTokenAddress?: Address): UsePlayTrackingReturn => {
  const { fullAddress } = useWallet();
  const { getAuthHeaders } = usePrivyToken();
  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check token balance if token address is provided
  const { balance: tokenBalance, refetch: refetchBalance } = useSongTokenBalance(
    songTokenAddress,
    fullAddress as Address | undefined
  );

  // Get song token price and XRGE price to calculate USD value
  const { price: priceInXRGE } = useSongPrice(songTokenAddress || undefined);
  const { prices } = useTokenPrices();
  
  // Calculate if user has at least $0.01 worth of tokens
  const hasMinimumValue = useCallback(() => {
    if (!tokenBalance || !priceInXRGE || !prices.xrge || parseFloat(tokenBalance) <= 0) {
      return false;
    }
    
    const balance = parseFloat(tokenBalance);
    const priceXRGE = parseFloat(priceInXRGE);
    const xrgeUsdPrice = prices.xrge;
    
    // Calculate USD value: balance * priceInXRGE * xrgeUsdPrice
    const valueUSD = balance * priceXRGE * xrgeUsdPrice;
    
    // Must have at least $0.01 worth
    return valueUSD >= 0.01;
  }, [tokenBalance, priceInXRGE, prices.xrge]);

  const checkPlayStatus = useCallback(async (targetSongId: string) => {
    if (!fullAddress || !targetSongId) {
      setPlayStatus(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First check database play status
      const normalizedWallet = fullAddress.toLowerCase();
      console.log('🔍 Checking play status:', { wallet: normalizedWallet, songId: targetSongId });
      
      const { data, error: rpcError } = await supabase.rpc('can_user_play_song', {
        p_user_wallet: normalizedWallet,
        p_song_id: targetSongId,
        p_max_free_plays: 3
      });

      if (rpcError) {
        console.error('❌ RPC Error:', rpcError);
        // If the function doesn't exist yet, allow unlimited plays
        if (rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
          setPlayStatus({
            canPlay: true,
            isOwner: true,
            playCount: 0,
            remainingPlays: 3,
            maxFreePlays: 3
          });
          return;
        }
        throw new Error(`Failed to check play status: ${rpcError.message}`);
      }

      console.log('📊 Play status response:', data);

      // Also directly query user_plays table to verify
      const { data: directPlays, error: directError } = await supabase
        .from('user_plays')
        .select('id')
        .eq('song_id', targetSongId)
        .ilike('user_wallet_address', normalizedWallet);
      
      console.log('🎵 Direct query result:', { 
        count: directPlays?.length || 0, 
        error: directError,
        wallet: normalizedWallet 
      });

      // Verify ownership by checking token balance value
      // User must have at least $0.01 worth of tokens to be considered an owner
      const hasTokens = hasMinimumValue();
      
      // Also check if user is the song creator (wallet_address matches)
      // The creator should always be considered an owner
      let isCreator = false;
      if (fullAddress) {
        try {
          const { data: songData } = await supabase
            .from('songs')
            .select('wallet_address')
            .eq('id', targetSongId)
            .maybeSingle();
          
          if (songData?.wallet_address) {
            isCreator = songData.wallet_address.toLowerCase() === fullAddress.toLowerCase();
            console.log('🎵 Creator check:', { 
              songWallet: songData.wallet_address.toLowerCase(), 
              userWallet: fullAddress.toLowerCase(), 
              isCreator 
            });
          }
        } catch (err) {
          console.error('Error checking song creator:', err);
        }
      }
      
      const isOwner = hasTokens || isCreator || (data?.is_owner ?? false);
      console.log('🔍 Ownership check:', { hasTokens, isCreator, dbIsOwner: data?.is_owner, finalIsOwner: isOwner });
      const playCount = data?.play_count ?? 0;
      const remainingPlays = Math.max(0, 3 - playCount);
      const canPlay = isOwner || playCount < 3;
      
      console.log('✅ Final play status:', { playCount, isOwner, canPlay, remainingPlays });
      
      // Map database response to interface (snake_case to camelCase)
      const updatedPlayStatus: PlayStatus = {
        canPlay: canPlay,
        isOwner: isOwner,
        playCount: playCount,
        remainingPlays: remainingPlays,
        maxFreePlays: 3
      };

      setPlayStatus(updatedPlayStatus);
    } catch (err) {
      console.error('Error checking play status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check play status');
      // Default to allowing play if there's an error
      setPlayStatus({
        canPlay: true,
        isOwner: true,
        playCount: 0,
        remainingPlays: 3,
        maxFreePlays: 3
      });
    } finally {
      setIsLoading(false);
    }
  }, [fullAddress, hasMinimumValue]);

  const recordPlay = useCallback(async (targetSongId: string, durationSeconds: number = 0): Promise<boolean> => {
    if (!fullAddress || !targetSongId) {
      return false;
    }

    try {
      // Use edge function to bypass RLS (service role key bypasses RLS)
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          songId: targetSongId,
          durationSeconds: durationSeconds
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // Update play status from response (if provided)
      if (result.playStatus) {
        const status = result.playStatus;
        const hasTokens = hasMinimumValue();
        
        // Also check if user is the song creator (wallet_address matches)
        let isCreator = false;
        if (fullAddress) {
          try {
            const { data: songData } = await supabase
              .from('songs')
              .select('wallet_address')
              .eq('id', targetSongId)
              .maybeSingle();
            
            if (songData?.wallet_address) {
              isCreator = songData.wallet_address.toLowerCase() === fullAddress.toLowerCase();
              console.log('🎵 Creator check in recordPlay:', { 
                songWallet: songData.wallet_address.toLowerCase(), 
                userWallet: fullAddress.toLowerCase(), 
                isCreator 
              });
            }
          } catch (err) {
            console.error('Error checking song creator in recordPlay:', err);
          }
        }
        
        const isOwner = hasTokens || isCreator || (status.is_owner ?? false);
        console.log('🔍 Ownership check in recordPlay:', { hasTokens, isCreator, dbIsOwner: status.is_owner, finalIsOwner: isOwner });
        const playCount = status.play_count ?? 0;
        const remainingPlays = Math.max(0, 3 - playCount);
        const canPlay = isOwner || playCount < 3;
        
        setPlayStatus({
          canPlay: canPlay,
          isOwner: isOwner,
          playCount: playCount,
          remainingPlays: remainingPlays,
          maxFreePlays: 3
        });
      } else {
        // Refresh play status after recording if not in response
        await checkPlayStatus(targetSongId);
      }
      
      return true;
    } catch (err) {
      console.error('Error recording play:', err);
      setError(err instanceof Error ? err.message : 'Failed to record play');
      return false;
    }
  }, [fullAddress, checkPlayStatus, getAuthHeaders, hasMinimumValue]);

  // Check play status when songId, wallet address, token balance, or price changes
  useEffect(() => {
    if (songId && fullAddress) {
      checkPlayStatus(songId);
    } else {
      setPlayStatus(null);
    }
  }, [songId, fullAddress, tokenBalance, priceInXRGE, prices.xrge, checkPlayStatus]);
  
  // Also check play status when token balance or price changes (e.g., after purchase)
  useEffect(() => {
    if (songId && fullAddress) {
      // Small delay to ensure balance/price has fully updated
      const timer = setTimeout(() => {
        checkPlayStatus(songId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tokenBalance, priceInXRGE, prices.xrge, songId, fullAddress, checkPlayStatus]);
  
  // Periodic check for ownership changes (e.g., after purchase) - every 2 seconds if not owned
  useEffect(() => {
    if (!songId || !fullAddress) return;
    
    // Only poll if we don't already own (to detect when ownership changes after purchase)
    const shouldPoll = !playStatus || !playStatus.isOwner;
    
    if (shouldPoll) {
      const interval = setInterval(() => {
        // Refetch balance first, then check play status
        refetchBalance();
        setTimeout(() => {
          checkPlayStatus(songId);
        }, 500);
      }, 2000); // Check every 2 seconds
      
      return () => clearInterval(interval);
    }
  }, [songId, fullAddress, playStatus?.isOwner, refetchBalance, checkPlayStatus]);

  return {
    playStatus,
    isLoading,
    recordPlay,
    checkPlayStatus,
    refetchBalance,
    error
  };
};
