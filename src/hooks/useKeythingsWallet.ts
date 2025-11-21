import { useState, useEffect, useCallback } from 'react';

// Keythings Wallet provider type (from extension)
interface KeetaProvider {
  isKeeta: boolean;
  requestCapabilities: (capabilities: string[]) => Promise<Record<string, any>>;
  refreshCapabilities: (capabilities: string[]) => Promise<Record<string, any>>;
  isConnected: () => Promise<boolean>;
  requestAccounts: () => Promise<string[]>;
  getAccounts: () => Promise<string[]>;
  getNetwork: () => Promise<{ name: string; chainId: string }>;
  switchNetwork: (chainId: string) => Promise<void>;
  getBalance: (address: string) => Promise<string>;
  getAllBalances: () => Promise<any[]>;
  getActivity: (params?: { depth?: number; cursor?: string }) => Promise<{ records: any[]; cursor: string; hasMore: boolean }>;
  sendTransaction: (transaction: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  getKtaPrice: () => Promise<number>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
}

// Extend window interface
declare global {
  interface Window {
    keeta?: KeetaProvider;
  }
}

interface KeythingsWalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  network: { name: string; chainId: string } | null;
  balance: string;
  error: string | null;
}

export const useKeythingsWallet = () => {
  const [state, setState] = useState<KeythingsWalletState>({
    isConnected: false,
    isConnecting: false,
    address: null,
    network: null,
    balance: '0',
    error: null,
  });
  const [isInstalled, setIsInstalled] = useState(false);

  // Detect Keythings Wallet provider
  const getProvider = useCallback((): KeetaProvider | null => {
    if (typeof window === 'undefined') return null;
    
    const provider = window.keeta;
    if (!provider?.isKeeta) {
      return null;
    }
    return provider;
  }, []);

  // Periodically check if Keythings Wallet is installed (extension might load after page load)
  useEffect(() => {
    const checkInstallation = () => {
      const provider = getProvider();
      const installed = !!provider;
      setIsInstalled(installed);
      
      if (installed) {
        console.log('✅ Keythings Wallet detected:', provider);
      } else {
        console.log('⚠️ Keythings Wallet not detected. Make sure:');
        console.log('  1. Extension is installed from Chrome Web Store');
        console.log('  2. Extension is enabled');
        console.log('  3. Developer options enabled in extension');
        console.log('  4. Current origin is in allowlist (localhost:3000, localhost:5173, etc.)');
        console.log('  5. window.keeta exists:', typeof window !== 'undefined' && !!window.keeta);
        if (typeof window !== 'undefined' && window.keeta) {
          console.log('  6. window.keeta.isKeeta:', (window.keeta as any)?.isKeeta);
        }
      }
    };

    // Check immediately
    checkInstallation();

    // Check periodically (extension might load after page)
    const interval = setInterval(checkInstallation, 1000);
    
    // Also listen for extension injection
    const checkOnLoad = () => {
      setTimeout(checkInstallation, 100);
    };
    window.addEventListener('load', checkOnLoad);

    return () => {
      clearInterval(interval);
      window.removeEventListener('load', checkOnLoad);
    };
  }, [getProvider]);

  // Connect to Keythings Wallet
  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setState(prev => ({ ...prev, error: 'Keythings Wallet not detected. Please install the extension from Chrome Web Store.' }));
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Request capabilities (read + transact by default)
      await provider.requestCapabilities(['read', 'transact']);

      // Request accounts
      const accounts = await provider.requestAccounts();
      if (accounts.length === 0) {
        throw new Error('User rejected the connection request or no accounts are available.');
      }

      // Get network
      const network = await provider.getNetwork();

      // Get balance
      let balance = '0';
      try {
        balance = await provider.getBalance(accounts[0]);
      } catch (error) {
        console.warn('Failed to fetch balance:', error);
      }

      setState({
        isConnected: true,
        isConnecting: false,
        address: accounts[0],
        network,
        balance,
        error: null,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Keythings Wallet';
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [getProvider]);

  // Disconnect
  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      isConnecting: false,
      address: null,
      network: null,
      balance: '0',
      error: null,
    });
  }, []);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    const provider = getProvider();
    if (!provider || !state.address) return;

    try {
      const balance = await provider.getBalance(state.address);
      setState(prev => ({ ...prev, balance }));
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [getProvider, state.address]);

  // Send transaction
  const sendTransaction = useCallback(async (transaction: any) => {
    const provider = getProvider();
    if (!provider) {
      throw new Error('Keythings Wallet not detected');
    }

    if (!state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const txHash = await provider.sendTransaction(transaction);
      return txHash;
    } catch (error) {
      throw error;
    }
  }, [getProvider, state.isConnected]);

  // Sign message
  const signMessage = useCallback(async (message: string) => {
    const provider = getProvider();
    if (!provider) {
      throw new Error('Keythings Wallet not detected');
    }

    if (!state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await provider.signMessage(message);
      return signature;
    } catch (error) {
      throw error;
    }
  }, [getProvider, state.isConnected]);

  // Switch network
  const switchNetwork = useCallback(async (chainId: string) => {
    const provider = getProvider();
    if (!provider) {
      throw new Error('Keythings Wallet not detected');
    }

    try {
      await provider.switchNetwork(chainId);
      const network = await provider.getNetwork();
      setState(prev => ({ ...prev, network }));
    } catch (error) {
      throw error;
    }
  }, [getProvider]);

  // Listen to provider events
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }));
      }
    };

    const handleChainChanged = (chainId: string) => {
      provider.getNetwork().then(network => {
        setState(prev => ({ ...prev, network }));
      });
    };

    const handleDisconnect = () => {
      disconnect();
    };

    if (provider.on) {
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);
      provider.on('disconnect', handleDisconnect);
    }

    return () => {
      if (provider.removeListener) {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged', handleChainChanged);
        provider.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [getProvider, disconnect]);

  // Auto-connect if already connected
  useEffect(() => {
    const provider = getProvider();
    if (!provider || state.isConnected) return;

    const checkConnection = async () => {
      try {
        const connected = await provider.isConnected();
        if (connected) {
          const accounts = await provider.getAccounts();
          if (accounts.length > 0) {
            const network = await provider.getNetwork();
            const balance = await provider.getBalance(accounts[0]);
            setState({
              isConnected: true,
              isConnecting: false,
              address: accounts[0],
              network,
              balance,
              error: null,
            });
          }
        }
      } catch (error) {
        // Not connected, ignore
      }
    };

    checkConnection();
  }, [getProvider, state.isConnected]);

  return {
    ...state,
    isInstalled,
    connect,
    disconnect,
    refreshBalance,
    sendTransaction,
    signMessage,
    switchNetwork,
    provider: getProvider(),
  };
};

