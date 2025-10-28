import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { supabase } from "@/integrations/supabase/client";
import xrgeLogo from "@/assets/tokens/xrge.png";
import ktaLogo from "@/assets/tokens/kta.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SongTradingHistory, { TradeData } from "@/components/SongTradingHistory";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import NetworkInfo from "@/components/NetworkInfo";
import LikeButton from "@/components/LikeButton";
import { ReportButton } from "@/components/ReportButton";
import { SongTradingChart } from "@/components/SongTradingChart";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useWallet } from "@/hooks/useWallet";
import { AiBadge } from "@/components/AiBadge";
import { useArtistProfile } from "@/hooks/useArtistProfile";
import { SongComments } from "@/components/SongComments";
import { AudioWaveform } from "@/components/AudioWaveform";
import { useAudioStateForSong } from "@/hooks/useAudioState";
import { useBuySongTokens, useSellSongTokens, useSongPrice, useSongMetadata, useCreateSong, SONG_FACTORY_ADDRESS, useApproveToken, useBuyQuote, useSellQuote, useBondingCurveSupply, useSongTokenBalance, BONDING_CURVE_ADDRESS } from "@/hooks/useSongBondingCurve";
import { useBalance, useConnect, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { useXRGESwap, KTA_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, useXRGEQuote, useXRGEQuoteFromKTA, useXRGEQuoteFromUSDC, XRGE_TOKEN_ADDRESS as XRGE_TOKEN } from "@/hooks/useXRGESwap";
import { usePrivyToken } from "@/hooks/usePrivyToken";
import { usePrivyWagmi } from "@/hooks/usePrivyWagmi";
import { useFundWallet } from "@privy-io/react-auth";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { Play, TrendingUp, TrendingDown, Users, MessageSquare, ArrowUpRight, ArrowDownRight, Loader2, Rocket, Wallet, Copy, Check, ExternalLink, CreditCard, Share2, Pause } from "lucide-react";
import { NetworkGuard } from "@/components/NetworkGuard";

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
  description?: string | null;
}


interface SongTradeProps {
  playSong: (song: Song) => void;
  currentSong: Song | null;
  isPlaying: boolean;
}

// Component that connects waveform to audio state
const AudioWaveformWithState = ({ songId, audioCid }: { songId: string; audioCid: string }) => {
  const audioState = useAudioStateForSong(songId);
  
  return (
    <AudioWaveform
      audioCid={audioCid}
      height={40}
      color="#00ff9f"
      backgroundColor="rgba(0, 0, 0, 0.2)"
      className="rounded border border-neon-green/20"
      showProgress={audioState.isCurrentSong && audioState.isPlaying}
      currentTime={audioState.currentTime}
      duration={audioState.duration}
      onSeek={(time) => {
        // Handle seeking - this would need to be connected to the audio player
        console.log('Seek to:', time);
      }}
    />
  );
};

const SongTrade = ({ playSong, currentSong, isPlaying }: SongTradeProps) => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const { fullAddress, isConnected } = useWallet();
  const { fundWallet } = useFundWallet();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount(); // Wagmi account check
  const { getAuthHeaders } = usePrivyToken();
  const { prices } = useTokenPrices();
  
  // Ensure Privy wallet is connected to wagmi
  usePrivyWagmi();

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [songTokenAddress, setSongTokenAddress] = useState<`0x${string}` | undefined>();
  const [isProcessingBuy, setIsProcessingBuy] = useState(false);
  const [paymentToken, setPaymentToken] = useState<'XRGE' | 'ETH' | 'KTA' | 'USDC'>('XRGE');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [holders, setHolders] = useState<Array<{ address: string; balance: string; percentage: number }>>([]);
  const [loadingHolders, setLoadingHolders] = useState(false);
  const [holderCount, setHolderCount] = useState<number>(0);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [volume24h, setVolume24h] = useState<number>(0);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [recentTrades, setRecentTrades] = useState<TradeData[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

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
    
    // When logged in with Privy, always use Privy connector
    // Only use injected connector if user is NOT authenticated with Privy
    const privyConn = connectors.find(c => /privy/i.test(c.id) || /privy/i.test(c.name));
    const injected = connectors.find(c => c.id === 'injected');
    
    // Prioritize Privy if user is connected via Privy, otherwise use injected
    const target = (isConnected && privyConn) ? privyConn : (injected || privyConn || connectors[0]);
    
    if (!target) {
      throw new Error('No wallet connector available');
    }
    
    console.log('🔌 Connecting wagmi with:', target.name, target.id, 'Privy authenticated:', isConnected);
    
    try {
      await connectAsync({ connector: target });
    } catch (e) {
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
  
  // Calculate market cap metrics in USD
  // Market Cap = Fully Diluted Valuation (current price × total supply / 10)
  const tokensSold = activeTradingSupply !== undefined ? (990_000_000 - activeTradingSupply) : undefined;
  const fullyDilutedValue = currentPrice && totalSupply ? (currentPrice * totalSupply) / 10 : undefined;
  const marketCapUSD = fullyDilutedValue || 0; // Use fully diluted value as market cap (divided by 10)
  const realizedValueXRGE = xrgeRaised; // Actual XRGE spent by traders
  const realizedValueUSD = xrgeRaised * xrgeUsdPrice; // Convert to USD
  
  // Use fully diluted value as the market cap
  const marketCap = marketCapUSD;
  
  // Check if data looks like initial/unrealistic values
  const hasRealisticData = xrgeRaised > 0;

  useEffect(() => {
    if (songId) {
      fetchSong();
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
        
        // Trigger refresh of trading history
        setRefreshTrigger(prev => prev + 1);
        
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
      // Use database query first (same as Artist page approach)
      console.log('🔍 Fetching holders for song:', songId);
      const { data: purchases, error: purchasesError } = await supabase
        .from('song_purchases')
        .select('buyer_wallet_address')
        .eq('song_id', songId);
      
      if (purchasesError) {
        console.error('Error fetching purchases:', purchasesError);
      }
      
      console.log('📊 Found purchases:', purchases?.length || 0, 'for song:', songId);
      console.log('📊 Purchase data:', purchases);
      
      const uniqueHolders = new Set(purchases?.map(p => p.buyer_wallet_address.toLowerCase()) || []);
      console.log('👥 Unique holders from database:', uniqueHolders.size);
      
      // If we have database purchases, use that count
      if (uniqueHolders.size > 0) {
        setHolderCount(uniqueHolders.size);
      }
      
      // Try to get detailed holder balances from blockchain for the top holders list
      if (publicClient) {
        try {
          // Get all Transfer events to calculate detailed holder balances
          const ERC20_TRANSFER_ABI = [
            {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { name: 'from', type: 'address', indexed: true },
                { name: 'to', type: 'address', indexed: true },
                { name: 'value', type: 'uint256', indexed: false }
              ]
            }
          ] as const;
          
          const { data: songData } = await supabase
            .from('songs')
            .select('created_at')
            .eq('id', songId)
            .single();
          
          const currentBlock = await publicClient.getBlockNumber();
          const blocksSinceCreation = songData?.created_at 
            ? Math.min(Math.floor((Date.now() - new Date(songData.created_at).getTime()) / 2000), 100000)
            : 50000;
          
          const fromBlock = currentBlock - BigInt(blocksSinceCreation);
          
          const logs = await publicClient.getLogs({
            address: songTokenAddress,
            event: ERC20_TRANSFER_ABI[0],
            fromBlock,
            toBlock: 'latest'
          });

          // Track holder balances
          const holderBalances: Record<string, bigint> = {};
          
          console.log('🔗 Processing', logs.length, 'transfer logs...');
          
          for (const log of logs) {
            const { args } = log as any;
            const from = args.from?.toLowerCase();
            const to = args.to?.toLowerCase();
            const value = BigInt(args.value || 0);
            
            const zeroAddress = '0x0000000000000000000000000000000000000000';
            
            if (from && from !== zeroAddress) {
              holderBalances[from] = (holderBalances[from] || BigInt(0)) - value;
            }
            
            if (to && to !== zeroAddress) {
              holderBalances[to] = (holderBalances[to] || BigInt(0)) + value;
            }
          }
          
          console.log('📊 Holder balances after processing:', Object.keys(holderBalances).length, 'addresses');
          console.log('📊 Balances:', Object.entries(holderBalances).map(([addr, bal]) => ({ 
            address: addr, 
            balance: bal.toString(), 
            isPositive: bal > BigInt(0),
            balanceFormatted: (Number(bal) / 1e18).toFixed(2)
          })));

          // Filter out zero/negative balances and format
          const holdersWithBalance = Object.entries(holderBalances)
            .filter(([_, balance]) => balance > BigInt(0))
            .map(([address, balance]) => ({
              address,
              rawBalance: balance,
              balance: (Number(balance) / 1e18).toFixed(2),
              percentage: 0
            }))
            .sort((a, b) => Number(b.rawBalance - a.rawBalance));
          
          console.log('✅ Holders with positive balance:', holdersWithBalance.length);
          console.log('✅ Final holders:', holdersWithBalance.map(h => ({ address: h.address, balance: h.balance })));
          
          // If we're missing holders, try direct balance checks for all addresses that ever held tokens
          if (holdersWithBalance.length < 2 && Object.keys(holderBalances).length >= 2) {
            console.log('🔍 Missing holders detected, checking current balances...');
            
            const directBalanceChecks = await Promise.all(
              Object.keys(holderBalances).map(async (address) => {
                try {
                  const currentBalance = await publicClient.readContract({
                    address: songTokenAddress,
                    abi: [{
                      name: 'balanceOf',
                      type: 'function',
                      stateMutability: 'view',
                      inputs: [{ name: 'account', type: 'address' }],
                      outputs: [{ name: 'balance', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [address as Address]
                  } as any);
                  
                  return { address, currentBalance: BigInt(currentBalance as any) };
                } catch (error) {
                  console.error(`Error checking balance for ${address}:`, error);
                  return { address, currentBalance: BigInt(0) };
                }
              })
            );
            
            console.log('🔍 Direct balance checks:', directBalanceChecks.map(b => ({ 
              address: b.address, 
              balance: b.currentBalance.toString(),
              formatted: (Number(b.currentBalance) / 1e18).toFixed(2)
            })));
            
            // Use direct balance checks instead of transfer tracking
            const directHolders = directBalanceChecks
              .filter(({ currentBalance }) => currentBalance > BigInt(0))
              .map(({ address, currentBalance }) => ({
                address,
                rawBalance: currentBalance,
                balance: (Number(currentBalance) / 1e18).toFixed(2),
                percentage: 0
              }))
              .sort((a, b) => Number(b.rawBalance - a.rawBalance));
            
            if (directHolders.length > holdersWithBalance.length) {
              // Calculate percentages for direct holders
              const totalHeld = directHolders.reduce((sum, h) => sum + h.rawBalance, BigInt(0));
              const formattedDirectHolders = directHolders.map(h => ({
                address: h.address,
                balance: h.balance,
                percentage: totalHeld > BigInt(0) 
                  ? (Number(h.rawBalance * BigInt(10000) / totalHeld) / 100)
                  : 0
              }));
              
              console.log('✅ Using direct balance checks:', directHolders.length, 'holders');
              setHolders(formattedDirectHolders.slice(0, 10));
              setHolderCount(formattedDirectHolders.length);
              return; // Exit early with direct balance results
            }
          }

          // Calculate percentages
          const totalHeld = holdersWithBalance.reduce((sum, h) => sum + h.rawBalance, BigInt(0));
          const formattedHolders = holdersWithBalance.map(h => ({
            address: h.address,
            balance: h.balance,
            percentage: totalHeld > BigInt(0) 
              ? (Number(h.rawBalance * BigInt(10000) / totalHeld) / 100)
              : 0
          }));

          setHolders(formattedHolders.slice(0, 10));
          // Use blockchain count if it's higher than database count, or if database is empty
          if (formattedHolders.length > uniqueHolders.size || uniqueHolders.size === 0) {
            console.log('🔄 Using blockchain count:', formattedHolders.length, 'vs database count:', uniqueHolders.size);
            setHolderCount(formattedHolders.length);
          }
        } catch (blockchainError) {
          console.warn('Blockchain query failed, using database count:', blockchainError);
          setHolders([]);
          // If blockchain fails and we have no database records, try a simpler approach
          if (uniqueHolders.size === 0) {
            console.log('🔄 No database records found, attempting direct balance check...');
            // This is a fallback - we could implement a direct balance check here if needed
          }
        }
      } else {
        setHolders([]);
      }
      
    } catch (error) {
      console.error('Error fetching holders:', error);
      setHolderCount(0);
      setHolders([]);
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

  // Calculate 24h price change from blockchain data
  useEffect(() => {
    const fetch24hChange = async () => {
      if (!publicClient || !songTokenAddress || !bondingSupply) return;
      
      try {
        // Get current block
        const currentBlock = await publicClient.getBlockNumber();
        
        // Estimate blocks in 24h (Base: ~2 second block time = 43200 blocks/day)
        const blocksIn24h = 43200n;
        const block24hAgo = currentBlock > blocksIn24h ? currentBlock - blocksIn24h : 0n;
        
        // Try to get historical price from 24h ago
        if (block24hAgo > 0n) {
          try {
            const historicalPrice = await publicClient.readContract({
              address: BONDING_CURVE_ADDRESS,
              abi: [{
                type: 'function',
                name: 'getCurrentPrice',
                inputs: [{ name: 'songToken', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view'
              }],
              functionName: 'getCurrentPrice',
              args: [songTokenAddress],
              blockNumber: block24hAgo
            } as any);
            
            const currentPriceRaw = rawPrice;
            if (currentPriceRaw && historicalPrice) {
              const change = ((Number(currentPriceRaw) - Number(historicalPrice)) / Number(historicalPrice)) * 100;
              setPriceChange24h(change);
              console.log('📊 24h price change calculated:', {
                historicalPrice: Number(historicalPrice) / 1e18,
                currentPrice: Number(currentPriceRaw) / 1e18,
                change: change.toFixed(2) + '%'
              });
            }
          } catch (histError: any) {
            // Historical state queries not supported by all RPC providers
            console.log('⚠️ Historical price query not supported, using fallback estimate');
            throw histError;
          }
        }
      } catch (error: any) {
        // Fallback: Calculate from actual trades in the last 24h
        console.log('⚠️ Historical price query not supported, calculating from trades');
        
        try {
          const currentBlock = await publicClient.getBlockNumber();
          const blocksIn24h = 43200;
          const fromBlock = currentBlock - BigInt(blocksIn24h);
          
          const XRGE_ADDRESS = '0x147120faEC9277ec02d957584CFCD92B56A24317' as Address;
          const FEE_ADDRESS = '0xb787433e138893a0ed84d99e82c7da260a940b1e';
          
          // Fetch song token Transfer events for 24h
          const songTokenLogs = await publicClient.getLogs({
            address: songTokenAddress,
            event: {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { type: 'address', indexed: true, name: 'from' },
                { type: 'address', indexed: true, name: 'to' },
                { type: 'uint256', indexed: false, name: 'value' }
              ]
            },
            fromBlock,
            toBlock: currentBlock
          });
          
          // Fetch XRGE Transfer events for 24h
          const xrgeLogs = await publicClient.getLogs({
            address: XRGE_ADDRESS,
            event: {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { type: 'address', indexed: true, name: 'from' },
                { type: 'address', indexed: true, name: 'to' },
                { type: 'uint256', indexed: false, name: 'value' }
              ]
            },
            fromBlock,
            toBlock: currentBlock
          });
          
          // Build a map of XRGE transfers by transaction hash
          const xrgeByTx = new Map<string, number>();
          
          for (const log of xrgeLogs) {
            const { args } = log as any;
            const from = (args.from as string).toLowerCase();
            const to = (args.to as string).toLowerCase();
            const amount = Number(args.value as bigint) / 1e18;
            
            // Skip fee transfers
            if (from === FEE_ADDRESS.toLowerCase() || to === FEE_ADDRESS.toLowerCase()) continue;
            
            // Only count XRGE going to or from bonding curve
            if (to === BONDING_CURVE_ADDRESS.toLowerCase() || from === BONDING_CURVE_ADDRESS.toLowerCase()) {
              const existing = xrgeByTx.get(log.transactionHash) || 0;
              xrgeByTx.set(log.transactionHash, existing + amount);
            }
          }
          
          // Calculate price change from actual trades
          if (songTokenLogs.length > 0) {
            const trades: { timestamp: number; priceXRGE: number }[] = [];
            
            for (const log of songTokenLogs) {
              const { args } = log as any;
              const from = (args.from as string).toLowerCase();
              const to = (args.to as string).toLowerCase();
              const amount = Number(args.value as bigint) / 1e18;
              
              if (from === BONDING_CURVE_ADDRESS.toLowerCase() || to === BONDING_CURVE_ADDRESS.toLowerCase()) {
                const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                const timestamp = Number(block.timestamp) * 1000;
                const xrgeAmount = xrgeByTx.get(log.transactionHash) || 0;
                const priceXRGE = amount > 0 ? xrgeAmount / amount : 0;
                
                if (priceXRGE > 0) {
                  trades.push({ timestamp, priceXRGE });
                }
              }
            }
            
            if (trades.length >= 2) {
              trades.sort((a, b) => a.timestamp - b.timestamp);
              const firstPrice = trades[0].priceXRGE;
              const lastPrice = trades[trades.length - 1].priceXRGE;
              const change = ((lastPrice - firstPrice) / firstPrice) * 100;
              setPriceChange24h(change);
              console.log('📊 24h price change from trades:', {
                firstPrice: firstPrice.toFixed(6),
                lastPrice: lastPrice.toFixed(6),
                change: change.toFixed(2) + '%',
                tradeCount: trades.length
              });
            } else {
              // If fewer than 2 trades in 24h, show 0% change
              // (Don't show inception-to-now gains as "24h change")
              setPriceChange24h(0);
            }
          }
        } catch (tradeError) {
          console.error('Failed to calculate from trades:', tradeError);
          // Final fallback - no 24h data available
          setPriceChange24h(0);
        }
      }
    };
    
    fetch24hChange();
  }, [publicClient, songTokenAddress, bondingSupply, rawPrice]);

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
      toast({
        title: "Error",
        description: "Failed to load song",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
          const xrgeAmountToUse = xrgeEquivalent || "0";
          
          if (parseFloat(xrgeAmountToUse) === 0) {
            throw new Error("Cannot calculate XRGE amount from KTA. Please try again.");
          }
          
          // Step 1 & 2: Approve KTA and swap to XRGE (hooks show their own toasts)
          const xrgeBalanceBefore = await getXRGEBalance();
          
          // KTA approval and swap
          await approveKTA(buyAmount);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for approval to mine
          
          await buyXRGEWithKTA(buyAmount, 500);
          
          // Wait for XRGE to arrive
          toast({
            title: "Checking XRGE balance...",
            description: "Waiting for swap to complete",
          });
          
          let actualXRGEReceived = "0";
          let swapAttempts = 0;
          const maxSwapAttempts = 60;
          
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          while (swapAttempts < maxSwapAttempts) {
            swapAttempts++;
            const currentBalance = await getXRGEBalance();
            const balanceDiff = parseFloat(currentBalance) - parseFloat(xrgeBalanceBefore);
            
            if (balanceDiff > 0) {
              actualXRGEReceived = balanceDiff.toString();
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          if (parseFloat(actualXRGEReceived) === 0) {
            throw new Error("KTA to XRGE swap failed - no XRGE received");
          }
          
          // Step 3: Buy song tokens with XRGE
          const amountToSpend = parseFloat(actualXRGEReceived) * 0.98;
          const safeAmount = amountToSpend.toFixed(18);
          
          if (parseFloat(safeAmount) <= 0) {
            throw new Error("Insufficient XRGE amount after swap");
          }
          
          toast({
            title: "Approving XRGE",
            description: "Confirm to approve XRGE for song token purchase",
          });
          
          // This approves XRGE for BONDING_CURVE_ADDRESS (not swapper!)
          await approve(XRGE_TOKEN, safeAmount);
          
          toast({
            title: "Buying song tokens",
            description: `Purchasing with ${parseFloat(actualXRGEReceived).toFixed(2)} XRGE...`,
          });
          
          await buyWithXRGE(songTokenAddress, safeAmount, "0");
          
          toast({
            title: "✅ Purchase successful!",
            description: `Bought song tokens using ${buyAmount} KTA`,
          });
        } catch (error) {
          let errorMessage = "Failed to complete KTA swap process";
          if (error instanceof Error) {
            
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
        console.log('💰 Starting USDC purchase flow:', { buyAmount, songTokenAddress });
        
        // Swap USDC to XRGE first, then buy
        toast({
          title: "Step 1/4: Approve USDC",
          description: "Please approve USDC for swapping",
        });
        
        const usdcTxHash = await approveUSDC(buyAmount);
        console.log('✅ USDC approved:', usdcTxHash);
        
        toast({
          title: "Step 2/4: Swapping USDC to XRGE",
          description: "Converting your USDC to XRGE...",
        });
        
        const balanceBefore = await getXRGEBalance();
        console.log('📊 XRGE balance before swap:', balanceBefore);
        
        const swapTxHash = await buyXRGEWithUSDC(buyAmount, 500);
        console.log('✅ Swap transaction:', swapTxHash);
        
        let xrgeReceived = "0";
        let attempts = 0;
        const maxAttempts = 60;
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        while (attempts < maxAttempts) {
          attempts++;
          const currentBalance = await getXRGEBalance();
          const balanceDiff = parseFloat(currentBalance) - parseFloat(balanceBefore);
          
          if (balanceDiff > 0) {
            xrgeReceived = balanceDiff.toString();
            console.log(`✅ XRGE received after ${attempts} attempts:`, xrgeReceived);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (parseFloat(xrgeReceived) === 0) {
          throw new Error("USDC to XRGE swap failed - no XRGE received");
        }
        
        // Use full XRGE amount for approval (not reduced)
        console.log('💰 XRGE to approve:', xrgeReceived);
        
        toast({
          title: "Step 3/4: Approving XRGE",
          description: "Approving XRGE for song token purchase...",
        });
        
        // Approve using the approve function from useSongBondingCurve
        await approve(XRGE_TOKEN, xrgeReceived);
        console.log('✅ XRGE approved for bonding curve');
        
        // Wait a bit for approval to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast({
          title: "Step 4/4: Buying song tokens",
          description: "Purchasing with swapped XRGE...",
        });
        
        // Use 98% to account for any tiny price movements
        const safeAmount = (parseFloat(xrgeReceived) * 0.98).toString();
        console.log('💰 Buying with XRGE:', { safeAmount, songTokenAddress });
        
        await buyWithXRGE(songTokenAddress, safeAmount, "0");
        
        toast({
          title: "✅ Purchase successful!",
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
            console.error('Error recording purchase:', purchaseError);
          } else {
            console.log('✅ Purchase recorded in database');
            // Refresh holders immediately after recording purchase
            setTimeout(() => fetchHolders(), 1000);
          }
        } catch (dbError) {
          console.error('Database error:', dbError);
        }
      }
      
      toast({
        title: "Updating balances...",
        description: "Fetching latest data from blockchain",
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        await refetchPrice();
        await refetchSupply();
        await refetchMetadata();
        
        toast({
          title: "✅ Balances updated!",
          description: "All data has been refreshed",
        });
      } catch (refreshError) {
        // Silent fail
      }
      
      setBuyAmount("");
    } catch (error) {
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


  const handleShare = async () => {
    if (!song) return;
    try {
      setSharing(true);
      const text = `Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on ROUGEE PLAY`;
      if (navigator.share) {
        await navigator.share({ title: song.title, text, url: pageUrl });
        toast({ title: "Shared", description: "Thanks for spreading the word!" });
      } else {
        await navigator.clipboard.writeText(pageUrl);
        setCopied(true);
        toast({ title: "Link copied", description: "Song link copied to clipboard" });
        setTimeout(() => setCopied(false), 1200);
      }
    } catch (e) {
      // ignore cancellation
    } finally {
      setSharing(false);
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
        <div className="max-w-7xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-mono text-muted-foreground">Song not found</h1>
          <Button onClick={() => navigate("/")} className="mt-4" variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Use Lighthouse gateway for social media sharing (more reliable for your app)
  const coverImageUrl = song.cover_cid 
    ? getIPFSGatewayUrl(song.cover_cid, 'https://gateway.lighthouse.storage/ipfs')
    : 'https://rougee.app/og-image.png';
  const pageUrl = `https://rougee.app/song/${song.id}`;

  return (
    <NetworkGuard>
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <Helmet>
          <title>{song.title} - {song.artist || 'Unknown Artist'} | ROUGEE PLAY</title>
        <meta name="description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on ROUGEE PLAY. Stream and trade music NFTs on the blockchain.`} />
        
        <meta property="og:title" content={`${song.title} - ${song.artist || 'Unknown Artist'}`} />
        <meta property="og:description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on ROUGEE PLAY`} />
        <meta property="og:image" content={coverImageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="music.song" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${song.title} - ${song.artist || 'Unknown Artist'}`} />
        <meta name="twitter:description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on ROUGEE PLAY`} />
        <meta name="twitter:image" content={coverImageUrl} />
      </Helmet>

      <NetworkInfo />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8">
        {/* Song Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
          <Card className="console-bg tech-border p-4 md:p-6 lg:col-span-2 relative overflow-hidden">
            {/* Background Cover Image with Fade */}
            <div 
              className="absolute inset-0 z-0"
              style={(artistProfile?.cover_cid || song.cover_cid) ? {
                backgroundImage: `url(${getIPFSGatewayUrl(artistProfile?.cover_cid || song.cover_cid)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : undefined}
            >
              {(artistProfile?.cover_cid || song.cover_cid) && (
                <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background/95" />
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6 relative z-10">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-32 md:w-32 border-2 border-neon-green shrink-0 shadow-2xl">
                <AvatarImage
                  src={song.cover_cid ? getIPFSGatewayUrl(song.cover_cid) : undefined}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/20 text-neon-green font-mono text-2xl md:text-3xl">
                  {song.title.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Play/Pause */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => playSong(song)}
                className="h-12 w-12 rounded-full bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40"
                aria-label="Play or Pause"
              >
                {currentSong?.id === song.id && isPlaying ? (
                  <Pause className="w-6 h-6 text-neon-green" />
                ) : (
                  <Play className="w-6 h-6 text-neon-green" />
                )}
              </Button>

              <div className="flex-1 w-full min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold neon-text mb-1 md:mb-2 truncate flex items-center gap-2">
                  <span className="truncate">{song.title}</span>
                  <AiBadge aiUsage={(song as any).ai_usage} size="md" />
                </h1>
                <button 
                  onClick={() => navigate(`/artist/${song.wallet_address}`)}
                  className="text-sm sm:text-base md:text-lg text-white font-mono mb-2 truncate hover:text-neon-green transition-colors duration-200 underline-offset-4 hover:underline"
                >
                  By {song.artist || "Unknown Artist"}
                </button>
                {song.description && (
                  <p className="text-xs sm:text-sm text-white/90 font-mono mb-3 md:mb-4 line-clamp-2 bg-black/20 px-2 py-1 rounded backdrop-blur-sm">
                    {song.description}
                  </p>
                )}
                
                {/* Audio Waveform */}
                {song.audio_cid && (
                  <div className="mb-3 md:mb-4">
                    <AudioWaveformWithState songId={song.id} audioCid={song.audio_cid} />
                  </div>
                )}
                
                <div className="flex flex-wrap items-center gap-2">
                  <LikeButton songId={song.id} size="sm" />
                  <ReportButton songId={song.id} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="font-mono"
                    disabled={sharing}
                  >
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
                    {copied ? 'COPIED' : 'SHARE'}
                  </Button>
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
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-mono mb-2 break-words">
                  per token {priceInXRGE && <span className="opacity-50">({priceInXRGE.toFixed(6)} XRGE)</span>}
                </p>
                
                {/* 24h Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3 md:mb-4">
                  <div className="p-2 bg-background/50 border border-border rounded">
                    <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mb-1">24h Change</div>
                    {priceChange24h !== null ? (
                      <div className={`font-mono font-semibold text-xs sm:text-sm flex items-center gap-1 ${priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                      </div>
                    ) : (
                      <div className="text-muted-foreground font-mono text-xs">—</div>
                    )}
                  </div>
                  <div className="p-2 bg-background/50 border border-border rounded">
                    <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mb-1">Volume (24h)</div>
                    <div className="font-mono font-semibold text-xs sm:text-sm">
                      {volume24h > 0 ? (
                        <>
                          <div>${(volume24h * xrgeUsdPrice).toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                          <div className="text-[9px] text-muted-foreground">{volume24h.toLocaleString(undefined, {maximumFractionDigits: 2})} XRGE</div>
                        </>
                      ) : (
                        <div className="text-muted-foreground">$0</div>
                      )}
                    </div>
                  </div>
                </div>
                
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
                    <span className="break-words">XRGE = ${xrgeUsdPrice < 0.0001 ? xrgeUsdPrice.toFixed(8) : xrgeUsdPrice.toFixed(6)} USD</span>
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
                      <div className="flex justify-between">
                        <span className="text-muted-foreground" title="Market cap (current price × total supply)">Market Cap:</span>
                        <span className="text-neon-green font-semibold">
                          ${marketCapUSD < 1 ? marketCapUSD.toFixed(6) : marketCapUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
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
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground" title="Number of unique wallets holding this token">Holders:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-semibold">
                            {loadingHolders ? '...' : holderCount.toLocaleString()}
                          </span>
                          {songTokenAddress && (
                            <a
                              href={`https://basescan.org/token/${songTokenAddress}#balances`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neon-green hover:text-neon-green/80 transition-colors"
                              title="View holders on BaseScan"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Market Cap:</span>
                        <span className="text-foreground opacity-60">
                          $0.00
                        </span>
                      </div>
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
                <p className="text-xs md:text-sm text-muted-foreground font-mono mb-4">
                  {song.wallet_address?.toLowerCase() === fullAddress?.toLowerCase() 
                    ? "Deploy this song to enable trading"
                    : "This song hasn't been deployed to the bonding curve yet"}
                </p>
                {song.wallet_address?.toLowerCase() === fullAddress?.toLowerCase() && (
                  <Button 
                    onClick={handleDeploy} 
                    variant="neon" 
                    size="sm"
                    disabled={isDeploying || isConfirming}
                    className="font-mono"
                  >
                    {isDeploying || isConfirming ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isDeploying ? "DEPLOYING..." : "CONFIRMING..."}
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        DEPLOY TO BONDING CURVE
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Price Charts - All 3 chart types with toggle */}
        <div className="mb-6 md:mb-8">
          <SongTradingChart 
            songTokenAddress={songTokenAddress} 
            priceInXRGE={priceInXRGE}
            bondingSupply={bondingSupply}
            trades={recentTrades}
          />
        </div>

        {/* Recent Trades */}
        {recentTrades.length > 0 && (
          <div className="mb-6 md:mb-8">
            <Card className="p-3 sm:p-4 md:p-6 console-bg tech-border">
              <h3 className="font-mono font-bold text-base sm:text-lg mb-3 sm:mb-4 text-cyan-400">RECENT TRADES</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentTrades.slice(-10).reverse().map((trade, i) => {
                  const coverUrl = song?.cover_cid ? getIPFSGatewayUrl(song.cover_cid) : '/placeholder-cover.png';
                  const xrgeAmount = trade.xrgeAmount 
                    ? trade.xrgeAmount.toLocaleString(undefined, {maximumFractionDigits: 2})
                    : (trade.amount * trade.price).toLocaleString(undefined, {maximumFractionDigits: 2});
                  const shortAddress = trade.trader 
                    ? `${trade.trader.slice(0, 4)}...${trade.trader.slice(-4)}`
                    : 'Unknown';
                  
                  return (
                    <div 
                      key={i}
                      className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 bg-background/50 border border-border rounded hover:bg-background/80 transition-colors"
                    >
                      {/* Badge in bottom-left corner */}
                      <div className={`absolute bottom-2 left-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-mono text-[10px] sm:text-xs font-bold ${
                        trade.type === 'buy' 
                          ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                          : 'bg-red-500/20 text-red-500 border border-red-500/30'
                      }`}>
                        {trade.type === 'buy' ? '↑ BUY' : '↓ SELL'}
                      </div>
                      
                      <div className="flex items-center gap-2 sm:gap-3 flex-1">
                        <img 
                          src={coverUrl} 
                          alt={song?.ticker || 'Song'} 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-cover.png';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs sm:text-sm font-mono text-muted-foreground">
                              {shortAddress}
                            </span>
                          </div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                            {new Date(trade.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right pl-12 sm:pl-0">
                        <div className="text-xs sm:text-sm font-mono font-bold">
                          {trade.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} ${song?.ticker?.toUpperCase()}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                          {xrgeAmount} XRGE
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* Trading History - Hidden (only used for data loading) */}
        <div className="hidden">
          {songTokenAddress && song && (
            <SongTradingHistory 
              tokenAddress={songTokenAddress}
              xrgeUsdPrice={prices.xrge || 0}
              songTicker={song.ticker || undefined}
              coverCid={song.cover_cid || undefined}
              currentPriceInXRGE={priceInXRGE}
              onVolumeCalculated={setVolume24h}
              showRecentTrades={false}
              onTradesLoaded={setRecentTrades}
              refreshTrigger={refreshTrigger}
            />
          )}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="trade" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 md:mb-6 h-auto">
            <TabsTrigger value="trade" className="text-xs sm:text-sm">TRADE</TabsTrigger>
            <TabsTrigger value="holders" className="text-xs sm:text-sm">HOLDERS</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">COMMENTS</span>
              <span className="sm:hidden">💬</span>
            </TabsTrigger>
          </TabsList>

          {/* Trade Tab */}
          <TabsContent value="trade" className="mt-0">
            {!isConnected ? (
              <Card className="console-bg tech-border p-8 text-center">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-mono font-bold mb-2">Connect Wallet to Trade</h3>
                <p className="text-sm text-muted-foreground font-mono mb-4">
                  You need to connect your wallet to buy or sell song tokens
                </p>
                <Button 
                  variant="neon" 
                  onClick={() => navigate('/')}
                  className="font-mono"
                >
                  CONNECT WALLET
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Buy/Sell Toggle */}
                <div className="flex justify-center">
                  <div className="inline-flex rounded-lg border border-neon-green/30 p-1 bg-black/50 backdrop-blur-sm">
                    <button
                      onClick={() => setTradeMode('buy')}
                      className={`
                        px-6 md:px-8 py-2 md:py-3 rounded-lg font-mono text-sm md:text-base font-bold transition-all duration-300
                        ${tradeMode === 'buy' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-lg shadow-green-500/30' 
                          : 'text-white/60 hover:text-green-400 hover:bg-green-500/5'
                        }
                      `}
                    >
                      <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 inline mr-2" />
                      BUY
                    </button>
                    <button
                      onClick={() => setTradeMode('sell')}
                      className={`
                        px-6 md:px-8 py-2 md:py-3 rounded-lg font-mono text-sm md:text-base font-bold transition-all duration-300
                        ${tradeMode === 'sell' 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-lg shadow-red-500/30' 
                          : 'text-white/60 hover:text-red-400 hover:bg-red-500/5'
                        }
                      `}
                    >
                      <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 inline mr-2" />
                      SELL
                    </button>
                  </div>
                </div>

                {/* Buy Card */}
                {tradeMode === 'buy' && (
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
                  {/* Transaction Guide - Only show when amount is entered */}
                  {paymentToken && buyAmount && parseFloat(buyAmount) > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                      <div className="font-mono text-xs space-y-2">
                        <div className="font-bold text-blue-400">💡 Transaction Guide:</div>
                        {paymentToken === "XRGE" && (
                          <div className="bg-green-500/10 p-2 rounded border border-green-500/20">
                            <div className="font-bold text-green-400">XRGE → Song</div>
                            <div>⚡ 1 transaction - Direct purchase</div>
                            <div>💰 No intermediate swaps needed</div>
                          </div>
                        )}
                        {paymentToken === "ETH" && (
                          <div className="bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                            <div className="font-bold text-yellow-400">ETH → Song</div>
                            <div>⚡ 2 transactions - ETH → XRGE → Song</div>
                            <div>💰 ETH swap + song purchase</div>
                          </div>
                        )}
                        {paymentToken === "USDC" && (
                          <div className="bg-orange-500/10 p-2 rounded border border-orange-500/20">
                            <div className="font-bold text-orange-400">USDC → Song</div>
                            <div>⚡ 3 transactions - USDC → XRGE → Song</div>
                            <div>💰 USDC approve + swap + song purchase</div>
                          </div>
                        )}
                        {paymentToken === "KTA" && (
                          <div className="bg-blue-500/10 p-2 rounded border border-blue-500/20">
                            <div className="font-bold text-blue-400">KTA → Song</div>
                            <div>⚡ 5 transactions - KTA → XRGE → Song</div>
                            <div>💰 KTA reset + approve + swap + XRGE approve + song purchase</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
                        <span className="text-xs text-muted-foreground font-mono">
                          Balance: {
                            paymentToken === 'ETH' ? (ethBalance?.formatted ? parseFloat(ethBalance.formatted).toFixed(4) : '0') :
                            paymentToken === 'XRGE' ? (xrgeBalance?.formatted ? parseFloat(xrgeBalance.formatted).toFixed(2) : '0') :
                            paymentToken === 'KTA' ? (ktaBalance?.formatted ? parseFloat(ktaBalance.formatted).toFixed(2) : '0') :
                            (usdcBalance?.formatted ? parseFloat(usdcBalance.formatted).toFixed(2) : '0')
                          }
                        </span>
                      )}
                    </div>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      className="font-mono"
                    />
                    
                    {/* Percentage Selector Buttons */}
                    {wagmiAddress && (
                      <div className="grid grid-cols-5 gap-1.5 mt-2">
                        {[
                          { label: '10%', value: 0.1 },
                          { label: '25%', value: 0.25 },
                          { label: '50%', value: 0.5 },
                          { label: '75%', value: 0.75 },
                          { label: 'MAX', value: 1 },
                        ].map((option) => (
                          <Button
                            key={option.label}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const balance = paymentToken === 'ETH' ? ethBalance :
                                            paymentToken === 'XRGE' ? xrgeBalance :
                                            paymentToken === 'KTA' ? ktaBalance :
                                            usdcBalance;
                              if (balance?.formatted) {
                                const amount = (parseFloat(balance.formatted) * option.value).toFixed(4);
                                setBuyAmount(amount);
                              }
                            }}
                            className="font-mono text-[10px] py-1 h-7 border-neon-green/30 hover:bg-neon-green/10 hover:border-neon-green/50"
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}
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

                  <div className="space-y-2">
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

                    {/* Apple Pay / Fiat Onramp Button */}
                    <Button
                      onClick={() => {
                        if (fullAddress) {
                          fundWallet({ address: fullAddress as `0x${string}` });
                          toast({
                            title: "Opening Fiat Onramp",
                            description: "Buy ETH with Apple Pay, then return to purchase song tokens!",
                          });
                        }
                      }}
                      className="w-full font-mono bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
                      size="sm"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      BUY ETH WITH APPLE PAY
                    </Button>
                  </div>

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
                )}

                {/* Sell Card */}
                {tradeMode === 'sell' && (
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
                        <span className="text-xs text-muted-foreground font-mono">
                          Balance: {parseFloat(userBalance).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      className="font-mono"
                    />
                    
                    {/* Percentage Selector Buttons */}
                    {userBalance && parseFloat(userBalance) > 0 && (
                      <div className="grid grid-cols-5 gap-1.5 mt-2">
                        {[
                          { label: '10%', value: 0.1 },
                          { label: '25%', value: 0.25 },
                          { label: '50%', value: 0.5 },
                          { label: '75%', value: 0.75 },
                          { label: 'MAX', value: 1 },
                        ].map((option) => (
                          <Button
                            key={option.label}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const amount = (parseFloat(userBalance) * option.value).toFixed(4);
                              setSellAmount(amount);
                            }}
                            className="font-mono text-[10px] py-1 h-7 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}
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
                )}
              </div>
            )}
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
                            {parseFloat(holder.balance).toLocaleString()} tokens
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
              {song && <SongComments songId={song.id} />}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </NetworkGuard>
  );
};

export default SongTrade;
