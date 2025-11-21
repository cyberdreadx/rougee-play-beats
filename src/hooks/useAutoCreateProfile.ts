import { useEffect, useRef } from 'react';
import { useWallet } from './useWallet';
import { useRougeeWallet } from './useRougeeWallet';
import { supabase } from '@/integrations/supabase/client';

/**
 * Automatically creates a profile entry when a wallet is detected
 * This ensures new users who log in with Privy or RouGee Wallet have a database entry
 */
export const useAutoCreateProfile = () => {
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const rougeeWallet = useRougeeWallet();
  const hasCreatedProfile = useRef(false);
  const hasCreatedRougeeProfile = useRef(false);

  // Handle Privy wallet (Base network - 0x addresses)
  useEffect(() => {
    const createProfileIfNeeded = async () => {
      // Only run if we have a wallet address and haven't already tried
      if (!fullAddress || !isConnected || !isPrivyReady || hasCreatedProfile.current) {
        return;
      }

      // Only create profile for Base network addresses (0x...)
      if (!fullAddress.startsWith('0x')) {
        return;
      }


      try {
        // Call the database function to ensure profile exists
        const { data, error } = await supabase.rpc('create_my_profile', {
          p_wallet_address: fullAddress
        });

        if (error) {
          console.error('❌ Error auto-creating profile for Privy wallet:', error);
        } else {
          console.log('✅ Profile auto-created for Privy wallet:', fullAddress);
        }

        // Mark as attempted (success or failure)
        hasCreatedProfile.current = true;
      } catch (error) {
        console.error('❌ Exception auto-creating profile for Privy wallet:', error);
        hasCreatedProfile.current = true; // Still mark as attempted to avoid infinite loops
      }
    };

    createProfileIfNeeded();
  }, [fullAddress, isConnected, isPrivyReady]);

  // Handle RouGee Wallet (Keeta network - keeta_ addresses)
  useEffect(() => {
    const createProfileIfNeeded = async () => {
      console.log('🔍 Checking RouGee Wallet profile creation...', {
        isConnected: rougeeWallet.isConnected,
        address: rougeeWallet.address,
        hasCreated: hasCreatedRougeeProfile.current,
      });

      // Only run if RouGee Wallet is connected and we have an address
      if (!rougeeWallet.isConnected || !rougeeWallet.address || hasCreatedRougeeProfile.current) {
        if (!rougeeWallet.isConnected) {
          console.log('⏭️ Skipping: RouGee Wallet not connected');
        } else if (!rougeeWallet.address) {
          console.log('⏭️ Skipping: No address available');
        } else if (hasCreatedRougeeProfile.current) {
          console.log('⏭️ Skipping: Profile already created/attempted');
        }
        return;
      }

      // RouGee Wallet uses Keeta addresses (keeta_... or other formats)
      const keetaAddress = rougeeWallet.address;
      console.log('🔍 RouGee Wallet address format:', {
        address: keetaAddress,
        startsWithKeeta: keetaAddress.startsWith('keeta_'),
        length: keetaAddress.length,
      });

      // Accept any address format from RouGee Wallet (not just keeta_)
      // The address might be in different formats depending on the extension version
      if (!keetaAddress || keetaAddress.length < 5) {
        console.warn('⚠️ Invalid address format, skipping profile creation');
        hasCreatedRougeeProfile.current = true;
        return;
      }

      try {
        console.log('📝 Creating profile for RouGee Wallet address:', keetaAddress);
        
        // Call the database function to ensure profile exists
        // Note: Keeta addresses are stored as-is in the database (not normalized to lowercase)
        const { data, error } = await supabase.rpc('create_my_profile', {
          p_wallet_address: keetaAddress
        });

        if (error) {
          console.error('❌ Error auto-creating profile for RouGee Wallet:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
        } else {
          console.log('✅ Profile auto-created for RouGee Wallet:', keetaAddress);
          console.log('Profile data:', data);
        }

        // Mark as attempted (success or failure)
        hasCreatedRougeeProfile.current = true;
      } catch (error) {
        console.error('❌ Exception auto-creating profile for RouGee Wallet:', error);
        console.error('Exception details:', error instanceof Error ? error.stack : error);
        hasCreatedRougeeProfile.current = true; // Still mark as attempted to avoid infinite loops
      }
    };

    createProfileIfNeeded();
  }, [rougeeWallet.isConnected, rougeeWallet.address]);

  return { 
    profileCreated: hasCreatedProfile.current,
    rougeeProfileCreated: hasCreatedRougeeProfile.current
  };
};

