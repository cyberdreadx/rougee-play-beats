# Phantom Wallet Auto-Opening Fix

## Issue

When logged in with Privy (email or embedded wallet), the SongTrade page was opening Phantom wallet when trying to buy/sell tokens. This created a confusing user experience where:

1. User logs in with Privy ✅
2. User navigates to SongTrade page ✅
3. User clicks "BUY" button ✅
4. **Phantom wallet popup appears** ❌ (unexpected!)

## Root Cause

The `ensureWagmiConnected()` function in `SongTrade.tsx` was prioritizing the **injected** connector (Phantom, MetaMask, etc.) over the Privy connector, even when the user was already authenticated with Privy.

### Before (Buggy Code)

```typescript
const ensureWagmiConnected = async () => {
  if (wagmiConnected) return;
  
  // Prioritize injected connector for external wallets (like Base wallet)
  const injected = connectors.find(c => c.id === 'injected');
  const privyConn = connectors.find(c => /privy/i.test(c.id) || /privy/i.test(c.name));
  const target = injected || privyConn || connectors[0]; // ❌ Always picks Phantom first!
  
  await connectAsync({ connector: target });
};
```

**Problem:** The code always tried to use `injected` first, which would be Phantom if installed, regardless of whether the user logged in with Privy.

## Solution

Modified the connector selection logic to **prioritize Privy** when the user is authenticated with Privy:

### After (Fixed Code)

```typescript
const ensureWagmiConnected = async () => {
  if (wagmiConnected) return;
  
  // When logged in with Privy, always use Privy connector
  // Only use injected connector if user is NOT authenticated with Privy
  const privyConn = connectors.find(c => /privy/i.test(c.id) || /privy/i.test(c.name));
  const injected = connectors.find(c => c.id === 'injected');
  
  // Prioritize Privy if user is connected via Privy, otherwise use injected
  const target = (isConnected && privyConn) ? privyConn : (injected || privyConn || connectors[0]);
  
  console.log('🔌 Connecting wagmi with:', target.name, target.id, 'Privy authenticated:', isConnected);
  
  await connectAsync({ connector: target });
};
```

**Fix:** 
- Check if user is authenticated with Privy (`isConnected`)
- If yes, use Privy connector
- If no, fall back to injected connector (for users connecting with external wallets)

## What Changed

**File:** `src/pages/SongTrade.tsx`  
**Function:** `ensureWagmiConnected()` (lines 103-125)

### Key Changes:
1. Reversed connector priority order
2. Added conditional logic based on Privy authentication state
3. Added debug logging to track which connector is being used

## Expected Behavior Now

### Scenario 1: Privy Login (Email or Embedded Wallet)
1. User logs in with Privy ✅
2. User clicks BUY/SELL ✅
3. **Privy wallet handles transaction** ✅ (no Phantom popup!)

### Scenario 2: External Wallet (MetaMask, Phantom, etc.)
1. User connects with external wallet ✅
2. User clicks BUY/SELL ✅
3. **External wallet handles transaction** ✅

## Why This Happened

The app has two wallet connection systems working together:
1. **Privy** - For authentication and embedded wallets
2. **Wagmi** - For blockchain interactions

The `usePrivyWagmi` hook (line 67) is supposed to automatically sync these, but there was a race condition or timing issue where `ensureWagmiConnected()` would run before the sync completed, causing it to grab whatever connector was available (Phantom in your case).

## Testing

To verify the fix works:

1. **With Privy Login:**
   - [ ] Log in with email
   - [ ] Go to any song trade page
   - [ ] Click BUY or SELL
   - [ ] Verify Privy wallet popup appears (NOT Phantom)
   - [ ] Complete a test transaction

2. **With External Wallet:**
   - [ ] Disconnect Privy
   - [ ] Connect with Phantom/MetaMask directly
   - [ ] Go to any song trade page
   - [ ] Click BUY or SELL
   - [ ] Verify Phantom/MetaMask popup appears
   - [ ] Complete a test transaction

## Additional Context

### Why Not Remove `ensureWagmiConnected`?

We keep this function because:
- It handles edge cases where wagmi isn't connected yet
- It provides explicit error handling
- It allows for chain switching before transactions
- `usePrivyWagmi` runs automatically but might not complete before user actions

### Related Code

- **`usePrivyWagmi` hook** (`src/hooks/usePrivyWagmi.ts`) - Automatically syncs Privy → Wagmi
- **`useWallet` hook** (`src/hooks/useWallet.ts`) - Provides Privy authentication state
- **`useSongBondingCurve` hooks** - Handle smart contract interactions

## Future Improvements

Consider these enhancements:

1. **Wait for `usePrivyWagmi` to complete** before allowing trades
   ```typescript
   const { isConnected: wagmiSynced } = usePrivyWagmi();
   if (!wagmiSynced) {
     return <LoadingState message="Connecting wallet..." />;
   }
   ```

2. **Add explicit connector status UI**
   ```typescript
   <div className="text-xs text-muted-foreground">
     Connected via: {wagmiConnected ? 'Wagmi' : 'Privy'} ({connectorName})
   </div>
   ```

3. **Disable trade buttons until sync completes**
   ```typescript
   <Button disabled={!wagmiConnected || isProcessing}>
     BUY
   </Button>
   ```

## Related Issues

This fix also resolves:
- Users seeing multiple wallet popups
- Transaction rejections due to wrong wallet
- Confusion about which wallet is being used

## Debug Logging

The fix includes a console log to help debug connector selection:

```
🔌 Connecting wagmi with: [connector name] [connector id] Privy authenticated: [true/false]
```

Check browser console to verify the correct connector is being used.

---

**Fixed:** [Date]  
**Related Files:** 
- `src/pages/SongTrade.tsx`
- `src/hooks/usePrivyWagmi.ts`
- `src/hooks/useWallet.ts`

