import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { useFundWallet } from "@privy-io/react-auth";
import { useIPLogger } from "@/hooks/useIPLogger";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSongPrice } from "@/hooks/useSongBondingCurve";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet as WalletIcon, Copy, Check, CreditCard, ArrowDownToLine, RefreshCw, Send, Music2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useBalance, useReadContract, useSendTransaction, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseEther, formatEther, Address } from "viem";
import xrgeLogo from "@/assets/tokens/xrge.png";
import { AiBadge } from "@/components/AiBadge";
import ktaLogo from "@/assets/tokens/kta.png";
import ethLogo from "@/assets/tokens/ethereum-eth.svg";
import usdcLogo from "@/assets/tokens/usdc.jpg";
import { getIPFSGatewayUrl } from "@/lib/ipfs";

const XRGE_TOKEN_ADDRESS = "0x147120faEC9277ec02d957584CFCD92B56A24317" as const;
const KTA_TOKEN_ADDRESS = "0xc0634090F2Fe6c6d75e61Be2b949464aBB498973" as const;
const USDC_TOKEN_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

// Format large numbers for display (e.g., 1234567 -> 1.23M)
const formatCompactNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  } else if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  return value.toFixed(4);
};

// Component for individual song token with real-time price
interface SongTokenItemProps {
  song: {
    id: string;
    title: string;
    artist?: string;
    ticker?: string;
    token_address: string;
    cover_cid?: string;
    ai_usage?: 'none' | 'partial' | 'full' | null;
  };
  userAddress: string;
  xrgeUsdPrice: number;
  onClick: () => void;
  onBalanceLoaded?: (songId: string, hasBalance: boolean) => void;
}

  const SongTokenItem = ({ song, userAddress, xrgeUsdPrice, onClick, onBalanceLoaded }: SongTokenItemProps) => {
  const navigate = useNavigate();
  
  // Log when component mounts
  useEffect(() => {
    console.log(`🔄 Mounting SongTokenItem for ${song.ticker} (${song.token_address})`);
    console.log(`   User address: ${userAddress}`);
  }, []);
  
  // Get user's balance of this token
  const { data: balanceData, isLoading: balanceLoading, isError, error } = useReadContract({
    address: song.token_address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress as Address],
    query: {
      enabled: !!userAddress && !!song.token_address,
    },
  });
  
  // Get current price from bonding curve (real-time!)
  const { price: priceInXRGE } = useSongPrice(song.token_address as Address);
  
  const balance = balanceData ? Number(balanceData) / 1e18 : 0;
  const priceXRGE = parseFloat(priceInXRGE) || 0;
  const priceUSD = priceXRGE * xrgeUsdPrice;
  const valueUSD = balance * priceUSD;
  
  // Log loading state
  useEffect(() => {
    if (balanceLoading) {
      console.log(`⏳ Loading balance for ${song.ticker}...`);
    }
  }, [balanceLoading, song.ticker]);
  
  // Notify parent about balance status
  useEffect(() => {
    if (balanceData !== undefined && onBalanceLoaded) {
      const hasBalance = balance > 0;
      console.log(`🎵 ${song.ticker}: balance=${balance.toFixed(4)}, hasBalance=${hasBalance}, balanceData=${balanceData?.toString()}`);
      onBalanceLoaded(song.id, hasBalance);
    }
  }, [song.id, balance, balanceData, onBalanceLoaded, song.ticker]);
  
  // Log errors with details
  useEffect(() => {
    if (isError) {
      console.error(`❌ Error fetching balance for ${song.ticker} (${song.token_address})`);
      console.error(`   Error details:`, error);
      // Still notify parent so we can count checked songs
      if (onBalanceLoaded) {
        onBalanceLoaded(song.id, false);
      }
    }
  }, [isError, song.ticker, song.token_address, error, song.id, onBalanceLoaded]);
  
  // Only render if user has a balance
  if (balance === 0) return null;
  
  return (
    <div
      className="group flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-background/80 to-background/40 hover:from-neon-green/10 hover:to-purple-500/10 transition-all duration-300 border border-border hover:border-neon-green/50 cursor-pointer hover:shadow-lg hover:shadow-neon-green/10 hover:scale-[1.02]"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 flex-1">
        {song.cover_cid ? (
          <img
            src={getIPFSGatewayUrl(song.cover_cid)}
            alt={song.title}
            className="w-12 h-12 rounded-lg object-cover ring-2 ring-border group-hover:ring-neon-green/50 transition-all duration-300"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center ring-2 ring-border group-hover:ring-neon-green/50 transition-all duration-300">
            <span className="text-lg font-mono font-bold text-neon-green">
              {song.ticker?.[0] || '?'}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold font-mono truncate group-hover:text-neon-green transition-colors flex items-center gap-1.5">
            <span className="truncate">{song.title}</span>
            <AiBadge aiUsage={song.ai_usage} size="sm" />
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{song.ticker || 'Unknown'}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-base font-bold font-mono text-neon-green">
          {formatCompactNumber(balance)}
        </p>
        {valueUSD > 0 ? (
          <>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              ${valueUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
            </p>
            {priceUSD > 0 && (
              <p className="text-[10px] text-muted-foreground/70 font-mono">
                ${priceUSD < 0.01 ? priceUSD.toFixed(6) : priceUSD.toFixed(4)}/token
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground/60 font-mono italic">
            Loading price...
          </p>
        )}
      </div>
    </div>
  );
};

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
] as const;

const Wallet = () => {
  const navigate = useNavigate();
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const { address: accountAddress, chain } = useAccount();
  const { fundWallet } = useFundWallet();
  const { logIP } = useIPLogger('wallet_visit');
  const { prices, calculateUsdValue } = useTokenPrices();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendType, setSendType] = useState<'ETH' | 'XRGE' | 'KTA'>('ETH');
  const [sendForm, setSendForm] = useState({
    to: '',
    amount: '',
  });
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [ownedSongsMap, setOwnedSongsMap] = useState<Map<string, boolean>>(new Map());
  const [activeTab, setActiveTab] = useState<'balances' | 'music'>('balances');

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useBalance({
    address: fullAddress as `0x${string}`,
  });

  const { data: xrgeBalance, isLoading: xrgeLoading, refetch: refetchXrge } = useReadContract({
    address: XRGE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: fullAddress ? [fullAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!fullAddress,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  const { data: xrgeDecimals } = useReadContract({
    address: XRGE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  const { data: ktaBalance, isLoading: ktaLoading, refetch: refetchKta } = useReadContract({
    address: KTA_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: fullAddress ? [fullAddress as `0x${string}`] : undefined,
  });

  const { data: ktaDecimals } = useReadContract({
    address: KTA_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  const { data: usdcBalance, isLoading: usdcLoading, refetch: refetchUsdc } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: fullAddress ? [fullAddress as `0x${string}`] : undefined,
  });

  const { data: usdcDecimals } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  const { sendTransaction, data: ethTxHash, isPending: ethSending, error: ethError } = useSendTransaction();
  const { writeContract, data: tokenTxHash, isPending: tokenSending, error: tokenError } = useWriteContract();
  
  const { isLoading: ethTxLoading, isSuccess: ethTxSuccess } = useWaitForTransactionReceipt({
    hash: ethTxHash,
  });
  
  const { isLoading: tokenTxLoading, isSuccess: tokenTxSuccess } = useWaitForTransactionReceipt({
    hash: tokenTxHash,
  });


  useEffect(() => {
    // Only redirect if Privy is ready and user is not connected
    if (isPrivyReady && !isConnected) {
      navigate("/");
    }
  }, [isConnected, isPrivyReady, navigate]);

  useEffect(() => {
    if (fullAddress) {
      fetchAllSongs();
    }
  }, [fullAddress]);
  
  const fetchAllSongs = async () => {
    if (!fullAddress) return;
    
    setLoadingSongs(true);
    setOwnedSongsMap(new Map()); // Reset map when fetching
    try {
      // Get all deployed songs with token addresses
      const { data: songs, error } = await supabase
        .from('songs')
        .select('id, title, artist, ticker, token_address, cover_cid')
        .not('token_address', 'is', null);
        
      if (error) {
        console.error('❌ Error fetching songs:', error);
        throw error;
      }
      
      console.log(`✅ Fetched ${songs?.length || 0} songs with token addresses for wallet UI`);
      console.log(`🔍 Checking balances for wallet: ${fullAddress}`);
      if (songs && songs.length > 0) {
        console.log(`📋 Songs to check:`, songs.map(s => `${s.ticker} (${s.token_address})`));
      }
      setAllSongs(songs || []);
    } catch (error) {
      console.error('Error fetching songs:', error);
      setAllSongs([]);
    } finally {
      setLoadingSongs(false);
    }
  };

  // Track owned songs count
  const handleBalanceLoaded = useCallback((songId: string, hasBalance: boolean) => {
    setOwnedSongsMap(prev => {
      const newMap = new Map(prev);
      newMap.set(songId, hasBalance);
      const totalOwned = Array.from(newMap.values()).filter(Boolean).length;
      const totalChecked = newMap.size;
      console.log(`📊 Balance check: ${totalChecked}/${allSongs.length} songs checked, ${totalOwned} owned`);
      return newMap;
    });
  }, [allSongs.length]);

  // Calculate owned songs count from map
  const ownedSongsCount = Array.from(ownedSongsMap.values()).filter(Boolean).length;


  const copyAddress = async () => {
    if (fullAddress) {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      toast({
        title: "Address copied!",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatXrgeBalance = () => {
    if (!xrgeBalance || !xrgeDecimals) return "0.0000";
    const decimals = Number(xrgeDecimals);
    const balance = Number(xrgeBalance) / Math.pow(10, decimals);
    return balance.toFixed(4);
  };

  const formatKtaBalance = () => {
    if (!ktaBalance || !ktaDecimals) return "0.0000";
    const decimals = Number(ktaDecimals);
    const balance = Number(ktaBalance) / Math.pow(10, decimals);
    return balance.toFixed(4);
  };

  const formatUsdcBalance = () => {
    if (!usdcBalance || !usdcDecimals) return "0.0000";
    const decimals = Number(usdcDecimals);
    const balance = Number(usdcBalance) / Math.pow(10, decimals);
    return balance.toFixed(4);
  };

  const handleFundWallet = () => {
    if (fullAddress) {
      fundWallet({ address: fullAddress as `0x${string}` });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchXrge(), refetchKta(), refetchUsdc(), fetchAllSongs()]);
    toast({
      title: "Balances refreshed",
      description: "Your wallet balances have been updated",
    });
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleSend = async () => {
    if (!sendForm.to || !sendForm.amount) {
      toast({
        title: "Missing information",
        description: "Please enter recipient address and amount",
        variant: "destructive",
      });
      return;
    }

    try {
      if (sendType === 'ETH') {
        sendTransaction({
          to: sendForm.to as `0x${string}`,
          value: parseEther(sendForm.amount),
        });
      } else {
        const tokenAddress = sendType === 'XRGE' ? XRGE_TOKEN_ADDRESS : KTA_TOKEN_ADDRESS;
        const decimals = Number((sendType === 'XRGE' ? xrgeDecimals : ktaDecimals) || 18);
        const amount = BigInt(Math.floor(parseFloat(sendForm.amount) * Math.pow(10, decimals)));
        
        if (!accountAddress || !chain) {
          throw new Error("Wallet not properly connected");
        }
        
        writeContract({
          account: accountAddress,
          chain: chain,
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [sendForm.to as `0x${string}`, amount],
        });
      }
    } catch (error) {
      console.error('Send error:', error);
      toast({
        title: "Transaction failed",
        description: error instanceof Error ? error.message : "Failed to send",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (ethTxSuccess) {
      toast({
        title: "ETH sent successfully! 🎉",
        description: `Sent ${sendForm.amount} ETH to ${sendForm.to.slice(0, 6)}...${sendForm.to.slice(-4)}`,
      });
      setShowSendDialog(false);
      setSendForm({ to: '', amount: '' });
      refetchBalance();
    }
  }, [ethTxSuccess]);

  useEffect(() => {
    if (tokenTxSuccess) {
      toast({
        title: `${sendType} sent successfully! 🎉`,
        description: `Sent ${sendForm.amount} ${sendType} to ${sendForm.to.slice(0, 6)}...${sendForm.to.slice(-4)}`,
      });
      setShowSendDialog(false);
      setSendForm({ to: '', amount: '' });
      if (sendType === 'XRGE') {
        refetchXrge();
      } else {
        refetchKta();
      }
    }
  }, [tokenTxSuccess]);

  if (!isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <main className="container mx-auto px-4 py-4 max-w-3xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold font-mono mb-1 text-neon-green">MY WALLET</h1>
            <p className="text-xs md:text-sm text-muted-foreground font-mono hidden sm:block">Manage your crypto assets and music collection</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="font-mono border-neon-green/50 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="ml-1.5 hidden sm:inline">REFRESH</span>
          </Button>
        </div>

        {/* Connected Wallet Card */}
        <Card className="p-3 mb-3 bg-card/50 backdrop-blur border-neon-green/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-mono mb-1">Connected Wallet</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono font-bold text-neon-green">{formatAddress(fullAddress || "")}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="h-6 w-6 p-0"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-neon-green" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            <Badge variant="outline" className="border-neon-green/50 text-neon-green text-xs">
              Connected
            </Badge>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-3">
          <Button
            variant={activeTab === 'balances' ? 'neon' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('balances')}
            className="flex-1 font-mono"
          >
            <WalletIcon className="h-4 w-4 mr-2" />
            Balances
          </Button>
          <Button
            variant={activeTab === 'music' ? 'neon' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('music')}
            className="flex-1 font-mono relative"
          >
            <Music2 className="h-4 w-4 mr-2" />
            My Music
            {ownedSongsCount > 0 && (
              <span className="ml-2 bg-neon-green/20 text-neon-green text-xs font-bold px-1.5 py-0.5 rounded">
                {ownedSongsCount}
              </span>
            )}
          </Button>
        </div>

        {/* Balances Tab Content */}
        {activeTab === 'balances' && (
          <>
            {/* Quick Actions */}
            <Card className="p-3 mb-3 bg-card/50 backdrop-blur border-neon-green/20">
              <p className="text-xs text-muted-foreground font-mono mb-2">Quick Actions</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="neon"
                  size="sm"
                  onClick={handleFundWallet}
                  className="font-mono text-xs h-auto py-3 flex-col gap-1"
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="text-[10px]">BUY</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFundWallet}
                  className="font-mono text-xs h-auto py-3 flex-col gap-1 border-neon-green/50"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  <span className="text-[10px]">RECEIVE</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSendDialog(true)}
                  className="font-mono text-xs h-auto py-3 flex-col gap-1 border-neon-green/50"
                >
                  <Send className="h-4 w-4" />
                  <span className="text-[10px]">SEND</span>
                </Button>
              </div>
            </Card>

            {/* Token Balances Grid - Mobile Optimized */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* XRGE Token */}
          <Card className="p-4 bg-gradient-to-br from-neon-green/5 to-transparent backdrop-blur border-neon-green/30 hover:border-neon-green/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <img src={xrgeLogo} alt="XRGE" className="h-10 w-10 object-contain" />
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(XRGE_TOKEN_ADDRESS);
                  toast({
                    title: "Address copied!",
                    description: "XRGE token address copied",
                  });
                }}
                className="h-6 w-6 p-0 -mt-1"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-mono mb-1">XRGE Token</p>
            {xrgeLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-neon-green" />
            ) : (
              <>
                <div className="mb-1">
                  <span className="text-2xl font-bold font-mono text-neon-green block">
                    {formatCompactNumber(parseFloat(formatXrgeBalance()))}
                  </span>
                  <span className="text-xs text-muted-foreground/70 font-mono">
                    {parseFloat(formatXrgeBalance()).toLocaleString()} XRGE
                  </span>
                </div>
                <p className="text-sm font-mono text-muted-foreground">
                  ${calculateUsdValue(parseFloat(formatXrgeBalance()), 'xrge').toFixed(2)}
                </p>
              </>
            )}
          </Card>

          {/* KTA Token */}
          <Card className="p-4 bg-gradient-to-br from-purple-500/5 to-transparent backdrop-blur border-purple-500/30 hover:border-purple-500/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <img src={ktaLogo} alt="KTA" className="h-10 w-10 object-contain" />
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(KTA_TOKEN_ADDRESS);
                  toast({
                    title: "Address copied!",
                    description: "KTA token address copied",
                  });
                }}
                className="h-6 w-6 p-0 -mt-1"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-mono mb-1">KEETA Token</p>
            {ktaLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            ) : (
              <>
                <div className="mb-1">
                  <span className="text-2xl font-bold font-mono text-purple-400 block">
                    {formatKtaBalance()}
                  </span>
                  <span className="text-xs text-muted-foreground/70 font-mono">KTA</span>
                </div>
                <p className="text-sm font-mono text-muted-foreground">
                  ${calculateUsdValue(parseFloat(formatKtaBalance()), 'kta').toFixed(2)}
                </p>
              </>
            )}
          </Card>

          {/* ETH */}
          <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-transparent backdrop-blur border-blue-500/30 hover:border-blue-500/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <img src={ethLogo} alt="ETH" className="h-10 w-10 object-contain" />
            </div>
            <p className="text-xs text-muted-foreground font-mono mb-1">Ethereum</p>
            {balanceLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            ) : (
              <>
                <div className="mb-1">
                  <span className="text-2xl font-bold font-mono text-blue-400 block">
                    {balance ? parseFloat(balance.formatted).toFixed(4) : "0.0000"}
                  </span>
                  <span className="text-xs text-muted-foreground/70 font-mono">ETH</span>
                </div>
                <p className="text-sm font-mono text-muted-foreground">
                  ${balance ? calculateUsdValue(parseFloat(balance.formatted), 'eth').toFixed(2) : '0.00'}
                </p>
              </>
            )}
          </Card>

          {/* USDC */}
          <Card className="p-4 bg-gradient-to-br from-green-500/5 to-transparent backdrop-blur border-green-500/30 hover:border-green-500/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="h-10 w-10 rounded-full bg-green-500/10 backdrop-blur flex items-center justify-center p-0.5">
                <img src={usdcLogo} alt="USDC" className="h-full w-full object-contain rounded-full" style={{ filter: 'brightness(1.2) contrast(1.1)' }} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(USDC_TOKEN_ADDRESS);
                  toast({
                    title: "Address copied!",
                    description: "USDC token address copied",
                  });
                }}
                className="h-6 w-6 p-0 -mt-1"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-mono mb-1">USD Coin</p>
            {usdcLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-green-400" />
            ) : (
              <>
                <div className="mb-1">
                  <span className="text-2xl font-bold font-mono text-green-400 block">
                    {formatUsdcBalance()}
                  </span>
                  <span className="text-xs text-muted-foreground/70 font-mono">USDC</span>
                </div>
                <p className="text-sm font-mono text-muted-foreground">
                  ${calculateUsdValue(parseFloat(formatUsdcBalance()), 'usdc').toFixed(2)}
                </p>
              </>
            )}
          </Card>
        </div>
          </>
        )}

        {/* My Music Tab Content */}
        {activeTab === 'music' && (
          <>
            {/* Purchased Songs */}
        <Card className="p-4 bg-card/50 backdrop-blur border-neon-green/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold font-mono text-foreground flex items-center gap-2">
                My Song Tokens
                {ownedSongsCount > 0 && (
                  <Badge variant="outline" className="border-neon-green/50 bg-neon-green/10 text-neon-green font-mono px-2 py-0.5">
                    {ownedSongsCount}
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Real-time prices from bonding curve
              </p>
            </div>
          </div>
          
          {loadingSongs ? (
            <div className="text-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-neon-green mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-mono">Loading your music collection...</p>
            </div>
          ) : allSongs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground font-mono mb-2">No songs deployed yet</p>
              <p className="text-xs text-muted-foreground font-mono mb-3">
                Be the first to discover new music
              </p>
              <Button
                variant="neon"
                size="sm"
                onClick={() => navigate('/trending')}
                className="font-mono text-xs"
              >
                BROWSE SONGS
              </Button>
            </div>
          ) : (
            <>
              {/* Always render components to check balances, they'll return null if balance is 0 */}
              <div className="space-y-2">
                {fullAddress && allSongs.map((song) => (
                  <SongTokenItem
                    key={song.id}
                    song={song}
                    userAddress={fullAddress}
                    xrgeUsdPrice={prices.xrge}
                    onClick={() => navigate(`/song/${song.id}`)}
                    onBalanceLoaded={handleBalanceLoaded}
                  />
                ))}
              </div>
              
              {/* Show "no tokens" message only after all balances are checked */}
              {ownedSongsMap.size === allSongs.length && ownedSongsCount === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground font-mono mb-2">No song tokens yet</p>
                  <p className="text-xs text-muted-foreground font-mono mb-3">
                    Buy song tokens to support your favorite artists
                  </p>
                  <Button
                    variant="neon"
                    size="sm"
                    onClick={() => navigate('/trending')}
                    className="font-mono text-xs"
                  >
                    BROWSE SONGS
                  </Button>
                </div>
              )}
              
              {/* Show loading message while checking balances */}
              {ownedSongsMap.size < allSongs.length && (
                <div className="text-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-neon-green mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/60 font-mono">
                    Checking balances... {ownedSongsMap.size} / {allSongs.length}
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
          </>
        )}
      </main>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl">SEND CRYPTO</DialogTitle>
            <DialogDescription className="font-mono">
              Send ETH or XRGE tokens to another wallet
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label className="font-mono text-sm mb-2">Asset Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={sendType === 'ETH' ? 'neon' : 'outline'}
                  size="sm"
                  onClick={() => setSendType('ETH')}
                  className="font-mono"
                >
                  ETH
                </Button>
                <Button
                  variant={sendType === 'XRGE' ? 'neon' : 'outline'}
                  size="sm"
                  onClick={() => setSendType('XRGE')}
                  className="font-mono"
                >
                  XRGE
                </Button>
                <Button
                  variant={sendType === 'KTA' ? 'neon' : 'outline'}
                  size="sm"
                  onClick={() => setSendType('KTA')}
                  className="font-mono"
                >
                  KTA
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="send-to" className="font-mono text-sm">Recipient Address</Label>
              <Input
                id="send-to"
                placeholder="0x..."
                value={sendForm.to}
                onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                className="font-mono mt-1"
              />
            </div>

            <div>
              <Label htmlFor="send-amount" className="font-mono text-sm">
                Amount ({sendType})
              </Label>
              <Input
                id="send-amount"
                type="number"
                step="0.0001"
                placeholder="0.0"
                value={sendForm.amount}
                onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                className="font-mono mt-1"
              />
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Available: {sendType === 'ETH' 
                  ? (balance ? parseFloat(balance.formatted).toFixed(4) : '0')
                  : sendType === 'XRGE'
                  ? formatXrgeBalance()
                  : formatKtaBalance()} {sendType}
              </p>
            </div>

            <Button
              variant="neon"
              onClick={handleSend}
              disabled={ethSending || tokenSending || ethTxLoading || tokenTxLoading || !sendForm.to || !sendForm.amount}
              className="w-full font-mono"
            >
              {(ethSending || tokenSending || ethTxLoading || tokenTxLoading) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  SENDING...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  SEND {sendType}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Wallet;
