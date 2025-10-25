import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { usePrivyWagmi } from '@privy-io/wagmi';
import { parseEther, formatEther, Address } from 'viem';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, User, Wallet, ArrowRight } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getIPFSGatewayUrl } from '@/lib/ipfs';

const ERC20_ABI = [
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

interface SendTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  maxBalance: string;
  onSuccess?: () => void;
}

interface UserProfile {
  wallet_address: string;
  display_name?: string;
  artist_name?: string;
  avatar_cid?: string;
}

export const SendTokenDialog = ({
  open,
  onOpenChange,
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  maxBalance,
  onSuccess,
}: SendTokenDialogProps) => {
  // Sync Privy's embedded wallet with wagmi
  const { wallet: privyWallet } = usePrivyWagmi();
  const { address: accountAddress, chain } = useAccount();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Search for users by username or wallet
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      // If it looks like a wallet address, skip search
      if (searchQuery.startsWith('0x') && searchQuery.length > 10) {
        setRecipientAddress(searchQuery);
        setSelectedUser(null);
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      try {
        // Search by artist name or display name
        const { data, error } = await supabase
          .from('profiles')
          .select('wallet_address, display_name, artist_name, avatar_cid')
          .or(`artist_name.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;

        setSearchResults(data || []);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setRecipientAddress(user.wallet_address);
    setSearchQuery(user.artist_name || user.display_name || '');
    setSearchResults([]);
  };

  const handleSend = async () => {
    if (!recipientAddress || !amount) {
      toast({
        title: "Missing information",
        description: "Please select a recipient and enter an amount",
        variant: "destructive",
      });
      return;
    }

    if (!accountAddress || !chain) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet",
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // Convert maxBalance from wei to token units for comparison
    const maxBalanceInTokens = parseFloat(maxBalance) / Math.pow(10, tokenDecimals);
    
    if (amountNum > maxBalanceInTokens) {
      toast({
        title: "Insufficient balance",
        description: `You only have ${maxBalanceInTokens.toFixed(4)} ${tokenSymbol}`,
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔄 Initiating token transfer:', {
        tokenAddress,
        tokenSymbol,
        recipient: recipientAddress,
        amount: amountNum,
        accountAddress,
        privyWallet: privyWallet?.address,
      });

      const amountInWei = BigInt(Math.floor(amountNum * Math.pow(10, tokenDecimals)));

      await writeContract({
        account: accountAddress,
        chain: chain,
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipientAddress as Address, amountInWei],
      });
    } catch (error) {
      console.error('❌ Send error:', error);
      toast({
        title: "Transaction failed",
        description: error instanceof Error ? error.message : "Failed to send",
        variant: "destructive",
      });
    }
  };

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      console.error('❌ Write contract error:', writeError);
      toast({
        title: "Transaction failed",
        description: writeError.message || "Failed to send tokens",
        variant: "destructive",
      });
    }
  }, [writeError]);

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      console.log('✅ Transaction successful!');
      toast({
        title: "Tokens sent successfully! 🎉",
        description: `Sent ${amount} ${tokenSymbol} to ${
          selectedUser?.artist_name || selectedUser?.display_name || 
          `${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`
        }`,
      });
      setAmount('');
      setSearchQuery('');
      setRecipientAddress('');
      setSelectedUser(null);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    }
  }, [isSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="console-bg tech-border">
        <DialogHeader>
          <DialogTitle className="font-mono">Send {tokenSymbol}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient Search/Input */}
          <div className="space-y-2">
            <Label className="font-mono">Recipient</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search username or paste wallet address..."
                className="pl-10 font-mono"
                disabled={isPending || isConfirming}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="console-bg tech-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.wallet_address}
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-neon-green/10 transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10">
                      {user.avatar_cid ? (
                        <AvatarImage src={getIPFSGatewayUrl(user.avatar_cid)} />
                      ) : null}
                      <AvatarFallback>
                        {(user.artist_name || user.display_name || 'U')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold truncate">
                        {user.artist_name || user.display_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {user.wallet_address.slice(0, 10)}...{user.wallet_address.slice(-8)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-neon-green" />
                  </button>
                ))}
              </div>
            )}

            {/* Selected User */}
            {selectedUser && (
              <div className="flex items-center gap-3 p-3 console-bg tech-border rounded-lg border-neon-green/50">
                <Avatar className="h-10 w-10">
                  {selectedUser.avatar_cid ? (
                    <AvatarImage src={getIPFSGatewayUrl(selectedUser.avatar_cid)} />
                  ) : null}
                  <AvatarFallback>
                    {(selectedUser.artist_name || selectedUser.display_name || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-semibold text-neon-green truncate">
                    {selectedUser.artist_name || selectedUser.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {selectedUser.wallet_address.slice(0, 10)}...{selectedUser.wallet_address.slice(-8)}
                  </p>
                </div>
              </div>
            )}

            {/* Direct Wallet Address (if entered) */}
            {recipientAddress && !selectedUser && recipientAddress.startsWith('0x') && (
              <div className="flex items-center gap-2 p-3 console-bg tech-border rounded-lg">
                <Wallet className="h-5 w-5 text-neon-green" />
                <p className="text-xs font-mono text-muted-foreground">
                  {recipientAddress.slice(0, 10)}...{recipientAddress.slice(-8)}
                </p>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label className="font-mono">Amount</Label>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="pr-20 font-mono"
                disabled={isPending || isConfirming}
                step="0.0001"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground">{tokenSymbol}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAmount((parseFloat(maxBalance) / Math.pow(10, tokenDecimals)).toString())}
                  className="h-6 px-2 text-xs font-mono"
                  disabled={isPending || isConfirming}
                >
                  MAX
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Available: {(parseFloat(maxBalance) / Math.pow(10, tokenDecimals)).toFixed(4)} {tokenSymbol}
            </p>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!recipientAddress || !amount || isPending || isConfirming}
            variant="neon"
            className="w-full font-mono"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isPending ? 'Sending...' : 'Confirming...'}
              </>
            ) : (
              <>Send {tokenSymbol}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

