import React, { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { usePrivy } from "@privy-io/react-auth";
import { useFundWallet } from "@privy-io/react-auth";
import { useIPLogger } from "@/hooks/useIPLogger";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSongPrice } from "@/hooks/useSongBondingCurve";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet as WalletIcon, Copy, Check, CreditCard, ArrowDownToLine, RefreshCw, Send, Music2, ArrowLeftRight, Plus, Network, Trash2, QrCode, Settings, Download } from "lucide-react";
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
import { SendTokenDialog } from "@/components/SendTokenDialog";
import { useDualWallet } from "@/contexts/DualWalletContext";
import { KeetaWalletDialog } from "@/components/KeetaWalletDialog";
import { KeetaQRCode } from "@/components/KeetaQRCode";
import keetaLogo from "@/assets/tokens/kta.png";
import { Play, Pause } from "lucide-react";

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
    audio_cid?: string;
  };
  userAddress: string;
  xrgeUsdPrice: number;
  onClick: () => void;
  onBalanceLoaded?: (songId: string, hasBalance: boolean) => void;
  onSendClick?: (song: any, balance: string) => void;
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
}

  const SongTokenItem = ({ song, userAddress, xrgeUsdPrice, onClick, onBalanceLoaded, onSendClick, playSong, currentSong, isPlaying }: SongTokenItemProps) => {
  const navigate = useNavigate();
  
  // Check if this song is currently playing
  const isCurrentlyPlaying = currentSong?.id === song.id && isPlaying;
  
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
  
  const handleSendClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to song page
    if (onSendClick) {
      // Pass the raw wei balance (not converted to tokens)
      const rawBalance = balanceData ? balanceData.toString() : '0';
      onSendClick(song, rawBalance);
    }
  };
  
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to song page
    if (playSong) {
      playSong(song);
    }
  };
  
  return (
    <Card
      className="group relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] hover:bg-white/8 hover:border-neon-green/30 active:bg-white/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Song Image - Larger and more prominent */}
        <div className="relative flex-shrink-0">
          {song.cover_cid ? (
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden ring-2 ring-border group-hover:ring-neon-green/50 transition-all duration-300">
              <img
                src={getIPFSGatewayUrl(song.cover_cid)}
                alt={song.title}
                className="w-full h-full object-cover"
              />
              {/* Play overlay button */}
              {playSong && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePlayClick}
                    className="h-12 w-12 rounded-full bg-neon-green/20 hover:bg-neon-green/30 border-2 border-neon-green/50 backdrop-blur-sm"
                  >
                    {isCurrentlyPlaying ? (
                      <Pause className="h-6 w-6 text-neon-green fill-neon-green" />
                    ) : (
                      <Play className="h-6 w-6 text-neon-green fill-neon-green" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center ring-2 ring-border group-hover:ring-neon-green/50 transition-all duration-300">
              <span className="text-2xl font-mono font-bold text-neon-green">
                {song.ticker?.[0] || '?'}
              </span>
              {/* Play overlay button for fallback */}
              {playSong && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-xl">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePlayClick}
                    className="h-12 w-12 rounded-full bg-neon-green/20 hover:bg-neon-green/30 border-2 border-neon-green/50 backdrop-blur-sm"
                  >
                    {isCurrentlyPlaying ? (
                      <Pause className="h-6 w-6 text-neon-green fill-neon-green" />
                    ) : (
                      <Play className="h-6 w-6 text-neon-green fill-neon-green" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Song Info and Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
          {/* Song Title and Ticker */}
          <div className="min-w-0">
            <div className="flex items-start gap-2 mb-1">
              <h3 className="text-base sm:text-lg font-bold font-mono group-hover:text-neon-green transition-colors break-words flex-1">
                {song.title}
              </h3>
              <AiBadge aiUsage={song.ai_usage} size="sm" className="flex-shrink-0 mt-0.5" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono">
              {song.ticker || 'Unknown'}
            </p>
            {song.artist && (
              <p className="text-xs text-muted-foreground/70 font-mono mt-1">
                by {song.artist}
              </p>
            )}
          </div>
          
          {/* Balance, Value, and Actions */}
          <div className="flex items-end justify-between gap-3">
            {/* Balance and Price Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-lg sm:text-xl font-bold font-mono text-neon-green">
                  {formatCompactNumber(balance)}
                </p>
                <span className="text-xs text-muted-foreground font-mono">tokens</span>
              </div>
              {valueUSD > 0 ? (
                <>
                  <p className="text-sm font-semibold font-mono text-foreground">
                    ${valueUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}
                  </p>
                  {priceUSD > 0 && (
                    <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">
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
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {playSong && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayClick}
                  className={`h-9 w-9 rounded-full transition-all ${
                    isCurrentlyPlaying
                      ? 'bg-neon-green/20 text-neon-green border border-neon-green/50'
                      : 'hover:bg-neon-green/10 hover:text-neon-green'
                  }`}
                >
                  {isCurrentlyPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendClick}
                className="font-mono text-xs hover:bg-neon-green/10 hover:text-neon-green hover:border-neon-green/50"
              >
                <Send className="h-3 w-3 mr-1" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
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

interface WalletProps {
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
}

// Skeleton for Wallet song card
const WalletSongCardSkeleton = memo(() => (
  <Card className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
    <div className="flex flex-col md:flex-row">
      <div className="w-full md:w-32 h-32 md:h-auto bg-white/10 animate-pulse" />
      <div className="flex-1 p-4 space-y-3">
        <div className="h-5 bg-white/10 rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-white/10 rounded w-1/2 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-6 bg-white/10 rounded w-16 animate-pulse" />
          <div className="h-6 bg-white/10 rounded w-20 animate-pulse" />
        </div>
      </div>
    </div>
  </Card>
));
WalletSongCardSkeleton.displayName = 'WalletSongCardSkeleton';

const Wallet = ({ playSong, currentSong, isPlaying }: WalletProps = {}) => {
  const navigate = useNavigate();
  const { fullAddress, isConnected, isPrivyReady } = useWallet();
  const { address: accountAddress, chain } = useAccount();
  const { exportWallet, user } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { logIP } = useIPLogger('wallet_visit');
  const { prices, calculateUsdValue } = useTokenPrices();

  // Check if user has an embedded wallet (not external wallet)
  const hasEmbeddedWallet = user?.linkedAccounts?.some(
    (account) =>
      account.type === 'wallet' &&
      account.walletClientType === 'privy' &&
      account.chainType === 'ethereum'
  );

  // Handle wallet export with proper error handling
  const handleExportWallet = async () => {
    try {
      if (!hasEmbeddedWallet) {
        toast({
          title: "Export Not Available",
          description: "Private key export is only available for embedded wallets. External wallets (like Phantom) manage their own private keys.",
          variant: "destructive",
        });
        return;
      }
      await exportWallet();
    } catch (error) {
      console.error('Export wallet error:', error);
      toast({
        title: "Export Failed",
        description: "Unable to export wallet. Please ensure you have an embedded wallet.",
        variant: "destructive",
      });
    }
  };

  // Format KEETA balance with correct decimal places (18 decimals)
  const formatKeetaBalance = (balance: string) => {
    if (!balance || balance === '0') return '0.000000000000000000';
    const balanceNum = parseFloat(balance);
    
    // If the balance is already in human-readable format (less than 1), return as is
    if (balanceNum < 1) {
      return balanceNum.toFixed(18);
    }
    
    // If the balance is >= 1, it's likely in base units, so divide by 10^18
    // This handles both small base units (500000 -> 0.000000000000000500) and large ones
    const divisor = Math.pow(10, 18);
    const divided = balanceNum / divisor;
    return divided.toFixed(7); // Show 7 decimal places for readability
  };

  // Format token balance with proper decimal handling
  const formatTokenBalance = (balance: string, decimals: number = 18) => {
    if (!balance || balance === '0') return '0.0000';
    const balanceNum = parseFloat(balance);
    
    // If the balance is already in human-readable format (less than 1), return as is
    if (balanceNum < 1) {
      return balanceNum.toFixed(4);
    }
    
    // If the balance is very large (likely in base units), divide by 10^decimals
    if (balanceNum > 1000000) {
      const formatted = (balanceNum / Math.pow(10, decimals)).toFixed(4);
      return formatted;
    }
    
    // For medium numbers, assume they're already in the correct format
    return balanceNum.toFixed(4);
  };
  
  // Dual wallet context
  const { 
    baseWallet, 
    keetaWallet, 
    activeNetwork, 
    setActiveNetwork, 
    hasAnyWallet, 
    currentWallet 
  } = useDualWallet();
  
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
  
  // Song token send dialog state
  const [sendSongDialog, setSendSongDialog] = useState(false);
  const [selectedSongForSend, setSelectedSongForSend] = useState<any>(null);
  const [selectedSongBalance, setSelectedSongBalance] = useState('0');
  
  // Keeta wallet dialog state
  const [showKeetaDialog, setShowKeetaDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showKeetaQRDialog, setShowKeetaQRDialog] = useState(false);
  const [showKeetaSettingsDialog, setShowKeetaSettingsDialog] = useState(false);
  const [showBaseSettingsDialog, setShowBaseSettingsDialog] = useState(false);
  const [deletingWallet, setDeletingWallet] = useState(false);

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
    // Only redirect if Privy is ready and user is not connected to any wallet
    if (isPrivyReady && !hasAnyWallet) {
      navigate("/");
    }
  }, [hasAnyWallet, isPrivyReady, navigate]);

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
        .select('id, title, artist, ticker, token_address, cover_cid, audio_cid, ai_usage')
        .not('token_address', 'is', null);
        
      if (error) {
        console.error('❌ Error fetching songs:', error);
        throw error;
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

  const handleSongSendClick = useCallback((song: any, balance: string) => {
    setSelectedSongForSend(song);
    setSelectedSongBalance(balance);
    setSendSongDialog(true);
  }, []);

  // Calculate owned songs count from map
  const ownedSongsCount = Array.from(ownedSongsMap.values()).filter(Boolean).length;


  const copyAddress = async () => {
    const addressToCopy = currentWallet.fullAddress;
    if (addressToCopy) {
      await navigator.clipboard.writeText(addressToCopy);
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

  const handleDeleteKeetaWallet = async () => {
    setDeletingWallet(true);
    try {
      await keetaWallet.deleteWallet();
      toast({
        title: "Keeta Wallet Deleted",
        description: "Your Keeta wallet has been permanently deleted",
      });
      setShowDeleteDialog(false);
      // Switch back to Base network if we were on Keeta
      if (activeNetwork === 'keeta') {
        setActiveNetwork('base');
      }
    } catch (error) {
      console.error('Failed to delete Keeta wallet:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete Keeta wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingWallet(false);
    }
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
      if (activeNetwork === 'keeta') {
        // Handle Keeta transactions - convert to base units (18 decimals)
        const amountInBaseUnits = (parseFloat(sendForm.amount) * Math.pow(10, 18)).toString();
        await keetaWallet.sendTokens(sendForm.to, amountInBaseUnits);
        toast({
          title: "Transaction sent!",
          description: "Your KTA tokens have been sent successfully.",
        });
        setShowSendDialog(false);
        setSendForm({ to: '', amount: '' });
      } else {
        // Handle Base network transactions
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

  // Reset send type when switching networks
  useEffect(() => {
    if (activeNetwork === 'keeta') {
      // For Keeta, set send type to KTA
      setSendType('KTA');
      setSendForm({ to: '', amount: '' });
    } else {
      // For Base network, reset to ETH if not already set
      if (sendType !== 'ETH' && sendType !== 'XRGE' && sendType !== 'KTA') {
        setSendType('ETH');
      }
      setSendForm({ to: '', amount: '' });
    }
  }, [activeNetwork]);

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
          <div className="flex gap-2">
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
        </div>

        {/* Network Selector */}
        <Card className="p-3 mb-3 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-neon-green" />
              <span className="text-xs text-muted-foreground font-mono">Active Network</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeNetwork === 'base' ? 'neon' : 'outline'}
                size="sm"
                onClick={() => {
                  setActiveNetwork('base');
                }}
                className="font-mono text-xs"
              >
                Base
                {baseWallet.isConnected && (
                  <Badge variant="outline" className="ml-1 text-[10px] border-green-500 text-green-500">
                    ✓
                  </Badge>
                )}
              </Button>
              <Button
                variant={activeNetwork === 'keeta' ? 'neon' : 'outline'}
                size="sm"
                onClick={() => {
                  setActiveNetwork('keeta');
                }}
                className="font-mono text-xs"
              >
                <img src={keetaLogo} alt="Keeta" className="h-3 w-3 mr-1" />
                Keeta
                {keetaWallet.isConnected && (
                  <Badge variant="outline" className="ml-1 text-[10px] border-purple-500 text-purple-500">
                    ✓
                  </Badge>
                )}
              </Button>
              {!keetaWallet.isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowKeetaDialog(true)}
                  className="font-mono text-xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Keeta
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Connected Wallet Card */}
        <Card className="p-3 mb-3 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-mono mb-1">
                {activeNetwork === 'base' ? 'Base Wallet' : 'Keeta Wallet'}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono font-bold text-neon-green">
                  {formatAddress(currentWallet.fullAddress || "")}
                </p>
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
                {activeNetwork === 'keeta' && keetaWallet.isConnected && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowKeetaQRDialog(true)}
                      className="h-6 w-6 p-0"
                      title="Show QR Code"
                    >
                      <QrCode className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowKeetaSettingsDialog(true)}
                      className="h-6 w-6 p-0"
                      title="Keeta Wallet Settings"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </>
                )}
                {activeNetwork === 'base' && currentWallet.isConnected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBaseSettingsDialog(true)}
                    className="h-6 w-6 p-0"
                    title="Base Wallet Settings"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  activeNetwork === 'base' 
                    ? 'border-green-500/50 text-green-400' 
                    : 'border-purple-500/50 text-purple-400'
                }`}
              >
                {activeNetwork === 'base' ? 'Base' : 'Keeta'}
              </Badge>
              <Badge variant="outline" className="border-neon-green/50 text-neon-green text-xs">
                Connected
              </Badge>
            </div>
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
            <Card className="p-3 mb-3 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] rounded-2xl">
              <p className="text-xs text-muted-foreground font-mono mb-2">Quick Actions</p>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="neon"
                  size="sm"
                  onClick={handleFundWallet}
                  className="font-mono text-xs h-auto py-3 flex-col gap-1"
                  disabled={activeNetwork === 'keeta'}
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="text-[10px]">BUY</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/swap')}
                  className="font-mono text-xs h-auto py-3 flex-col gap-1 border-neon-green/50"
                  disabled={activeNetwork === 'keeta'}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span className="text-[10px]">SWAP</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (activeNetwork === 'keeta') {
                      setShowKeetaQRDialog(true);
                    } else {
                      handleFundWallet();
                    }
                  }}
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
              {activeNetwork === 'keeta' ? (
                <>
                  {/* Keeta Native Token */}
                  <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(168,85,247,0.1)] rounded-2xl hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <img src={keetaLogo} alt="Keeta" className="h-6 w-6" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mb-1">KTA</p>
                    {keetaWallet.isConnecting ? (
                      <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                    ) : (
                      <>
                        <div className="mb-1">
                          <span className="text-2xl font-bold font-mono text-purple-400 block">
                            {formatKeetaBalance(keetaWallet.balance)}
                          </span>
                          <span className="text-xs text-muted-foreground/70 font-mono">KTA</span>
                        </div>
                        <p className="text-sm font-mono text-muted-foreground">
                          Native Keeta Token
                        </p>
                      </>
                    )}
                  </Card>

                  {/* Keeta Tokens */}
                  {keetaWallet.tokens.map((token, index) => (
                    <Card key={index} className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(168,85,247,0.1)] rounded-2xl hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300">
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                          {token.symbol === 'KTA' ? (
                            <img src={keetaLogo} alt="KTA" className="w-6 h-6" />
                          ) : (
                            <span className="text-lg font-bold text-purple-400">
                              {token.symbol?.[0] || 'T'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mb-1">{token.symbol}</p>
                      <div className="mb-1">
                        <span className="text-2xl font-bold font-mono text-purple-400 block">
                          {formatTokenBalance(token.balance, token.decimals)}
                        </span>
                        <span className="text-xs text-muted-foreground/70 font-mono">{token.symbol}</span>
                      </div>
                      <p className="text-sm font-mono text-muted-foreground">
                        {token.name}
                      </p>
                    </Card>
                  ))}
                </>
              ) : (
                <>
          {/* XRGE Token */}
          <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] rounded-2xl hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300">
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
          <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(168,85,247,0.1)] rounded-2xl hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300">
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
          <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(59,130,246,0.1)] rounded-2xl hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300">
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
          <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(34,197,94,0.1)] rounded-2xl hover:bg-white/8 active:bg-white/10 active:scale-[0.99] transition-all duration-300">
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
                </>
              )}
            </div>
          </>
        )}

        {/* My Music Tab Content */}
        {activeTab === 'music' && (
          <>
            {/* Purchased Songs */}
        <Card className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_16px_0_rgba(0,255,159,0.1)] rounded-2xl">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <WalletSongCardSkeleton key={`skeleton-wallet-${i}`} />
              ))}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fullAddress && allSongs.map((song) => (
                  <SongTokenItem
                    key={song.id}
                    song={song}
                    userAddress={fullAddress}
                    xrgeUsdPrice={prices.xrge}
                    onClick={() => navigate(`/song/${song.id}`)}
                    onBalanceLoaded={handleBalanceLoaded}
                    onSendClick={handleSongSendClick}
                    playSong={playSong}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
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
              {activeNetwork === 'base' 
                ? 'Send ETH or XRGE tokens to another wallet'
                : 'Send KTA tokens to another wallet'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label className="font-mono text-sm mb-2">Asset Type</Label>
              <div className={`grid gap-2 ${activeNetwork === 'base' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                {activeNetwork === 'base' ? (
                  <>
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
                  </>
                ) : (
                  <Button
                    variant="neon"
                    size="sm"
                    className="font-mono"
                    disabled
                  >
                    <img src={keetaLogo} alt="Keeta" className="h-4 w-4 mr-2" />
                    KTA
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="send-to" className="font-mono text-sm">Recipient Address</Label>
              <Input
                id="send-to"
                placeholder={activeNetwork === 'keeta' ? 'keeta_...' : '0x...'}
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
                Available: {activeNetwork === 'keeta' 
                  ? `${formatKeetaBalance(keetaWallet.balance || '0')} KTA`
                  : sendType === 'ETH' 
                  ? `${balance ? parseFloat(balance.formatted).toFixed(4) : '0'} ETH`
                  : sendType === 'XRGE'
                  ? `${formatXrgeBalance()} XRGE`
                  : `${formatKtaBalance()} KTA`}
              </p>
              
              {/* Percentage Selector Buttons */}
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
                      let availableBalance = 0;
                      if (activeNetwork === 'keeta') {
                        // Use Keeta balance - convert from base units to human-readable format
                        availableBalance = parseFloat(keetaWallet.balance || '0') / Math.pow(10, 18);
                      } else {
                        // Use Base network balances
                        availableBalance = sendType === 'ETH' 
                          ? (balance ? parseFloat(balance.formatted) : 0)
                          : sendType === 'XRGE'
                          ? parseFloat(formatXrgeBalance())
                          : parseFloat(formatKtaBalance());
                      }
                      const amount = (availableBalance * option.value).toFixed(4);
                      setSendForm({ ...sendForm, amount });
                    }}
                    className="font-mono text-[10px] py-1 h-7 border-neon-green/30 hover:bg-neon-green/10 hover:border-neon-green/50"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
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
                  {activeNetwork === 'keeta' ? 'SEND KTA' : `SEND ${sendType}`}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Song Token Dialog */}
      {selectedSongForSend && (
        <SendTokenDialog
          open={sendSongDialog}
          onOpenChange={setSendSongDialog}
          tokenAddress={selectedSongForSend.token_address as Address}
          tokenSymbol={selectedSongForSend.ticker || 'SONG'}
          tokenDecimals={18}
          maxBalance={selectedSongBalance}
          onSuccess={() => {
            // Refresh songs list after successful send
            fetchAllSongs();
          }}
        />
      )}

      {/* Keeta Wallet Dialog */}
      <KeetaWalletDialog
        open={showKeetaDialog}
        onOpenChange={setShowKeetaDialog}
        onSuccess={(address) => {
          console.log('Keeta wallet created/imported:', address);
          setShowKeetaDialog(false);
          // Don't automatically switch networks - let user choose
        }}
      />

      {/* Delete Keeta Wallet Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl text-red-500">DELETE KTA WALLET</DialogTitle>
            <DialogDescription className="font-mono">
              This will permanently delete your Keeta wallet and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-red-800">Warning: Permanent Deletion</p>
                  <ul className="text-red-700 mt-2 space-y-1 text-xs">
                    <li>• Your Keeta wallet will be permanently deleted</li>
                    <li>• All tokens and balances will be lost</li>
                    <li>• Your mnemonic phrase will be removed</li>
                    <li>• This action cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 font-mono"
                disabled={deletingWallet}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteKeetaWallet}
                disabled={deletingWallet}
                className="flex-1 font-mono"
              >
                {deletingWallet ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting Keeta...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Keeta Wallet
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keeta QR Code Dialog */}
      <KeetaQRCode
        open={showKeetaQRDialog}
        onOpenChange={setShowKeetaQRDialog}
        address={keetaWallet.address || ''}
      />

      {/* Keeta Settings Dialog */}
      <Dialog open={showKeetaSettingsDialog} onOpenChange={setShowKeetaSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl text-purple-400">KTA WALLET SETTINGS</DialogTitle>
            <DialogDescription className="font-mono">
              Manage your Keeta wallet settings and export private key
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-mono text-sm">Wallet Address</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={keetaWallet.address || ''}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(keetaWallet.address || '');
                    toast({
                      title: "Copied!",
                      description: "Address copied to clipboard",
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="font-mono text-sm">Private Key</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={keetaWallet.privateKey || ''}
                  readOnly
                  type="password"
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(keetaWallet.privateKey || '');
                    toast({
                      title: "Copied!",
                      description: "Private key copied to clipboard",
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                ⚠️ Never share your private key with anyone
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowKeetaSettingsDialog(false)}
                className="flex-1 font-mono"
              >
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowKeetaSettingsDialog(false);
                  setShowDeleteDialog(true);
                }}
                className="flex-1 font-mono text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Wallet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Base Settings Dialog */}
      <Dialog open={showBaseSettingsDialog} onOpenChange={setShowBaseSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl text-neon-green">BASE WALLET SETTINGS</DialogTitle>
            <DialogDescription className="font-mono">
              Manage your Base wallet settings and export private key
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-mono text-sm">Wallet Address</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={currentWallet.address || ''}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(currentWallet.address || '');
                    toast({
                      title: "Copied!",
                      description: "Address copied to clipboard",
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="font-mono text-sm">Export Private Key</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportWallet}
                  className="flex-1 font-mono text-xs"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Wallet
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {hasEmbeddedWallet 
                  ? "Export your embedded wallet private key to import into other wallets"
                  : "Private key export is only available for embedded wallets. External wallets manage their own private keys."
                }
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowBaseSettingsDialog(false)}
                className="flex-1 font-mono"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Wallet;
