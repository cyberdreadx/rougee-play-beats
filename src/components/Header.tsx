import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useLockCode } from "@/hooks/useLockCode";
import WalletButton from "@/components/WalletButton";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { User, Shield, CheckCircle, HelpCircle, Lock, ChevronDown, Network, Wallet as WalletIcon, LogOut, Link as LinkIcon } from "lucide-react";
import { UploadSlotsBadge } from "@/components/UploadSlotsBadge";
import { toast } from "@/hooks/use-toast";
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { usePrivy } from '@privy-io/react-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";


const Header = () => {
  const navigate = useNavigate();
  const { isConnected, fullAddress, isPrivyReady } = useWallet();
  const { profile, isArtist } = useCurrentUserProfile();
  const { hasLockCode, lock, triggerLockUpdate } = useLockCode();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Wagmi hooks for network switching
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { logout } = usePrivy();

  const networks = [
    { chain: base, name: 'Base' },
  ];

  const currentNetwork = networks.find(n => n.chain.id === chainId);

  const handleLock = () => {
    console.log('🔒 Header: handleLock called');
    lock();
    console.log('🔒 Header: lock() called');
    toast({
      title: "App Locked",
      description: "The app has been locked. Enter your lock code to continue.",
    });
    // Refresh the page to immediately show the lock screen
    window.location.reload();
  };

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isPrivyReady) return;
      
      if (isConnected && fullAddress) {
        const walletLower = fullAddress.toLowerCase();
        console.log('Checking admin status (RPC) for:', walletLower);
        
        const { data: isAdminResp, error } = await supabase
          .rpc('is_admin', { check_wallet: walletLower });
        
        console.log('Admin RPC result:', { isAdminResp, error, walletLower });
        setIsAdmin(Boolean(isAdminResp));
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [isConnected, fullAddress, isPrivyReady]);

  return (
    <header 
      className="w-full max-w-full glass z-30 border-b border-neon-green/10 pt-safe px-4 transition-all duration-300 overflow-x-hidden"
      style={{
        paddingLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'var(--sidebar-width, 16rem)' : '1rem',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        transform: 'translateZ(0)', // Force GPU acceleration for better stability
        WebkitTransform: 'translateZ(0)', // Safari support
      }}
    >
      <div className="flex items-center justify-between h-14 md:h-16">
        {/* Brand */}
        <div 
          className="flex items-center gap-2 md:gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="flex items-center gap-2 min-h-[28px] md:min-h-[32px]">
            <img src="/favicon.png" alt="Rougee logo" className="h-5 w-5 md:h-6 md:w-6" />
            <span className="text-xs md:text-sm font-bold neon-text font-mono tracking-wider">ROUGEE</span>
          </div>
          
          {/* User wallet info - hidden on mobile */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-muted-foreground font-mono ml-4">
            <span>USER:</span>
            <span className="text-foreground">
              {isConnected ? fullAddress : "Not Connected"}
            </span>
            {isConnected && profile?.verified && (
              <CheckCircle className="h-3 w-3 text-neon-green" />
            )}
          </div>
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Upload Slots Badge - Show for artists */}
          {isConnected && isArtist && (
            <UploadSlotsBadge className="hidden md:flex" />
          )}
          
          {/* Consolidated Menu Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="font-mono border-neon-green/30 hover:border-neon-green/50 bg-black/40 backdrop-blur-sm"
              >
                {isConnected ? (
                  <>
                    <Network className="h-4 w-4 md:mr-2 text-neon-green" />
                    <span className="hidden md:inline text-neon-green">{currentNetwork?.name || 'Menu'}</span>
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Menu</span>
                  </>
                )}
                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 console-bg backdrop-blur-xl border-white/20">
              <DropdownMenuLabel className="font-mono text-xs text-muted-foreground uppercase">
                {isConnected ? 'Network & Account' : 'Menu'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              
              {/* Network Selection - Only show if connected */}
              {isConnected && (
                <>
                  <div className="px-2 py-1">
                    <p className="text-xs font-mono text-muted-foreground mb-2 uppercase">Network:</p>
                    {networks.map(({ chain, name }) => (
                      <DropdownMenuItem
                        key={chain.id}
                        onClick={() => switchChain({ chainId: chain.id })}
                        className={`font-mono text-sm ${
                          chainId === chain.id 
                            ? 'bg-neon-green/10 text-neon-green' 
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <Network className="h-4 w-4 mr-2" />
                        {name}
                        {chainId === chain.id && <CheckCircle className="h-3 w-3 ml-auto text-neon-green" />}
                      </DropdownMenuItem>
                    ))}
                    <div className="mt-2 px-2 py-1">
                      <span className="text-xs font-mono text-muted-foreground/60">KTA</span>
                    </div>
                  </div>
                  
                  <DropdownMenuSeparator className="bg-white/10" />
                  
                  {/* Wallet Info */}
                  <div className="px-2 py-2">
                    <p className="text-xs font-mono text-muted-foreground mb-1 uppercase">Wallet Address:</p>
                    <p className="text-xs font-mono text-foreground break-all bg-black/40 p-2 rounded border border-white/10">
                      {fullAddress}
                    </p>
                  </div>
                  
                  <DropdownMenuSeparator className="bg-white/10" />
                </>
              )}
              
              {/* Navigation Items */}
              <DropdownMenuItem
                onClick={() => navigate("/how-it-works")}
                className="font-mono text-sm hover:bg-white/5"
              >
                <HelpCircle className="h-4 w-4 mr-2 text-primary" />
                How It Works
              </DropdownMenuItem>
              
              {isConnected && (
                <>
                  <DropdownMenuItem
                    onClick={() => navigate("/profile/edit")}
                    className="font-mono text-sm hover:bg-white/5"
                  >
                    <User className="h-4 w-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => navigate("/admin")}
                      className="font-mono text-sm hover:bg-white/5 text-neon-green"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Panel
                    </DropdownMenuItem>
                  )}
                  
                  {hasLockCode && (
                    <DropdownMenuItem
                      onClick={handleLock}
                      className="font-mono text-sm hover:bg-white/5 text-yellow-500"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Lock App
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator className="bg-white/10" />
                  
                  {/* Disconnect Button */}
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      toast({
                        title: "Disconnected",
                        description: "Your wallet has been disconnected.",
                      });
                    }}
                    className="font-mono text-sm text-red-500 hover:bg-red-500/10 hover:text-red-400 focus:bg-red-500/10 focus:text-red-400"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Disconnect Wallet
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <ThemeSwitcher />
          <WalletButton />
        </div>
      </div>
    </header>
  );
};

export default Header;