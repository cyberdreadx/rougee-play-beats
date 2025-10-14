import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import xrgeLogo from "@/assets/tokens/xrge.png";
import ktaLogo from "@/assets/tokens/kta.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import NetworkInfo from "@/components/NetworkInfo";
import Navigation from "@/components/Navigation";
import LikeButton from "@/components/LikeButton";
import { ReportButton } from "@/components/ReportButton";
import { SongTradingChart } from "@/components/SongTradingChart";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useWallet } from "@/hooks/useWallet";
import { useArtistProfile } from "@/hooks/useArtistProfile";
import { useBuySongTokens, useSellSongTokens, useSongPrice, useSongMetadata, useCreateSong, SONG_FACTORY_ADDRESS, useApproveToken, useBuyQuote, useSellQuote, useBondingCurveSupply, useSongTokenBalance, BONDING_CURVE_ADDRESS } from "@/hooks/useSongBondingCurve";
import { useBalance, useConnect, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { useXRGESwap, KTA_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, useXRGEQuote, useXRGEQuoteFromKTA, useXRGEQuoteFromUSDC, XRGE_TOKEN_ADDRESS as XRGE_TOKEN } from "@/hooks/useXRGESwap";
import { usePrivyToken } from "@/hooks/usePrivyToken";
import { usePrivyWagmi } from "@/hooks/usePrivyWagmi";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { Play, TrendingUp, Users, MessageSquare, ArrowUpRight, ArrowDownRight, Loader2, Rocket, Wallet, Copy, Check } from "lucide-react";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  play_count: number;
  created_at: string;
  token_address?: string | null;
  ticker?: string | null;
}

interface Comment {
  id: string;
  wallet_address: string;
  user_name: string | null;
  comment_text: string;
  created_at: string;
  profiles?: {
    artist_name: string | null;
    avatar_cid: string | null;
  };
}

interface SongTradeProps {
  playSong: (song: Song) => void;
  currentSong: Song | null;
  isPlaying: boolean;
}

const SongTrade = ({ playSong, currentSong, isPlaying }: SongTradeProps) => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const { fullAddress, isConnected } = useWallet();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount(); // Wagmi account check
  const { getAuthHeaders } = usePrivyToken();
  const { prices } = useTokenPrices();
  
  // Ensure Privy wallet is connected to wagmi
  usePrivyWagmi();
  
  // Debug wallet state
  useEffect(() => {
    console.log('💳 Wallet State:', {
      privy: { isConnected, address: fullAddress },
      wagmi: { isConnected: wagmiConnected, address: wagmiAddress },
    });
  }, [isConnected, fullAddress, wagmiConnected, wagmiAddress]);

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [songTokenAddress, setSongTokenAddress] = useState<`0x${string}` | undefined>();
  const [isProcessingBuy, setIsProcessingBuy] = useState(false);
  const [paymentToken, setPaymentToken] = useState<'XRGE' | 'ETH' | 'KTA' | 'USDC'>('XRGE');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [holders, setHolders] = useState<Array<{ address: string; balance: string; percentage: number }>>([]);
  const [loadingHolders, setLoadingHolders] = useState(false);

  // Fetch artist profile from IPFS
  const { profile: artistProfile } = useArtistProfile(song?.wallet_address || null);

  // Bonding curve hooks
  const { createSong, isPending: isDeploying, isConfirming, isSuccess: deploySuccess, hash, receipt } = useCreateSong();
  const { buyWithETH, buyWithXRGE, isPending: isBuying, isSuccess: buySuccess } = useBuySongTokens();
  const { sell, isPending: isSelling, isSuccess: sellSuccess } = useSellSongTokens();
  const { price: priceData, rawPrice, isLoading: priceLoading, refetch: refetchPrice } = useSongPrice(songTokenAddress);
  const { metadata: metadataData, isLoading: metadataLoading, refetch: refetchMetadata } = useSongMetadata(songTokenAddress);
  const { supply: bondingSupply, refetch: refetchSupply } = useBondingCurveSupply(songTokenAddress);
  const { balance: userBalance, refetch: refetchBalance } = useSongTokenBalance(songTokenAddress, fullAddress as `0x${string}` | undefined);
  const { approve, isPending: isApproving } = useApproveToken();
  const { connectors, connectAsync } = useConnect();
  const publicClient = usePublicClient();
  
  const ensureWagmiConnected = async () => {
    if (wagmiConnected) return;
    const privyConn = connectors.find(c => /privy/i.test(c.id) || /privy/i.test(c.name));
    const injected = connectors.find(c => c.id === 'injected');
    const target = privyConn || injected || connectors[0];
    if (!target) {
      throw new Error('No wallet connector available');
    }
    try {
      console.log('🔌 Ensuring wagmi connection with', target.name, target.id);
      await connectAsync({ connector: target });
    } catch (e) {
      console.error('Wagmi connect failed:', e);
      throw e;
    }
  };
  const { buyXRGEWithKTA, buyXRGEWithUSDC, approveKTA, approveUSDC, approveXRGE, getXRGEBalance, isPending: isSwapping } = useXRGESwap();
  
  // Get all token balances - use fullAddress as wagmi should sync with Privy
  const walletForBalance = (wagmiAddress || fullAddress) as `0x${string}` | undefined;
  const { data: ethBalance } = useBalance({ address: walletForBalance });
  const { data: xrgeBalance } = useBalance({ address: walletForBalance, token: XRGE_TOKEN });
  const { data: ktaBalance } = useBalance({ address: walletForBalance, token: KTA_TOKEN_ADDRESS });
  const { data: usdcBalance } = useBalance({ address: walletForBalance, token: USDC_TOKEN_ADDRESS });
  
  // Get XRGE quotes based on payment token
  const { expectedXRGE: xrgeFromETH } = useXRGEQuote(paymentToken === 'ETH' ? buyAmount : '0');
  const { expectedXRGE: xrgeFromKTA } = useXRGEQuoteFromKTA(paymentToken === 'KTA' ? buyAmount : '0');
  const { expectedXRGE: xrgeFromUSDC } = useXRGEQuoteFromUSDC(paymentToken === 'USDC' ? buyAmount : '0');
  
  // Calculate XRGE equivalent based on selected payment token
  const xrgeEquivalent = paymentToken === 'ETH' ? xrgeFromETH :
                         paymentToken === 'KTA' ? xrgeFromKTA :
                         paymentToken === 'USDC' ? xrgeFromUSDC :
                         buyAmount; // Already XRGE
  
  // Quote hooks for accurate bonding curve calculations
  const { tokensOut: buyQuote, isLoading: buyQuoteLoading } = useBuyQuote(songTokenAddress, xrgeEquivalent);
  const { xrgeOut: sellQuote, isLoading: sellQuoteLoading } = useSellQuote(songTokenAddress, sellAmount);

  // Real blockchain data or undefined if not deployed
  const priceInXRGE = priceData ? parseFloat(priceData) : undefined;
  const activeTradingSupply = bondingSupply ? parseFloat(bondingSupply) : undefined;
  const totalSupply = metadataData?.totalSupply ? parseFloat(metadataData.totalSupply) : undefined;
  const xrgeRaised = metadataData?.xrgeRaised ? parseFloat(metadataData.xrgeRaised) : 0;
  
  // Convert XRGE price to USD price
  const currentPrice = priceInXRGE && prices.xrge ? priceInXRGE * prices.xrge : undefined;
  const currentPriceAfterFee = currentPrice ? currentPrice * 0.97 : undefined; // After 3% sell fee
  const xrgeUsdPrice = prices.xrge || 0;
  
  // Calculate different market cap metrics in USD
  // Market cap = current price × tokens sold (not remaining supply)
  const tokensSold = activeTradingSupply !== undefined ? (990_000_000 - activeTradingSupply) : undefined;
  const circulatingMarketCap = currentPrice && tokensSold ? currentPrice * tokensSold : undefined;
  const fullyDilutedValue = currentPrice && totalSupply ? currentPrice * totalSupply : undefined;
  const realizedValueXRGE = xrgeRaised; // Actual XRGE spent by traders
  const realizedValueUSD = xrgeRaised * xrgeUsdPrice; // Convert to USD
  
  // Use circulating market cap as the primary display
  const marketCap = circulatingMarketCap;
  
  // Check if data looks like initial/unrealistic values
  const hasRealisticData = xrgeRaised > 0;

  useEffect(() => {
    if (songId) {
      fetchSong();
      fetchComments();
    }
  }, [songId]);

  useEffect(() => {
    // Load token address from database
    const loadTokenAddress = async () => {
      if (!song) return;
      
      if (song.token_address) {
        setSongTokenAddress(song.token_address as `0x${string}`);
      }
    };
    
    loadTokenAddress();
  }, [song]);

  // Watch for deployment states
  useEffect(() => {
    if (isDeploying) {
      toast({
        title: "Transaction pending...",
        description: "Please confirm the transaction in your wallet",
      });
    }
  }, [isDeploying]);

  useEffect(() => {
    if (isConfirming) {
      toast({
        title: "Transaction submitted!",
        description: "Waiting for blockchain confirmation...",
      });
    }
  }, [isConfirming]);

  // Refresh data after successful buy/sell
  useEffect(() => {
    if (buySuccess || sellSuccess) {
      // Wait a bit for blockchain to update
      setTimeout(() => {
        refetchPrice();
        refetchMetadata();
        refetchSupply();
        refetchBalance();
        toast({
          title: "Data refreshed!",
          description: "Your balance and prices have been updated",
        });
      }, 2000);
    }
  }, [buySuccess, sellSuccess]);

  // Fetch holders when token address is available
  useEffect(() => {
    if (songTokenAddress) {
      fetchHolders();
    }
  }, [songTokenAddress, buySuccess, sellSuccess]);

  const fetchHolders = async () => {
    if (!songTokenAddress) return;
    
    setLoadingHolders(true);
    try {
      // Fetch holders from song_purchases table
      const { data: purchases, error } = await supabase
        .from('song_purchases')
        .select('buyer_wallet_address')
        .eq('song_id', songId);

      if (error) throw error;

      // Count unique holders
      const holderCounts = purchases?.reduce((acc: Record<string, number>, purchase) => {
        const addr = purchase.buyer_wallet_address.toLowerCase();
        acc[addr] = (acc[addr] || 0) + 1;
        return acc;
      }, {});

      // Convert to array and sort by purchase count
      const holdersList = Object.entries(holderCounts || {})
        .map(([address, count]) => ({
          address,
          balance: count.toString(),
          percentage: 0 // Will calculate after we have total
        }))
        .sort((a, b) => parseInt(b.balance) - parseInt(a.balance));

      // Calculate percentages
      const total = holdersList.reduce((sum, h) => sum + parseInt(h.balance), 0);
      const holdersWithPercentage = holdersList.map(h => ({
        ...h,
        percentage: total > 0 ? (parseInt(h.balance) / total) * 100 : 0
      }));

      setHolders(holdersWithPercentage.slice(0, 10)); // Top 10
    } catch (error) {
      console.error('Error fetching holders:', error);
    } finally {
      setLoadingHolders(false);
    }
  };

  useEffect(() => {
    // Use a ref to prevent multiple executions
    let hasRun = false;
    
    const updateTokenAddress = async () => {
      if (deploySuccess && receipt && song && !hasRun) {
        hasRun = true;
        console.log('Deployment successful, processing receipt...', { receipt, songId: song.id });
        
        try {
          // Find the SongCreated event in the logs
          const songCreatedLog = receipt.logs.find((log: any) => {
            return log.address?.toLowerCase() === SONG_FACTORY_ADDRESS.toLowerCase();
          });

          console.log('Found SongCreated log:', songCreatedLog);

          if (songCreatedLog && songCreatedLog.topics && songCreatedLog.topics.length > 0) {
            // The first indexed parameter (songToken address) is in topics[1]
            const tokenAddress = `0x${songCreatedLog.topics[1].slice(-40)}` as `0x${string}`;
            
            console.log('Extracted token address:', tokenAddress);

            // Update database with token address
            const { data: fnData, error: fnError } = await supabase.functions.invoke('update-song-token', {
              body: { 
                songId: song.id, 
                tokenAddress,
                walletAddress: fullAddress?.toLowerCase() || '',
              },
            });

            console.log('Edge function update result:', { fnData, fnError });

            if (fnError) {
              console.error('Failed to update token address via function:', fnError);
              toast({
                title: "Error",
                description: "Failed to save token address to database",
                variant: "destructive",
              });
            } else {
              // Update local state without reloading
              setSongTokenAddress(tokenAddress);
              setSong((prev) => (prev ? { ...prev, token_address: tokenAddress } as Song : prev));
              toast({
                title: "Success",
                description: "Your song is now live on the bonding curve!",
              });
            }
          } else {
            console.error('Could not find SongCreated event in transaction receipt');
            toast({
              title: "Warning",
              description: "Deployed but couldn't extract token address. Please refresh.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error processing deployment:', error);
          toast({
            title: "Error",
            description: "Deployment confirmed but failed to update database",
            variant: "destructive",
          });
        }
      }
    };

    updateTokenAddress();
  }, [deploySuccess, receipt]);

  const fetchSong = async () => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("id", songId)
        .single();

      if (error) throw error;
      setSong(data);
    } catch (error) {
      console.error("Error fetching song:", error);
      toast({
        title: "Error",
        description: "Failed to load song",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const { data: commentsData, error } = await supabase
        .from("comments")
        .select("*")
        .eq("song_id", songId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for comment authors
      const walletAddresses = [...new Set(commentsData?.map(c => c.wallet_address) || [])];
      const { data: profilesData } = await supabase
        .from('public_profiles')
        .select('wallet_address, artist_name, avatar_cid')
        .in('wallet_address', walletAddresses);

      const commentsWithProfiles = commentsData?.map(comment => ({
        ...comment,
        profiles: profilesData?.find(p => p.wallet_address === comment.wallet_address) || null,
      })) || [];

      setComments(commentsWithProfiles as Comment[]);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleBuy = async () => {
    if (!isConnected || !fullAddress) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to buy",
        variant: "destructive",
      });
      return;
    }

    console.log('🔍 Wallet check:', { 
      isConnected, 
      privyAddress: fullAddress, 
      wagmiAddress,
      paymentToken 
    });

    // Ensure wagmi is connected to Privy wallet before writing transactions
    try {
      await ensureWagmiConnected();
    } catch (e) {
      toast({
        title: "Wallet connection error",
        description: "Could not connect signing wallet. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!songTokenAddress) {
      toast({
        title: "Song Token Not Deployed",
        description: "This song hasn't been deployed to the bonding curve yet. Contact the artist to deploy it.",
        variant: "destructive",
      });
      return;
    }

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingBuy(true);
    try {
      if (paymentToken === 'ETH') {
        // Buy directly with ETH (bonding curve handles swap internally)
        toast({
          title: "Transaction pending",
          description: "Please confirm ETH payment in your wallet",
        });
        
        await buyWithETH(songTokenAddress, buyAmount, 500); // 5% slippage
        
        toast({
          title: "Purchase successful!",
          description: `Bought tokens with ${buyAmount} ETH`,
        });
      } else if (paymentToken === 'XRGE') {
        // Buy with XRGE (2-step: approve then buy)
        toast({
          title: "Approval required",
          description: "Please approve XRGE spending in your wallet",
        });
        
        await approve(XRGE_TOKEN, buyAmount);
        
        toast({
          title: "Approval confirmed",
          description: "Now processing your purchase...",
        });
        
        await buyWithXRGE(songTokenAddress, buyAmount, "0");
        
        toast({
          title: "Purchase successful!",
          description: `Bought tokens for ${buyAmount} XRGE`,
        });
      } else if (paymentToken === 'KTA') {
        try {
          console.log("=== Starting KTA to Song Token Swap Process ===");
          console.log("KTA amount:", buyAmount);
          console.log("Expected XRGE from quote:", xrgeEquivalent);
          
          // Calculate the XRGE amount we'll use (from the quote)
          const xrgeAmountToUse = xrgeEquivalent || "0";
          
          if (parseFloat(xrgeAmountToUse) === 0) {
            throw new Error("Cannot calculate XRGE amount from KTA. Please try again.");
          }
          
          console.log("🎯 Will use XRGE amount for purchase:", xrgeAmountToUse);
          
          // Step 1: Approve KTA for swap
          toast({
            title: "Step 1/3: Approve KTA",
            description: "⏳ Please confirm the transaction in your wallet popup...",
          });
          
          console.log("Requesting KTA approval...");
          const approveHash = await approveKTA(buyAmount);
          console.log("✅ KTA approval hash:", approveHash);
          
          // Wait for approval to be mined
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Step 2: Swap KTA to XRGE
          toast({
            title: "Step 2/3: Swapping KTA to XRGE",
            description: `⏳ Swapping ${buyAmount} KTA for ~${parseFloat(xrgeAmountToUse).toFixed(2)} XRGE...`,
          });
          
          // Get XRGE balance BEFORE swap
          const xrgeBalanceBefore = await getXRGEBalance();
          console.log("XRGE balance before KTA swap:", xrgeBalanceBefore);
          
          console.log("Requesting KTA to XRGE swap...");
          const swapHash = await buyXRGEWithKTA(buyAmount, 500);
          console.log("✅ KTA to XRGE swap hash:", swapHash);
          console.log("🔗 Check transaction on BaseScan:", `https://basescan.org/tx/${swapHash}`);
          
          // Wait for swap transaction to be mined and get actual XRGE received
          toast({
            title: "Waiting for swap confirmation...",
            description: "This usually takes a few seconds on Base",
          });
          
          let actualXRGEReceived = "0";
          let swapAttempts = 0;
          const maxSwapAttempts = 60;
          
          // Initial wait
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          while (swapAttempts < maxSwapAttempts) {
            swapAttempts++;
            const currentBalance = await getXRGEBalance();
            const balanceDiff = parseFloat(currentBalance) - parseFloat(xrgeBalanceBefore);
            console.log(`KTA Swap - Balance check attempt ${swapAttempts}: ${currentBalance} XRGE (diff: +${balanceDiff})`);
            
            if (balanceDiff > 0) {
              actualXRGEReceived = balanceDiff.toString();
              console.log(`✅ XRGE received from KTA swap: ${actualXRGEReceived} (before: ${xrgeBalanceBefore}, after: ${currentBalance})`);
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          if (parseFloat(actualXRGEReceived) === 0) {
            throw new Error("KTA to XRGE swap failed - no XRGE received");
          }
          
          // Step 3: Approve XRGE and buy song tokens
          toast({
            title: "Step 3/3: Buying song tokens",
            description: `⏳ Approving and purchasing with ${parseFloat(actualXRGEReceived).toFixed(2)} XRGE...`,
          });
          
          console.log("🔐 Approving XRGE for bonding curve...");
          console.log("Bonding curve address:", BONDING_CURVE_ADDRESS);
          console.log("Actual XRGE received to approve:", actualXRGEReceived);
          const approveXRGEHash = await approveXRGE(actualXRGEReceived, BONDING_CURVE_ADDRESS as `0x${string}`);
          console.log("✅ XRGE approval hash:", approveXRGEHash);
          console.log("🔗 Check approval on BaseScan:", `https://basescan.org/tx/${approveXRGEHash}`);
          
          // Wait for the approval transaction to be confirmed on-chain
          console.log("⏳ Waiting for XRGE approval to be confirmed on-chain...");
          if (publicClient && approveXRGEHash) {
            try {
              const receipt = await publicClient.waitForTransactionReceipt({
                hash: approveXRGEHash as `0x${string}`,
                confirmations: 1,
                timeout: 30000, // 30 second timeout
              });
              console.log("✅ XRGE approval confirmed! Block:", receipt.blockNumber);
            } catch (waitError) {
              console.warn("Could not wait for receipt, falling back to fixed delay:", waitError);
              await new Promise(resolve => setTimeout(resolve, 6000));
            }
          } else {
            // Fallback to fixed delay if publicClient not available
            console.log("No publicClient available, using fixed delay");
            await new Promise(resolve => setTimeout(resolve, 6000));
          }
          
          // Use 98% of the actual XRGE received from swap
          const amountToSpend = parseFloat(actualXRGEReceived) * 0.98;
          const safeAmount = amountToSpend.toFixed(18); // Keep 18 decimals
          console.log(`Using 98% of actual XRGE received: ${safeAmount} (98% of ${actualXRGEReceived})`);
          console.log("Final safe amount to spend:", safeAmount);
          
          if (parseFloat(safeAmount) <= 0) {
            throw new Error("Cannot proceed with zero XRGE amount");
          }
          
          // Check how many tokens we'd get with this amount
          console.log("🔍 Checking bonding curve quote for amount:", safeAmount);
          console.log("Current bonding curve price (XRGE):", priceData);
          console.log("Bonding curve supply:", bondingSupply);
          
          console.log("🎵 Buying song tokens with XRGE amount:", safeAmount);
          
          const buyHash = await buyWithXRGE(songTokenAddress, safeAmount, "0");
          console.log("✅ Song token purchase hash:", buyHash);
          console.log("🔗 Check transaction on BaseScan:", `https://basescan.org/tx/${buyHash}`);
          
          toast({
            title: "Purchase successful!",
            description: `Bought tokens using ${buyAmount} KTA`,
          });
        } catch (error) {
          console.error("❌ KTA swap process failed:", error);
          console.error("Full error object:", JSON.stringify(error, null, 2));
          
          // Provide specific error messages based on the error
          let errorMessage = "Failed to complete KTA swap process";
          if (error instanceof Error) {
            console.error("Error details:", error.message);
            console.error("Error stack:", error.stack);
            
            if (error.message.includes("User rejected") || error.message.includes("user rejected") || error.message.includes("User denied")) {
              errorMessage = "Transaction was cancelled. Please try again and approve all transactions.";
            } else if (error.message.includes("Insufficient XRGE balance") || error.message.includes("insufficient funds")) {
              errorMessage = "Insufficient funds for transaction. The XRGE approval may not have been mined yet. Please wait a moment and try again.";
            } else if (error.message.includes("execution reverted") || error.message.includes("ERC20: insufficient allowance")) {
              errorMessage = "Transaction reverted. The XRGE approval may not have been mined yet. Please wait a moment and try again.";
            } else if (error.message.includes("Swap transaction may have failed")) {
              errorMessage = error.message; // Use the full error message with BaseScan link
            } else {
              errorMessage = error.message;
            }
          }
          
          toast({
            title: "Swap Failed",
            description: errorMessage,
            variant: "destructive",
          });
          
          // Don't throw - just stop the process
          return;
        }
      } else if (paymentToken === 'USDC') {
        // Swap USDC to XRGE first, then buy
        toast({
          title: "Step 1/3: Approve USDC",
          description: "Please approve USDC for swapping",
        });
        
        const usdcTxHash = await approveUSDC(buyAmount);
        console.log("USDC Approval tx hash:", usdcTxHash);
        
        toast({
          title: "Step 2/3: Swapping USDC to XRGE",
          description: "Converting your USDC to XRGE...",
        });
        
        // Get XRGE balance BEFORE swap
        const balanceBefore = await getXRGEBalance();
        console.log("XRGE balance before USDC swap:", balanceBefore);
        
        const swapTxHash = await buyXRGEWithUSDC(buyAmount, 500);
        console.log("USDC → XRGE swap tx hash:", swapTxHash);
        
        // Get XRGE balance difference after swap
        let xrgeReceived = "0";
        let attempts = 0;
        const maxAttempts = 60;
        
        console.log("Waiting for XRGE balance increase after USDC swap...");
        
        // Initial wait for transaction to be mined
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        while (attempts < maxAttempts) {
          attempts++;
          const currentBalance = await getXRGEBalance();
          const balanceDiff = parseFloat(currentBalance) - parseFloat(balanceBefore);
          console.log(`USDC Swap - Balance check attempt ${attempts}: ${currentBalance} XRGE (diff: +${balanceDiff})`);
          
          if (balanceDiff > 0) {
            xrgeReceived = balanceDiff.toString();
            console.log(`✅ XRGE received from USDC swap: ${xrgeReceived} (before: ${balanceBefore}, after: ${currentBalance})`);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (parseFloat(xrgeReceived) === 0) {
          throw new Error("USDC to XRGE swap failed - no XRGE received");
        }
        
        toast({
          title: "Step 3/4: Approving XRGE",
          description: "Approving XRGE for song token purchase...",
        });
        
        const xrgeApproveTxHash = await approveXRGE(xrgeReceived, BONDING_CURVE_ADDRESS);
        console.log("XRGE Approval for bonding curve tx hash:", xrgeApproveTxHash);
        
        // Wait for XRGE approval to be confirmed on-chain
        if (publicClient && xrgeApproveTxHash) {
          console.log("Waiting for XRGE approval to be mined...");
          await publicClient.waitForTransactionReceipt({
            hash: xrgeApproveTxHash as `0x${string}`,
            confirmations: 1,
          });
          console.log("✅ XRGE approval confirmed on-chain");
        }
        
        toast({
          title: "Step 4/4: Buying song tokens",
          description: "Purchasing with swapped XRGE...",
        });
        
        // Use 98% of XRGE to account for precision/slippage
        const safeAmount = (parseFloat(xrgeReceived) * 0.98).toString();
        console.log(`Final purchase with XRGE amount: ${safeAmount} (98% of ${xrgeReceived})`);
        
        await buyWithXRGE(songTokenAddress, safeAmount, "0");
        
        toast({
          title: "Purchase successful!",
          description: `Bought tokens using ${buyAmount} USDC`,
        });
      }
      
      // Record purchase in database
      if (song && fullAddress) {
        try {
          const { error: purchaseError } = await supabase
            .from('song_purchases')
            .insert({
              song_id: song.id,
              buyer_wallet_address: fullAddress.toLowerCase(),
              artist_wallet_address: song.wallet_address.toLowerCase(),
            });
          
          if (purchaseError) {
            console.error('Failed to record purchase:', purchaseError);
            // Don't fail the whole transaction, just log it
          } else {
            console.log('✅ Purchase recorded in database');
          }
        } catch (dbError) {
          console.error('Database error recording purchase:', dbError);
        }
      }
      
      // Refetch all balances and bonding curve data after successful purchase
      console.log("🔄 Refreshing balances and bonding curve data...");
      
      toast({
        title: "Updating balances...",
        description: "Fetching latest data from blockchain",
      });
      
      // Wait a bit for blockchain to update
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        // Refetch bonding curve data
        await refetchPrice();
        await refetchSupply();
        await refetchMetadata();
        
        console.log("✅ Data refreshed");
        
        toast({
          title: "Balances updated! ✅",
          description: "All data has been refreshed",
        });
      } catch (refreshError) {
        console.error("Error refreshing data:", refreshError);
      }
      
      setBuyAmount("");
    } catch (error) {
      console.error("Buy error:", error);
      toast({
        title: "Purchase failed",
        description: error instanceof Error ? error.message : "Failed to buy tokens",
        variant: "destructive",
      });
    } finally {
      setIsProcessingBuy(false);
    }
  };

  const handleSell = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to sell",
        variant: "destructive",
      });
      return;
    }

    if (!songTokenAddress) {
      toast({
        title: "Song Token Not Deployed",
        description: "This song hasn't been deployed to the bonding curve yet.",
        variant: "destructive",
      });
      return;
    }

    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: Approve bonding curve to spend song tokens
      toast({
        title: "Approval required",
        description: "Please approve your song tokens for selling",
      });
      
      await approve(songTokenAddress, sellAmount);
      
      toast({
        title: "Approval confirmed",
        description: "Now processing your sale...",
      });
      
      // Step 2: Execute the sell
      await sell(songTokenAddress, sellAmount, "0"); // accept any XRGE out (no min)
      
      toast({
        title: "Sale successful!",
        description: `Sold ${sellAmount} tokens`,
      });
      setSellAmount("");
      
      // Refresh all data after successful sell
      refetchBalance();
      refetchPrice();
      refetchSupply();
      refetchMetadata();
    } catch (error) {
      console.error("Sell error:", error);
      toast({
        title: "Sale failed",
        description: error instanceof Error ? error.message : "Failed to sell tokens",
        variant: "destructive",
      });
    }
  };

  const handleDeploy = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to deploy",
        variant: "destructive",
      });
      return;
    }

    if (!song) return;

    if (songTokenAddress) {
      toast({
        title: "Already deployed",
        description: "This song is already deployed to the bonding curve",
      });
      return;
    }

    const ticker = song.ticker || song.title.substring(0, 4).toUpperCase();
    
    try {
      // Fetch metadata CID from song data
      const metadataCid = `${song.audio_cid}_metadata`;
      
      // Call smart contract - the useEffect will handle the success case
      await createSong(song.title, ticker, metadataCid);
    } catch (error) {
      console.error("Deploy error:", error);
      toast({
        title: "Deployment failed",
        description: error instanceof Error ? error.message : "Failed to deploy to bonding curve",
        variant: "destructive",
      });
    }
  };

  const addTokenToWallet = async () => {
    if (!songTokenAddress || !song) {
      toast({
        title: "Token not available",
        description: "Song token hasn't been deployed yet",
        variant: "destructive",
      });
      return;
    }

    try {
      const wasAdded = await (window as any).ethereum?.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: songTokenAddress,
            symbol: song.ticker || 'SONG',
            decimals: 18,
            image: song.cover_cid ? getIPFSGatewayUrl(song.cover_cid, undefined, true) : undefined,
          },
        },
      });

      if (wasAdded) {
        toast({
          title: "Token added!",
          description: `${song.ticker} has been added to your wallet`,
        });
      }
    } catch (error) {
      console.error('Error adding token:', error);
      toast({
        title: "Could not add token",
        description: "You can manually add it using the contract address",
        variant: "destructive",
      });
    }
  };

  const copyTokenAddress = async () => {
    if (!songTokenAddress) return;
    
    try {
      await navigator.clipboard.writeText(songTokenAddress);
      setCopiedAddress(true);
      toast({
        title: "Address copied!",
        description: "Token address copied to clipboard",
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  const handlePostComment = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to comment",
        variant: "destructive",
      });
      return;
    }

    if (!commentText.trim()) {
      toast({
        title: "Comment required",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('add-song-comment', {
        body: {
          songId,
          commentText: commentText.trim(),
          walletAddress: fullAddress,
        },
      });

      if (error) throw error;

      toast({
        title: "Comment posted!",
        description: "Your comment has been added",
      });

      setCommentText("");
      fetchComments();
    } catch (error) {
      console.error("Error posting comment:", error);
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-mono text-muted-foreground">Song not found</h1>
          <Button onClick={() => navigate("/")} className="mt-4" variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const coverImageUrl = song.cover_cid ? getIPFSGatewayUrl(song.cover_cid, undefined, true) : '/og-image.png';
  const pageUrl = `https://edbd29f5-fe8e-435d-b3d2-8111ac95287a.lovableproject.com/song/${song.id}`;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Helmet>
        <title>{song.title} - {song.artist || 'Unknown Artist'} | ROUGEE.PLAY</title>
        <meta name="description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on ROUGEE.PLAY. Stream and trade music NFTs on the blockchain.`} />
        
        <meta property="og:title" content={`${song.title} - ${song.artist || 'Unknown Artist'}`} />
        <meta property="og:description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on ROUGEE.PLAY`} />
        <meta property="og:image" content={coverImageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="music.song" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${song.title} - ${song.artist || 'Unknown Artist'}`} />
        <meta name="twitter:description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on ROUGEE.PLAY`} />
        <meta name="twitter:image" content={coverImageUrl} />
      </Helmet>

      <Header />
      <Navigation />
      <NetworkInfo />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8">
        {/* Song Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
          <Card className="console-bg tech-border p-4 md:p-6 lg:col-span-2">
            <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-32 md:w-32 border-2 border-neon-green shrink-0">
                <AvatarImage
                  src={song.cover_cid ? getIPFSGatewayUrl(song.cover_cid) : undefined}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-2xl md:text-3xl">
                  {song.title.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 w-full min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold neon-text mb-1 md:mb-2 truncate">
                  {song.title}
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-mono mb-3 md:mb-4 truncate">
                  By {song.artist || "Unknown Artist"}
                </p>

                <div className="flex flex-wrap gap-2 md:gap-3 mb-3 md:mb-4">
                  <Badge variant="outline" className="font-mono text-xs">
                    <Play className="h-3 w-3 mr-1" />
                    {song.play_count} plays
                  </Badge>
                  {marketCap !== undefined && marketCap > 0 && (
                    <Badge variant="outline" className="font-mono text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      ${marketCap < 0.01 ? marketCap.toFixed(6) : marketCap.toFixed(2)} MCap
                    </Badge>
                  )}
                  {songTokenAddress && !hasRealisticData && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      🎯 Ready to Trade
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2 md:gap-3">
                  <Button 
                    variant="neon" 
                    size="sm"
                    className="flex-1 text-xs sm:text-sm"
                    onClick={() => song && playSong(song)}
                  >
                    <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {currentSong?.id === song.id && isPlaying ? "PLAYING..." : "PLAY"}
                  </Button>
                  
                  {!songTokenAddress && song.wallet_address?.toLowerCase() === fullAddress?.toLowerCase() && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleDeploy}
                      disabled={isDeploying}
                      className="text-xs sm:text-sm"
                    >
                      {isDeploying ? (
                        <>
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                          DEPLOYING...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          DEPLOY
                        </>
                      )}
                    </Button>
                  )}
                  
                  <LikeButton songId={song.id} size="sm" />
                  <ReportButton songId={song.id} />
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="console-bg tech-border p-3 sm:p-4 md:p-6">
            {songTokenAddress && currentPrice !== undefined ? (
              <>
                <h3 className="text-sm sm:text-base md:text-lg font-mono font-bold neon-text mb-2 md:mb-3">CURRENT PRICE</h3>
                <div className="text-xl sm:text-2xl md:text-3xl font-mono font-bold text-neon-green mb-1 md:mb-2 break-all">
                  {currentPrice ? (
                    currentPrice < 0.01 ? 
                      `$${currentPrice.toFixed(10).replace(/\.?0+$/, '')}` : 
                      `$${currentPrice.toFixed(6)}`
                  ) : '$0'}
                </div>
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-mono mb-3 md:mb-4 break-words">
                  per token {priceInXRGE && <span className="opacity-50">({priceInXRGE.toFixed(6)} XRGE)</span>}
                </p>
                
                {userBalance && parseFloat(userBalance) > 0 && (
                  <div className="mb-3 p-2 sm:p-3 bg-neon-green/10 border border-neon-green/30 rounded">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mb-1">Your Holdings</div>
                        <div className="text-base sm:text-lg font-mono font-bold text-neon-green break-words">
                          {parseFloat(userBalance).toLocaleString(undefined, {maximumFractionDigits: 2})} {song?.ticker || 'tokens'}
                        </div>
                        {currentPriceAfterFee && (
                          <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-1 break-words">
                            Value: ${(parseFloat(userBalance) * currentPriceAfterFee).toFixed(4)}
                            <span className="opacity-50 ml-1 text-[9px] sm:text-[10px]">(after 3% sell fee)</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={addTokenToWallet}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs bg-neon-green/20 hover:bg-neon-green/30 text-neon-green rounded font-mono transition-colors shrink-0"
                        title="Add to wallet"
                      >
                        <Wallet className="h-3 w-3" />
                        <span className="hidden sm:inline">Add</span>
                      </button>
                    </div>
                    <button
                      onClick={copyTokenAddress}
                      className="w-full mt-2 flex items-center justify-center gap-1 px-2 py-1 text-[10px] sm:text-xs bg-black/20 hover:bg-black/30 text-muted-foreground rounded font-mono transition-colors overflow-hidden"
                    >
                      {copiedAddress ? (
                        <>
                          <Check className="h-3 w-3 shrink-0" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-full">{songTokenAddress}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {xrgeUsdPrice > 0 && (
                  <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] sm:text-xs text-blue-400 font-mono flex items-center gap-2">
                    <img src={xrgeLogo} alt="XRGE" className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                    <span className="break-words">XRGE = ${xrgeUsdPrice.toFixed(6)} USD</span>
                  </div>
                )}
                
                {!hasRealisticData && (
                  <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] sm:text-xs text-yellow-500 font-mono">
                    ⚠️ No trading activity yet - Make the first trade!
                  </div>
                )}
                
                  {songTokenAddress && !userBalance && (
                    <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-400 font-mono">Add token to wallet:</span>
                        <button
                          onClick={addTokenToWallet}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded font-mono transition-colors"
                        >
                          <Wallet className="h-3 w-3" />
                          Add to Wallet
                        </button>
                      </div>
                      <button
                        onClick={copyTokenAddress}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs bg-black/20 hover:bg-black/30 text-muted-foreground rounded font-mono transition-colors"
                      >
                        {copiedAddress ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span className="truncate">{songTokenAddress}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-xs md:text-sm font-mono">
                    {hasRealisticData ? (
                      <>
                      {circulatingMarketCap !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground" title="Current price × tokens sold">Market Cap:</span>
                          <span className="text-foreground font-semibold">
                            ${circulatingMarketCap < 1 ? circulatingMarketCap.toFixed(6) : circulatingMarketCap.toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground" title="Total XRGE deposited into bonding curve">Total Value Locked:</span>
                        <span className="text-neon-green font-semibold">
                          ${realizedValueUSD < 1 ? realizedValueUSD.toFixed(6) : realizedValueUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs opacity-70">
                        <span className="text-muted-foreground" title="All-time XRGE spent on this token">Total Traded (XRGE):</span>
                        <span className="text-foreground">
                          {realizedValueXRGE.toLocaleString(undefined, {maximumFractionDigits: 4})} XRGE
                        </span>
                      </div>
                      {activeTradingSupply !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground" title="Number of tokens purchased from bonding curve">Tokens Sold:</span>
                          <span className="text-foreground">
                            {(990_000_000 - activeTradingSupply).toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </span>
                        </div>
                      )}
                      {fullyDilutedValue !== undefined && fullyDilutedValue !== circulatingMarketCap && (
                        <div className="flex justify-between text-xs opacity-70">
                          <span className="text-muted-foreground">Fully Diluted:</span>
                          <span className="text-foreground">
                            ${fullyDilutedValue < 1 ? fullyDilutedValue.toFixed(6) : fullyDilutedValue.toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {circulatingMarketCap !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Initial Market Cap:</span>
                          <span className="text-foreground opacity-60">
                            ${circulatingMarketCap < 1 ? circulatingMarketCap.toFixed(6) : circulatingMarketCap.toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </span>
                        </div>
                      )}
                      {activeTradingSupply !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Starting Supply:</span>
                          <span className="text-foreground opacity-60">
                            {activeTradingSupply.toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Volume:</span>
                        <span className="text-foreground opacity-60">0 XRGE</span>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-base md:text-lg font-mono font-bold mb-2">Not Deployed Yet</h3>
                <p className="text-xs md:text-sm text-muted-foreground font-mono">
                  {song.wallet_address?.toLowerCase() === fullAddress?.toLowerCase() 
                    ? "Deploy this song to enable trading"
                    : "This song hasn't been deployed to the bonding curve yet"}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Artist Cover & Trading Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
          {/* Large Artist Cover Display */}
          <Card className="console-bg tech-border p-3 md:p-4 lg:p-6 flex items-center justify-center">
            <div className="w-full aspect-square max-w-md mx-auto">
              {artistProfile?.cover_cid ? (
                <img
                  src={getIPFSGatewayUrl(artistProfile.cover_cid)}
                  alt={artistProfile.artist_name || song.artist || 'Artist'}
                  className="w-full h-full object-cover rounded-lg border-2 border-neon-green/50 shadow-lg"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/20 rounded-lg border-2 border-neon-green/50">
                  <div className="text-center p-4">
                    <div className="text-4xl md:text-6xl font-mono text-neon-green mb-4">
                      {(song.artist || song.title).substring(0, 2).toUpperCase()}
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground font-mono">
                      {song.artist || 'Unknown Artist'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Trading Chart */}
          <div className="lg:col-span-2">
            <SongTradingChart 
              songTokenAddress={songTokenAddress} 
              priceInXRGE={priceInXRGE}
              bondingSupply={bondingSupply}
            />
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="trade" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 md:mb-6 h-auto">
            <TabsTrigger value="trade" className="text-xs sm:text-sm">TRADE</TabsTrigger>
            <TabsTrigger value="holders" className="text-xs sm:text-sm">HOLDERS</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">COMMENTS ({comments.length})</span>
              <span className="sm:hidden">💬 ({comments.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Trade Tab */}
          <TabsContent value="trade" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
              {/* Buy Card */}
              <Card className="console-bg tech-border p-4 md:p-6">
                <h3 className="text-lg md:text-xl font-mono font-bold neon-text mb-4 flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                  {song?.cover_cid ? (
                    <Avatar className="h-5 w-5 md:h-6 md:w-6 border border-neon-green">
                      <AvatarImage
                        src={getIPFSGatewayUrl(song.cover_cid)}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xs">
                        {song.ticker?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                  BUY ${song?.ticker ? song.ticker.toUpperCase() : ''}
                </h3>

                <div className="space-y-3 md:space-y-4">
                  {/* Payment Token Selector */}
                  <div>
                    <label className="text-xs md:text-sm font-mono text-muted-foreground mb-2 block">
                      Pay with
                    </label>
                    <Select value={paymentToken} onValueChange={(value: any) => setPaymentToken(value)}>
                      <SelectTrigger className="font-mono">
                        <SelectValue>
                          {paymentToken === 'ETH' && (
                            <div className="flex items-center gap-2">
                              <span>💎</span>
                              <span>ETH (Ethereum)</span>
                            </div>
                          )}
                          {paymentToken === 'XRGE' && (
                            <div className="flex items-center gap-2">
                              <img src={xrgeLogo} alt="XRGE" className="w-4 h-4" />
                              <span>XRGE (Recommended)</span>
                            </div>
                          )}
                          {paymentToken === 'KTA' && (
                            <div className="flex items-center gap-2">
                              <img src={ktaLogo} alt="KTA" className="w-4 h-4" />
                              <span>KTA</span>
                            </div>
                          )}
                          {paymentToken === 'USDC' && (
                            <div className="flex items-center gap-2">
                              <span>💵</span>
                              <span>USDC (Stablecoin)</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ETH" className="font-mono">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span>💎</span>
                              <span>ETH</span>
                            </div>
                            {wagmiAddress && ethBalance && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {parseFloat(ethBalance.formatted).toFixed(4)}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                        <SelectItem value="XRGE" className="font-mono">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <img src={xrgeLogo} alt="XRGE" className="w-4 h-4" />
                              <span>XRGE ⭐</span>
                            </div>
                            {wagmiAddress && xrgeBalance && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {parseFloat(xrgeBalance.formatted).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                        <SelectItem value="KTA" className="font-mono">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <img src={ktaLogo} alt="KTA" className="w-4 h-4" />
                              <span>KTA</span>
                            </div>
                            {wagmiAddress && ktaBalance && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {parseFloat(ktaBalance.formatted).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                        <SelectItem value="USDC" className="font-mono">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span>💵</span>
                              <span>USDC</span>
                            </div>
                            {wagmiAddress && usdcBalance && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {parseFloat(usdcBalance.formatted).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs md:text-sm font-mono text-muted-foreground">
                        Amount ({paymentToken})
                      </label>
                      {wagmiAddress && (
                        <button
                          onClick={() => {
                            const balance = paymentToken === 'ETH' ? ethBalance :
                                          paymentToken === 'XRGE' ? xrgeBalance :
                                          paymentToken === 'KTA' ? ktaBalance :
                                          usdcBalance;
                            if (balance?.formatted) {
                              setBuyAmount(balance.formatted);
                            }
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                        >
                          Balance: {
                            paymentToken === 'ETH' ? (ethBalance?.formatted ? parseFloat(ethBalance.formatted).toFixed(4) : '0') :
                            paymentToken === 'XRGE' ? (xrgeBalance?.formatted ? parseFloat(xrgeBalance.formatted).toFixed(2) : '0') :
                            paymentToken === 'KTA' ? (ktaBalance?.formatted ? parseFloat(ktaBalance.formatted).toFixed(2) : '0') :
                            (usdcBalance?.formatted ? parseFloat(usdcBalance.formatted).toFixed(2) : '0')
                          } (MAX)
                        </button>
                      )}
                    </div>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div className="console-bg p-3 md:p-4 rounded-lg border border-border">
                    {paymentToken !== 'XRGE' && buyAmount && parseFloat(buyAmount) > 0 && (
                      <div className="flex justify-between text-xs md:text-sm font-mono mb-2 pb-2 border-b border-border">
                        <span className="text-muted-foreground">XRGE equivalent:</span>
                        <span className="text-blue-400 flex items-center gap-1">
                          <img src={xrgeLogo} alt="XRGE" className="w-3 h-3" />
                          ~{parseFloat(xrgeEquivalent).toFixed(4)} XRGE
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs md:text-sm font-mono mb-2">
                      <span className="text-muted-foreground">You will receive:</span>
                      <span className="text-foreground">
                        {buyQuoteLoading ? (
                          <Loader2 className="h-3 w-3 inline animate-spin" />
                        ) : (
                          `~${buyQuote ? parseFloat(buyQuote).toFixed(2) : "0"} tokens`
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs md:text-sm font-mono">
                      <span className="text-muted-foreground">Price impact:</span>
                      <span className="text-green-500">
                        {xrgeEquivalent && priceInXRGE && buyQuote && parseFloat(buyQuote) > 0 && activeTradingSupply ? (
                          (() => {
                            // Calculate market cap change: (new supply * final price) - (current supply * current price)
                            const newSupply = activeTradingSupply + parseFloat(buyQuote);
                            const avgPricePerToken = parseFloat(xrgeEquivalent) / parseFloat(buyQuote);
                            const currentMC = activeTradingSupply * priceInXRGE;
                            const newMC = newSupply * avgPricePerToken;
                            const mcImpact = ((newMC - currentMC) / currentMC) * 100;
                            return `~${mcImpact.toFixed(2)}%`;
                          })()
                        ) : (
                          "~0%"
                        )}
                      </span>
                    </div>
                  </div>

                  <Button 
                    onClick={handleBuy} 
                    className="w-full" 
                    variant="neon" 
                    size="sm"
                    disabled={isProcessingBuy || isBuying || isApproving || isSwapping || !songTokenAddress}
                  >
                    {(isProcessingBuy || isBuying || isApproving || isSwapping) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {isApproving || isSwapping ? "PROCESSING..." : isProcessingBuy || isBuying ? "BUYING..." : `BUY WITH ${paymentToken}`}
                  </Button>

                  {(paymentToken === 'KTA' || paymentToken === 'USDC') && (
                    <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 font-mono text-center">
                      💡 {paymentToken} purchase requires 3 steps: Approve → Swap to XRGE → Buy
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground font-mono text-center">
                    {songTokenAddress ? '✅ Bonding curve active' : '⚠️ Song not deployed to bonding curve'}
                  </p>
                </div>
              </Card>

              {/* Sell Card */}
              <Card className="console-bg tech-border p-4 md:p-6">
                <h3 className="text-lg md:text-xl font-mono font-bold neon-text mb-4 flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
                  {song?.cover_cid ? (
                    <Avatar className="h-5 w-5 md:h-6 md:w-6 border border-neon-green">
                      <AvatarImage
                        src={getIPFSGatewayUrl(song.cover_cid)}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xs">
                        {song.ticker?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                  SELL ${song?.ticker ? song.ticker.toUpperCase() : ''}
                </h3>

                <div className="space-y-3 md:space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs md:text-sm font-mono text-muted-foreground">
                        Amount (${song?.ticker ? song.ticker.toUpperCase() : 'Tokens'})
                      </label>
                      {userBalance && parseFloat(userBalance) > 0 && (
                        <button
                          onClick={() => setSellAmount(userBalance)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                        >
                          Balance: {parseFloat(userBalance).toFixed(2)} (MAX)
                        </button>
                      )}
                    </div>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div className="console-bg p-3 md:p-4 rounded-lg border border-border">
                    <div className="flex justify-between text-xs md:text-sm font-mono mb-2">
                      <span className="text-muted-foreground">You will receive:</span>
                      <span className="text-foreground">
                        {sellQuoteLoading ? (
                          <Loader2 className="h-3 w-3 inline animate-spin" />
                        ) : (
                          `~${sellQuote ? parseFloat(sellQuote).toFixed(6) : "0"} XRGE`
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs md:text-sm font-mono">
                      <span className="text-muted-foreground">Price impact:</span>
                      <span className="text-red-500">
                        {sellAmount && priceInXRGE && sellQuote && parseFloat(sellAmount) > 0 && activeTradingSupply ? (
                          (() => {
                            // Calculate market cap change when selling
                            const newSupply = activeTradingSupply - parseFloat(sellAmount);
                            const avgPricePerToken = parseFloat(sellQuote) / parseFloat(sellAmount);
                            const currentMC = activeTradingSupply * priceInXRGE;
                            const newMC = newSupply > 0 ? newSupply * avgPricePerToken : 0;
                            const mcImpact = ((newMC - currentMC) / currentMC) * 100;
                            return `~${Math.abs(mcImpact).toFixed(2)}%`;
                          })()
                        ) : (
                          "~0%"
                        )}
                      </span>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSell} 
                    className="w-full" 
                    variant="outline" 
                    size="sm" 
                    disabled={isSelling || isApproving || !songTokenAddress}
                  >
                    {(isSelling || isApproving) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {isApproving ? "APPROVING..." : isSelling ? "SELLING..." : `SELL $${song?.ticker ? song.ticker.toUpperCase() : ''}`}
                  </Button>

                  <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 font-mono text-center">
                    💡 Selling requires 2 steps: Approve → Sell
                  </div>

                  <p className="text-xs text-muted-foreground font-mono text-center">
                    {songTokenAddress ? '✅ Bonding curve active' : '⚠️ Song not deployed to bonding curve'}
                  </p>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Holders Tab */}
          <TabsContent value="holders" className="mt-0">
            <Card className="console-bg tech-border p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-mono font-bold neon-text mb-4 md:mb-6">TOP HOLDERS</h3>
              
              <div className="space-y-2 md:space-y-3">
                {loadingHolders ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="font-mono text-sm">Loading holders...</p>
                  </div>
                ) : holders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="font-mono text-sm">No holders yet</p>
                    <p className="font-mono text-xs mt-1">Be the first to buy!</p>
                  </div>
                ) : (
                  holders.map((holder, i) => (
                    <div key={holder.address} className="flex items-center justify-between p-2 md:p-3 console-bg border border-border rounded-lg">
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <Avatar className="h-8 w-8 md:h-10 md:w-10 border border-neon-green shrink-0">
                          <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xs">
                            #{i + 1}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs md:text-sm truncate">
                            {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {holder.balance} purchases
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {holder.percentage.toFixed(2)}%
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="mt-0">
            <Card className="console-bg tech-border p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-mono font-bold neon-text mb-4 md:mb-6 flex items-center">
                <MessageSquare className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                COMMENTS
              </h3>

              {/* Post Comment */}
              <div className="mb-4 md:mb-6 space-y-2 md:space-y-3">
                <Textarea
                  placeholder="Share your thoughts..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="font-mono resize-none text-sm"
                  rows={3}
                />
                <Button onClick={handlePostComment} variant="neon" size="sm" className="w-full sm:w-auto">
                  POST COMMENT
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-3 md:space-y-4">
                {loadingComments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground font-mono">
                    No comments yet. Be the first!
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="console-bg p-3 md:p-4 border border-border rounded-lg">
                      <div className="flex items-start gap-2 md:gap-3">
                        <Avatar className="h-8 w-8 md:h-10 md:w-10 border border-neon-green shrink-0">
                          {comment.profiles?.avatar_cid && (
                            <AvatarImage
                              src={getIPFSGatewayUrl(comment.profiles.avatar_cid)}
                              className="object-cover"
                            />
                          )}
                          <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-xs">
                            {comment.profiles?.artist_name?.[0]?.toUpperCase() || comment.wallet_address.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                            <p className="font-mono text-xs md:text-sm font-semibold truncate">
                              {comment.profiles?.artist_name || `${comment.wallet_address.substring(0, 6)}...${comment.wallet_address.substring(38)}`}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="font-mono text-xs md:text-sm text-foreground break-words">{comment.comment_text}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SongTrade;
