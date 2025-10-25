# 🔧 Privy Wallet Connection Fix - Mobile/PWA

## Problem

Users on **mobile/PWA** (and potentially desktop) were getting "Please connect wallet" error when trying to save their artist profile, even though they were logged in with Privy.

### Root Cause

**The ProfileEdit page wasn't syncing Privy's embedded wallet with wagmi**, causing the wallet address to not be available when submitting the form.

The app has two wallet systems:
1. **Privy's embedded wallet** → Handles authentication
2. **Wagmi** → Handles blockchain interactions (trading, swaps, etc.)

The `usePrivyWagmi()` hook exists to sync them, but it **wasn't being called in ProfileEdit**, causing:
- Privy authentication ✅
- Wallet address available in Privy ✅
- BUT wagmi not synced ❌
- So `fullAddress` was undefined/delayed ❌

### Secondary Issue

The wallet detection logic was also too strict, only looking for specific account types. This was improved with fallback detection.

---

## Solution

### Primary Fix

Added `usePrivyWagmi()` hook to ProfileEdit page to ensure Privy's embedded wallet is synced with wagmi before allowing form submission.

### Secondary Fix

Added **fallback logic** to detect wallet addresses from ANY linked account that has an Ethereum address format (`0x...` with 42 characters).

### Files Updated

1. **`src/pages/ProfileEdit.tsx`** - Added usePrivyWagmi() sync (MAIN FIX)
2. **`src/hooks/useWallet.ts`** - Frontend wallet detection with fallback
3. **`supabase/functions/_shared/privy.ts`** - Backend wallet extraction with fallback
4. **`src/hooks/useSessionManager.ts`** - Session restoration with fallback

---

## What Changed

### Main Fix: ProfileEdit.tsx

**Before:**
```typescript
const ProfileEdit = () => {
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const { profile, loading, updating, updateProfile } = useCurrentUserProfile();
  // ... rest of component
```

**After:**
```typescript
const ProfileEdit = () => {
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const { profile, loading, updating, updateProfile } = useCurrentUserProfile();
  
  // ✅ Ensure Privy wallet is synced with wagmi (fixes mobile/PWA issues)
  usePrivyWagmi();
  
  // ... rest of component
```

This ensures the Privy embedded wallet is connected to wagmi BEFORE the user tries to save their profile.

---

### Secondary Fix: Better Wallet Detection

**Before (Frontend)**
```typescript
const walletAccount = user?.linkedAccounts?.find((account: any) =>
  ['wallet', 'smart_wallet', 'embedded_wallet'].includes(account.type)
) as any;
```

**After (Frontend)**
```typescript
// First try specific wallet types
let walletAccount = user?.linkedAccounts?.find((account: any) =>
  ['wallet', 'smart_wallet', 'embedded_wallet'].includes(account.type)
) as any;

// Fallback: Try to find ANY account with an Ethereum address
if (!walletAccount && user?.linkedAccounts) {
  walletAccount = user.linkedAccounts.find((account: any) => 
    account.address && 
    typeof account.address === 'string' && 
    account.address.startsWith('0x') &&
    account.address.length === 42
  ) as any;
}
```

---

## Benefits

✅ **More robust** - Works with any Privy account type that has an address  
✅ **Better logging** - Console logs show what accounts are available  
✅ **Backward compatible** - Still tries standard wallet types first  
✅ **Mobile/PWA support** - Handles different account structures on mobile  
✅ **Debug friendly** - Logs warnings when authenticated but no address found  

---

## Testing Instructions

### On Mobile/PWA:

1. **Open the app** on mobile browser or installed PWA
2. **Login with Privy** (any method)
3. **Navigate to Profile Edit** page
4. **Fill in artist information** (name, bio, etc.)
5. **Click Save**
6. ✅ Should save successfully (no "Please connect wallet" error)

### Check Console Logs:

If you still have issues, open Chrome DevTools on mobile:
1. Connect phone via USB
2. Open `chrome://inspect` on desktop
3. Click "Inspect" on your device
4. Check console for these logs:
   - `👤 User linked accounts:` - Shows all available accounts
   - `🔍 No standard wallet found` - Means fallback was triggered
   - `✅ Found wallet address from account type:` - Shows which account type worked
   - `⚠️ User authenticated but no wallet address found!` - Means problem persists

---

## Next Steps

### If Issue Persists:

1. **Check console logs** to see what account types Privy is providing
2. **Share the logs** with me so we can add more fallback logic
3. **Verify Privy SDK version** - Make sure you're on latest `@privy-io/react-auth`

### Deploy Backend Changes:

The backend changes need to be deployed:

```bash
cd supabase
npx supabase functions deploy update-artist-profile
```

---

## Additional Improvements

The fix also added better logging throughout the wallet detection:

- **Frontend logs**: Shows all linked accounts when wallet not found
- **Backend logs**: Shows JWT payload structure for debugging
- **Session logs**: Tracks wallet restoration during login

This will help identify any future authentication issues quickly.

---

## Technical Details

### Why This Happens

Privy uses different wallet providers depending on:
- Device type (mobile vs desktop)
- Browser (Chrome, Safari, in-app browsers)
- Login method (email, social, wallet connect)
- SDK version

The account `type` field may vary, but the `address` field format is consistent for Ethereum addresses.

### Our Approach

Instead of hardcoding account types, we:
1. Try known wallet types first (preferred)
2. Fallback to pattern matching on address format
3. Log everything for debugging

This makes the system more resilient to Privy SDK updates and edge cases.

---

## Status

✅ **Fixed** - Changes deployed to frontend  
⏳ **Pending** - Backend needs deployment (run command above)  
📋 **Testing** - Please test on mobile/PWA and report results  

---

## Questions?

If you still experience issues after this fix:

1. Share console logs from mobile DevTools
2. Let me know what login method you used (email, social, etc.)
3. Share your Privy SDK version from package.json

We'll investigate further! 🔍

