# Keeta SDK Reference Documentation

## Overview
This document provides a comprehensive reference for the Keeta SDK (`@keetanetwork/keetanet-client`) based on actual API exploration and implementation.

## Installation
```bash
npm install @keetanetwork/keetanet-client
```

## Version
- **Current Version**: 0.14.11
- **Last Updated**: December 2024

---

## Core Exports

### Main Exports
```typescript
import { UserClient, lib } from '@keetanetwork/keetanet-client';

// Available exports:
// - UserClient: Main client for network operations
// - lib: Contains core classes and utilities
// - blockGenerator: Block generation utilities
// - emitBlocks: Block emission functions
```

### Library Components (`lib`)
```typescript
const { 
  Account,      // Account management
  Block,        // Block operations
  Error,        // Error handling
  Ledger,       // Ledger operations
  Log,          // Logging utilities
  Node,         // Node management
  P2P,          // Peer-to-peer networking
  Permissions,  // Permission management
  Stats,        // Statistics
  Vote,         // Voting mechanisms
  Utils         // Utility functions
} = lib;
```

---

## Account Management

### Account Class
The `Account` class is the core component for wallet management in Keeta.

#### Static Methods
```typescript
// Key generation
Account.generateRandomSeed(): Buffer
Account.seedFromPassphrase(passphrase: string): Buffer

// Account creation
Account.fromSeed(seed: Buffer, index: number, keyType?: AccountKeyAlgorithm): Account
Account.fromED25519PrivateKey(privateKey: Buffer): Account
Account.fromECDSASECP256K1PrivateKey(privateKey: Buffer): Account
Account.fromECDSASECP256R1PrivateKey(privateKey: Buffer): Account

// Public key operations
Account.fromED25519PublicKey(publicKey: Buffer): Account
Account.fromECDSASECP256K1PublicKey(publicKey: Buffer): Account
Account.fromECDSASECP256R1PublicKey(publicKey: Buffer): Account
Account.fromPublicKeyString(publicKeyString: string): Account
Account.fromPublicKeyAndType(publicKey: Buffer, keyType: string): Account

// Address generation
Account.generateNetworkAddress(): string
Account.generateBaseAddresses(): string[]
```

#### Instance Methods
```typescript
// Key operations
account.publicKeyString.get(): string
account.publicKey(): Buffer
account._getPrivateKey(): Buffer
account.keyType(): string

// Signing and verification
account.sign(data: Buffer): Buffer
account.verify(data: Buffer, signature: Buffer): boolean

// Encryption (if supported)
account.encrypt(data: Buffer): Buffer
account.decrypt(encryptedData: Buffer): Buffer
account.supportsEncryption(): boolean

// Validation
account.isIdentifier(): boolean
account.isAccount(): boolean
account.isKeyType(keyType: string): boolean
account.isStorage(): boolean
account.isNetwork(): boolean
account.isToken(): boolean
account.isMultisig(): boolean

// Utility
account.toJSON(): object
account.generateIdentifier(): string
```

---

## UserClient API

### Initialization
```typescript
// Create client for testnet
const client = await UserClient.fromNetwork('test');

// Create client for mainnet
const client = await UserClient.fromNetwork('main');
```

### Balance Operations
```typescript
// Get account balance
const balance = await client.balance(account);

// Get all token balances
const balances = await client.allBalances(account);
```

### Transaction Operations
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

### Network Information
```typescript
// Get current head block
const head = await client.head();

// Get specific block
const block = await client.block(blockId);

// Get account chain
const chain = await client.chain(account);

// Get transaction history
const history = await client.history(account);
```

### Advanced Operations
```typescript
// Token supply management (admin only)
await client.modTokenSupplyAndBalance(tokenAddress, supplyChange, balanceChange);

// Permission management
await client.updatePermissions(account, permissions);

// Certificate operations
await client.modifyCertificate(certificate);
const certificates = await client.getCertificates(account);

// Swap operations
const swapRequest = await client.createSwapRequest(swapData);
await client.acceptSwapRequest(swapRequestId);
```

---

## Implementation Examples

### Creating a New Wallet
```typescript
import { UserClient, lib } from '@keetanetwork/keetanet-client';
const { Account } = lib;

// Generate new wallet
const seed = Account.generateRandomSeed();
const account = Account.fromSeed(seed, 0, Account.AccountKeyAlgorithm.ED25519);
const address = account.publicKeyString.get();
const privateKey = Buffer.from(seed).toString('hex'); // Store seed as private key

// Store for later use
const walletData = {
  address,
  privateKey,
  seed: seed.toString('hex')
};
```

### Importing Existing Wallet
```typescript
// From mnemonic/passphrase
const mnemonic = "your 24 word mnemonic phrase here";
const seed = Account.seedFromPassphrase(mnemonic);
const account = Account.fromSeed(seed, 0, Account.AccountKeyAlgorithm.ED25519);

// From private key
const privateKeyHex = "your_private_key_hex";
const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
const account = Account.fromED25519PrivateKey(privateKeyBuffer);
```

### Checking Balance
```typescript
const client = await UserClient.fromNetwork('test');
const account = Account.fromED25519PrivateKey(privateKeyBuffer);

// Get native KEETA balance
const balance = await client.balance(account);

// Get all token balances
const allBalances = await client.allBalances(account);
```

### Sending Transactions
```typescript
const client = await UserClient.fromNetwork('test');
const account = Account.fromED25519PrivateKey(privateKeyBuffer);

// Send native KEETA
await client.send(account, recipientAddress, amount);

// Send specific token
await client.send(account, recipientAddress, amount, tokenAddress);
```

---

## Network Configuration

### Supported Networks
- **test**: Keeta testnet
- **main**: Keeta mainnet

### RPC Endpoints
```typescript
// Testnet
const testnetRpc = 'https://keeta.network/testnet/rpc';

// Mainnet  
const mainnetRpc = 'https://keeta.network/mainnet/rpc';
```

---

## Error Handling

### Common Error Types
```typescript
try {
  const balance = await client.balance(account);
} catch (error) {
  if (error.message.includes('network')) {
    // Network connectivity issues
  } else if (error.message.includes('insufficient')) {
    // Insufficient balance
  } else if (error.message.includes('invalid')) {
    // Invalid account or parameters
  }
}
```

---

## Key Differences from EVM

### 1. Account Structure
- **EVM**: Uses 20-byte addresses (0x...)
- **Keeta**: Uses public key strings as addresses

### 2. Private Key Format
- **EVM**: 32-byte private keys
- **Keeta**: Various key types (ED25519, ECDSA SECP256K1, ECDSA SECP256R1)

### 3. Transaction Model
- **EVM**: Gas-based transactions
- **Keeta**: Different fee model (TBD)

### 4. Client Initialization
- **EVM**: Requires provider and signer
- **Keeta**: Account passed to individual methods

---

## Best Practices

### 1. Key Management
```typescript
// Always use proper key derivation
const seed = Account.generateRandomSeed();
const account = Account.fromSeed(seed);

// Store securely
const privateKey = Buffer.from(seed).toString('hex'); // Store seed as private key
// Store in encrypted format, not plain text
```

### 2. Error Handling
```typescript
// Always wrap network calls in try-catch
try {
  const result = await client.balance(account);
} catch (error) {
  console.error('Network error:', error);
  // Handle gracefully
}
```

### 3. Network Selection
```typescript
// Use testnet for development
const client = await UserClient.fromNetwork('test');

// Switch to mainnet for production
const client = await UserClient.fromNetwork('main');
```

### 4. Account Validation
```typescript
// Always validate account before use
if (!account || !account.isAccount()) {
  throw new Error('Invalid account');
}
```

---

## Troubleshooting

### Common Issues

1. **"Account is undefined"**
   - Solution: Import from `lib` export: `const { Account } = lib;`

2. **"can't access property 'hasPrivateKey'"**
   - Solution: Don't pass account to `UserClient.fromNetwork()`

3. **"Invalid private key format"**
   - Solution: Use correct key type method (`fromED25519PrivateKey`, etc.)

4. **Network connection errors**
   - Solution: Check network availability and RPC endpoints

---

## Future Updates

This documentation should be updated when:
- New SDK versions are released
- New API methods are added
- Network configuration changes
- Breaking changes are introduced

---

## Resources

- **Official Documentation**: [Keeta Network Docs](https://docs.keeta.network)
- **GitHub Repository**: [keeta-cli](https://github.com/rougecoin-project/keeta-cli)
- **SDK Package**: [@keetanetwork/keetanet-client](https://www.npmjs.com/package/@keetanetwork/keetanet-client)

---

*Last Updated: December 2024*
*SDK Version: 0.14.11*
