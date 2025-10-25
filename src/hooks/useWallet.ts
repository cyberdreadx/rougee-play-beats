import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export const useWallet = () => {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // PRIORITY 1: Try to get address from Privy's useWallets hook (most reliable)
  let address: string | undefined = undefined;
  
  console.log('🔍 Checking Privy wallets:', {
    walletsCount: wallets.length,
    wallets: wallets.map(w => ({
      type: w.walletClientType,
      address: w.address,
      chainId: w.chainId
    }))
  });
  
  // Try useWallets first (this is the proper way)
  if (wallets.length > 0) {
    const primaryWallet = wallets[0]; // Get first wallet
    address = primaryWallet.address;
    console.log('✅ Got address from useWallets:', address);
  }
  
  // FALLBACK: Try user.linkedAccounts
  if (!address && user?.linkedAccounts) {
    console.log('🔄 Trying user.linkedAccounts as fallback...');
    console.log('All linked accounts:', user.linkedAccounts.map((acc: any) => ({
      type: acc.type,
      address: acc.address,
      hasAddress: !!acc.address,
      keys: Object.keys(acc)
    })));
    
    // First try specific wallet types
    let walletAccount = user.linkedAccounts.find((account: any) =>
      ['wallet', 'smart_wallet', 'embedded_wallet'].includes(account.type)
    ) as any;
    
    // If not found, try to find ANY account with an address
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
      console.log('✅ Got address from linkedAccounts:', address);
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
    SOURCE: address ? (wallets.length > 0 ? 'useWallets' : 'linkedAccounts') : 'NONE'
  });

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
    isConnecting: !ready,
    connect,
    disconnect: logout,
    isPrivyReady: ready,
  };
};