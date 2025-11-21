import { useEffect, useState } from 'react';
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import { supabase } from '@/integrations/supabase/client';

export const useWallet = () => {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // PRIORITY 1: Try to get address from Privy's useWallets hook (most reliable)
  let address: string | undefined = undefined;
  
  // Try useWallets first (this is the proper way)
  if (wallets.length > 0) {
    // For smart wallets, prioritize the smart wallet
    const smartWallet = wallets.find(w => 
      w.walletClientType === 'privy' || 
      w.connectorType === 'embedded' ||
      (w as any).type === 'smart_wallet'
    );
    
    const primaryWallet = smartWallet || wallets[0]; // Prefer smart wallet
    address = primaryWallet.address;
    // CRITICAL: For external wallets, we need to authenticate them with loginOrLink()
    if (primaryWallet.walletClientType !== 'privy' && primaryWallet.walletClientType !== 'embedded_wallet') {
      // Note: loginOrLink() should be called when user initiates a transaction
      // For now, we'll use the address as-is
    }
  }
  
  // FALLBACK: Try user.linkedAccounts (especially for smart wallets)
  if (!address && user?.linkedAccounts) {
    
    // PRIORITY for smart wallets: Look for smart_wallet type first
    let walletAccount = user.linkedAccounts.find((account: any) =>
      account.type === 'smart_wallet'
    ) as any;
    
    // Then try embedded wallet
    if (!walletAccount) {
      walletAccount = user.linkedAccounts.find((account: any) =>
        account.type === 'embedded_wallet' || account.type === 'privy'
      ) as any;
    }
    
    // Then try regular wallet
    if (!walletAccount) {
      walletAccount = user.linkedAccounts.find((account: any) =>
        account.type === 'wallet'
      ) as any;
    }
    
    // Last resort: find ANY account with an address
    if (!walletAccount) {
      walletAccount = user.linkedAccounts.find((account: any) => 
        account.address && 
        typeof account.address === 'string' && 
        account.address.startsWith('0x') &&
        account.address.length === 42
      ) as any;
    }
    
    if (walletAccount) {
      address = walletAccount.address as string;
    } else {
      console.error('❌ No wallet account found in linkedAccounts!');
    }
  }
  
  // Additional logging for debugging
  if (authenticated && !address) {
    console.warn('⚠️ User authenticated but no wallet address found!');
  }

  
  // CRITICAL ERROR LOGGING
  if (authenticated && !address) {
    console.error('❌❌❌ CRITICAL: User authenticated but NO WALLET ADDRESS found!');
    console.error('This means the embedded wallet was not created or is not accessible.');
    console.error('Check Privy config: embeddedWallets.createOnLogin should be "all-users"');
  }

  // SMART: Auto-create embedded wallet ONLY for new email users with no existing wallet
  useEffect(() => {
    const smartCreateWallet = async () => {
      // Only try if authenticated, no wallets, and not already creating
      if (authenticated && ready && wallets.length === 0 && !isCreatingWallet) {
        console.log('🔍 Checking if user needs a wallet...');
        
        // Check if user has ANY existing wallet address in linkedAccounts
        const hasExistingWallet = user?.linkedAccounts?.some((account: any) => 
          account.address && 
          typeof account.address === 'string' && 
          account.address.startsWith('0x') &&
          account.address.length === 42
        );
        
        if (hasExistingWallet) {
          console.log('🔍 User already has wallet address in linkedAccounts, skipping auto-creation');
          console.log('Existing wallet addresses:', user.linkedAccounts
            .filter((acc: any) => acc.address && acc.address.startsWith('0x'))
            .map((acc: any) => ({ type: acc.type, address: acc.address }))
          );
          return;
        }
        
        // Check if user has any wallet-related account types
        const hasWalletAccount = user?.linkedAccounts?.some((account: any) => 
          account.type === 'wallet' || 
          account.type === 'smart_wallet' || 
          account.type === 'embedded_wallet' ||
          account.type === 'privy'
        );
        
        if (hasWalletAccount) {
          console.log('🔍 User has wallet account type in linkedAccounts, skipping auto-creation');
          return;
        }
        
        // Check if user has any addresses at all
        const allAddresses = user?.linkedAccounts?.map((acc: any) => acc.address).filter(Boolean) || [];
        if (allAddresses.length > 0) {
          console.log('🔍 User has existing addresses in linkedAccounts, skipping auto-creation');
          console.log('All addresses:', allAddresses);
          return;
        }
        
        // ONLY create wallet for NEW email users with NO existing wallet
        console.log('🔧 NEW EMAIL USER: No existing wallet found, creating embedded wallet...');
        console.log('🔍 User linkedAccounts details:', user?.linkedAccounts?.map(acc => ({
          type: acc.type,
          address: acc.address,
          hasValidAddress: !!(acc.address && acc.address.startsWith('0x') && acc.address.length === 42)
        })));
        
        setIsCreatingWallet(true);
        
        try {
          console.log('🚀 Calling createWallet()...');
          await createWallet();
          console.log('✅ Embedded wallet created successfully for new user');
          
          // Wait a moment for the wallet to be available
          setTimeout(() => {
            console.log('🔄 Checking wallets after creation...');
            console.log('Wallets count after creation:', wallets.length);
          }, 1000);
        } catch (error) {
          console.error('❌ Failed to auto-create wallet:', error);
          console.error('Error details:', error);
        } finally {
          setIsCreatingWallet(false);
        }
      }
    };

    // Wait a bit before trying to auto-create (give Privy time to initialize)
    const timeout = setTimeout(smartCreateWallet, 2000);
    return () => clearTimeout(timeout);
  }, [authenticated, ready, wallets.length, createWallet, isCreatingWallet, user?.linkedAccounts]);

  // Additional fallback for mobile/PWA issues
  useEffect(() => {
    if (authenticated && !address && user?.linkedAccounts?.length > 0) {
      const allAccounts = user.linkedAccounts;
      
      // Try to find any account with an address
      const accountWithAddress = allAccounts.find((acc: any) => acc.address);
      if (accountWithAddress) {
      }
    }
  }, [authenticated, address, user]);

  // Format address for display (e.g., 0x1234...5678)
  const formattedAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  const connect = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Failed to login:', error);
    }
  };

  // Function to authenticate external wallets
  const authenticateWallet = async () => {
    if (wallets.length > 0) {
      const primaryWallet = wallets[0];
      try {
        console.log('🔐 Authenticating external wallet...');
        await primaryWallet.loginOrLink();
        console.log('✅ Wallet authenticated successfully');
        return true;
      } catch (error) {
        console.error('❌ Failed to authenticate wallet:', error);
        return false;
      }
    }
    return false;
  };

  return {
    isConnected: authenticated,
    address: formattedAddress,
    fullAddress: address,
    isConnecting: !ready || isCreatingWallet,
    connect,
    disconnect: logout,
    isPrivyReady: ready,
    createWallet, // Expose for manual wallet creation
    isCreatingWallet,
    authenticateWallet, // Expose for manual wallet authentication
  };
};