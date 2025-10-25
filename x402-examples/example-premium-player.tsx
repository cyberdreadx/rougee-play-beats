// Example: Premium Audio Player with x402 Integration
// This shows how the AudioPlayer component could be enhanced with x402 payments

import { useState } from 'react';
import { useX402 } from '@coinbase/x402-sdk';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface Song {
  id: string;
  title: string;
  artist: string;
  audio_cid: string;
  is_premium: boolean;
  premium_price_usdc?: number; // e.g., 0.01
  artist_wallet: string;
}

export const PremiumAudioPlayer = ({ song }: { song: Song }) => {
  const [hasPaid, setHasPaid] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { pay, balance } = useX402();

  const PLATFORM_FEE = 0.20; // 20%
  const ARTIST_SHARE = 0.70; // 70%
  const LIQUIDITY_POOL_SHARE = 0.10; // 10%

  const handlePlayClick = async () => {
    // Free songs play immediately
    if (!song.is_premium) {
      playAudio();
      return;
    }

    // Premium songs require payment first
    if (!hasPaid) {
      setShowPaymentModal(true);
      return;
    }

    playAudio();
  };

  const handlePayment = async () => {
    try {
      const price = song.premium_price_usdc || 0.01;

      // Split payment to multiple recipients
      const artistAmount = price * ARTIST_SHARE; // 0.007 USDC
      const platformAmount = price * PLATFORM_FEE; // 0.002 USDC
      const poolAmount = price * LIQUIDITY_POOL_SHARE; // 0.001 USDC

      // Process payment via x402
      const receipt = await pay({
        amount: price,
        splits: [
          { address: song.artist_wallet, amount: artistAmount },
          { address: process.env.VITE_PLATFORM_WALLET, amount: platformAmount },
          { address: process.env.VITE_LIQUIDITY_POOL, amount: poolAmount },
        ],
        metadata: {
          type: 'premium_play',
          songId: song.id,
          artistWallet: song.artist_wallet,
        }
      });

      // Verify payment on backend
      const verified = await verifyX402Payment(receipt);

      if (verified) {
        setHasPaid(true);
        setShowPaymentModal(false);
        
        toast({
          title: "Premium Unlocked! 🎵",
          description: `You can now play "${song.title}"`,
        });

        // Track payment in database
        await trackPremiumPlay({
          songId: song.id,
          transactionHash: receipt.hash,
          amount: price,
          artistWallet: song.artist_wallet,
        });

        // Start playing immediately
        playAudio();
      }
    } catch (error) {
      console.error('Payment failed:', error);
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const playAudio = () => {
    setIsPlaying(true);
    // Existing audio player logic...
  };

  const verifyX402Payment = async (receipt: any) => {
    // Call edge function to verify payment on-chain
    const response = await fetch('/functions/v1/verify-x402-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt })
    });

    const { verified } = await response.json();
    return verified;
  };

  const trackPremiumPlay = async (data: any) => {
    await fetch('/functions/v1/track-premium-play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  };

  return (
    <div className="premium-player">
      <div className="song-info">
        <h3>{song.title}</h3>
        <p>{song.artist}</p>
        {song.is_premium && (
          <div className="premium-badge">
            💎 Premium - ${song.premium_price_usdc} USDC
          </div>
        )}
      </div>

      <Button 
        onClick={handlePlayClick}
        className="play-button"
      >
        {isPlaying ? '⏸️ Pause' : '▶️ Play'}
        {song.is_premium && !hasPaid && ' (Premium)'}
      </Button>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="x402-payment-modal">
          <DialogHeader>
            <DialogTitle>🎵 Unlock Premium Track</DialogTitle>
          </DialogHeader>

          <div className="payment-details">
            <div className="track-info">
              <h4>{song.title}</h4>
              <p className="text-muted-foreground">{song.artist}</p>
            </div>

            <div className="price-breakdown">
              <div className="total-price">
                <span>Total Price:</span>
                <span className="amount">${song.premium_price_usdc} USDC</span>
              </div>

              <div className="split-details text-sm text-muted-foreground">
                <div>→ Artist receives: ${(song.premium_price_usdc * ARTIST_SHARE).toFixed(3)} (70%)</div>
                <div>→ Platform fee: ${(song.premium_price_usdc * PLATFORM_FEE).toFixed(3)} (20%)</div>
                <div>→ Liquidity pool: ${(song.premium_price_usdc * LIQUIDITY_POOL_SHARE).toFixed(3)} (10%)</div>
              </div>
            </div>

            <div className="wallet-balance">
              <span>Your Balance:</span>
              <span className={balance >= song.premium_price_usdc ? "text-green-500" : "text-red-500"}>
                ${balance.toFixed(2)} USDC {balance >= song.premium_price_usdc ? '✅' : '⚠️'}
              </span>
            </div>

            {balance < song.premium_price_usdc && (
              <div className="insufficient-balance text-red-500 text-sm">
                Insufficient balance. Please add USDC to your wallet.
              </div>
            )}

            <div className="payment-actions">
              <Button 
                onClick={handlePayment}
                disabled={balance < song.premium_price_usdc}
                className="w-full"
              >
                💰 Pay & Play
              </Button>
              <Button 
                onClick={() => setShowPaymentModal(false)}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>

            <div className="payment-info text-xs text-muted-foreground text-center">
              ⚡ Instant payment · 🔒 Secure via x402 · No gas fees
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

