import React, { createContext, useContext, ReactNode } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useKeetaWallet } from '@/hooks/useKeetaWallet';

export type WalletNetwork = 'base' | 'keeta';

interface DualWalletContextType {
  // Base wallet (existing Privy integration)
  baseWallet: {
    address: string | null;
    fullAddress: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
  };
  
  // Keeta wallet (new web wallet integration)
  keetaWallet: {
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    balance: string;
    tokens: any[];
    createWallet: (mnemonic?: string) => Promise<{ address: string; mnemonic: string }>;
    importWallet: (mnemonic: string) => Promise<{ address: string; mnemonic: string }>;
    disconnect: () => void;
    deleteWallet: () => Promise<boolean>;
    fetchBalance: () => Promise<void>;
    fetchTokens: () => Promise<void>;
    sendTokens: (to: string, amount: string, tokenAddress?: string) => Promise<boolean>;
    network: any;
  };
  
  // Current active network
  activeNetwork: WalletNetwork;
  setActiveNetwork: (network: WalletNetwork) => void;
  
  // Combined state
  hasAnyWallet: boolean;
  currentWallet: {
    address: string | null;
    fullAddress: string | null;
    isConnected: boolean;
    network: WalletNetwork;
  };
}

const DualWalletContext = createContext<DualWalletContextType | undefined>(undefined);

interface DualWalletProviderProps {
  children: ReactNode;
}

export const DualWalletProvider: React.FC<DualWalletProviderProps> = ({ children }) => {
  const baseWallet = useWallet();
  const keetaWallet = useKeetaWallet();
  

  // Safety check to ensure wallets are properly initialized
  if (!baseWallet || !keetaWallet) {
    console.error('DualWalletProvider: Wallets not properly initialized');
    return <div>Loading wallets...</div>;
  }
  
  // Default to Base network
  const [activeNetwork, setActiveNetwork] = React.useState<WalletNetwork>('base');
  
  // Determine if user has any wallet connected
  const hasAnyWallet = baseWallet.isConnected || keetaWallet.isConnected;
  

  // Network switching handler
  const handleSetActiveNetwork = React.useCallback((network: WalletNetwork) => {
    setActiveNetwork(network);
  }, []);
  
  // Get current wallet based on active network
  const currentWallet = React.useMemo(() => {
    if (activeNetwork === 'base') {
      const wallet = {
        address: baseWallet.address,
        fullAddress: baseWallet.fullAddress,
        isConnected: baseWallet.isConnected,
        network: 'base' as WalletNetwork,
      };
      return wallet;
    } else {
      return {
        address: keetaWallet.address,
        fullAddress: keetaWallet.address,
        isConnected: keetaWallet.isConnected,
        network: 'keeta' as WalletNetwork,
      };
    }
  }, [activeNetwork, baseWallet, keetaWallet]);

  const contextValue: DualWalletContextType = {
    baseWallet: {
      address: baseWallet.address,
      fullAddress: baseWallet.fullAddress,
      isConnected: baseWallet.isConnected,
      isConnecting: baseWallet.isConnecting,
      connect: baseWallet.connect,
      disconnect: baseWallet.disconnect,
    },
    keetaWallet,
    activeNetwork,
    setActiveNetwork: handleSetActiveNetwork,
    hasAnyWallet,
    currentWallet,
  };

  return (
    <DualWalletContext.Provider value={contextValue}>
      {children}
    </DualWalletContext.Provider>
  );
};

export const useDualWallet = (): DualWalletContextType => {
  const context = useContext(DualWalletContext);
  if (context === undefined) {
    console.error('useDualWallet called outside of DualWalletProvider');
    console.trace('Stack trace:');
    throw new Error('useDualWallet must be used within a DualWalletProvider');
  }
  return context;
};
