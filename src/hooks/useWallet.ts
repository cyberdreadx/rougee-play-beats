import { useEffect, useState } from 'react';
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';

export const useWallet = () => {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // PRIORITY 1: Try to get address from Privy's useWallets hook (most reliable)
  let address: string | undefined = undefined;
  
  console.log('🔍 Checking Privy wallets:', {
    walletsCount: wallets.length,
    wallets: wallets.map(w => ({
      type: w.walletClientType,
      address: w.address,
      chainId: w.chainId,
      connectorType: w.connectorType,
      imported: w.imported,
      delegated: w.delegated,
      // Show ALL properties for debugging
      allKeys: Object.keys(w)
    }))
  });
  
  // CRITICAL: Log if wallets array is empty
  if (wallets.length === 0) {
    console.warn('⚠️ WALLETS ARRAY IS EMPTY! Embedded wallet may not be created yet.');
    console.log('Privy user linkedAccounts:', user?.linkedAccounts?.map(acc => ({
      type: acc.type,
      address: (acc as any).address
    })));
  }
  
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
    console.log('✅ Got address from useWallets:', address, 'Type:', primaryWallet.walletClientType);
  }
  
  // FALLBACK: Try user.linkedAccounts (especially for smart wallets)
  if (!address && user?.linkedAccounts) {
    console.log('🔄 Trying user.linkedAccounts as fallback...');
    console.log('All linked accounts:', user.linkedAccounts.map((acc: any) => ({
      type: acc.type,
      address: acc.address,
      hasAddress: !!acc.address,
      keys: Object.keys(acc),
      // Show all properties for debugging
      ...acc
    })));
    
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
      console.log('✅ Got address from linkedAccounts:', address, 'Type:', walletAccount.type);
    } else {
      console.error('❌ No wallet account found in linkedAccounts!');
    }
  }
  
  // Additional logging for debugging
  if (authenticated && !address) {
    console.warn('⚠️ User authenticated but no wallet address found!');
    console.log('Available accounts:', user?.linkedAccounts?.map((acc: any) => 
      ({ type: acc.type, address: acc.address })
    ));
  }

  // Debug logging for ProfileEdit issues
  console.log('🔍 useWallet FINAL STATE:', {
    ready,
    authenticated,
    hasUser: !!user,
    address,
    fullAddress: address,
    walletsCount: wallets.length,
    linkedAccountsCount: user?.linkedAccounts?.length || 0,
    linkedAccountTypes: user?.linkedAccounts?.map(acc => acc.type),
    SOURCE: address ? (wallets.length > 0 ? 'useWallets' : 'linkedAccounts') : 'NONE'
  });
  
  // CRITICAL ERROR LOGGING
  if (authenticated && !address) {
    console.error('❌❌❌ CRITICAL: User authenticated but NO WALLET ADDRESS found!');
    console.error('This means the embedded wallet was not created or is not accessible.');
    console.error('Check Privy config: embeddedWallets.createOnLogin should be "all-users"');
  }

  // Auto-create embedded wallet if it doesn't exist
  useEffect(() => {
    const autoCreateWallet = async () => {
      // Only try if authenticated, no wallets, and not already creating
      if (authenticated && ready && wallets.length === 0 && !isCreatingWallet) {
        console.log('🔧 No wallets found, auto-creating embedded wallet...');
        setIsCreatingWallet(true);
        
        try {
          await createWallet();
          console.log('✅ Embedded wallet created successfully');
        } catch (error) {
          console.error('❌ Failed to auto-create wallet:', error);
        } finally {
          setIsCreatingWallet(false);
        }
      }
    };

    // Wait a bit before trying to auto-create (give Privy time to initialize)
    const timeout = setTimeout(autoCreateWallet, 2000);
    return () => clearTimeout(timeout);
  }, [authenticated, ready, wallets.length, createWallet, isCreatingWallet]);

  // Additional fallback for mobile/PWA issues
  useEffect(() => {
    if (authenticated && !address && user?.linkedAccounts?.length > 0) {
      console.log('🔄 No address found, checking all linked accounts...');
      const allAccounts = user.linkedAccounts;
      console.log('All linked accounts:', allAccounts.map((acc: any) => ({
        type: acc.type,
        address: acc.address,
        hasAddress: !!acc.address
      })));
      
      // Try to find any account with an address
      const accountWithAddress = allAccounts.find((acc: any) => acc.address);
      if (accountWithAddress) {
        console.log('✅ Found account with address:', accountWithAddress);
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
  };
};