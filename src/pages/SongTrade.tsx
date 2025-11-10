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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
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
import SongTradeHeader from "@/components/SongTradeHeader";
import SongTradeStats from "@/components/SongTradeStats";
import SongTradeHolders from "@/components/SongTradeHolders";
import SongTradeRecentTrades from "@/components/SongTradeRecentTrades";
import SongTradeForm from "@/components/SongTradeForm";
import { useBuySongTokens, useSellSongTokens, useSongPrice, useSongMetadata, useCreateSong, SONG_FACTORY_ADDRESS, useApproveToken, useBuyQuote, useSellQuote, useBondingCurveSupply, useSongTokenBalance, BONDING_CURVE_ADDRESS, useAutoIndexTrades } from "@/hooks/useSongBondingCurve";
import { useBalance, useConnect, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { useXRGESwap, KTA_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, useXRGEQuote, useXRGEQuoteFromKTA, useXRGEQuoteFromUSDC, XRGE_TOKEN_ADDRESS as XRGE_TOKEN } from "@/hooks/useXRGESwap";
import { usePrivyToken } from "@/hooks/usePrivyToken";
import { usePrivyWagmi } from "@/hooks/usePrivyWagmi";
import { useFundWallet, useWallets, usePrivy } from "@privy-io/react-auth";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { invalidate24hDataCache } from "@/hooks/useSong24hData";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { Play, TrendingUp, TrendingDown, Users, MessageSquare, ArrowUpRight, ArrowDownRight, Loader2, Rocket, Wallet, Copy, Check, ExternalLink, CreditCard, Share2, Pause, Edit, Download, Lock } from "lucide-react";
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
  download_enabled?: boolean | null;
  download_type?: string | null;
  download_price_usdc?: number | null;
  og_image_url?: string | null;
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
  const { fundWallet } = useFundWallet();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount(); // Wagmi account check
  const { getAuthHeaders } = usePrivyToken();
  
  // Function to cache OG image via edge function
  // Note: This is a public operation, uses anon key for Supabase Edge Function
  const cacheOGImage = async (songId: string, coverCid: string) => {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cache-og-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`, // Supabase requires both apikey and Authorization headers
        },
        body: JSON.stringify({ songId, coverCid }),
      });
      
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `Failed to cache OG image: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          if (errorData.details) {
            errorMessage += ` - ${errorData.details}`;
          }
        } catch {
          // If JSON parsing fails, use status text
          const text = await response.text().catch(() => '');
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      // Update song with cached OG image URL
      if (result.success && result.ogImageUrl) {
        setSong((prev) => (prev ? { ...prev, og_image_url: result.ogImageUrl } : prev));
      }
    } catch (error: any) {
      console.error('Error caching OG image:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        songId,
        coverCid,
      });
      // Non-blocking error - don't throw
    }
  };
  const { prices } = useTokenPrices();
  const { wallets } = useWallets(); // Get Privy wallets to detect external wallets
  const { user, ready } = usePrivy();
  
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
  const [downloading, setDownloading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Fetch artist profile from IPFS
  const { profile: artistProfile } = useArtistProfile(song?.wallet_address || null);

  // Bonding curve hooks
  const { createSong, isPending: isDeploying, isConfirming, isSuccess: deploySuccess, hash, receipt } = useCreateSong();
  const { buyWithETH, buyWithXRGE, isPending: isBuying, isSuccess: buySuccess, hash: buyHash } = useBuySongTokens();
  const { sell, isPending: isSelling, isSuccess: sellSuccess, hash: sellHash } = useSellSongTokens();
  const { indexTradeAfterSuccess } = useAutoIndexTrades();
  const { price: priceData, rawPrice, isLoading: priceLoading, refetch: refetchPrice } = useSongPrice(songTokenAddress);
  const { metadata: metadataData, isLoading: metadataLoading, refetch: refetchMetadata } = useSongMetadata(songTokenAddress);
  const { supply: bondingSupply, refetch: refetchSupply } = useBondingCurveSupply(songTokenAddress);
  const { balance: userBalance, refetch: refetchBalance } = useSongTokenBalance(songTokenAddress, fullAddress as `0x${string}` | undefined);
  const { approve, isPending: isApproving } = useApproveToken();
  const { connectors, connectAsync } = useConnect();
  const publicClient = usePublicClient();
  
  const ensureWagmiConnected = async () => {
    if (wagmiConnected) return;
    
    // Check if user has an external wallet (like MetaMask) connected via Privy
    const externalWallet = wallets.find(
      (wallet) => wallet.walletClientType !== 'privy' && 
                  wallet.walletClientType !== 'embedded_wallet' &&
                  (wallet.walletClientType === 'metamask' || wallet.walletClientType === 'injected')
    );
    
    // Also check if MetaMask is available directly (for users not connected through Privy)
    const isMetaMaskAvailable = typeof window !== 'undefined' && 
                                 (window as any).ethereum?.isMetaMask === true;
    
    const privyConn = connectors.find(c => /privy/i.test(c.id) || /privy/i.test(c.name));
    const injected = connectors.find(c => c.id === 'injected' || c.name?.toLowerCase().includes('metamask'));
    
    // Priority: MetaMask (if available) > External wallet via Privy > Privy connector > Fallback
    // If MetaMask is available or user has MetaMask connected via Privy, use injected connector
    // Otherwise, use Privy connector if authenticated
    let target;
    if ((isMetaMaskAvailable || externalWallet) && injected) {
      // User has MetaMask available or connected - use injected connector
      target = injected;
      console.log('🔌 Detected MetaMask/external wallet, using injected connector');
    } else if (isConnected && privyConn) {
      // User authenticated with Privy (embedded wallet) - use Privy connector
      target = privyConn;
      console.log('🔌 Using Privy connector for embedded wallet');
    } else {
      // Fallback: try injected first, then Privy, then any available
      target = injected || privyConn || connectors[0];
      console.log('🔌 Using fallback connector');
    }
    
    if (!target) {
      throw new Error('No wallet connector available');
    }
    
    console.log('🔌 Connecting wagmi with:', target.name, target.id, 'Privy authenticated:', isConnected, 'MetaMask available:', isMetaMaskAvailable, 'External wallet:', !!externalWallet);
    
    try {
      await connectAsync({ connector: target });
    } catch (e) {
      console.error('❌ Failed to connect wagmi:', e);
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
      console.log('🔍 Fetching holders for token:', songTokenAddress);
      
      // Get database purchases (for fallback if needed)
      const { data: purchases, error: purchasesError } = await supabase
        .from('song_purchases')
        .select('buyer_wallet_address')
        .eq('song_id', songId);
      
      if (purchasesError) {
        console.error('Error fetching purchases:', purchasesError);
      }
      
      const uniqueHolders = new Set(purchases?.map(p => p.buyer_wallet_address.toLowerCase()) || []);
      console.log('👥 Unique holders from database:', uniqueHolders.size);
      
      // Use Basescan API V2 to get accurate holder list (V1 is deprecated)
      try {
        // Using V2 endpoint: https://docs.etherscan.io/api-reference/token-endpoints/token-endpoints-v2#get-token-holder-list-by-contract-address
        // API key from environment variable - set in .env.local for development
        // For production (Netlify), set VITE_BASESCAN_API_KEY in environment variables
        const basescanApiKey = import.meta.env.VITE_BASESCAN_API_KEY || '';
        const basescanUrl = `https://api.basescan.org/v2/api?chainid=8453&module=token&action=tokenholderlist&contractaddress=${songTokenAddress}&page=1&offset=100&apikey=${basescanApiKey}`;
        
        console.log('📡 Querying Basescan API V2 for holders...');
        console.log('🔗 Token address:', songTokenAddress);
        console.log('🔗 Full URL:', basescanUrl);
        
        const response = await fetch(basescanUrl);
        console.log('📡 Basescan API response status:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`Basescan API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📡 Basescan API V2 response:', data);
        
        if (data.status === '1' && data.result && Array.isArray(data.result)) {
          console.log('✅ Basescan returned', data.result.length, 'holders');
          console.log('✅ Holders data:', data.result);
          
          const holdersList = data.result
            .map((holder: any) => ({
              address: holder.TokenHolderAddress.toLowerCase(),
              balance: (Number(holder.TokenHolderQuantity) / 1e18).toFixed(2),
              rawBalance: BigInt(holder.TokenHolderQuantity),
              percentage: 0 // Will calculate below
            }))
            .filter((h: any) => h.rawBalance > BigInt(0))
            .sort((a: any, b: any) => Number(b.rawBalance - a.rawBalance));
          
          // Calculate percentages
          const totalHeld = holdersList.reduce((sum: bigint, h: any) => sum + h.rawBalance, BigInt(0));
          const formattedHolders = holdersList.map((h: any) => ({
            address: h.address,
            balance: h.balance,
            percentage: totalHeld > BigInt(0) 
              ? (Number(h.rawBalance * BigInt(10000) / totalHeld) / 100)
              : 0
          }));
          
          console.log('✅ Final holders from Basescan:', formattedHolders.length);
          setHolders(formattedHolders.slice(0, 10));
          setHolderCount(formattedHolders.length);
          setLoadingHolders(false);
          return; // Exit early with Basescan data
        } else {
          console.warn('⚠️ Basescan API returned no data or error:', data.message || 'Unknown error');
          console.warn('⚠️ Full response data:', data);
        }
      } catch (basescanError) {
        console.error('❌ Basescan API failed, falling back to blockchain query:', basescanError);
        console.error('❌ Error details:', basescanError instanceof Error ? basescanError.message : basescanError);
      }
      
      // Fallback: Try blockchain query if Basescan fails
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
        // Use a VERY large block range to ensure we catch ALL historical transfers
        // Base produces ~43,200 blocks per day
        // If we have creation date, calculate exact blocks since creation
        // Otherwise, use 2 million blocks (~46 days) to be safe
        let blocksSinceCreation: number;
        if (songData?.created_at) {
          const msElapsed = Date.now() - new Date(songData.created_at).getTime();
          const secondsElapsed = msElapsed / 1000;
          // Base: ~2 second block time
          blocksSinceCreation = Math.floor(secondsElapsed / 2);
          console.log('📅 Song created:', songData.created_at, '→', blocksSinceCreation, 'blocks ago');
        } else {
          blocksSinceCreation = 2000000; // ~46 days fallback
          console.log('⚠️ No creation date, using fallback:', blocksSinceCreation, 'blocks');
        }
        
        const fromBlock = currentBlock - BigInt(blocksSinceCreation);
        console.log('🔗 Scanning blocks:', fromBlock.toString(), '→', currentBlock.toString(), '(', blocksSinceCreation, 'blocks )');
          
          const logs = await publicClient.getLogs({
            address: songTokenAddress,
            event: ERC20_TRANSFER_ABI[0],
            fromBlock,
            toBlock: 'latest'
          });

          // Track ALL addresses that ever received tokens (for balance checking)
          const holderBalances: Record<string, bigint> = {};
          const allAddressesThatReceivedTokens = new Set<string>();
          
          console.log('🔗 Processing', logs.length, 'transfer logs...');
          
          for (const log of logs) {
            const { args } = log as any;
            const from = args.from?.toLowerCase();
            const to = args.to?.toLowerCase();
            const value = BigInt(args.value || 0);
            
            const zeroAddress = '0x0000000000000000000000000000000000000000';
            
            if (from && from !== zeroAddress) {
              holderBalances[from] = (holderBalances[from] || BigInt(0)) - value;
              allAddressesThatReceivedTokens.add(from);
            }
            
            if (to && to !== zeroAddress) {
              holderBalances[to] = (holderBalances[to] || BigInt(0)) + value;
              allAddressesThatReceivedTokens.add(to);
            }
          }
          
          console.log('📊 Found', allAddressesThatReceivedTokens.size, 'unique addresses that ever received tokens');
          
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
          
          // Always verify with direct balance checks to ensure we don't miss any holders
          // Check ALL addresses that ever received tokens (not just those with tracked balances)
          // This ensures we catch holders even if our block range is incomplete
          const allPotentialHolders = new Set([
            ...allAddressesThatReceivedTokens, // ALL addresses from transfer logs
            ...uniqueHolders                    // Plus any from database
          ]);
          
          console.log('🔍 Checking balances for', allPotentialHolders.size, 'potential holders (', allAddressesThatReceivedTokens.size, 'addresses from transfers +', uniqueHolders.size, 'from database)');
          
          if (allPotentialHolders.size >= 1) {
            console.log('🔍 Running direct balance checks for ALL addresses that ever received tokens...');
            
            const directBalanceChecks = await Promise.all(
              Array.from(allPotentialHolders).map(async (address) => {
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
            
            if (directHolders.length >= holdersWithBalance.length) {
              // Calculate percentages for direct holders
              const totalHeld = directHolders.reduce((sum, h) => sum + h.rawBalance, BigInt(0));
              const formattedDirectHolders = directHolders.map(h => ({
                address: h.address,
                balance: h.balance,
                percentage: totalHeld > BigInt(0) 
                  ? (Number(h.rawBalance * BigInt(10000) / totalHeld) / 100)
                  : 0
              }));
              
              console.log('✅ Using direct balance checks:', directHolders.length, 'holders (was', holdersWithBalance.length, 'from transfers)');
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
      
      // Cache OG image if cover exists but OG image doesn't
      // This needs to happen before Discord crawls the page
      if (data && data.cover_cid && !data.og_image_url) {
        // Try to cache immediately - wait for it if possible
        const cachePromise = cacheOGImage(data.id, data.cover_cid);
        // Don't block page load, but cache will update state when ready
        cachePromise.catch(err => {
          console.warn('Failed to cache OG image:', err);
          // Non-blocking - continue even if cache fails
        });
      }
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
        // The approve function now waits for confirmation before returning
        await approve(XRGE_TOKEN, xrgeReceived);
        console.log('✅ XRGE approved for bonding curve');
        
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
      
      // Record purchase in database using edge function to bypass RLS
      if (song && fullAddress) {
        try {
          const authHeaders = await getAuthHeaders();
          
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-purchase`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify({
              songId: song.id,
              artistWalletAddress: song.wallet_address.toLowerCase(),
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Error recording purchase:', errorData.error || `HTTP ${response.status}`);
          } else {
            const result = await response.json();
            if (result.success) {
              console.log('✅ Purchase recorded in database');
              // Refresh holders immediately after recording purchase
              setTimeout(() => fetchHolders(), 1000);
            }
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
        
        // Invalidate 24h data cache to force recalculation after purchase
        if (songTokenAddress) {
          invalidate24hDataCache(songTokenAddress);
          console.log('🔄 Invalidated 24h data cache after purchase');
        }
        
        // Auto-index trade for database-backed charts
        if (buyHash && songTokenAddress && song?.id) {
          try {
            await indexTradeAfterSuccess(buyHash, songTokenAddress, song.id);
            console.log('✅ Trade indexed for charts');
          } catch (idxError) {
            console.warn('Failed to auto-index trade (non-critical):', idxError);
          }
        }
        
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
      
      // Auto-index trade for database-backed charts
      if (sellHash && songTokenAddress && song?.id) {
        try {
          await indexTradeAfterSuccess(sellHash, songTokenAddress, song.id);
          console.log('✅ Sell trade indexed for charts');
        } catch (idxError) {
          console.warn('Failed to auto-index sell trade (non-critical):', idxError);
        }
      }
      
      // Invalidate 24h data cache after sell
      if (songTokenAddress) {
        invalidate24hDataCache(songTokenAddress);
      }
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
      const text = `Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on ROUGEE`;
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

  const handleDownload = async () => {
    if (!song || !song.audio_cid) {
      toast({
        title: "Download unavailable",
        description: "Audio file not found",
        variant: "destructive",
      });
      return;
    }

    // Check if download is enabled
    if (!song.download_enabled) {
      toast({
        title: "Downloads disabled",
        description: "The artist has disabled downloads for this song",
        variant: "destructive",
      });
      return;
    }

    const downloadType = song.download_type || 'disabled';
    
    // Check download type and handle accordingly
    if (downloadType === 'disabled') {
      toast({
        title: "Downloads disabled",
        description: "Downloads are not available for this song",
        variant: "destructive",
      });
      return;
    }

    if (downloadType === 'free') {
      // Free download - proceed directly
      performDownload();
      return;
    }

    if (downloadType === 'holders_only') {
      // Check if user holds tokens
      if (!fullAddress || !songTokenAddress) {
        toast({
          title: "Wallet required",
          description: "Please connect your wallet to verify token ownership",
          variant: "destructive",
        });
        return;
      }

      // Check token balance
      const hasTokens = userBalance && parseFloat(userBalance) > 0;
      if (!hasTokens) {
        toast({
          title: "Token holder required",
          description: "You need to hold tokens for this song to download. Purchase tokens to unlock downloads.",
          variant: "destructive",
        });
        return;
      }

      // User has tokens - proceed with download
      performDownload();
      return;
    }

    if (downloadType === 'purchase_usdc') {
      // Handle USDC payment
      if (!fullAddress || !isConnected) {
        toast({
          title: "Wallet required",
          description: "Please connect your wallet to purchase download",
          variant: "destructive",
        });
        return;
      }

      const price = song.download_price_usdc || 0;
      if (price <= 0) {
        toast({
          title: "Invalid price",
          description: "Download price not set",
          variant: "destructive",
        });
        return;
      }

      // Show payment modal
      setShowDownloadModal(true);
      return;
    }
  };

  const performDownloadPayment = async () => {
    if (!song || !fullAddress || !user) {
      return;
    }

    const price = song.download_price_usdc || 0;
    setDownloading(true);
    setShowDownloadModal(false);

    try {
      // Create wallet client for signing (same as TipButton)
      const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
      if (!embeddedWallet) {
        throw new Error('Embedded wallet not found. Please use an embedded wallet for payments.');
      }

      // Get Ethereum provider from Privy wallet
      let provider;
      try {
        await embeddedWallet.switchChain(8453); // Ensure on Base
        provider = await embeddedWallet.getEthereumProvider();
      } catch (providerError) {
        throw new Error('Could not access wallet provider for payment.');
      }

      // Create viem wallet client
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });
      
      const addresses = await walletClient.getAddresses();
      const account = addresses[0];
      
      if (!account) {
        throw new Error('Could not get account from wallet.');
      }

      const signingClient = createWalletClient({
        account,
        chain: base,
        transport: custom(provider),
      });

      toast({
        title: "Processing Payment... 💸",
        description: `Creating payment for $${price} USDC`,
      });

      // Create USDC transfer directly using ERC20 contract (same pattern as TipButton)
      const usdcContractAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
      const amountInWei = BigInt(Math.floor(price * 1_000_000)); // USDC 6 decimals
      
      // USDC transfer function signature: transfer(address,uint256)
      const transferData = `0xa9059cbb${song.wallet_address.slice(2).padStart(64, '0')}${amountInWei.toString(16).padStart(64, '0')}` as `0x${string}`;
      
      // Send the actual USDC transfer transaction
      const txHash = await signingClient.sendTransaction({
        to: usdcContractAddress as Address,
        data: transferData,
        value: 0n, // No ETH value, just USDC transfer
      });

      toast({
        title: "✅ Payment sent!",
        description: `Transaction submitted: ${txHash.substring(0, 10)}...`,
      });

      // Wait for transaction confirmation (optional - could proceed immediately)
      // For now, proceed with download after transaction is submitted
      // In production, you might want to wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 2000)); // Brief delay for UX

      toast({
        title: "✅ Payment successful!",
        description: "Downloading your song...",
      });

      // Proceed with download after payment
      performDownload();
    } catch (error: any) {
      console.error('Download payment error:', error);
      toast({
        title: "Payment failed",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const performDownload = async () => {
    if (!song || !song.audio_cid) return;

    setDownloading(true);

    try {
      // Get audio URL from IPFS
      const audioUrl = getIPFSGatewayUrl(song.audio_cid, undefined, true);
      
      // Fetch the audio file
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch audio file');
      }

      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title} - ${song.artist || 'Unknown Artist'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "✅ Download started!",
        description: `Downloading ${song.title}`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message || "Failed to download song",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
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

  // Use cached OG image if available, otherwise fallback to IPFS or default
  // Always prefer cached OG image for social sharing (Discord, Twitter, etc.)
  // NOTE: Discord caches OG images aggressively - cached images must be available when Discord crawls
  let coverImageUrl: string;
  
  if (song.og_image_url) {
    // Use cached OG image (best for social sharing)
    coverImageUrl = song.og_image_url;
  } else if (song.cover_cid) {
    // Fallback to IPFS gateway (Discord may not be able to access IPFS)
    coverImageUrl = getIPFSGatewayUrl(song.cover_cid, 'https://gateway.lighthouse.storage/ipfs');
  } else {
    // Final fallback to default OG image
    coverImageUrl = `${window.location.origin}/rougee-new-og.jpg`;
  }
  
  // Ensure absolute URL for social crawlers (they need full URLs)
  if (coverImageUrl && !coverImageUrl.startsWith('http')) {
    coverImageUrl = `${window.location.origin}${coverImageUrl}`;
  }
  
  const pageUrl = `https://rougee.app/song/${song.id}`;

  return (
    <NetworkGuard>
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <Helmet>
          <title>{song.title} - {song.artist || 'Unknown Artist'} | RouGee.app</title>
        <meta name="description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on RouGee.app. Stream and trade music NFTs on the blockchain.`} />
        
        <meta property="og:title" content={`${song.title} - ${song.artist || 'Unknown Artist'}`} />
        <meta property="og:description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on RouGee.app`} />
        <meta property="og:image" content={coverImageUrl} />
        <meta property="og:image:secure_url" content={coverImageUrl} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="music.song" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${song.title} - ${song.artist || 'Unknown Artist'}`} />
        <meta name="twitter:description" content={`Listen to ${song.title} by ${song.artist || 'Unknown Artist'} on RouGee.app`} />
        <meta name="twitter:image" content={coverImageUrl} />
        <meta name="twitter:image:src" content={coverImageUrl} />
      </Helmet>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8">
        {/* Song Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
          <SongTradeHeader
            song={song}
            currentSong={currentSong}
            isPlaying={isPlaying}
            playSong={playSong}
            fullAddress={fullAddress}
            userBalance={userBalance}
            sharing={sharing}
            copied={copied}
            downloading={downloading}
            onShare={handleShare}
            onDownload={handleDownload}
          />

          {/* Quick Stats */}
          <SongTradeStats
            song={song}
            songTokenAddress={songTokenAddress}
            currentPrice={currentPrice}
            priceInXRGE={priceInXRGE}
            priceChange24h={priceChange24h}
            volume24h={volume24h}
            xrgeUsdPrice={xrgeUsdPrice}
            userBalance={userBalance}
            currentPriceAfterFee={currentPriceAfterFee}
            hasRealisticData={hasRealisticData}
            marketCapUSD={marketCapUSD}
            realizedValueXRGE={realizedValueXRGE}
            activeTradingSupply={activeTradingSupply}
            holderCount={holderCount}
            loadingHolders={loadingHolders}
            copiedAddress={copiedAddress}
            fullAddress={fullAddress}
            isDeploying={isDeploying}
            isConfirming={isConfirming}
            onAddTokenToWallet={addTokenToWallet}
            onCopyTokenAddress={copyTokenAddress}
            onDeploy={handleDeploy}
          />
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
        <SongTradeRecentTrades trades={recentTrades} song={song} />

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
            <SongTradeForm
              isConnected={isConnected}
              song={song}
              songTokenAddress={songTokenAddress}
              tradeMode={tradeMode}
              setTradeMode={setTradeMode}
              buyAmount={buyAmount}
              setBuyAmount={setBuyAmount}
              sellAmount={sellAmount}
              setSellAmount={setSellAmount}
              paymentToken={paymentToken}
              setPaymentToken={setPaymentToken}
              userBalance={userBalance}
              priceInXRGE={priceInXRGE}
              activeTradingSupply={activeTradingSupply}
              xrgeEquivalent={xrgeEquivalent}
              buyQuote={buyQuote}
              buyQuoteLoading={buyQuoteLoading}
              sellQuote={sellQuote}
              sellQuoteLoading={sellQuoteLoading}
              wagmiAddress={wagmiAddress}
              ethBalance={ethBalance}
              xrgeBalance={xrgeBalance}
              ktaBalance={ktaBalance}
              usdcBalance={usdcBalance}
              fullAddress={fullAddress}
              isProcessingBuy={isProcessingBuy}
              isBuying={isBuying}
              isSelling={isSelling}
              isApproving={isApproving}
              isSwapping={isSwapping}
              onBuy={handleBuy}
              onSell={handleSell}
            />
          </TabsContent>

          {/* Holders Tab */}
          <TabsContent value="holders" className="mt-0">
            <SongTradeHolders holders={holders} loadingHolders={loadingHolders} />
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

      {/* Download Payment Dialog */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl text-neon-green">Purchase Download</DialogTitle>
            <DialogDescription className="font-mono">
              Pay {song?.download_price_usdc || 0} USDC to download "{song?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
              <span className="font-mono text-sm text-muted-foreground">Download Price:</span>
              <span className="font-mono text-lg font-bold text-neon-green">
                ${song?.download_price_usdc || 0} USDC
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Payment will be sent to the artist's wallet address.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDownloadModal(false)}
              className="font-mono"
              disabled={downloading}
            >
              Cancel
            </Button>
            <Button
              onClick={performDownloadPayment}
              className="font-mono"
              disabled={downloading || !isConnected}
              variant="neon"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay & Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </NetworkGuard>
  );
};

export default SongTrade;
