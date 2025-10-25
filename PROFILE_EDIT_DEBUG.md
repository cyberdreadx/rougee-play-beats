# ProfileEdit Wallet Connection Debug

## Issue
User reports "wallet not connected" error when saving artist profile, even though they are connected with Privy on mobile/PWA.

## Debugging Changes Made

### 1. Enhanced useWallet Hook Debugging
**File**: `src/hooks/useWallet.ts`
- Added comprehensive logging to track wallet connection state
- Logs show: ready, authenticated, user, address, linkedAccounts, walletAccount details
- Helps identify if the issue is in wallet detection or timing

### 2. Enhanced ProfileEdit Debugging  
**File**: `src/pages/ProfileEdit.tsx`
- Added detailed logging in `handleSubmit` function
- Shows: fullAddress, isConnected, isPrivyReady, wagmiConnected status
- Added retry mechanism with 1-second delay for timing issues
- Better error messages to distinguish between "not connected" vs "connection issue"

### 3. Retry Mechanism
If the wallet appears connected (`isConnected && isPrivyReady`) but `fullAddress` is still null:
1. Wait 1 second for wallet state to stabilize
2. Re-check the address
3. If still no address, show "connection issue" message suggesting page refresh

## How to Test

1. **Open browser console** on mobile/PWA
2. **Navigate to ProfileEdit page** 
3. **Try to save profile** - watch console logs
4. **Look for these debug messages**:
   - `🔍 useWallet debug:` - Shows wallet connection state
   - `🔍 ProfileEdit handleSubmit debug:` - Shows form submission state
   - `⏳ Wallet appears connected but address not available, waiting...` - Retry mechanism

## Expected Debug Output

### Normal Case (Working)
```
🔍 useWallet debug: {
  ready: true,
  authenticated: true,
  hasUser: true,
  address: "0x1234...5678",
  fullAddress: "0x1234...5678",
  linkedAccounts: 1,
  walletAccount: { type: "embedded_wallet", address: "0x1234...5678" }
}

🔍 ProfileEdit handleSubmit debug: {
  fullAddress: "0x1234...5678",
  isConnected: true,
  isPrivyReady: true,
  wagmiConnected: true,
  hasPrivyWagmi: true
}
```

### Problem Case (Not Working)
```
🔍 useWallet debug: {
  ready: true,
  authenticated: true,
  hasUser: true,
  address: undefined,
  fullAddress: undefined,
  linkedAccounts: 1,
  walletAccount: null
}

❌ Wallet not connected - fullAddress is: undefined
⏳ Wallet appears connected but address not available, waiting...
❌ Still no address after delay
```

## Next Steps Based on Debug Output

### If `walletAccount` is null but `linkedAccounts` > 0:
- The wallet detection logic needs improvement
- Check if the account type is not being recognized

### If `walletAccount` exists but `address` is undefined:
- The wallet object structure might be different
- Need to check the actual wallet object structure

### If everything looks correct but still fails:
- There might be a timing issue with Privy/wagmi sync
- The retry mechanism should help with this

## Files Modified
- `src/hooks/useWallet.ts` - Added comprehensive debugging
- `src/pages/ProfileEdit.tsx` - Added retry mechanism and detailed logging

## Related Issues
This is the same pattern as the SendTokenDialog issue we just fixed - Privy's embedded wallet not being properly synced with wagmi on mobile/PWA.
