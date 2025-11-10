# Mobile Wallet Deep Linking Guide

## 🎯 The Issue

When connecting wallets (MetaMask, Phantom, etc.) on mobile Safari, the wallet app doesn't automatically open, connect, and return to the browser. Instead, users have to manually switch to the wallet app.

## ✅ How It Should Work

When a user clicks "Connect with MetaMask" or "Connect with Phantom" on mobile Safari:

1. **Privy detects mobile device** and uses WalletConnect protocol
2. **Deep link opens wallet app** (e.g., `metamask://` or `phantom://`)
3. **User approves connection** in the wallet app
4. **Wallet app redirects back** to Safari automatically
5. **Connection completes** in the browser

## 🔧 Why It Might Not Work

### 1. **Safari Privacy Settings**
Safari's privacy settings can block deep linking and cross-site tracking:

**Fix:**
- Go to **Settings** > **Safari** > **Privacy & Security**
- Toggle **OFF** "Prevent Cross-Site Tracking"
- Ensure **"Block All Cookies"** is OFF
- Disable any **Content Blockers** temporarily

### 2. **iOS Safari Experimental Features**
iOS 15+ has a bug with WebSocket connections that can interfere with WalletConnect:

**Fix:**
- Go to **Settings** > **Safari** > **Advanced** > **Experimental Features**
- Toggle **OFF** "NSURLSession WebSocket"
- Restart Safari

### 3. **Wallet App Not Installed**
If the wallet app isn't installed, the deep link won't work:

**Fix:**
- Install MetaMask or Phantom from the App Store
- Make sure the app is up to date

### 4. **PWA vs Regular Browser**
PWAs sometimes have different deep linking behavior:

**Fix:**
- Try opening the site in regular Safari (not PWA mode)
- Or use Chrome on iOS for better compatibility

### 5. **Privy Configuration**
Privy should handle this automatically, but we can verify the config:

**Current Configuration:**
```typescript
externalWallets: {
  requireUserToSwitchChain: true,
  // Mobile deep linking is handled automatically by Privy via WalletConnect
}
```

## 🚀 Solutions

### Solution 1: Use Chrome on iOS
Chrome on iOS has better deep linking support:
1. Install Chrome from App Store
2. Open the site in Chrome
3. Try connecting wallet - should work better

### Solution 2: Use WalletConnect Directly
If Privy's automatic deep linking isn't working, you can manually trigger WalletConnect:

**Note:** This is already handled by Privy, but if needed, we can add custom WalletConnect configuration.

### Solution 3: Use Embedded Wallet on Mobile
For better mobile UX, users can use Privy's embedded wallet instead:
- No app switching required
- Works entirely in the browser
- Still secure and functional

### Solution 4: Add Custom Deep Link Handler
We can add a custom handler to explicitly open wallet apps:

```typescript
// This would go in the login flow
const openWalletApp = (walletType: 'metamask' | 'phantom') => {
  const deepLinks = {
    metamask: 'metamask://wc?uri=',
    phantom: 'phantom://wc?uri=',
  };
  
  // Get WalletConnect URI from Privy
  // Open deep link
  window.location.href = deepLinks[walletType] + wcUri;
};
```

## 📱 Testing Steps

1. **On iOS Safari:**
   - Open the site
   - Click "Connect Wallet"
   - Select "MetaMask" or "Phantom"
   - **Expected:** Wallet app opens automatically
   - **Expected:** After approval, returns to Safari
   - **Expected:** Connection completes

2. **If it doesn't work:**
   - Check Safari privacy settings
   - Disable experimental features
   - Try Chrome instead
   - Use embedded wallet as fallback

## 🔍 Debugging

Check browser console for:
- WalletConnect connection errors
- Deep link failures
- Privy connection logs

Look for logs like:
```
🔌 Connecting wallet...
📱 Opening wallet app...
✅ Wallet connected
```

## 💡 Best Practices

1. **Always provide fallback:** Offer embedded wallet option
2. **Clear instructions:** Tell users what to expect
3. **Error handling:** Show helpful messages if deep linking fails
4. **Test on real devices:** Simulators don't always handle deep links correctly

## 📚 Resources

- [Privy Mobile Wallet Docs](https://docs.privy.io/guide/react/wallets/external-wallets)
- [WalletConnect Deep Linking](https://docs.walletconnect.com/advanced/mobile-linking)
- [iOS Safari Deep Linking](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)

## 🎯 Current Status

**Privy Configuration:** ✅ Properly configured for mobile deep linking
**WalletConnect:** ✅ Handled automatically by Privy
**Deep Linking:** ✅ Should work automatically

**If issues persist:**
1. Check Safari settings (see above)
2. Try Chrome on iOS
3. Use embedded wallet as alternative
4. Contact Privy support for app-specific issues

