import { useWriteContract, useReadContract, useWaitForTransactionReceipt, useAccount, useChainId, usePublicClient } from "wagmi";
import { parseEther, parseUnits, formatEther, Address } from "viem";
import { toast } from "@/hooks/use-toast";

// XRGESwapper contract address on Base
const XRGE_SWAPPER_ADDRESS = "0xA8a861e7076529E7bAe38B48ed434a2383e2F40b" as Address;
export const XRGE_TOKEN_ADDRESS = "0x147120faEC9277ec02d957584CFCD92B56A24317" as Address;
export const KTA_TOKEN_ADDRESS = "0xc0634090F2Fe6c6d75e61Be2b949464aBB498973" as Address; // KTA Token on Base
export const USDC_TOKEN_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

// Contract ABI (only functions we need)
const XRGE_SWAPPER_ABI = [
  {
    inputs: [{ name: "slippageBps", type: "uint256" }],
    name: "swapETHForXRGESimple",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "xrgeAmount", type: "uint256" },
      { name: "slippageBps", type: "uint256" },
    ],
    name: "swapXRGEForETHSimple",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "ethAmount", type: "uint256" }],
    name: "getExpectedXRGEOutput",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "xrgeAmount", type: "uint256" }],
    name: "getExpectedETHOutput",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "checkXRGEApproval",
    outputs: [
      { name: "hasApproval", type: "bool" },
      { name: "currentAllowance", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "checkUSDCApproval",
    outputs: [
      { name: "hasApproval", type: "bool" },
      { name: "currentAllowance", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "checkKTAApproval",
    outputs: [
      { name: "hasApproval", type: "bool" },
      { name: "currentAllowance", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "ktaAmount", type: "uint256" },
      { name: "slippageBps", type: "uint256" },
    ],
    name: "swapKTAForXRGESimple",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "xrgeAmount", type: "uint256" },
      { name: "slippageBps", type: "uint256" },
    ],
    name: "swapXRGEForKTASimple",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "ktaAmount", type: "uint256" }],
    name: "getExpectedXRGEFromKTA",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "xrgeAmount", type: "uint256" }],
    name: "getExpectedKTAFromXRGE",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "usdcAmount", type: "uint256" },
      { name: "slippageBps", type: "uint256" },
    ],
    name: "swapUSDCForXRGESimple",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "xrgeAmount", type: "uint256" },
      { name: "slippageBps", type: "uint256" },
    ],
    name: "swapXRGEForUSDCSimple",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    name: "getExpectedXRGEFromUSDC",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "xrgeAmount", type: "uint256" }],
    name: "getExpectedUSDCFromXRGE",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const useXRGESwap = () => {
  const { address: accountAddress } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Buy XRGE with ETH
  const buyXRGE = async (ethAmount: string, slippageBps: number = 500) => {
    if (!accountAddress || !chainId) {
      toast({
        title: "Wallet Error",
        description: "Please ensure your wallet is properly connected",
        variant: "destructive",
      });
      return;
    }

    try {
      const value = parseEther(ethAmount);
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: XRGE_SWAPPER_ADDRESS,
        abi: XRGE_SWAPPER_ABI,
        functionName: "swapETHForXRGESimple",
        args: [BigInt(slippageBps)],
        value,
      };

      const submittedHash = await writeContractAsync(config as any);
    } catch (err) {
      toast({
        title: "Transaction Failed",
        description: err instanceof Error ? err.message : "Failed to swap ETH for XRGE",
        variant: "destructive",
      });
    }
  };

  // Approve XRGE for swapper contract
  const approveXRGE = async (amount: string, spenderAddress?: Address) => {
    const spender = spenderAddress || XRGE_SWAPPER_ADDRESS;
    
    if (!accountAddress || !chainId) {
      toast({
        title: "Wallet Error",
        description: "Please ensure your wallet is properly connected",
        variant: "destructive",
      });
      throw new Error("Wallet not connected");
    }

    try {
      const value = parseEther("1000000000");
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: XRGE_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender, value],
      };

      const submittedHash = await writeContractAsync(config as any);
      return submittedHash;
    } catch (err) {
      toast({
        title: "Approval Failed",
        description: err instanceof Error ? err.message : "Failed to approve XRGE",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Sell XRGE for ETH
  const sellXRGE = async (xrgeAmount: string, slippageBps: number = 500) => {
    if (!accountAddress || !chainId) {
      toast({
        title: "Wallet Error",
        description: "Please ensure your wallet is properly connected",
        variant: "destructive",
      });
      return;
    }

    try {
      const value = parseEther(xrgeAmount);
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: XRGE_SWAPPER_ADDRESS,
        abi: XRGE_SWAPPER_ABI,
        functionName: "swapXRGEForETHSimple",
        args: [value, BigInt(slippageBps)],
      };

      const submittedHash = await writeContractAsync(config as any);
    } catch (err) {
      toast({
        title: "Transaction Failed",
        description: err instanceof Error ? err.message : "Failed to swap XRGE for ETH",
        variant: "destructive",
      });
    }
  };

  // Buy XRGE with KTA
  const buyXRGEWithKTA = async (ktaAmount: string, slippageBps: number = 500) => {
    if (!accountAddress || !chainId) {
      throw new Error("Wallet not connected");
    }

    try {
      const ktaDecimals = await publicClient.readContract({
        address: KTA_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "decimals",
      } as any) as number;
      
      const value = parseUnits(ktaAmount, Number(ktaDecimals));
      
      const ktaBalance = await publicClient.readContract({
        address: KTA_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [accountAddress],
      } as any) as bigint;
      
      if (ktaBalance < value) {
        throw new Error(`Insufficient KTA balance. You have ${(Number(ktaBalance) / 10**Number(ktaDecimals)).toFixed(4)} KTA`);
      }
      
      const allowance = await publicClient.readContract({
        address: KTA_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [accountAddress, XRGE_SWAPPER_ADDRESS],
      } as any) as bigint;
      
      if (allowance < value) {
        throw new Error(`KTA not approved. Please approve KTA first. Current allowance: ${(Number(allowance) / 10**Number(ktaDecimals)).toFixed(4)} KTA`);
      }
      
      toast({
        title: "Swapping KTA for XRGE",
        description: "Confirm swap in your wallet...",
      });
      
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: XRGE_SWAPPER_ADDRESS,
        abi: XRGE_SWAPPER_ABI,
        functionName: "swapKTAForXRGESimple",
        args: [value, BigInt(slippageBps)],
      };

      const submittedHash = await writeContractAsync(config as any);
      
      toast({
        title: "✅ Swap Submitted!",
        description: `Swapping ${ktaAmount} KTA for XRGE...`,
      });
      
      return submittedHash;
    } catch (err: any) {
      
      // Check if user rejected
      const isUserRejection = err?.message?.includes('User rejected') || 
                              err?.message?.includes('user rejected') ||
                              err?.code === 4001 ||
                              err?.code === 'ACTION_REJECTED';
      
      if (isUserRejection) {
        // Silent for user rejection
        throw err;
      }
      
      // Provide more specific error messages
      let errorMessage = "Failed to swap KTA for XRGE";
      if (err.message) {
        if (err.message.includes("Insufficient KTA balance")) {
          errorMessage = err.message;
        } else if (err.message.includes("not approved")) {
          errorMessage = err.message;
        } else if (err.message.includes("slippage")) {
          errorMessage = "Price moved too much. Try increasing slippage tolerance.";
        } else {
          errorMessage = err.message;
        }
      }
      
      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Sell XRGE for KTA
  const sellXRGEForKTA = async (xrgeAmount: string, slippageBps: number = 500) => {
    if (!accountAddress || !chainId) {
      toast({
        title: "Wallet Error",
        description: "Please ensure your wallet is properly connected",
        variant: "destructive",
      });
      throw new Error("Wallet not connected");
    }

    try {
      const value = parseEther(xrgeAmount);
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: XRGE_SWAPPER_ADDRESS,
        abi: XRGE_SWAPPER_ABI,
        functionName: "swapXRGEForKTASimple",
        args: [value, BigInt(slippageBps)],
      };

      const submittedHash = await writeContractAsync(config as any);
      toast({
        title: "Swap Submitted",
        description: "Please wait for confirmation...",
      });
      return submittedHash;
    } catch (err) {
      toast({
        title: "Transaction Failed",
        description: err instanceof Error ? err.message : "Failed to swap XRGE for KTA",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Approve KTA for swapper contract
  const approveKTA = async (amount: string) => {
    if (!accountAddress || !chainId) {
      throw new Error("Wallet not connected");
    }

    try {
      const ktaDecimals = await publicClient.readContract({
        address: KTA_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "decimals",
      } as any) as number;
      
      const currentAllowance = await publicClient.readContract({
        address: KTA_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [accountAddress, XRGE_SWAPPER_ADDRESS],
      } as any) as bigint;
      
      if (currentAllowance > BigInt(0)) {
        toast({
          title: "KTA Approval (Step 1/2)",
          description: "Confirm wallet to reset existing approval...",
        });
        
        const resetConfig = {
          account: accountAddress,
          chainId: chainId,
          address: KTA_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [XRGE_SWAPPER_ADDRESS, BigInt(0)],
        };
        
        const resetHash = await writeContractAsync(resetConfig as any);
        
        toast({
          title: "KTA Approval (Step 1/2)",
          description: "Waiting for reset transaction to confirm...",
        });
        
        // Wait for reset transaction with better error handling
        let receipt = null;
        const maxResetAttempts = 60; // 60 seconds total
        for (let i = 0; i < maxResetAttempts; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            receipt = await publicClient.getTransactionReceipt({ hash: resetHash });
            if (receipt) {
              console.log('✅ KTA reset transaction confirmed:', resetHash);
              break;
            }
          } catch (receiptError: any) {
            // If it's a "not found" error, continue waiting - transaction might still be pending
            if (receiptError?.message?.includes('not found') || 
                receiptError?.message?.includes('Transaction receipt') ||
                receiptError?.code === 'NOT_FOUND') {
              // Continue waiting
              continue;
            }
            // Other errors should be thrown
            throw receiptError;
          }
        }
        
        // If we still don't have a receipt after waiting, continue anyway
        // The transaction was submitted successfully and may still be pending
        if (!receipt) {
          console.warn('⚠️ KTA reset transaction receipt not found after waiting, but transaction was submitted:', resetHash);
          toast({
            title: "Transaction Submitted",
            description: "KTA reset transaction submitted. It may still be processing. Continuing...",
            variant: "default",
          });
        }
      }
      
      const value = parseUnits("1000000000", Number(ktaDecimals));
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: KTA_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [XRGE_SWAPPER_ADDRESS, value],
      };

      toast({
        title: currentAllowance > BigInt(0) ? "KTA Approval (Step 2/2)" : "KTA Approval",
        description: "Confirm approval in your wallet...",
      });

      const submittedHash = await writeContractAsync(config as any);
      
      // Wait for approval transaction to be mined with better error handling
      // Handle "receipt not found" errors gracefully
      let receipt = null;
      const maxAttempts = 60; // 60 seconds total
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          receipt = await publicClient.getTransactionReceipt({ hash: submittedHash });
          if (receipt) {
            console.log('✅ KTA approval transaction confirmed:', submittedHash);
            break;
          }
        } catch (receiptError: any) {
          // If it's a "not found" error, continue waiting - transaction might still be pending
          if (receiptError?.message?.includes('not found') || 
              receiptError?.message?.includes('Transaction receipt') ||
              receiptError?.code === 'NOT_FOUND') {
            // Continue waiting
            continue;
          }
          // Other errors should be thrown
          throw receiptError;
        }
      }
      
      // If we still don't have a receipt after waiting, return the hash anyway
      // The transaction was submitted successfully and may still be pending
      if (!receipt) {
        console.warn('⚠️ KTA approval transaction receipt not found after waiting, but transaction was submitted:', submittedHash);
        toast({
          title: "Transaction Submitted",
          description: "KTA approval transaction submitted. It may still be processing. Please wait a moment and try again if needed.",
          variant: "default",
        });
      }
      
      toast({
        title: "✅ KTA Approved!",
        description: "You can now swap KTA for XRGE",
      });
      
      return submittedHash;
    } catch (err) {
      
      // Check if user rejected
      const isUserRejection = (err as any)?.message?.includes('User rejected') || 
                              (err as any)?.message?.includes('user rejected') ||
                              (err as any)?.code === 4001 ||
                              (err as any)?.code === 'ACTION_REJECTED';
      
      if (!isUserRejection) {
        toast({
          title: "Approval Failed",
          description: err instanceof Error ? err.message : "Failed to approve KTA",
          variant: "destructive",
        });
      }
      throw err;
    }
  };

  // Buy XRGE with USDC
  const buyXRGEWithUSDC = async (usdcAmount: string, slippageBps: number = 500) => {
    if (!accountAddress || !chainId) {
      toast({
        title: "Wallet Error",
        description: "Please ensure your wallet is properly connected",
        variant: "destructive",
      });
      throw new Error("Wallet not connected");
    }

    try {
      // USDC has 6 decimals
      const value = parseUnits(usdcAmount, 6);
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: XRGE_SWAPPER_ADDRESS,
        abi: XRGE_SWAPPER_ABI,
        functionName: "swapUSDCForXRGESimple",
        args: [value, BigInt(slippageBps)],
      };

      const submittedHash = await writeContractAsync(config as any);
      return submittedHash;
    } catch (err) {
      toast({
        title: "Transaction Failed",
        description: err instanceof Error ? err.message : "Failed to swap USDC for XRGE",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Sell XRGE for USDC
  const sellXRGEForUSDC = async (xrgeAmount: string, slippageBps: number = 500) => {
    if (!accountAddress || !chainId) {
      toast({
        title: "Wallet Error",
        description: "Please ensure your wallet is properly connected",
        variant: "destructive",
      });
      return;
    }

    try {
      const value = parseEther(xrgeAmount);
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: XRGE_SWAPPER_ADDRESS,
        abi: XRGE_SWAPPER_ABI,
        functionName: "swapXRGEForUSDCSimple",
        args: [value, BigInt(slippageBps)],
      };

      const submittedHash = await writeContractAsync(config as any);
    } catch (err) {
      toast({
        title: "Transaction Failed",
        description: err instanceof Error ? err.message : "Failed to swap XRGE for USDC",
        variant: "destructive",
      });
    }
  };

  // Approve USDC for swapper contract
  const approveUSDC = async (amount: string) => {
    if (!accountAddress || !chainId) {
      toast({
        title: "Wallet Error",
        description: "Please ensure your wallet is properly connected",
        variant: "destructive",
      });
      throw new Error("Wallet not connected");
    }

    try {
      const value = parseUnits("1000000000", 6);
      const config = {
        account: accountAddress,
        chainId: chainId,
        address: USDC_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [XRGE_SWAPPER_ADDRESS, value],
      };

      const submittedHash = await writeContractAsync(config as any);
      
      // Wait for approval transaction to be mined with better error handling
      // Handle "receipt not found" errors gracefully
      let receipt = null;
      const maxAttempts = 60; // 60 seconds total
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          receipt = await publicClient.getTransactionReceipt({ hash: submittedHash });
          if (receipt) {
            console.log('✅ USDC approval transaction confirmed:', submittedHash);
            break;
          }
        } catch (receiptError: any) {
          // If it's a "not found" error, continue waiting - transaction might still be pending
          if (receiptError?.message?.includes('not found') || 
              receiptError?.message?.includes('Transaction receipt') ||
              receiptError?.code === 'NOT_FOUND') {
            // Continue waiting
            continue;
          }
          // Other errors should be thrown
          throw receiptError;
        }
      }
      
      // If we still don't have a receipt after waiting, return the hash anyway
      // The transaction was submitted successfully and may still be pending
      if (!receipt) {
        console.warn('⚠️ USDC approval transaction receipt not found after waiting, but transaction was submitted:', submittedHash);
        toast({
          title: "Transaction Submitted",
          description: "USDC approval transaction submitted. It may still be processing. Please wait a moment and try again if needed.",
          variant: "default",
        });
      }
      
      return submittedHash;
    } catch (err: any) {
      // Better error handling
      let errorMessage = "Failed to approve USDC";
      if (err?.message) {
        if (err.message.includes("User rejected") || err.message.includes("user rejected") || err.message.includes("User denied")) {
          errorMessage = "Transaction was cancelled. Please approve the transaction to continue.";
        } else if (err.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for transaction. Please check your USDC balance.";
        } else {
          errorMessage = err.message;
        }
      }
      
      toast({
        title: "Approval Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Get XRGE balance using wagmi hook with refetch capability
  const { data: xrgeBalanceData, refetch: refetchXRGEBalance } = useReadContract({
    address: XRGE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: accountAddress ? [accountAddress] : undefined,
    query: {
      enabled: !!accountAddress,
      refetchInterval: 2000, // Auto-refetch every 2 seconds
    },
  });

  const getXRGEBalance = async () => {
    if (!accountAddress || !publicClient) {
      return "0";
    }
    
    try {
      const balance = await publicClient.readContract({
        address: XRGE_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [accountAddress],
      } as any) as bigint;
      
      return formatEther(balance);
    } catch (error) {
      return "0";
    }
  };

  return {
    buyXRGE,
    sellXRGE,
    approveXRGE,
    buyXRGEWithKTA,
    sellXRGEForKTA,
    approveKTA,
    buyXRGEWithUSDC,
    sellXRGEForUSDC,
    approveUSDC,
    getXRGEBalance,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
};

// Hook to get quote for buying XRGE
export const useXRGEQuote = (ethAmount: string) => {
  const value = ethAmount ? parseEther(ethAmount) : BigInt(0);

  const { data, isLoading } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "getExpectedXRGEOutput",
    args: [value],
    query: {
      enabled: !!ethAmount && Number(ethAmount) > 0,
    },
  });

  return {
    expectedXRGE: data ? formatEther(data) : "0",
    isLoading,
  };
};

// Hook to get quote for selling XRGE
export const useETHQuote = (xrgeAmount: string) => {
  const value = xrgeAmount ? parseEther(xrgeAmount) : BigInt(0);

  const { data, isLoading } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "getExpectedETHOutput",
    args: [value],
    query: {
      enabled: !!xrgeAmount && Number(xrgeAmount) > 0,
    },
  });

  return {
    expectedETH: data ? formatEther(data) : "0",
    isLoading,
  };
};

// Hook to check XRGE approval status
export const useXRGEApproval = (userAddress: Address | undefined, amount: string) => {
  const value = amount ? parseEther(amount) : parseEther("0.000001"); // Use minimal amount if empty

  const { data, isLoading, refetch } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "checkXRGEApproval",
    args: userAddress ? [userAddress, value] : undefined,
    query: {
      enabled: !!userAddress, // Always check if user is connected
      refetchInterval: 2000, // Auto-refetch every 2 seconds
    },
  });

  // If checking with actual amount, use that; otherwise just check if there's ANY approval
  const hasApproval = amount && Number(amount) > 0 ? (data?.[0] ?? false) : (data?.[1] ? Number(data[1]) > 0 : false);

  return {
    hasApproval,
    currentAllowance: data?.[1] ? formatEther(data[1]) : "0",
    isLoading,
    refetch,
  };
};

// Hook to check USDC approval for buying XRGE
export const useUSDCApproval = (userAddress: Address | undefined, amount: string) => {
  const value = amount ? parseUnits(amount, 6) : parseUnits("0.000001", 6); // USDC has 6 decimals, use minimal amount if empty

  const { data, isLoading, refetch } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "checkUSDCApproval",
    args: userAddress ? [userAddress, value] : undefined,
    query: {
      enabled: !!userAddress, // Always check if user is connected, regardless of amount
      refetchInterval: 2000, // Auto-refetch every 2 seconds to detect approval changes
    },
  });

  // If checking with actual amount, use that; otherwise just check if there's ANY approval
  const hasApproval = amount && Number(amount) > 0 ? (data?.[0] ?? false) : (data?.[1] ? Number(data[1]) > 0 : false);

  return {
    hasApproval,
    currentAllowance: data?.[1] ? (Number(data[1]) / 1e6).toFixed(6) : "0", // USDC has 6 decimals
    isLoading,
    refetch,
  };
};

// Hook to check KTA approval for buying XRGE
export const useKTAApproval = (userAddress: Address | undefined, amount: string) => {
  const { data: ktaDecimals } = useReadContract({
    address: KTA_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: true }, // Always fetch decimals
  });
  
  // Use actual amount or minimal amount for checking
  const value = ktaDecimals !== undefined 
    ? (amount && Number(amount) > 0 ? parseUnits(amount, Number(ktaDecimals)) : parseUnits("0.000001", Number(ktaDecimals)))
    : BigInt(0);

  const { data, isLoading, refetch } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "checkKTAApproval",
    args: userAddress && ktaDecimals !== undefined ? [userAddress, value] : undefined,
    query: {
      enabled: !!userAddress && ktaDecimals !== undefined, // Check whenever user is connected and decimals are known
      refetchInterval: 2000, // Auto-refetch every 2 seconds
    },
  });

  // If checking with actual amount, use that; otherwise just check if there's ANY approval
  const hasApproval = amount && Number(amount) > 0 ? (data?.[0] ?? false) : (data?.[1] ? Number(data[1]) > 0 : false);

  return {
    hasApproval,
    currentAllowance: data?.[1] ? formatEther(data[1]) : "0",
    isLoading,
    refetch,
  };
};

// Additional on-chain KTA allowance check (fallback)
export const useKTAAllowance = (userAddress: Address | undefined, amount: string) => {
  const enabledBase = !!userAddress && !!amount && Number(amount) > 0;
  const { data: ktaDecimals } = useReadContract({
    address: KTA_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: enabledBase },
  });

  const scaledAmount = enabledBase && ktaDecimals !== undefined ? parseUnits(amount, Number(ktaDecimals)) : BigInt(0);

  const { data: allowance, isLoading, refetch } = useReadContract({
    address: KTA_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: enabledBase ? [userAddress as Address, XRGE_SWAPPER_ADDRESS] : undefined,
    query: { enabled: enabledBase },
  });

  const hasApproval = allowance !== undefined && (allowance as bigint) >= (scaledAmount as bigint);

  return {
    hasApproval,
    currentAllowance: allowance ? allowance.toString() : "0",
    isLoading,
    refetch,
  };
};

// Direct USDC allowance check (fallback - more reliable)
export const useUSDCAllowance = (userAddress: Address | undefined, amount: string) => {
  const enabledBase = !!userAddress;
  
  // USDC has 6 decimals
  const scaledAmount = amount && Number(amount) > 0 ? parseUnits(amount, 6) : parseUnits("0.000001", 6);

  const { data: allowance, isLoading, refetch } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: enabledBase ? [userAddress as Address, XRGE_SWAPPER_ADDRESS] : undefined,
    query: { 
      enabled: enabledBase,
      refetchInterval: 2000, // Auto-refetch every 2 seconds
    },
  });

  const hasApproval = amount && Number(amount) > 0 
    ? (allowance !== undefined && (allowance as bigint) >= scaledAmount)
    : (allowance !== undefined && (allowance as bigint) > BigInt(0));

  return {
    hasApproval,
    currentAllowance: allowance ? (Number(allowance) / 1e6).toFixed(6) : "0",
    isLoading,
    refetch,
  };
};

// Hook to get quote for buying XRGE with KTA
export const useXRGEQuoteFromKTA = (ktaAmount: string) => {
  const { data: ktaDecimals } = useReadContract({
    address: KTA_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!ktaAmount && Number(ktaAmount) > 0 },
  });
  const value = ktaAmount && ktaDecimals !== undefined ? parseUnits(ktaAmount, Number(ktaDecimals)) : BigInt(0);

  const { data, isLoading } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "getExpectedXRGEFromKTA",
    args: [value],
    query: {
      enabled: !!ktaAmount && Number(ktaAmount) > 0 && ktaDecimals !== undefined,
    },
  });

  return {
    expectedXRGE: data ? formatEther(data) : "0",
    isLoading,
  };
};

// Hook to get quote for selling XRGE for KTA
export const useKTAQuote = (xrgeAmount: string) => {
  const value = xrgeAmount ? parseEther(xrgeAmount) : BigInt(0);

  const { data, isLoading } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "getExpectedKTAFromXRGE",
    args: [value],
    query: {
      enabled: !!xrgeAmount && Number(xrgeAmount) > 0,
    },
  });

  return {
    expectedKTA: data ? formatEther(data) : "0",
    isLoading,
  };
};

// Hook to get quote for buying XRGE with USDC
export const useXRGEQuoteFromUSDC = (usdcAmount: string) => {
  const value = usdcAmount ? parseUnits(usdcAmount, 6) : BigInt(0);

  const { data, isLoading } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "getExpectedXRGEFromUSDC",
    args: [value],
    query: {
      enabled: !!usdcAmount && Number(usdcAmount) > 0,
    },
  });

  return {
    expectedXRGE: data ? formatEther(data) : "0",
    isLoading,
  };
};

// Hook to get quote for selling XRGE for USDC
export const useUSDCQuote = (xrgeAmount: string) => {
  const value = xrgeAmount ? parseEther(xrgeAmount) : BigInt(0);

  const { data, isLoading } = useReadContract({
    address: XRGE_SWAPPER_ADDRESS,
    abi: XRGE_SWAPPER_ABI,
    functionName: "getExpectedUSDCFromXRGE",
    args: [value],
    query: {
      enabled: !!xrgeAmount && Number(xrgeAmount) > 0,
    },
  });

  return {
    expectedUSDC: data ? (Number(data) / 1e6).toFixed(6) : "0", // USDC has 6 decimals
    isLoading,
  };
};
