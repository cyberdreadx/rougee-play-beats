import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

interface TipButtonProps {
  artistId: string;
  artistWalletAddress: string;
  artistName: string;
  variant?: "default" | "outline" | "neon" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

// Preset tip amounts in USD
const PRESET_AMOUNTS = [1, 5, 10, 25, 50, 100];

// Supabase Edge Function URL for x402 protocol
const SUPABASE_URL = "https://phybdsfwycygroebrsdx.supabase.co";
const TIP_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/tip-artist`;

export const TipButton = ({
  artistId,
  artistWalletAddress,
  artistName,
  variant = "neon",
  size = "default",
  className = "",
}: TipButtonProps) => {
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = usePrivy();
  const { wallets } = useWallets();

  // Handle preset amount selection
  const handlePresetAmount = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  // Handle custom amount input
  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  // Send tip using real x402 protocol
  const handleSendTip = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to send a tip",
        variant: "destructive",
      });
      return;
    }

    const amount = selectedAmount || parseFloat(customAmount);
    
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid tip amount",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      console.log('💸 Sending tip via x402:', {
        artistId,
        artistWallet: artistWalletAddress,
        amount,
      });

      // Get user's embedded wallet
      const embeddedWallet = wallets.find(w => 
        w.walletClientType === 'privy' || w.connectorType === 'embedded'
      );

      if (!embeddedWallet) {
        toast({
          title: "Wallet Required",
          description: "Please ensure your embedded wallet is created",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Get Ethereum provider from Privy wallet
      let provider;
      try {
        await embeddedWallet.switchChain(8453); // Ensure on Base
        provider = await embeddedWallet.getEthereumProvider();
        console.log('✅ Ethereum provider retrieved');
      } catch (providerError) {
        console.error('❌ Failed to get provider:', providerError);
        toast({
          title: "Provider Error",
          description: "Could not access wallet provider for payment.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Create viem wallet client
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });
      
      const addresses = await walletClient.getAddresses();
      const account = addresses[0];
      
      if (!account) {
        console.error('❌ No account found in wallet client');
        toast({
          title: "Account Error",
          description: "Could not get account from wallet.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const signingClient = createWalletClient({
        account,
        chain: base,
        transport: custom(provider),
      });
      
      console.log('✅ Signing wallet client created:', account);

      // Make initial request to get payment requirements
      let response = await fetch(`${TIP_FUNCTION_URL}/tip/${artistId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          amount: amount.toString(),
          artistWallet: artistWalletAddress,
        }),
      });

      if (response.status === 402) {
        // x402 Payment Required - create payment proof
        const paymentRequirements = await response.json();
        console.log('💳 Payment required:', paymentRequirements);
        
        toast({
          title: "Processing Payment... 💸",
          description: `Creating payment for $${amount} USDC`,
        });

        // Create REAL USDC payment using the user's wallet
        const usdcContractAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
        const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1_000_000)); // USDC has 6 decimals
        
        console.log('💸 Creating real USDC transfer:', {
          to: artistWalletAddress,
          amount: amountInWei.toString(),
          contract: usdcContractAddress
        });

        // USDC transfer function signature: transfer(address,uint256)
        const transferData = `0xa9059cbb${artistWalletAddress.slice(2).padStart(64, '0')}${amountInWei.toString(16).padStart(64, '0')}`;
        
        // Send the actual USDC transfer transaction
        const txHash = await signingClient.sendTransaction({
          to: usdcContractAddress,
          data: transferData,
          value: 0n, // No ETH value, just USDC transfer
        });

        console.log('✅ USDC transfer sent:', txHash);

        // Create payment proof with real transaction
        const paymentProof = {
          type: 'x402_payment',
          amount: amount.toString(),
          recipient: artistWalletAddress,
          asset: usdcContractAddress,
          network: 'base',
          timestamp: Date.now(),
          txHash: txHash,
          verified: true
        };

        // Retry with payment proof
        response = await fetch(`${TIP_FUNCTION_URL}/tip/${artistId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'X-PAYMENT': btoa(JSON.stringify(paymentProof)),
          },
          body: JSON.stringify({
            amount: amount.toString(),
            artistWallet: artistWalletAddress,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Tip successful:', data);

      toast({
        title: "Tip Sent! 🎉",
        description: (
          <div className="flex flex-col gap-2">
            <p>Successfully tipped ${amount} USDC to {artistName}</p>
            {data.txHash && (
              <a
                href={`https://basescan.org/tx/${data.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-green hover:underline flex items-center gap-1 text-xs"
              >
                View on BaseScan
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ),
      });
      
      setOpen(false);
      setCustomAmount("");
      setSelectedAmount(null);

    } catch (error: any) {
      console.error("❌ Error sending tip:", error);
      
      toast({
        title: "Tip Failed",
        description: error.message || "Failed to send tip. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const finalAmount = selectedAmount || parseFloat(customAmount) || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <DollarSign className="w-4 h-4 mr-2" />
          TIP ARTIST
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-neon-green/20">
        <DialogHeader>
          <DialogTitle className="font-mono text-neon-green">
            Tip {artistName}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Support this artist with USDC via x402 protocol
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Preset Amounts */}
          <div>
            <Label className="font-mono text-xs mb-2 block">
              Quick Select (USD)
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? "neon" : "outline"}
                  size="sm"
                  onClick={() => handlePresetAmount(amount)}
                  className="font-mono"
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <Label htmlFor="custom-amount" className="font-mono text-xs mb-2 block">
              Custom Amount (USD)
            </Label>
            <Input
              id="custom-amount"
              type="number"
              placeholder="Enter custom amount"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              className="font-mono"
              min="0.01"
              step="0.01"
            />
          </div>

          {/* Tip Info */}

          {/* Summary */}
          {finalAmount > 0 && (
            <div className="bg-neon-green/10 border border-neon-green/20 rounded-lg p-3">
              <div className="flex justify-between items-center font-mono text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span className="text-neon-green font-bold text-lg">
                  ${finalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Send Button */}
          <Button
            variant="neon"
            className="w-full font-mono font-bold"
            onClick={handleSendTip}
            disabled={!user || finalAmount <= 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4 mr-2" />
                Send Tip via x402
              </>
            )}
          </Button>

          {/* x402 Protocol Info */}
          <div className="text-xs text-muted-foreground font-mono text-center pt-2 border-t border-border">
            <p>
              Powered by{" "}
              <a
                href="https://x402.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-green hover:underline"
              >
                x402 protocol
              </a>
            </p>
            <p className="text-[10px] mt-1">
              HTTP 402 • Frictionless payments • Works for AI agents
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
