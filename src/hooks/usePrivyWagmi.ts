import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useConnect, useAccount } from 'wagmi';

/**
 * Ensures Privy's embedded wallet is connected to wagmi
 * This fixes "Connector not connected" errors when using wagmi hooks
 */
export const usePrivyWagmi = () => {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { connectors, connect } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    const connectPrivyWallet = async () => {
      console.log('🔍 usePrivyWagmi: Starting connection process', {
        ready,
        authenticated,
        walletsCount: wallets.length,
        isConnected,
        connectorsCount: connectors.length
      });

      // Wait for Privy to be ready
      if (!ready || !authenticated) {
        console.log('⏳ Waiting for Privy to be ready and authenticated');
        return;
      }
      
      // If wagmi is already connected, we're good
      if (isConnected) {
        console.log('✅ Wagmi already connected');
        return;
      }

      // Get the primary wallet (external wallet first, then embedded)
      const externalWallet = wallets.find(
        (wallet) => wallet.walletClientType !== 'privy' && wallet.walletClientType !== 'embedded_wallet'
      );
      const embeddedWallet = wallets.find(
        (wallet) => wallet.walletClientType === 'privy' || wallet.walletClientType === 'embedded_wallet'
      );

      const primaryWallet = externalWallet || embeddedWallet;
      if (!primaryWallet) {
        console.log('❌ No wallet found in Privy wallets:', wallets.map(w => ({ type: w.walletClientType, address: w.address })));
        return;
      }

      console.log('🔍 Available wallets:', wallets.map(w => ({ type: w.walletClientType, address: w.address })));
      console.log('🎯 Using wallet:', { type: primaryWallet.walletClientType, address: primaryWallet.address });

      // Find the appropriate connector
      const injected = connectors.find((c) => c.id === 'injected');
      const privyConnector = connectors.find(
        (connector) => /privy/i.test(connector.id) || /privy/i.test(connector.name)
      );
      
      console.log('🔍 Available connectors:', connectors.map(c => ({ id: c.id, name: c.name })));
      
      // Prioritize injected connector for external wallets, privy for embedded
      const target = (primaryWallet.walletClientType !== 'privy' && primaryWallet.walletClientType !== 'embedded_wallet') 
        ? injected || privyConnector || connectors[0]
        : privyConnector || injected || connectors[0];

      if (!target) {
        console.warn('❌ No wagmi connector available to connect');
        return;
      }

      console.log('🎯 Selected connector:', { id: target.id, name: target.name });

      if (!isConnected) {
        try {
          console.log('🔌 Connecting wallet to wagmi using', target.name, target.id);
          console.log('🎯 Target wallet:', { type: primaryWallet.walletClientType, address: primaryWallet.address });
          await connect({ connector: target });
          console.log('✅ Wallet connected to wagmi successfully');
        } catch (error) {
          console.error('❌ Failed to connect wallet to wagmi:', error);
          
          // Try alternative approach - force connect with any available connector
          if (connectors.length > 0) {
            console.log('🔄 Trying alternative connector...');
            try {
              await connect({ connector: connectors[0] });
              console.log('✅ Alternative connection successful');
            } catch (altError) {
              console.error('❌ Alternative connection also failed:', altError);
            }
          }
        }
      }
    };

    connectPrivyWallet();
  }, [ready, authenticated, wallets, isConnected, connectors, connect]);

  // Force retry connection if we have wallets but wagmi isn't connected
  const forceRetry = async () => {
    if (ready && authenticated && wallets.length > 0 && !isConnected) {
      console.log('🔄 Force retrying connection...');
      const primaryWallet = wallets.find(w => w.address) || wallets[0];
      if (primaryWallet && connectors.length > 0) {
        try {
          await connect({ connector: connectors[0] });
          console.log('✅ Force retry successful');
        } catch (error) {
          console.error('❌ Force retry failed:', error);
        }
      }
    }
  };

  return { isConnected, forceRetry };
};
