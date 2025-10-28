import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";

interface AICoverPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (paymentProof: string) => void;
  model: 'flux-schnell' | 'seedream-v4';
  prompt: string;
}

const PAYMENT_AMOUNTS = {
  'flux-schnell': '0.01',
  'seedream-v4': '0.05'
};

const RECIPIENT_ADDRESS = '0xDa31C963E979495f4374979127c34E980eF3184e';

// USDC contract on Base
const USDC_CONTRACT = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  abi: [
    {
      name: 'transfer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ name: '', type: 'bool' }]
    },
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }]
    },
    {
      name: 'decimals',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint8' }]
    }
  ]
} as const;

export const AICoverPaymentModal = ({
  isOpen,
  onClose,
  onPaymentSuccess,
  model,
  prompt
}: AICoverPaymentModalProps) => {
  const { isConnected, address, connect } = useWallet();
  const { address: wagmiAddress } = useAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'connect' | 'payment' | 'success'>('connect');
  const [txHash, setTxHash] = useState<string | null>(null);
  const paymentSuccessCalled = useRef(false);
  const lastProcessedHash = useRef<string | null>(null);

  // viem hooks for USDC transaction
  const { writeContract, data: hash, isPending, isSuccess, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
    hash,
  });

  // Auto-advance to payment step if wallet is already connected
  useEffect(() => {
    console.log('🔍 Payment Modal Wallet Check:', { isConnected, address, step });
    if (isConnected && address && step === 'connect') {
      console.log('✅ Wallet connected, advancing to payment step');
      setStep('payment');
    }
  }, [isConnected, address, step]);

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 Payment modal opened:', { isConnected, address, step });
      // Reset all state for fresh payment
      paymentSuccessCalled.current = false;
      setTxHash(null);
      setIsProcessing(false);
      
      if (isConnected && address) {
        console.log('✅ Wallet already connected, going to payment step');
        setStep('payment');
      } else {
        console.log('❌ Wallet not connected, showing connect step');
        setStep('connect');
      }
    }
  }, [isOpen, isConnected, address]);

  const amount = PAYMENT_AMOUNTS[model];
  const modelName = model === 'flux-schnell' ? 'FLUX Schnell' : 'Seedream 4.0';

  const handleConnectWallet = async () => {
    try {
      console.log('🔗 Attempting to connect wallet...');
      await connect();
      console.log('✅ Wallet connection initiated');
      setStep('payment');
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      toast.error('Failed to connect wallet. Please try again.');
    }
  };

  const handlePayment = async () => {
    if (!isConnected || !address || !wagmiAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    setStep('payment');

    try {
      // Step 1: Get payment requirements from x402 endpoint (like tip-artist)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover-x402`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          model,
          genre: 'music',
          style: 'album cover, square format, high quality'
        })
      });

      if (response.status !== 402) {
        throw new Error('Expected 402 Payment Required response');
      }

      const paymentRequirements = await response.json();
      console.log('Payment requirements:', paymentRequirements);

      // Step 2: Create real USDC transaction using viem
      toast.info(`Creating $${amount} USDC payment for ${modelName}...`);
      
      // Convert amount to USDC units (6 decimals)
      const amountInUnits = parseUnits(amount, 6);
      
      // Create USDC transfer transaction
      writeContract({
        address: USDC_CONTRACT.address,
        abi: USDC_CONTRACT.abi,
        functionName: 'transfer',
        args: [RECIPIENT_ADDRESS as `0x${string}`, amountInUnits],
      });

    } catch (error) {
      console.error('Payment failed:', error);
      toast.error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('connect');
      setIsProcessing(false);
    }
  };

  // Handle transaction success - wait for confirmation
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('Transaction submitted, waiting for confirmation:', hash);
      setTxHash(hash);
      // Don't set step to success yet - wait for confirmation
    }
  }, [isSuccess, hash]);

  // Handle transaction confirmation
  useEffect(() => {
    // Only process confirmation if:
    // 1. Modal is open
    // 2. Transaction is confirmed
    // 3. We have a hash
    // 4. We haven't already processed this specific hash
    // 5. Step is not already success
    if (isOpen && isConfirmed && hash && hash !== lastProcessedHash.current && step !== 'success' && !paymentSuccessCalled.current) {
      console.log('Transaction confirmed:', hash);
      paymentSuccessCalled.current = true;
      lastProcessedHash.current = hash; // Mark this hash as processed
      setStep('success');
      
      // Create payment proof with real transaction hash
      const paymentProof = {
        type: 'usdc_payment',
        amount: amount,
        recipient: RECIPIENT_ADDRESS,
        txHash: hash,
        from: wagmiAddress,
        timestamp: Date.now()
      };

      onPaymentSuccess(btoa(JSON.stringify(paymentProof)));
      toast.success(`Payment successful! Generated cover with ${modelName}`);
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
        setStep('connect');
        setIsProcessing(false);
      }, 2000);
    }
  }, [isOpen, isConfirmed, hash, step, amount, wagmiAddress, onPaymentSuccess, onClose, modelName]);

  // Add timeout for stuck transactions
  useEffect(() => {
    if (isPending && hash) {
      const timeout = setTimeout(() => {
        console.warn('Transaction confirmation timeout');
        toast.error('Transaction confirmation timed out. Please check your wallet or try again.');
        setStep('connect');
        setIsProcessing(false);
      }, 60000); // 60 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isPending, hash]);

  // Handle transaction error
  useEffect(() => {
    if (error) {
      console.error('Transaction failed:', error);
      toast.error(`Transaction failed: ${error.message}`);
      setStep('connect');
      setIsProcessing(false);
    }
  }, [error]);

  // Handle transaction confirmation error
  useEffect(() => {
    if (confirmError) {
      console.error('Transaction confirmation failed:', confirmError);
      toast.error(`Transaction confirmation failed: ${confirmError.message}`);
      setStep('connect');
      setIsProcessing(false);
    }
  }, [confirmError]);

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
      // Reset all state for next payment
      setStep('connect');
      setTxHash(null);
      setIsProcessing(false);
      paymentSuccessCalled.current = false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-neon-green/20">
        <DialogHeader>
          <DialogTitle className="font-mono text-neon-green flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            AI Cover Payment
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Pay ${amount} USDC to generate cover with {modelName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Payment Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-400">Payment Required</span>
            </div>
            <div className="text-xs text-blue-300 space-y-1">
              <p>• Model: <span className="font-mono">{modelName}</span></p>
              <p>• Cost: <span className="font-mono text-yellow-400">${amount} USDC</span></p>
              <p>• Recipient: <span className="font-mono text-xs">{RECIPIENT_ADDRESS.slice(0, 6)}...{RECIPIENT_ADDRESS.slice(-4)}</span></p>
              <p>• Network: <span className="font-mono">Base</span></p>
            </div>
          </div>

          {/* Step 1: Connect Wallet */}
          {step === 'connect' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your wallet to pay for AI cover generation
                </p>
              </div>
              
              <Button
                onClick={handleConnectWallet}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                disabled={isProcessing}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 'payment' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Confirm Payment</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Pay ${amount} USDC to generate your cover
                </p>
                {address && (
                  <p className="text-xs text-muted-foreground font-mono">
                    From: {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                )}
              </div>

              <div className="bg-neon-green/10 border border-neon-green/20 rounded-lg p-4">
                <div className="flex justify-between items-center font-mono text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="text-neon-green font-bold text-lg">
                    ${amount} USDC
                  </span>
                </div>
              </div>

              <Button
                onClick={handlePayment}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                disabled={isProcessing || isPending || isConfirming}
              >
                {isProcessing || isPending || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isPending ? 'Confirming in wallet...' : isConfirming ? 'Confirming transaction...' : 'Processing Payment...'}
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay ${amount} USDC
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-green-500">Payment Successful!</h3>
              <p className="text-sm text-muted-foreground">
                Your cover is being generated with {modelName}
              </p>
              {txHash && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-xs text-green-400 font-mono">
                    Transaction: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </p>
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-400 hover:underline"
                  >
                    View on BaseScan
                  </a>
                </div>
              )}
            </div>
          )}

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
              HTTP 402 • Direct USDC payments • Base network
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
