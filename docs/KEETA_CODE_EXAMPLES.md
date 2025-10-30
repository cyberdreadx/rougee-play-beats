# Keeta SDK Code Examples

## Complete Wallet Implementation

### 1. Basic Wallet Hook
```typescript
// useKeetaWallet.ts
import { useState, useEffect, useCallback } from 'react';
import { UserClient, lib } from '@keetanetwork/keetanet-client';

const { Account } = lib;

export const useKeetaWallet = () => {
  const [walletState, setWalletState] = useState({
    address: null,
    isConnected: false,
    balance: '0',
    tokens: [],
    mnemonic: null,
    privateKey: null,
  });

  const createWallet = useCallback(async (mnemonic?: string) => {
    try {
      let account: any;
      let generatedMnemonic: string;
      
      if (mnemonic) {
        const seed = Account.seedFromPassphrase(mnemonic);
        account = Account.fromSeed(seed);
        generatedMnemonic = mnemonic;
      } else {
        const seed = Account.generateRandomSeed();
        account = Account.fromSeed(seed);
        generatedMnemonic = seed.toString('hex');
      }

      const address = account.publicKeyString.get();
      const privateKey = Buffer.from(seed).toString('hex'); // Store seed as private key

      setWalletState({
        address,
        isConnected: true,
        balance: '0',
        tokens: [],
        mnemonic: generatedMnemonic,
        privateKey,
      });

      return { address, mnemonic: generatedMnemonic };
    } catch (error) {
      console.error('Failed to create wallet:', error);
      throw error;
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!walletState.address || !walletState.privateKey) return;

    try {
      const privateKeyBuffer = Buffer.from(walletState.privateKey, 'hex');
      const account = Account.fromED25519PrivateKey(privateKeyBuffer);
      const client = await UserClient.fromNetwork('test');
      const balance = await client.balance(account);
      
      setWalletState(prev => ({ ...prev, balance: balance.toString() }));
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }, [walletState.address, walletState.privateKey]);

  return {
    ...walletState,
    createWallet,
    fetchBalance,
  };
};
```

### 2. Wallet Creation Dialog
```typescript
// KeetaWalletDialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { lib } from '@keetanetwork/keetanet-client';

const { Account } = lib;

export const KeetaWalletDialog = ({ open, onOpenChange, onSuccess }) => {
  const [mnemonic, setMnemonic] = useState('');
  const [mode, setMode] = useState('create');

  const handleCreateWallet = async () => {
    try {
      const result = await createWallet();
      onSuccess?.(result.address);
    } catch (error) {
      console.error('Failed to create wallet:', error);
    }
  };

  const handleImportWallet = async () => {
    try {
      // Validate mnemonic
      const seed = Account.seedFromPassphrase(mnemonic.trim());
      Account.fromSeed(seed);
      
      const result = await importWallet(mnemonic.trim());
      onSuccess?.(result.address);
    } catch (error) {
      console.error('Failed to import wallet:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keeta Wallet</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === 'create' ? 'default' : 'outline'}
              onClick={() => setMode('create')}
            >
              Create New
            </Button>
            <Button
              variant={mode === 'import' ? 'default' : 'outline'}
              onClick={() => setMode('import')}
            >
              Import
            </Button>
          </div>

          {mode === 'create' ? (
            <Button onClick={handleCreateWallet} className="w-full">
              Create Keeta Wallet
            </Button>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="Enter your mnemonic phrase..."
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
              />
              <Button onClick={handleImportWallet} className="w-full">
                Import Wallet
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

### 3. Balance Display Component
```typescript
// KeetaBalanceCard.tsx
import React from 'react';
import { Card } from '@/components/ui/card';

interface KeetaBalanceCardProps {
  balance: string;
  tokens: any[];
  isLoading: boolean;
}

export const KeetaBalanceCard = ({ balance, tokens, isLoading }: KeetaBalanceCardProps) => {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-2">Keeta Wallet</h3>
      
      {/* Native KEETA Balance */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">KEETA</span>
          <span className="text-xl font-bold">{parseFloat(balance).toFixed(4)}</span>
        </div>
      </div>

      {/* Token Balances */}
      {tokens.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-600">Tokens</h4>
          {tokens.map((token, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm">{token.symbol}</span>
              <span className="text-sm font-medium">
                {parseFloat(token.balance).toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
```

### 4. Transaction Component
```typescript
// KeetaSendDialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface KeetaSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (to: string, amount: string, tokenAddress?: string) => Promise<void>;
  balance: string;
  tokens: any[];
}

export const KeetaSendDialog = ({ 
  open, 
  onOpenChange, 
  onSend, 
  balance, 
  tokens 
}: KeetaSendDialogProps) => {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!to || !amount) return;

    setIsLoading(true);
    try {
      await onSend(to, amount, selectedToken || undefined);
      setTo('');
      setAmount('');
      setSelectedToken(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Send failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const maxAmount = selectedToken 
    ? tokens.find(t => t.address === selectedToken)?.balance || '0'
    : balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Keeta</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Token Selection */}
          <div>
            <Label>Token</Label>
            <select
              value={selectedToken || ''}
              onChange={(e) => setSelectedToken(e.target.value || null)}
              className="w-full p-2 border rounded"
            >
              <option value="">KEETA (Native)</option>
              {tokens.map((token, index) => (
                <option key={index} value={token.address}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Address */}
          <div>
            <Label htmlFor="to">Recipient Address</Label>
            <Input
              id="to"
              placeholder="Enter Keeta address..."
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => setAmount(maxAmount)}
              >
                MAX
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Available: {parseFloat(maxAmount).toFixed(4)}
            </p>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!to || !amount || isLoading}
            className="w-full"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

### 5. Network Status Component
```typescript
// KeetaNetworkStatus.tsx
import React, { useState, useEffect } from 'react';
import { UserClient } from '@keetanetwork/keetanet-client';

export const KeetaNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    checkNetworkStatus();
  }, []);

  const checkNetworkStatus = async () => {
    try {
      const client = await UserClient.fromNetwork('test');
      const head = await client.head();
      
      setIsOnline(true);
      setNetworkInfo({
        blockHeight: head.height,
        network: 'testnet'
      });
    } catch (error) {
      setIsOnline(false);
      setNetworkInfo(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm">
        {isOnline ? 'Keeta Connected' : 'Keeta Offline'}
      </span>
      {networkInfo && (
        <span className="text-xs text-gray-500">
          (Block: {networkInfo.blockHeight})
        </span>
      )}
    </div>
  );
};
```

## Testing Examples

### Unit Test Example
```typescript
// keetaWallet.test.ts
import { Account } from '@keetanetwork/keetanet-client/lib';
import { createWallet, importWallet } from './keetaWallet';

describe('Keeta Wallet', () => {
  test('should create new wallet', async () => {
    const result = await createWallet();
    
    expect(result.address).toBeDefined();
    expect(result.mnemonic).toBeDefined();
    expect(result.address).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64-like format
  });

  test('should import wallet from mnemonic', async () => {
    const mnemonic = 'test mnemonic phrase';
    const result = await importWallet(mnemonic);
    
    expect(result.address).toBeDefined();
    expect(result.mnemonic).toBe(mnemonic);
  });

  test('should validate mnemonic format', () => {
    const validMnemonic = 'valid test mnemonic phrase';
    const invalidMnemonic = 'invalid';
    
    expect(() => Account.seedFromPassphrase(validMnemonic)).not.toThrow();
    expect(() => Account.seedFromPassphrase(invalidMnemonic)).toThrow();
  });
});
```

## Error Handling Patterns

### Comprehensive Error Handling
```typescript
const handleKeetaOperation = async (operation: () => Promise<any>) => {
  try {
    return await operation();
  } catch (error) {
    if (error.message.includes('network')) {
      throw new Error('Network connection failed. Please check your internet connection.');
    } else if (error.message.includes('insufficient')) {
      throw new Error('Insufficient balance for this transaction.');
    } else if (error.message.includes('invalid')) {
      throw new Error('Invalid account or transaction parameters.');
    } else if (error.message.includes('timeout')) {
      throw new Error('Transaction timed out. Please try again.');
    } else {
      throw new Error(`Keeta operation failed: ${error.message}`);
    }
  }
};

// Usage
const sendTransaction = async (to: string, amount: string) => {
  return handleKeetaOperation(async () => {
    const account = Account.fromED25519PrivateKey(privateKeyBuffer);
    const client = await UserClient.fromNetwork('test');
    return await client.send(account, to, amount);
  });
};
```

## Performance Optimization

### Caching and Memoization
```typescript
import { useMemo, useCallback } from 'react';

export const useKeetaWallet = () => {
  const [walletState, setWalletState] = useState(initialState);

  // Memoize expensive operations
  const account = useMemo(() => {
    if (!walletState.privateKey) return null;
    const privateKeyBuffer = Buffer.from(walletState.privateKey, 'hex');
    return Account.fromED25519PrivateKey(privateKeyBuffer);
  }, [walletState.privateKey]);

  // Memoize client creation
  const client = useMemo(async () => {
    return await UserClient.fromNetwork('test');
  }, []);

  // Debounced balance fetching
  const debouncedFetchBalance = useCallback(
    debounce(async () => {
      if (!account) return;
      try {
        const balance = await client.balance(account);
        setWalletState(prev => ({ ...prev, balance: balance.toString() }));
      } catch (error) {
        console.error('Balance fetch failed:', error);
      }
    }, 1000),
    [account, client]
  );

  return {
    ...walletState,
    fetchBalance: debouncedFetchBalance,
  };
};
```

---

*These examples provide practical implementations for common Keeta wallet operations. Use them as starting points and adapt them to your specific needs.*
