import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Loader2 } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePrivyToken } from '@/hooks/usePrivyToken';
import { parseEther, parseUnits, formatEther, Address } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { useSwitchChain } from 'wagmi';
import { XRGE_TOKEN_ADDRESS, KTA_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from '@/hooks/useXRGESwap';
import { useSongTokenBalance, ERC20_ABI } from '@/hooks/useSongBondingCurve';

interface UnlockPostButtonProps {
  postId: string;
  unlockPrice: string;
  unlockTokenType: string;
  unlockTokenAddress?: string | null;
  onUnlocked?: () => void;
}

const XRGE_TOKEN = XRGE_TOKEN_ADDRESS as Address;
const KTA_TOKEN = KTA_TOKEN_ADDRESS as Address;
const USDC_TOKEN = USDC_TOKEN_ADDRESS as Address;

export default function UnlockPostButton({
  postId,
  unlockPrice,
  unlockTokenType,
  unlockTokenAddress,
  onUnlocked
}: UnlockPostButtonProps) {
  const { fullAddress, isConnected } = useWallet();
  const { authenticated } = usePrivy();
  const { getAuthHeaders } = usePrivyToken();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const [isUnlocking, setIsUnlocking] = useState(false);
  
  // Get user balance for the unlock token
  const tokenAddress = unlockTokenType === 'XRGE' ? XRGE_TOKEN :
                       unlockTokenType === 'KTA' ? KTA_TOKEN :
                       unlockTokenType === 'USDC' ? USDC_TOKEN :
                       unlockTokenType === 'SONG_TOKEN' ? (unlockTokenAddress as Address) : null;
  
  const { balance: tokenBalance } = useSongTokenBalance(
    tokenAddress,
    fullAddress as Address | undefined
  );
  
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash,
    query: {
      enabled: !!hash,
    }
  });

  const handleUnlock = async () => {
    if (!authenticated || !fullAddress || !isConnected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to unlock this post",
        variant: "destructive",
      });
      return;
    }

    // Ensure unlockPrice is a string for parsing
    const priceString = typeof unlockPrice === 'string' ? unlockPrice : String(unlockPrice || '0');
    
    if (!priceString || parseFloat(priceString) <= 0) {
      toast({
        title: "Invalid Price",
        description: "This post has an invalid unlock price",
        variant: "destructive",
      });
      return;
    }

    setIsUnlocking(true);

    try {
      // Check if user has enough balance (reuse priceString from above)
      const price = parseFloat(priceString);
      const balance = parseFloat(tokenBalance || '0');
      
      if (balance < price) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${priceString} ${unlockTokenType} to unlock this post`,
          variant: "destructive",
        });
        setIsUnlocking(false);
        return;
      }

      let txHash: string | undefined;

      if (unlockTokenType === 'ETH') {
        // Send ETH directly to post creator
        // Note: This is a simplified version - you may want to use a payment contract
        toast({
          title: "ETH Payment",
          description: "ETH payments require a payment contract. Please contact support.",
          variant: "destructive",
        });
        setIsUnlocking(false);
        return;
      } else if (unlockTokenType === 'XRGE' || unlockTokenType === 'KTA' || unlockTokenType === 'USDC' || unlockTokenType === 'SONG_TOKEN') {
        // Transfer ERC20 tokens
        const tokenAddr = unlockTokenType === 'XRGE' ? XRGE_TOKEN :
                         unlockTokenType === 'KTA' ? KTA_TOKEN :
                         unlockTokenType === 'USDC' ? USDC_TOKEN :
                         unlockTokenAddress as Address;

        if (!tokenAddr) {
          throw new Error('Invalid token address');
        }

        // Get post creator wallet address
        const { data: postData, error: postError } = await supabase
          .from('feed_posts')
          .select('wallet_address')
          .eq('id', postId)
          .single();

        if (postError || !postData) {
          throw new Error('Failed to fetch post creator');
        }

        const creatorAddress = postData.wallet_address as Address;

        // Determine token decimals (USDC uses 6, others use 18)
        const decimals = unlockTokenType === 'USDC' ? 6 : 18;
        // Ensure unlockPrice is a string for parseUnits (reuse priceString from above)
        const amount = parseUnits(priceString, decimals);

        // Transfer tokens to creator
        txHash = await writeContractAsync({
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [creatorAddress, amount],
          chainId: base.id,
        } as any);
      } else {
        throw new Error(`Unsupported token type: ${unlockTokenType}`);
      }

      // Wait for transaction confirmation before recording unlock
      if (txHash) {
        // Wait for transaction to be confirmed
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
        });

        if (!receipt || receipt.status !== 'success') {
          throw new Error('Transaction failed');
        }

        // Record unlock in database after transaction is confirmed
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unlock-post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            postId,
            transactionHash: txHash,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to record unlock');
        }

        toast({
          title: "Post Unlocked! 🔓",
          description: "You can now view this premium content",
        });

        if (onUnlocked) {
          onUnlocked();
        }
      }
    } catch (error: any) {
      console.error('Error unlocking post:', error);
      toast({
        title: "Unlock Failed",
        description: error.message || "Failed to unlock post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  // Ensure unlockPrice is a string for parsing (for render section)
  const priceString = typeof unlockPrice === 'string' ? unlockPrice : String(unlockPrice || '0');
  const price = parseFloat(priceString);
  const balance = parseFloat(tokenBalance || '0');
  const hasEnoughBalance = balance >= price;

  if (!authenticated || !isConnected) {
    return (
      <div className="text-center">
        <p className="text-white/80 font-mono text-sm mb-2">Connect your wallet to unlock</p>
        <Button
          disabled
          className="bg-gradient-to-r from-purple-500/50 to-pink-500/50 text-white/50 font-mono font-bold uppercase tracking-wider border-2 border-purple-500/30"
        >
          <Lock className="w-4 h-4 mr-2" />
          CONNECT WALLET TO UNLOCK
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-2">
      <div className="text-xs font-mono text-white/60">
        Your balance: {balance.toFixed(4)} {unlockTokenType}
      </div>
      <Button
        onClick={handleUnlock}
        disabled={isUnlocking || isPending || isConfirming || !hasEnoughBalance}
        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-mono font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] border-2 border-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUnlocking || isPending || isConfirming ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            UNLOCKING...
          </>
        ) : !hasEnoughBalance ? (
          <>
            <Lock className="w-4 h-4 mr-2" />
            INSUFFICIENT BALANCE
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            UNLOCK FOR {priceString} {unlockTokenType}
          </>
        )}
      </Button>
      {!hasEnoughBalance && (
        <p className="text-xs font-mono text-yellow-400">
          You need {price.toFixed(4)} {unlockTokenType}, but you have {balance.toFixed(4)}
        </p>
      )}
    </div>
  );
}

