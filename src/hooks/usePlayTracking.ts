import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from './useWallet';

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

export const usePlayTracking = (songId?: string): UsePlayTrackingReturn => {
  const { fullAddress } = useWallet();
  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkPlayStatus = useCallback(async (targetSongId: string) => {
    if (!fullAddress || !targetSongId) {
      setPlayStatus(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('can_user_play_song', {
        p_user_wallet: fullAddress.toLowerCase(),
        p_song_id: targetSongId,
        p_max_free_plays: 5
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        // If the function doesn't exist yet, allow unlimited plays
        if (rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
          console.log('🔧 Play tracking functions not available, allowing unlimited plays');
          setPlayStatus({
            canPlay: true,
            isOwner: true,
            playCount: 0,
            remainingPlays: 5,
            maxFreePlays: 5
          });
          return;
        }
        throw new Error(`Failed to check play status: ${rpcError.message}`);
      }

      console.log('✅ Play status retrieved:', data);
      setPlayStatus(data);
    } catch (err) {
      console.error('Error checking play status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check play status');
      // Default to allowing play if there's an error
      setPlayStatus({
        canPlay: true,
        isOwner: true,
        playCount: 0,
        remainingPlays: 5,
        maxFreePlays: 5
      });
    } finally {
      setIsLoading(false);
    }
  }, [fullAddress]);

  const recordPlay = useCallback(async (targetSongId: string, durationSeconds: number = 0): Promise<boolean> => {
    if (!fullAddress || !targetSongId) {
      console.log('❌ Cannot record play: missing wallet address or song ID');
      return false;
    }

    console.log('🎵 Recording play for:', { wallet: fullAddress, songId: targetSongId, duration: durationSeconds });

    try {
      const { data, error: rpcError } = await supabase.rpc('record_play', {
        p_user_wallet: fullAddress.toLowerCase(),
        p_song_id: targetSongId,
        p_duration_seconds: durationSeconds
      });

      if (rpcError) {
        console.error('Record play RPC Error:', rpcError);
        // If the function doesn't exist yet, try direct insert
        if (rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
          console.log('🔧 Record play function not available, trying direct insert');
          
          const { data: insertData, error: insertError } = await supabase
            .from('user_plays')
            .insert({
              user_wallet_address: fullAddress.toLowerCase(),
              song_id: targetSongId,
              play_duration_seconds: durationSeconds
            })
            .select();

          if (insertError) {
            console.error('Direct insert error:', insertError);
            return false;
          }

          console.log('✅ Play recorded via direct insert:', insertData);
          return true;
        }
        throw new Error(`Failed to record play: ${rpcError.message}`);
      }

      console.log('✅ Play recorded successfully via RPC:', data);
      // Refresh play status after recording
      await checkPlayStatus(targetSongId);
      return true;
    } catch (err) {
      console.error('Error recording play:', err);
      setError(err instanceof Error ? err.message : 'Failed to record play');
      return false;
    }
  }, [fullAddress, checkPlayStatus]);

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
