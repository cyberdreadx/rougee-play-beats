# Keeta SDK Quick Reference

## 🚀 Quick Start

```typescript
import { UserClient, lib } from '@keetanetwork/keetanet-client';
const { Account } = lib;
```

## 🔑 Account Operations

### Create New Wallet
```typescript
const seed = Account.generateRandomSeed();
const account = Account.fromSeed(seed, 0, Account.AccountKeyAlgorithm.ED25519);
const address = account.publicKeyString.get();
const privateKey = Buffer.from(seed).toString('hex'); // Store seed as private key
```

### Import Wallet
```typescript
// From mnemonic
const seed = Account.seedFromPassphrase(mnemonic);
const account = Account.fromSeed(seed, 0, Account.AccountKeyAlgorithm.ED25519);

// From private key
const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
const account = Account.fromED25519PrivateKey(privateKeyBuffer);
```

## 🌐 Network Operations

### Initialize Client
```typescript
const client = await UserClient.fromNetwork('test'); // or 'main'
```

### Check Balance
```typescript
const balance = await client.balance(account);
const allBalances = await client.allBalances(account);
```

### Send Transactions
```typescript
// Connect to network with account
const client = UserClient.fromNetwork('main', account);

// Start building a transaction
const builder = client.initBuilder();

// Create recipient account
const recipientAccount = Account.fromPublicKeyString(recipientAddress);

// Add send operation
builder.send(recipientAccount, BigInt(amount), client.baseToken); // For native KEETA
// or
builder.send(recipientAccount, BigInt(amount), tokenAddress); // For specific token

// Compute and publish transaction
const computed = await client.computeBuilderBlocks(builder);
const transaction = await client.publishBuilder(builder);
```

## 📋 Common Patterns

### Wallet State Management
```typescript
interface KeetaWalletState {
  address: string | null;
  isConnected: boolean;
  balance: string;
  tokens: KeetaToken[];
  mnemonic: string | null;
  privateKey: string | null;
}
```

### Error Handling
```typescript
try {
  const balance = await client.balance(account);
} catch (error) {
  console.error('Keeta error:', error.message);
}
```

## ⚠️ Important Notes

- **Non-EVM**: Keeta is not EVM-compatible
- **Address Format**: Uses public key strings, not 0x addresses
- **Key Types**: Supports ED25519, ECDSA SECP256K1, ECDSA SECP256R1
- **Client Usage**: Pass account to methods, not to constructor

## 🔧 Troubleshooting

| Error | Solution |
|-------|----------|
| `Account is undefined` | Import from `lib`: `const { Account } = lib;` |
| `hasPrivateKey` error | Don't pass account to `UserClient.fromNetwork()` |
| Invalid key format | Use correct key type method |
| Network errors | Check RPC endpoints and connectivity |

## 📚 Full Documentation

See [KEETA_SDK_REFERENCE.md](./KEETA_SDK_REFERENCE.md) for complete API documentation.
