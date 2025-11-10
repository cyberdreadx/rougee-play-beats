import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from './useWallet';
import { useSongTokenBalance } from './useSongBondingCurve';
import { usePrivyToken } from './usePrivyToken';
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
  error: string | null;
}

export const usePlayTracking = (songId?: string, songTokenAddress?: Address): UsePlayTrackingReturn => {
  const { fullAddress } = useWallet();
  const { getAuthHeaders } = usePrivyToken();
  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check token balance if token address is provided
  const { balance: tokenBalance } = useSongTokenBalance(
    songTokenAddress,
    fullAddress as Address | undefined
  );

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

      // Verify ownership by checking token balance
      // If user has tokens (> 0), they are an owner regardless of database status
      const hasTokens = tokenBalance && parseFloat(tokenBalance) > 0;
      const isOwner = hasTokens || (data?.is_owner ?? false);
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
  }, [fullAddress, tokenBalance]);

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
        const hasTokens = tokenBalance && parseFloat(tokenBalance) > 0;
        const isOwner = hasTokens || (status.is_owner ?? false);
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
  }, [fullAddress, checkPlayStatus, getAuthHeaders, tokenBalance]);

  // Check play status when songId or wallet address changes
  useEffect(() => {
    if (songId && fullAddress) {
      checkPlayStatus(songId);
    } else {
      setPlayStatus(null);
    }
  }, [songId, fullAddress, checkPlayStatus]);

  return {
    playStatus,
    isLoading,
    recordPlay,
    checkPlayStatus,
    error
  };
};
