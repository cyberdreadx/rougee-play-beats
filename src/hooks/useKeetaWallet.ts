import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserClient, lib } from '@keetanetwork/keetanet-client';

const { Account } = lib;

// Keeta network configuration
export const KEETA_NETWORK = {
  name: 'Keeta',
  chainId: 'keeta',
  rpcUrl: 'https://keeta.network/rpc',
  explorerUrl: 'https://explorer.keeta.network',
  nativeCurrency: {
    name: 'KTA',
    symbol: 'KTA',
    decimals: 18,
  },
};

// Keeta wallet state interface
interface KeetaWalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: string;
  tokens: KeetaToken[];
  mnemonic: string | null;
  privateKey: string | null;
}

interface KeetaToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  price?: number;
}

export const useKeetaWallet = () => {
  const [walletState, setWalletState] = useState<KeetaWalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    balance: '0',
    tokens: [],
    mnemonic: null,
    privateKey: null,
  });

  // Load wallet from localStorage on mount
  useEffect(() => {
    loadWalletFromStorage();
  }, []);

  const loadWalletFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem('keeta-wallet');
      if (stored) {
        const walletData = JSON.parse(stored);
        // Only set as connected if we have both address and private key
        if (walletData.address && walletData.privateKey) {
          setWalletState(prev => ({
            ...prev,
            address: walletData.address,
            isConnected: true,
            mnemonic: walletData.mnemonic,
            privateKey: walletData.privateKey,
          }));
        } else {
          // Clear invalid wallet data
          localStorage.removeItem('keeta-wallet');
        }
      }
    } catch (error) {
      console.error('Failed to load Keeta wallet from storage:', error);
      // Clear corrupted wallet data
      localStorage.removeItem('keeta-wallet');
    }
  }, []);

  const saveWalletToStorage = useCallback((walletData: Partial<KeetaWalletState>) => {
    try {
      const current = localStorage.getItem('keeta-wallet');
      const existing = current ? JSON.parse(current) : {};
      const updated = { ...existing, ...walletData };
      localStorage.setItem('keeta-wallet', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save Keeta wallet to storage:', error);
    }
  }, []);

  const createWallet = useCallback(async (mnemonic?: string) => {
    setWalletState(prev => ({ ...prev, isConnecting: true }));
    
    try {
      let account: any;
      let generatedMnemonic: string;
      let seed: any;

      if (mnemonic) {
        // Import existing wallet from mnemonic (matches CLI pattern)
        seed = await Account.seedFromPassphrase(mnemonic, { asString: true });
        account = Account.fromSeed(seed, 0);
        generatedMnemonic = mnemonic;
      } else {
        // Generate new wallet (matches CLI pattern)
        const seedBuffer = Account.generateRandomSeed();
        seed = Buffer.from(seedBuffer).toString('hex'); // Convert ArrayBuffer to hex string
        account = Account.fromSeed(seed, 0);
        generatedMnemonic = seed; // Store seed as mnemonic
      }

      // Get the account address (matches CLI pattern)
      const address = account.publicKeyString.toString();
      
      // Try to get the actual private key from the account
      let actualPrivateKey = seed; // Fallback to seed
      try {
        // Attempt to get the private key using the method from CLI
        if (account._getPrivateKey) {
          actualPrivateKey = account._getPrivateKey();
        }
      } catch (error) {
        console.warn('Could not extract private key, using seed:', error);
      }

      const newWalletState = {
        address,
        isConnected: true,
        isConnecting: false,
        balance: '0',
        tokens: [],
        mnemonic: generatedMnemonic,
        privateKey: actualPrivateKey, // Store actual private key or seed as fallback
      };

      setWalletState(newWalletState);
      saveWalletToStorage(newWalletState);

      // Store in Supabase for backup
      await supabase
        .from('keeta_wallets')
        .upsert({
          address,
          mnemonic: generatedMnemonic,
          private_key: newWalletState.privateKey,
          created_at: new Date().toISOString(),
        });

      return { address, mnemonic: generatedMnemonic };
    } catch (error) {
      console.error('Failed to create Keeta wallet:', error);
      setWalletState(prev => ({ ...prev, isConnecting: false }));
      throw error;
    }
  }, [saveWalletToStorage]);

  const importWallet = useCallback(async (input: string, options?: { 
    type?: 'mnemonic' | 'seed' | 'privateKey',
    algorithm?: 'ed25519' | 'secp256k1' | 'secp256r1',
    index?: number,
    autoDetect?: boolean 
  }) => {
    setWalletState(prev => ({ ...prev, isConnecting: true }));
    
    try {
      const type = options?.type || 'mnemonic';
      const algorithm = options?.algorithm || 'ed25519';
      const index = options?.index || 0;
      const autoDetect = options?.autoDetect || false;

      let seed: string;

      if (type === 'mnemonic') {
        // Validate mnemonic format (24 words)
        const words = input.trim().split(/\s+/);
        if (words.length !== 24) {
          throw new Error('Mnemonic must be exactly 24 words');
        }
        seed = await Account.seedFromPassphrase(input, { asString: true }) as string;
      } else if (type === 'seed') {
        // Import from hex seed (matches CLI --seed)
        const seedHex = input.startsWith('0x') ? input.slice(2) : input;
        if (!/^[0-9a-fA-F]+$/.test(seedHex)) {
          throw new Error('Invalid seed format. Must be hexadecimal.');
        }
        seed = seedHex;
      } else if (type === 'privateKey') {
        // Import from private key (matches CLI --priv, only supports secp256k1)
        if (algorithm !== 'secp256k1') {
          throw new Error('Private key import only supports secp256k1 algorithm');
        }
        const privHex = input.startsWith('0x') ? input.slice(2) : input;
        if (!/^[0-9a-fA-F]+$/.test(privHex)) {
          throw new Error('Invalid private key format. Must be hexadecimal.');
        }
        // For now, we'll treat private key as seed (simplified implementation)
        // In a full implementation, you'd need to handle secp256k1 differently
        seed = privHex;
      } else {
        throw new Error('Invalid import type');
      }

      let account: any;
      let address: string;

      if (autoDetect) {
        // Auto-detect wallet with balance (matches CLI --auto-detect)
        const algorithms: ('ed25519' | 'secp256k1' | 'secp256r1')[] = ['ed25519', 'secp256k1', 'secp256r1'];
        const indices = [0, 1, 2, 3, 4, 5];
        let foundWallet: any = null;
        let maxBalance = BigInt(0);
        let foundAddress = '';

        for (const testAlgo of algorithms) {
          for (const testIndex of indices) {
            try {
              const testAccount = Account.fromSeed(seed, testIndex);
              const testAddress = testAccount.publicKeyString.toString();
              
              // Check balance on mainnet
              const client = UserClient.fromNetwork('main', testAccount);
              const balances = await client.allBalances();
              
              // Calculate total balance
              let totalBalance = BigInt(0);
              if (Array.isArray(balances)) {
                for (const balanceData of balances) {
                  const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k, v) => typeof v === 'bigint' ? v.toString() : v));
                  totalBalance += BigInt(tokenInfo.balance || 0);
                }
              }
              
              if (totalBalance > maxBalance) {
                maxBalance = totalBalance;
                foundWallet = testAccount;
                foundAddress = testAddress;
              }
            } catch (error) {
              // Continue to next combination
            }
          }
        }

        if (foundWallet) {
          account = foundWallet;
          address = foundAddress;
        } else {
          throw new Error('No wallet with balance found. Try importing manually.');
        }
      } else {
        // Standard import (matches CLI without --auto-detect)
        account = Account.fromSeed(seed, index);
        address = account.publicKeyString.toString();
      }

      // Try to get the actual private key from the account
      let actualPrivateKey = seed; // Fallback to seed
      try {
        // Attempt to get the private key using the method from CLI
        if (account._getPrivateKey) {
          actualPrivateKey = account._getPrivateKey();
        }
      } catch (error) {
        console.warn('Could not extract private key, using seed:', error);
      }

      const newWalletState = {
        address,
        isConnected: true,
        isConnecting: false,
        balance: '0',
        tokens: [],
        mnemonic,
        privateKey: actualPrivateKey, // Store actual private key or seed as fallback
      };

      setWalletState(newWalletState);
      saveWalletToStorage(newWalletState);

      // Store in Supabase for backup
      await supabase
        .from('keeta_wallets')
        .upsert({
          address,
          mnemonic,
          private_key: newWalletState.privateKey,
          created_at: new Date().toISOString(),
        });

      return { address, mnemonic };
    } catch (error) {
      console.error('Failed to import Keeta wallet:', error);
      setWalletState(prev => ({ ...prev, isConnecting: false }));
      throw error;
    }
  }, [saveWalletToStorage]);

  const disconnect = useCallback(() => {
    setWalletState({
      address: null,
      isConnected: false,
      isConnecting: false,
      balance: '0',
      tokens: [],
      mnemonic: null,
      privateKey: null,
    });
    localStorage.removeItem('keeta-wallet');
  }, []);

  const deleteWallet = useCallback(async () => {
    try {
      // Remove from Supabase
      if (walletState.address) {
        await supabase
          .from('keeta_wallets')
          .delete()
          .eq('address', walletState.address);
      }
      
      // Clear local state and storage
      disconnect();
      
      return true;
    } catch (error) {
      console.error('Failed to delete Keeta wallet:', error);
      // Still disconnect locally even if Supabase fails
      disconnect();
      throw error;
    }
  }, [walletState.address, disconnect]);

  const fetchBalance = useCallback(async () => {
    if (!walletState.address || !walletState.privateKey) {
      return;
    }

    try {
      // Reconstruct account from stored seed (privateKey is actually the seed)
      const account = Account.fromSeed(walletState.privateKey, 0);
      
      // Create Keeta client
      const client = UserClient.fromNetwork('main', account);
      
      // Get all balances and extract KTA balance
      const allBalances = await client.allBalances();
      
      // Get base token address for comparison
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      
      // Find KTA balance from allBalances
      let keetaBalance = BigInt(0);
      if (Array.isArray(allBalances)) {
        for (const balanceData of allBalances) {
          const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k, v) => typeof v === 'bigint' ? v.toString() : v));
          const tokenAddress = tokenInfo.token;
          
          if (tokenAddress === baseTokenAddr) {
            keetaBalance = BigInt(tokenInfo.balance || 0);
            break;
          }
        }
      }
      
      setWalletState(prev => ({ ...prev, balance: keetaBalance.toString() }));
    } catch (error) {
      console.error('Failed to fetch Keeta balance:', error);
    }
  }, [walletState.address, walletState.privateKey]);

  const fetchTokens = useCallback(async () => {
    if (!walletState.address || !walletState.privateKey) return;

    try {
      // Reconstruct account from stored seed (privateKey is actually the seed)
      const account = Account.fromSeed(walletState.privateKey, 0);
      
      // Create Keeta client (matches CLI pattern)
      const client = UserClient.fromNetwork('main', account);
      
      // Get all balances (matches CLI pattern - no account parameter)
      const balances = await client.allBalances();
      
      // Get base token address for comparison
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      
      // Convert to our token format (matches CLI pattern)
      // Filter out the native KTA token since it's displayed separately
      const tokens: KeetaToken[] = balances
        .filter((balanceData) => {
          const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k, v) => typeof v === 'bigint' ? v.toString() : v));
          const tokenAddress = tokenInfo.token;
          
          // Filter out native KTA token and zero balances
          return tokenInfo.balance !== '0' && tokenInfo.balance !== 0 && tokenAddress !== baseTokenAddr;
        })
        .map((balanceData) => {
          const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k, v) => typeof v === 'bigint' ? v.toString() : v));
          const tokenAddress = tokenInfo.token;
          
          return {
            address: tokenAddress,
            symbol: 'UNKNOWN', // Will be updated when we have token metadata
            name: 'Unknown Token',
            balance: tokenInfo.balance.toString(),
            decimals: 18, // Default decimals for custom tokens
            price: 0,
          };
        });
      
      setWalletState(prev => ({ ...prev, tokens }));
    } catch (error) {
      console.error('Failed to fetch Keeta tokens:', error);
    }
  }, [walletState.address, walletState.privateKey]);

  // Fetch balance and tokens when wallet connects
  useEffect(() => {
    if (walletState.isConnected && walletState.address) {
      fetchBalance();
      fetchTokens();
    }
  }, [walletState.isConnected, walletState.address, fetchBalance, fetchTokens]);

  // Send tokens function
  const sendTokens = useCallback(async (to: string, amount: string, tokenAddress?: string) => {
    if (!walletState.address || !walletState.privateKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Reconstruct account from stored seed (privateKey is actually the seed)
      const account = Account.fromSeed(walletState.privateKey, 0);
      
      // Connect to the Keeta main network
      const client = UserClient.fromNetwork('main', account);
      
      // Start building a transaction
      const builder = client.initBuilder();
      
      // Create recipient account from public key string
      const recipientAccount = Account.fromPublicKeyString(to);
      
      // Convert amount to BigInt
      const amountBigInt = BigInt(amount);
      
      // Get base token address (matches CLI pattern)
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      
      if (tokenAddress && tokenAddress !== baseTokenAddr) {
        // Send specific token (matches CLI pattern)
        const tokenAccount = Account.fromPublicKeyString(tokenAddress);
        builder.send(recipientAccount, amountBigInt, tokenAccount);
      } else {
        // Send native KTA (base token) - matches CLI pattern
        builder.send(recipientAccount, amountBigInt, client.baseToken);
      }
      
      // Publish the transaction (matches CLI pattern)
      const result = await builder.publish();
      
      // Refresh balances after sending
      await fetchBalance();
      await fetchTokens();
      
      return transaction;
    } catch (error) {
      console.error('Failed to send tokens:', error);
      throw error;
    }
  }, [walletState.address, walletState.privateKey, fetchBalance, fetchTokens]);

  return {
    ...walletState,
    createWallet,
    importWallet,
    disconnect,
    deleteWallet,
    fetchBalance,
    fetchTokens,
    sendTokens,
    network: KEETA_NETWORK,
  };
};

// Real Keeta SDK integration - no helper functions needed
