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
import { DollarSign, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TipButtonX402Props {
  artistWalletAddress: string;
  artistName: string;
  variant?: "default" | "outline" | "neon" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

// Preset tip amounts in USD
const PRESET_AMOUNTS = [1, 5, 10, 25, 50, 100];

// x402 Facilitator endpoint (we'd need to set this up)
const X402_FACILITATOR_URL = process.env.VITE_X402_FACILITATOR_URL || "https://facilitator.x402.org";

export const TipButtonX402 = ({
  artistWalletAddress,
  artistName,
  variant = "neon",
  size = "default",
  className = "",
}: TipButtonX402Props) => {
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

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

  // Send tip using TRUE x402 protocol
  const handleSendTip = async () => {
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
      // Step 1: Request payment from our API endpoint
      // This would return a 402 Payment Required with payment instructions
      const paymentRequest = await fetch(`/api/tip/${artistWalletAddress}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (paymentRequest.status === 402) {
        // Step 2: Parse payment requirements
        const paymentRequirements = await paymentRequest.json();
        
        // Step 3: Get payment signature from x402 facilitator
        // In a real x402 implementation, the facilitator generates the payment
        // This can work WITHOUT a wallet - the facilitator can sponsor or use other methods
        const paymentResponse = await fetch(`${X402_FACILITATOR_URL}/create-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...paymentRequirements,
            amount,
          }),
        });

        const paymentPayload = await paymentResponse.json();

        // Step 4: Submit payment to our API with X-PAYMENT header
        const tipResponse = await fetch(`/api/tip/${artistWalletAddress}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-PAYMENT': btoa(JSON.stringify(paymentPayload)), // Base64 encoded
          },
          body: JSON.stringify({ amount }),
        });

        if (tipResponse.ok) {
          const result = await tipResponse.json();
          
          toast({
            title: "Tip Sent! 💸",
            description: (
              <div className="flex flex-col gap-1">
                <p>Successfully sent ${amount} to {artistName}</p>
                {result.txHash && (
                  <a
                    href={`https://basescan.org/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neon-green hover:underline flex items-center gap-1 text-xs"
                  >
                    View on BaseScan <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ),
          });

          setOpen(false);
          setCustomAmount("");
          setSelectedAmount(null);
        } else {
          throw new Error('Payment verification failed');
        }
      }
    } catch (error) {
      console.error("❌ Error sending tip:", error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Failed to send tip",
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
            Send USDC via x402 protocol - No wallet required!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs font-mono text-blue-400">
              <p className="font-bold mb-1">No crypto wallet needed!</p>
              <p>Payment handled by x402 facilitator - works for humans & AI agents</p>
            </div>
          </div>

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

          {/* Summary */}
          {finalAmount > 0 && (
            <div className="bg-neon-green/10 border border-neon-green/20 rounded-lg p-3">
              <div className="flex justify-between items-center font-mono text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span className="text-neon-green font-bold text-lg">
                  ${finalAmount.toFixed(2)} USDC
                </span>
              </div>
            </div>
          )}

          {/* Send Button */}
          <Button
            variant="neon"
            className="w-full font-mono font-bold"
            onClick={handleSendTip}
            disabled={finalAmount <= 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing via x402...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4 mr-2" />
                Send Tip (No Wallet Needed)
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
