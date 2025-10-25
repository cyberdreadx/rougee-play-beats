# Send Token & PWA Update Modal Fixes

## Issues Fixed

### 1. PWA Update Modal Behind Mobile Navigation
**Problem**: The PWA update prompt had `z-50` which was the same z-index as the mobile navigation, causing it to appear behind the nav bar on mobile.

**Solution**: Changed the z-index from `z-50` to `z-[9999]` in `src/components/PWAUpdatePrompt.tsx` to ensure it always appears on top of all other UI elements.

```typescript
// Before
<div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5">

// After
<div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] animate-in slide-in-from-bottom-5">
```

### 2. Send Token Button Not Triggering Privy Wallet
**Problem**: When clicking the "Send" button in the SendTokenDialog, nothing happened - the Privy wallet didn't open to approve the transaction. This was the same issue as the artist profile save bug.

**Root Cause**: The dialog was using wagmi's `useAccount` and `useWriteContract` hooks, but Privy's embedded wallet wasn't synced with wagmi's context. Without this sync, wagmi doesn't know about the Privy wallet, so transactions can't be initiated.

**Solution**: 
1. Added `usePrivyWagmi()` hook to sync Privy's embedded wallet with wagmi
2. Added comprehensive error handling and logging
3. Made the `writeContract` call awaited for better error catching

**Changes in `src/components/SendTokenDialog.tsx`**:

```typescript
// Added import
import { usePrivyWagmi } from '@privy-io/wagmi';

// Added in component
const { wallet: privyWallet } = usePrivyWagmi();

// Enhanced writeContract with logging
console.log('🔄 Initiating token transfer:', {
  tokenAddress,
  tokenSymbol,
  recipient: recipientAddress,
  amount: amountNum,
  accountAddress,
  privyWallet: privyWallet?.address,
});

await writeContract({
  account: accountAddress,
  chain: chain,
  address: tokenAddress,
  abi: ERC20_ABI,
  functionName: 'transfer',
  args: [recipientAddress as Address, amountInWei],
});

// Added separate error handling effect
useEffect(() => {
  if (writeError) {
    console.error('❌ Write contract error:', writeError);
    toast({
      title: "Transaction failed",
      description: writeError.message || "Failed to send tokens",
      variant: "destructive",
    });
  }
}, [writeError]);
```

## How It Works Now

### PWA Update Flow
1. When a new version is detected, the update prompt appears with `z-[9999]`
2. The prompt is now always visible above the mobile navigation
3. Users can click "Update Now" to trigger the update or "Later" to dismiss

### Send Token Flow
1. User selects a song token and clicks "Send"
2. SendTokenDialog opens with username search functionality
3. User enters recipient (by username or wallet address) and amount
4. When clicking "Send", Privy's embedded wallet is now properly recognized by wagmi
5. The transaction is initiated and Privy's wallet UI appears to approve
6. After approval, the transaction is sent on-chain
7. Success toast appears and the dialog closes

### Balance Validation Fix
**Problem**: The balance was being passed in wei (18 decimals) but compared as token units, causing "insufficient balance" errors even when the user had enough tokens.

**Solution**: Added proper conversion from wei to token units for balance validation:
```typescript
// Convert maxBalance from wei to token units for comparison
const maxBalanceInTokens = parseFloat(maxBalance) / Math.pow(10, tokenDecimals);

if (amountNum > maxBalanceInTokens) {
  // Show proper error with actual token balance
}
```

This ensures the balance validation works correctly with ERC20 tokens that have 18 decimals.

## Testing Notes

### Test PWA Update
1. On mobile/PWA, scroll down to show mobile nav
2. Trigger an update (by incrementing VERSION in `public/sw.js`)
3. The update prompt should appear above the mobile navigation

### Test Send Token
1. On mobile/PWA, go to Wallet page
2. Find a song token you own and click "Send"
3. Search for a user or enter a wallet address
4. Enter an amount and click "Send"
5. Privy wallet should open to approve the transaction
6. After approval, transaction should be sent and confirmed

## Files Modified
- `src/components/PWAUpdatePrompt.tsx` - Increased z-index to z-[9999]
- `src/components/SendTokenDialog.tsx` - Added Privy/wagmi sync with usePrivyWagmi()

## Related Issues
This is the same pattern we've seen before:
- Artist profile save button (fixed in `src/pages/ProfileEdit.tsx`)
- Any form/action that requires wallet interaction needs `usePrivyWagmi()` on mobile/PWA

The `usePrivyWagmi()` hook is critical for ensuring Privy's embedded wallet is available to wagmi's hooks like `useWriteContract`, `useReadContract`, etc.

