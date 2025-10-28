# Testing the Tipping Feature

## Prerequisites

To test tipping, you need:

1. **A wallet connected to Base network**
2. **USDC on Base** - You can get testnet USDC or buy real USDC
3. **Some ETH on Base** - For gas fees (~$0.01-0.05 per transaction)

## Getting Test USDC on Base

### Option 1: Bridge from Ethereum/Other Chains
1. Go to https://bridge.base.org
2. Bridge USDC from Ethereum or another chain
3. Wait for bridge confirmation (~10 minutes)

### Option 2: Use a DEX
1. Go to Uniswap or another DEX on Base
2. Swap ETH → USDC
3. Confirm transaction

### Option 3: Buy Directly
1. Use a service like Moonpay or Transak
2. Buy USDC directly on Base network

## Step-by-Step Testing

### 1. Check Your Balance
```
Before testing:
- Open browser console (F12)
- Connect your wallet
- Go to any artist page
- Click "TIP ARTIST"
- Look for "Your USDC Balance" in the modal
```

### 2. Send a Small Test Tip
```
1. Select $1 or $5 (or less if testing)
2. Click "Send Tip"
3. Approve transaction in wallet popup
4. Wait for confirmation (5-10 seconds)
5. Check console logs for transaction details
```

### 3. Verify Transaction
```
After sending:
1. Success toast should show BaseScan link
2. Click link to see transaction on-chain
3. Verify:
   - Transaction status: Success ✓
   - From: Your wallet address
   - To: Artist's wallet address
   - Value: USDC amount you sent
```

### 4. Check Artist Received It
```
1. Copy artist wallet address
2. Go to https://basescan.org
3. Paste address and search
4. Look for USDC transfer in token transfers
5. Verify amount matches what you sent
```

## Common Issues & Solutions

### Issue: "Insufficient USDC Balance"
**Solution:** Get USDC on Base (see options above)

### Issue: "Network Error"
**Solution:** 
- Switch to Base network in your wallet
- Network name: Base
- RPC URL: https://mainnet.base.org
- Chain ID: 8453

### Issue: Transaction Rejected
**Solution:**
- Make sure you approve the transaction in wallet popup
- Check you have enough ETH for gas (~$0.01)

### Issue: Transaction Failed On-Chain
**Solution:**
- Check you have USDC balance
- Check you're on Base network
- Try smaller amount

## What Success Looks Like

✅ **Correct Flow:**
1. Click "TIP ARTIST"
2. See your USDC balance displayed
3. Select amount
4. Click "Send Tip"
5. Wallet popup appears
6. Approve transaction
7. See "Tip Initiated! 💸" toast
8. Wait 5-10 seconds
9. See "Tip Confirmed! ✅" toast with BaseScan link
10. Artist's wallet shows increased USDC balance

## Console Debugging

Look for these logs in browser console:

```javascript
🎯 Sending tip: {
  from: "0xYourAddress...",
  to: "0xArtistAddress...",
  amount: 5,
  amountInUSDC: "5000000", // 5 USDC with 6 decimals
  balance: "10000000" // Your balance
}
```

## Test Checklist

- [ ] Wallet connected to Base
- [ ] Have USDC on Base
- [ ] Have ETH for gas
- [ ] Can see USDC balance in modal
- [ ] Transaction approved in wallet
- [ ] Transaction confirmed on-chain
- [ ] Artist received USDC
- [ ] BaseScan link works

## Important Notes

⚠️ **This uses REAL money on Base mainnet!**
- Start with small amounts ($1-5)
- Transactions are irreversible
- Double-check recipient address
- Gas fees are separate from tip amount

## Need Help?

If something isn't working:
1. Check browser console for errors
2. Verify you're on Base network
3. Confirm USDC balance > tip amount
4. Make sure you have ETH for gas
5. Check transaction on BaseScan
