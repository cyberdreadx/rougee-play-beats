import { usePrivy } from '@privy-io/react-auth';

export const useWallet = () => {
  const { ready, authenticated, user, login, logout } = usePrivy();

  // Get wallet address from Privy (supports smart/embedded)
  // First try specific wallet types
  let walletAccount = user?.linkedAccounts?.find((account: any) =>
    ['wallet', 'smart_wallet', 'embedded_wallet'].includes(account.type)
  ) as any;
  
  // Fallback: If no specific wallet type found, try to find ANY account with an address
  if (!walletAccount && user?.linkedAccounts) {
    console.log('🔍 No standard wallet found, checking all accounts:', 
      user.linkedAccounts.map((acc: any) => ({ type: acc.type, hasAddress: !!acc.address }))
    );
    
    // Try to find any account with an address field that looks like an Ethereum address
    walletAccount = user.linkedAccounts.find((account: any) => 
      account.address && 
      typeof account.address === 'string' && 
      account.address.startsWith('0x') &&
      account.address.length === 42
    ) as any;
    
    if (walletAccount) {
      console.log('✅ Found wallet address from account type:', walletAccount.type);
    }
  }
  
  const address = walletAccount?.address as string | undefined;
  
  // Additional logging for debugging
  if (authenticated && !address) {
    console.warn('⚠️ User authenticated but no wallet address found!');
    console.log('Available accounts:', user?.linkedAccounts?.map((acc: any) => 
      ({ type: acc.type, address: acc.address })
    ));
  }

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