# 🎵 Ad-Supported Free + Premium Model for ROUGEE.PLAY

## 🎯 Core Concept

**Free streaming with ads** + **Premium access** via:
1. Pay monthly fee (USDC via x402)
2. Hold XRGE tokens (stake-based)

This combines traditional streaming economics with Web3 token utility!

---

## 📊 The Three-Tier Model

```
┌──────────────────────────────────────────────────────┐
│                    USER TIERS                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🆓 FREE TIER                                        │
│  ├─ Unlimited streaming                             │
│  ├─ 15-30 second ads every ~2 minutes               │
│  ├─ Standard quality (128kbps)                      │
│  └─ Limited skips (6 per hour)                      │
│                                                      │
│  💎 PREMIUM (Paid)                                   │
│  ├─ $4.99 USDC/month via x402                       │
│  ├─ No ads                                          │
│  ├─ High quality (320kbps)                          │
│  ├─ Unlimited skips                                 │
│  └─ Offline downloads                               │
│                                                      │
│  🪙 XRGE HOLDERS (Token-Gated)                      │
│  ├─ Hold 1000+ XRGE tokens                          │
│  ├─ No ads (as long as you hold)                   │
│  ├─ High quality (320kbps)                          │
│  ├─ Unlimited skips                                 │
│  ├─ Priority features                               │
│  └─ Governance voting rights                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 💰 Pricing Strategy

### XRGE Holding Tiers

| Tier | XRGE Required | Benefits |
|------|---------------|----------|
| 🥉 Bronze | 100 XRGE | 50% fewer ads |
| 🥈 Silver | 500 XRGE | No ads, standard quality |
| 🥇 Gold | 1,000 XRGE | No ads, high quality, unlimited skips |
| 💎 Platinum | 5,000 XRGE | All Gold + priority support + exclusive drops |

### Premium Subscription (x402)

| Duration | Price (USDC) | Savings |
|----------|--------------|---------|
| Monthly | $4.99 | - |
| 3 Months | $12.99 | 13% off |
| Yearly | $49.99 | 17% off |

---

## 🎵 Ad Implementation

### Ad Frequency
```typescript
// Free tier ad schedule
const AD_CONFIG = {
  minTimeBetweenAds: 120, // 2 minutes (120 seconds)
  maxTimeBetweenAds: 180, // 3 minutes (180 seconds)
  adDuration: 15, // 15-30 second ads
  skippableAfter: 5, // Can skip after 5 seconds
};

// Example: 3-minute song
// Play 0:00 - 2:00 → Ad (15s) → Resume 2:00 - 3:00 → Next song
```

### Ad Types
1. **Audio Ads** - 15-30 second audio spots
2. **Banner Ads** - Visual ads during playback
3. **Artist Promotion** - Internal platform promo (artists can pay to promote their music)
4. **Sponsored Songs** - "This song brought to you by..."

### Ad Revenue Split
```
Ad Revenue Distribution:
├─ 40% to Artist (song being played)
├─ 30% to Platform
├─ 20% to XRGE Buyback & Burn
└─ 10% to Liquidity Pool
```

---

## 🛠️ Technical Implementation

### Step 1: Ad Detection in Audio Player

Update `src/components/AudioPlayer.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { useX402 } from '@/contexts/X402Context';
import { useXRGEBalance } from '@/hooks/useXRGEBalance';

interface AdConfig {
  enabled: boolean;
  lastAdTime: number;
  minInterval: number;
}

export const AudioPlayer = ({ song }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [adPlaying, setAdPlaying] = useState(false);
  const [adConfig, setAdConfig] = useState<AdConfig>({
    enabled: true,
    lastAdTime: 0,
    minInterval: 120, // 2 minutes
  });
  
  const { isPremiumSubscriber } = useX402();
  const { xrgeBalance } = useXRGEBalance();
  
  // Check if user qualifies for ad-free
  const isAdFree = isPremiumSubscriber || xrgeBalance >= 1000;
  
  useEffect(() => {
    if (!audioRef.current || isAdFree) return;
    
    const checkForAd = () => {
      const timeSinceLastAd = currentTime - adConfig.lastAdTime;
      
      // Play ad every ~2 minutes
      if (timeSinceLastAd >= adConfig.minInterval) {
        pauseSongAndPlayAd();
      }
    };
    
    checkForAd();
  }, [currentTime, isAdFree]);
  
  const pauseSongAndPlayAd = async () => {
    // Pause current song
    audioRef.current?.pause();
    
    // Play ad
    setAdPlaying(true);
    const ad = await fetchAd();
    await playAd(ad);
    
    // Resume song
    setAdPlaying(false);
    setAdConfig(prev => ({ ...prev, lastAdTime: currentTime }));
    audioRef.current?.play();
  };
  
  const fetchAd = async () => {
    const response = await fetch('/functions/v1/get-audio-ad', {
      method: 'POST',
      body: JSON.stringify({
        songId: song.id,
        userTier: isAdFree ? 'premium' : 'free',
      })
    });
    return response.json();
  };
  
  const playAd = async (ad: any) => {
    return new Promise((resolve) => {
      const adAudio = new Audio(ad.audioUrl);
      adAudio.play();
      adAudio.onended = resolve;
    });
  };
  
  return (
    <div className="audio-player">
      {adPlaying && (
        <div className="ad-overlay">
          <p>🎵 Advertisement</p>
          <p className="text-sm">
            Want ad-free? 
            <button onClick={() => showPremiumModal()}>
              Subscribe for $4.99/mo
            </button>
            or
            <button onClick={() => showXRGEModal()}>
              Hold 1000 XRGE
            </button>
          </p>
        </div>
      )}
      
      <audio ref={audioRef} src={song.audioUrl} />
      
      {/* Player controls */}
    </div>
  );
};
```

---

### Step 2: Premium Subscription via x402

Create `src/components/PremiumSubscriptionModal.tsx`:

```typescript
import { useState } from 'react';
import { useX402 } from '@/contexts/X402Context';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export const PremiumSubscriptionModal = ({ open, onClose }) => {
  const { payViaX402, verifyPayment } = useX402();
  const [processing, setProcessing] = useState(false);
  
  const SUBSCRIPTION_PLANS = [
    { duration: 'monthly', price: 4.99, label: '1 Month', savings: null },
    { duration: '3months', price: 12.99, label: '3 Months', savings: '13% off' },
    { duration: 'yearly', price: 49.99, label: '1 Year', savings: '17% off' },
  ];
  
  const handleSubscribe = async (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    setProcessing(true);
    
    try {
      // Pay via x402
      const txHash = await payViaX402(plan.price, {
        type: 'premium_subscription',
        duration: plan.duration,
      });
      
      // Verify payment
      const verified = await verifyPayment(txHash);
      
      if (verified) {
        // Activate premium subscription
        await activateSubscription(plan.duration, txHash);
        
        toast({
          title: "Welcome to Premium! 🎉",
          description: `Ad-free music for ${plan.label}`,
        });
        
        onClose();
        
        // Reload to update user tier
        window.location.reload();
      }
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };
  
  const activateSubscription = async (duration: string, txHash: string) => {
    await fetch('/functions/v1/activate-premium-subscription', {
      method: 'POST',
      body: JSON.stringify({
        duration,
        transactionHash: txHash,
      })
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="premium-modal">
        <h2>🎵 ROUGEE Premium</h2>
        <p className="text-muted-foreground">
          Enjoy ad-free music, high quality audio, and unlimited skips
        </p>
        
        <div className="plans-grid">
          {SUBSCRIPTION_PLANS.map(plan => (
            <div key={plan.duration} className="plan-card">
              <h3>{plan.label}</h3>
              <p className="price">${plan.price} USDC</p>
              {plan.savings && (
                <span className="badge">{plan.savings}</span>
              )}
              
              <Button
                onClick={() => handleSubscribe(plan)}
                disabled={processing}
                className="w-full"
              >
                {processing ? 'Processing...' : 'Subscribe'}
              </Button>
            </div>
          ))}
        </div>
        
        <div className="divider">OR</div>
        
        <div className="xrge-option">
          <h3>🪙 Hold 1000 XRGE for Free Premium</h3>
          <p>No monthly payments - just hold tokens!</p>
          <Button variant="outline" onClick={() => window.location.href = '/wallet'}>
            Get XRGE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

---

### Step 3: XRGE Balance Checker

Create `src/hooks/useXRGEBalance.ts`:

```typescript
import { useState, useEffect } from 'react';
import { useWallet } from './useWallet';
import { readContract } from 'wagmi/actions';

const XRGE_CONTRACT = '0x147120faEC9277ec02d957584CFCD92B56A24317';
const XRGE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  }
];

export const useXRGEBalance = () => {
  const { fullAddress } = useWallet();
  const [xrgeBalance, setXrgeBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (fullAddress) {
      fetchBalance();
    }
  }, [fullAddress]);
  
  const fetchBalance = async () => {
    setLoading(true);
    
    try {
      const balance = await readContract({
        address: XRGE_CONTRACT,
        abi: XRGE_ABI,
        functionName: 'balanceOf',
        args: [fullAddress],
      });
      
      // Convert from wei to tokens (assuming 18 decimals)
      const balanceInTokens = Number(balance) / 1e18;
      setXrgeBalance(balanceInTokens);
    } catch (error) {
      console.error('Failed to fetch XRGE balance:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getTierFromBalance = (balance: number) => {
    if (balance >= 5000) return 'platinum';
    if (balance >= 1000) return 'gold';
    if (balance >= 500) return 'silver';
    if (balance >= 100) return 'bronze';
    return 'free';
  };
  
  const isAdFree = xrgeBalance >= 1000;
  const tier = getTierFromBalance(xrgeBalance);
  
  return {
    xrgeBalance,
    loading,
    isAdFree,
    tier,
    refresh: fetchBalance,
  };
};
```

---

### Step 4: User Tier Indicator

Create `src/components/UserTierBadge.tsx`:

```typescript
import { useX402 } from '@/contexts/X402Context';
import { useXRGEBalance } from '@/hooks/useXRGEBalance';
import { Badge } from '@/components/ui/badge';

export const UserTierBadge = () => {
  const { isPremiumSubscriber } = useX402();
  const { xrgeBalance, tier } = useXRGEBalance();
  
  const getTierDisplay = () => {
    if (isPremiumSubscriber) {
      return {
        label: '💎 Premium',
        color: 'bg-gradient-to-r from-purple-500 to-pink-500',
        description: 'Paid Subscriber'
      };
    }
    
    if (tier === 'platinum') {
      return {
        label: '💎 Platinum',
        color: 'bg-gradient-to-r from-cyan-500 to-blue-500',
        description: `${xrgeBalance.toFixed(0)} XRGE`
      };
    }
    
    if (tier === 'gold') {
      return {
        label: '🥇 Gold',
        color: 'bg-gradient-to-r from-yellow-500 to-orange-500',
        description: `${xrgeBalance.toFixed(0)} XRGE`
      };
    }
    
    if (tier === 'silver') {
      return {
        label: '🥈 Silver',
        color: 'bg-gradient-to-r from-gray-400 to-gray-500',
        description: `${xrgeBalance.toFixed(0)} XRGE - 50% fewer ads`
      };
    }
    
    if (tier === 'bronze') {
      return {
        label: '🥉 Bronze',
        color: 'bg-gradient-to-r from-amber-600 to-amber-700',
        description: `${xrgeBalance.toFixed(0)} XRGE - 25% fewer ads`
      };
    }
    
    return {
      label: '🆓 Free',
      color: 'bg-gray-600',
      description: 'With ads'
    };
  };
  
  const tierDisplay = getTierDisplay();
  
  return (
    <div className="flex items-center gap-2">
      <Badge className={tierDisplay.color}>
        {tierDisplay.label}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {tierDisplay.description}
      </span>
    </div>
  );
};
```

---

## 📊 Revenue Model Comparison

### Monthly Revenue Breakdown (1,000 users)

#### Scenario 1: All Free (Ad-Supported)
```
User Type: 1,000 free users
Ad Revenue: $2 CPM × 30 ads/user/month = $0.06/user
Monthly Revenue: $60
Artist Payout: $24 (40%)
Platform: $18 (30%)
XRGE Buyback: $12 (20%)
Liquidity: $6 (10%)
```

#### Scenario 2: 10% Premium Subscribers
```
Free Users: 900 × $0.06 = $54 (ads)
Premium: 100 × $4.99 = $499 (subscriptions)
───────────────────────────────────
Total: $553/month

Distribution:
- Artists: $54 × 40% + $499 × 70% = $371
- Platform: $54 × 30% + $499 × 20% = $116
- XRGE Buyback: $54 × 20% + $499 × 10% = $61
- Liquidity: $54 × 10% = $5
```

#### Scenario 3: 20% XRGE Holders (no subscription)
```
Free Users: 800 × $0.06 = $48 (ads)
XRGE Holders: 200 × $0 = $0 (no direct revenue)

BUT... XRGE holders contribute by:
1. Buying XRGE (increases token price)
2. Holding XRGE (reduces supply)
3. Trading song tokens (platform fees)

Monthly Revenue: $48 (ads only)
+ Indirect: XRGE trading fees, increased token value
```

#### Scenario 4: Mixed (Optimal)
```
Free Users: 600 × $0.06 = $36 (ads)
Premium: 200 × $4.99 = $998 (subscriptions)
XRGE Holders: 200 × $0 = $0 (token-gated)
───────────────────────────────────
Direct Revenue: $1,034/month

Distribution:
- Artists: $36 × 40% + $998 × 70% = $713
- Platform: $36 × 30% + $998 × 20% = $211
- XRGE Buyback: $36 × 20% + $998 × 10% = $107
- Liquidity: $36 × 10% = $4

Plus XRGE ecosystem benefits!
```

---

## 🎯 User Conversion Funnels

### Free → Premium Path
```
1. User streams for free (with ads)
   ↓
2. Gets ad mid-song
   ↓
3. Sees prompt: "Remove ads? $4.99/mo or hold 1000 XRGE"
   ↓
4. Options:
   A. Pay $4.99 (instant) → Premium
   B. Buy XRGE (investment) → Token-gated premium
   C. Continue free (watch ads)
```

### Free → XRGE Holder Path
```
1. User streams for free
   ↓
2. Discovers song token trading
   ↓
3. Buys XRGE to trade
   ↓
4. Realizes: "If I hold 1000 XRGE, no ads!"
   ↓
5. Holds XRGE → Token-gated premium
   ↓
6. Gets governance rights + ad-free access
```

---

## 🔄 Why This Model is Brilliant

### For Platform
✅ **Multiple revenue streams**: Ads + subscriptions + XRGE trading  
✅ **User choice**: Pay cash or hold tokens  
✅ **XRGE utility**: Real reason to hold tokens  
✅ **Conversion optimization**: Two paths to premium  
✅ **Token price support**: Buying pressure from users wanting ad-free  

### For Artists
✅ **Ad revenue share**: 40% of ad revenue  
✅ **Subscriber bonus**: 70% of premium fees  
✅ **More plays**: Free tier = more discovery  
✅ **Token holders**: More engaged fans  

### For Users
✅ **Free option**: Can use platform without paying  
✅ **Flexible upgrade**: Pay or hold tokens  
✅ **Investment option**: XRGE can appreciate  
✅ **Governance**: Token holders get voting rights  
✅ **No lock-in**: Sell XRGE anytime  

### For XRGE Token
✅ **Real utility**: Ad-free access  
✅ **Buying pressure**: Users buy to remove ads  
✅ **Holding incentive**: Must hold 1000+ for benefit  
✅ **Price floor**: Calculated by "cost of premium"  

---

## 💡 XRGE Price Floor Calculation

### Economic Logic
```
Premium subscription: $4.99/month
Annual cost: $4.99 × 12 = $59.88/year

XRGE requirement: 1,000 tokens

Implied XRGE value floor:
$59.88 ÷ 1,000 = $0.059 per XRGE

If XRGE < $0.059:
→ Users buy XRGE (cheaper than paying monthly)
→ Buying pressure increases
→ Price rises to equilibrium

Equilibrium price: ~$0.06-$0.10 per XRGE
```

### This Creates Natural Price Support!

---

## 🛠️ Database Schema

```sql
-- Add to existing schema

-- Premium subscriptions table
CREATE TABLE premium_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  subscription_type TEXT NOT NULL, -- 'monthly', '3months', 'yearly'
  price_paid DECIMAL(10, 2) NOT NULL,
  transaction_hash TEXT NOT NULL UNIQUE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick user lookups
CREATE INDEX idx_premium_subs_wallet ON premium_subscriptions(user_wallet);
CREATE INDEX idx_premium_subs_expires ON premium_subscriptions(expires_at);

-- Ad plays tracking
CREATE TABLE ad_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT,
  ad_id TEXT NOT NULL,
  song_id UUID REFERENCES songs(id),
  ad_duration INTEGER NOT NULL,
  skipped BOOLEAN DEFAULT false,
  skip_after_seconds INTEGER,
  revenue_generated DECIMAL(10, 6),
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function: Check if user has active premium
CREATE OR REPLACE FUNCTION has_active_premium(wallet_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM premium_subscriptions
    WHERE user_wallet = wallet_address
    AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Check XRGE tier
CREATE OR REPLACE FUNCTION get_xrge_tier(xrge_balance NUMERIC)
RETURNS TEXT AS $$
BEGIN
  IF xrge_balance >= 5000 THEN RETURN 'platinum';
  ELSIF xrge_balance >= 1000 THEN RETURN 'gold';
  ELSIF xrge_balance >= 500 THEN RETURN 'silver';
  ELSIF xrge_balance >= 100 THEN RETURN 'bronze';
  ELSE RETURN 'free';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## 🎨 UI/UX Examples

### Ad Playback Screen
```
┌────────────────────────────────────┐
│  🎵 Advertisement (15s)            │
│                                    │
│  [=====>           ] 5s / 15s     │
│                                    │
│  Skip in 2 seconds...              │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Tired of ads?                │  │
│  │                              │  │
│  │ [Subscribe $4.99/mo]         │  │
│  │ [Hold 1000 XRGE]             │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Premium Comparison Table
```
┌──────────────────────────────────────────────────┐
│           🆓 Free    💎 Premium   🪙 XRGE Gold   │
├──────────────────────────────────────────────────┤
│ Streaming    ✅ Yes      ✅ Yes       ✅ Yes      │
│ Ads          ❌ Yes      ✅ No        ✅ No       │
│ Quality      128kbps    320kbps     320kbps     │
│ Skips        6/hour     Unlimited   Unlimited   │
│ Cost         Free       $4.99/mo    1000 XRGE   │
│ Downloads    ❌ No       ✅ Yes       ✅ Yes      │
│ Governance   ❌ No       ❌ No        ✅ Yes      │
└──────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Timeline

### Week 1-2: Ad Infrastructure
- [ ] Integrate ad server (Google AdSense or custom)
- [ ] Build ad detection in audio player
- [ ] Create ad playback UI
- [ ] Test ad insertion mid-song

### Week 3-4: Premium Subscriptions
- [ ] x402 subscription payment flow
- [ ] Database schema for subscriptions
- [ ] Premium activation logic
- [ ] Subscription management UI

### Week 5-6: XRGE Integration
- [ ] XRGE balance checker
- [ ] Tier calculation logic
- [ ] Token-gated premium access
- [ ] Real-time balance monitoring

### Week 7-8: Polish & Launch
- [ ] A/B test pricing
- [ ] Optimize conversion funnels
- [ ] Marketing materials
- [ ] Public launch 🚀

---

## ✅ Success Metrics

### Conversion Rates (Target)
- Free → Premium: 5-10%
- Free → XRGE Holder: 10-15%
- Total Premium Access: 15-25%

### Revenue Targets (1,000 users)
- Month 1: $300 (mostly ads)
- Month 3: $700 (some conversions)
- Month 6: $1,200 (mature conversion)

### XRGE Metrics
- XRGE holders: 20-30% of users
- Average holding: 1,500 XRGE
- Price support: Minimum $0.06/XRGE

---

## 🎉 Summary

This model is **perfect** because it:
1. ✅ Offers **free tier** (user acquisition)
2. ✅ Monetizes **non-paying users** (ads)
3. ✅ Provides **paid option** ($4.99/mo via x402)
4. ✅ Creates **XRGE utility** (1000 XRGE = ad-free)
5. ✅ Supports **XRGE price** (buying pressure)
6. ✅ Gives **user choice** (pay or hold)
7. ✅ Generates **multiple revenue streams**

**This is how you build a sustainable Web3 music platform!** 🎵💰🚀

