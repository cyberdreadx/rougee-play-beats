import { useEffect, useRef } from 'react';
import { useWallet } from './useWallet';
import { supabase } from '@/integrations/supabase/client';

/**
 * Automatically creates a profile entry when a wallet is detected
 * This ensures new users who log in with Privy have a database entry
 */
export const useAutoCreateProfile = () => {
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const hasCreatedProfile = useRef(false);

  useEffect(() => {
    const createProfileIfNeeded = async () => {
      // Only run if we have a wallet address and haven't already tried
      if (!fullAddress || !isConnected || !isPrivyReady || hasCreatedProfile.current) {
        return;
      }

      console.log('🔧 Auto-creating profile for:', fullAddress);

      try {
        // Call the database function to ensure profile exists
        const { data, error } = await supabase.rpc('create_my_profile', {
          p_wallet_address: fullAddress
        });

        if (error) {
          console.error('❌ Error auto-creating profile:', error);
        } else {
          console.log('✅ Profile ensured for wallet:', fullAddress);
          console.log('Profile data:', data);
        }

        // Mark as attempted (success or failure)
        hasCreatedProfile.current = true;
      } catch (error) {
        console.error('❌ Exception auto-creating profile:', error);
        hasCreatedProfile.current = true; // Still mark as attempted to avoid infinite loops
      }
    };

    createProfileIfNeeded();
  }, [fullAddress, isConnected, isPrivyReady]);

  return { profileCreated: hasCreatedProfile.current };
};

