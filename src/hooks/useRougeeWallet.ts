import { useState, useEffect, useCallback } from 'react';

// RouGee Wallet provider type (from extension)
interface RougeeProvider {
  connect: () => Promise<{ accounts: string[]; network: string }>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: { to: string; amount: string }) => Promise<string>;
  switchNetwork: (network: 'test' | 'main') => Promise<string>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
}

// Extend window interface
declare global {
  interface Window {
    rougee?: RougeeProvider;
  }
}

interface RougeeWalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  network: string | null;
  error: string | null;
}

export const useRougeeWallet = () => {
  const [state, setState] = useState<RougeeWalletState>({
    isConnected: false,
    isConnecting: false,
    address: null,
    network: null,
    error: null,
  });
  const [isInstalled, setIsInstalled] = useState(false);

  // Detect RouGee Wallet provider (matches working example pattern)
  const getProvider = useCallback((): RougeeProvider | null => {
    if (typeof window === 'undefined') return null;
    
    const provider = window.rougee;
    if (!provider) {
      return null;
    }
    
    return provider as RougeeProvider;
  }, []);

  // Periodically check if RouGee Wallet is installed (matches working example pattern exactly)
  useEffect(() => {
    let checkAttempts = 0;
    const maxCheckAttempts = 10; // 10 attempts × 200ms = 2 seconds max

    // Retry logic to wait for window.rougee to be injected (matches example)
    const tryCheckWallet = () => {
      checkAttempts++;
      console.log(`[RouGee] Check attempt ${checkAttempts}, window.rougee exists:`, !!window.rougee);
      
      if (window.rougee) {
        setIsInstalled(true);
        console.log('✅ RouGee Wallet detected!');
      } else if (checkAttempts < maxCheckAttempts) {
        setTimeout(tryCheckWallet, 200);
      } else {
        // Give up after max attempts
        setIsInstalled(false);
        console.log('⚠️ RouGee Wallet not detected after retries');
      }
    };

    // Start checking immediately (don't wait for 'load' event)
    tryCheckWallet();

    // Also listen for the wallet initialization event (matches example)
    const handleInitialized = () => {
      console.log('[RouGee] Received rougee#initialized event');
      checkAttempts = maxCheckAttempts; // Stop retry loop
      setIsInstalled(true);
    };

    window.addEventListener('rougee#initialized', handleInitialized);

    // Also check on window load
    const checkOnLoad = () => {
      if (window.rougee) {
        setIsInstalled(true);
        console.log('✅ RouGee Wallet detected on load!');
      }
    };

    if (document.readyState === 'complete') {
      checkOnLoad();
    } else {
      window.addEventListener('load', checkOnLoad);
    }

    return () => {
      window.removeEventListener('rougee#initialized', handleInitialized);
      window.removeEventListener('load', checkOnLoad);
    };
  }, []);

  // Connect to RouGee Wallet (matches working example pattern exactly)
  const connect = useCallback(async () => {
    if (!window.rougee) {
      const errorMsg = 'RouGee Wallet not detected. Please install the extension and reload the page.';
      setState(prev => ({ ...prev, error: errorMsg }));
      console.error('❌', errorMsg);
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      console.log('[RouGee] Calling window.rougee.connect()...');
      const result = await window.rougee.connect();
      console.log('[RouGee] Connect result:', result);

      if (!result.accounts || result.accounts.length === 0) {
        throw new Error('No accounts returned. Please make sure you have an account in RouGee Wallet.');
      }

      setState({
        isConnected: true,
        isConnecting: false,
        address: result.accounts[0],
        network: result.network || null,
        error: null,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to RouGee Wallet';
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: errorMessage,
      }));
      console.error('[RouGee] Connect error:', error);
      return false;
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (!window.rougee) return;

    try {
      await window.rougee.disconnect();
      setState({
        isConnected: false,
        isConnecting: false,
        address: null,
        network: null,
        error: null,
      });
      console.log('[RouGee] Disconnected successfully');
    } catch (error) {
      console.error('[RouGee] Disconnect error:', error);
    }
  }, []);

  // Send transaction
  const sendTransaction = useCallback(async (transaction: { to: string; amount: string }) => {
    if (!window.rougee) {
      throw new Error('RouGee Wallet not detected');
    }

    if (!state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('[RouGee] Sending transaction...');
      const txHash = await window.rougee.sendTransaction(transaction);
      console.log('[RouGee] Transaction sent:', txHash);
      return txHash;
    } catch (error) {
      console.error('[RouGee] Transaction error:', error);
      throw error;
    }
  }, [state.isConnected]);

  // Switch network
  const switchNetwork = useCallback(async (network: 'test' | 'main') => {
    if (!window.rougee) {
      throw new Error('RouGee Wallet not detected');
    }

    try {
      const newNetwork = await window.rougee.switchNetwork(network);
      setState(prev => ({ ...prev, network: newNetwork }));
      console.log('[RouGee] Switched network to:', newNetwork);
      return newNetwork;
    } catch (error) {
      console.error('[RouGee] Network switch error:', error);
      throw error;
    }
  }, []);

  // Listen to wallet events (matches example pattern)
  useEffect(() => {
    if (!window.rougee || !window.rougee.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[RouGee] Accounts changed:', accounts);
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }));
      }
    };

    const handleNetworkChanged = ({ network }: { network: string }) => {
      console.log('[RouGee] Network changed:', network);
      setState(prev => ({ ...prev, network }));
    };

    const handleDisconnect = () => {
      console.log('[RouGee] Wallet disconnected');
      disconnect();
    };

    window.rougee.on('accountsChanged', handleAccountsChanged);
    window.rougee.on('networkChanged', handleNetworkChanged);
    window.rougee.on('disconnect', handleDisconnect);

    return () => {
      if (window.rougee?.removeListener) {
        window.rougee.removeListener('accountsChanged', handleAccountsChanged);
        window.rougee.removeListener('networkChanged', handleNetworkChanged);
        window.rougee.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [disconnect]);

  // Expose manual check function for debugging
  const manualCheck = useCallback(async () => {
    console.log('🔍 Manual RouGee Wallet check triggered');
    console.log('typeof window.rougee:', typeof window !== 'undefined' ? typeof window.rougee : 'N/A');
    if (typeof window !== 'undefined' && window.rougee) {
      console.log('window.rougee:', window.rougee);
      console.log('window.rougee keys:', Object.keys(window.rougee));
    }
    
    const detected = typeof window !== 'undefined' && !!window.rougee;
    setIsInstalled(detected);
    console.log('Manual check result:', detected);
    return detected;
  }, []);

  // Expose to window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__checkRougeeWallet = manualCheck;
      (window as any).__rougeeWalletState = { isInstalled, state };
    }
  }, [manualCheck, isInstalled, state]);

  return {
    ...state,
    isInstalled,
    connect,
    disconnect,
    sendTransaction,
    switchNetwork,
    provider: getProvider(),
    manualCheck, // Expose for debugging
  };
};




