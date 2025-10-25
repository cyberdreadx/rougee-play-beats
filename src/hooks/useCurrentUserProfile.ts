import { useState, useEffect } from 'react';
import { useWallet } from './useWallet';
import { useArtistProfile } from './useArtistProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePrivy } from '@privy-io/react-auth';

export const useCurrentUserProfile = () => {
  const { fullAddress } = useWallet();
  const { profile, loading, refresh } = useArtistProfile(fullAddress || null);
  const [updating, setUpdating] = useState(false);
  const { getAccessToken } = usePrivy();

  const updateProfile = async (formData: FormData) => {
    console.log('🔍 updateProfile called with wallet:', fullAddress);
    
    if (!fullAddress) {
      console.error('❌ No wallet address in updateProfile');
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return false;
    }

    try {
      setUpdating(true);
      console.log('📤 Starting profile update...');
      
      const token = await getAccessToken();
      console.log('✅ Got access token');
      
      // Log what we're sending
      console.log('📦 Sending to update-artist-profile:', {
        walletAddress: fullAddress,
        hasToken: !!token,
        formDataKeys: Array.from(formData.keys())
      });
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile update timed out after 60 seconds')), 60000);
      });

      // Add wallet address to formData as fallback
      formData.append('walletAddress', fullAddress);
      
      const updatePromise = supabase.functions.invoke('update-artist-profile', {
        headers: {
          'authorization': `Bearer ${token}`,  // lowercase
          'x-privy-token': token,  // Also send as x-privy-token
          'x-wallet-address': fullAddress,
        },
        body: formData,
      });

      const response = await Promise.race([updatePromise, timeoutPromise]) as any;

      console.log('📬 Response from update-artist-profile:', {
        status: response?.status,
        statusText: response?.statusText,
        data: response?.data,
        error: response?.error
      });

      if (response.error) {
        console.error('❌ Edge function error:', {
          message: response.error.message,
          status: response.error.status,
          details: response.error
        });
        
        // Try to get more details from the response
        if (response.error.message) {
          throw new Error(`Profile update failed: ${response.error.message}`);
        } else {
          throw response.error;
        }
      }

      // Check if we got a proper response
      if (!response.data) {
        console.warn('⚠️ No data in response, but no error either');
      }

      console.log('✅ Profile update successful');
      toast({
        title: "Profile updated!",
        description: "Your artist profile has been saved to IPFS",
      });

      await refresh();
      return true;
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error
      });
      
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return {
    profile,
    loading,
    updating,
    isArtist: !!profile,
    updateProfile,
    refresh,
  };
};
