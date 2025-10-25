# Send Token Balance Display Fix

## Issue
When clicking "Send" on a song token in the wallet, the SendTokenDialog modal shows "0 tokens" even though the wallet shows a balance.

## Root Cause
The balance was being converted from wei to tokens in the `SongTokenItem` component, but then passed as a string to the `SendTokenDialog`. However, the `SendTokenDialog` expected the balance in wei format for its internal calculations.

### The Problem Flow:
1. **SongTokenItem**: `balance = Number(balanceData) / 1e18` (converts wei to tokens)
2. **Pass to SendTokenDialog**: `onSendClick(song, balance.toString())` (passes token amount as string)
3. **SendTokenDialog**: Expects wei format, converts again: `parseFloat(maxBalance) / Math.pow(10, tokenDecimals)`
4. **Result**: Double conversion = 0 tokens

## Solution
Pass the raw wei balance directly to the SendTokenDialog instead of the converted token amount.

### Changes Made:

**File**: `src/pages/Wallet.tsx`
```typescript
// Before
onSendClick(song, balance.toString());

// After  
const rawBalance = balanceData ? balanceData.toString() : '0';
onSendClick(song, rawBalance);
```

**File**: `src/components/SendTokenDialog.tsx`
- Added debug logging to show what balance is received
- Shows both raw wei balance and converted token amount

## How It Works Now

### Before (Broken):
1. Balance: `1000000000000000000` wei (1 token)
2. SongTokenItem converts: `1000000000000000000 / 1e18 = 1` token
3. Passes to SendTokenDialog: `"1"`
4. SendTokenDialog converts again: `1 / 1e18 = 0.000000000000000001` tokens
5. **Result**: Shows 0 tokens ❌

### After (Fixed):
1. Balance: `1000000000000000000` wei (1 token)
2. SongTokenItem passes raw: `"1000000000000000000"`
3. SendTokenDialog converts once: `1000000000000000000 / 1e18 = 1` token
4. **Result**: Shows 1 token ✅

## Testing

1. **Go to Wallet page**
2. **Find a song token you own**
3. **Click "Send"**
4. **Check the debug console** - should show:
   ```
   🔍 SendTokenDialog received: {
     maxBalance: "1000000000000000000",
     maxBalanceInTokens: 1
   }
   ```
5. **Available balance should show correctly** (e.g., "Available: 1.0000 WATER")

## Files Modified
- `src/pages/Wallet.tsx` - Pass raw wei balance instead of converted tokens
- `src/components/SendTokenDialog.tsx` - Added debug logging

## Related Issues
This was the same type of balance conversion issue we fixed earlier in the SendTokenDialog validation logic. The key is ensuring consistent handling of wei vs token amounts throughout the flow.
