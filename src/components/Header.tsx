import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import WalletButton from "@/components/WalletButton";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { User, Shield, CheckCircle, HelpCircle } from "lucide-react";


const Header = () => {
  const navigate = useNavigate();
  const { isConnected, fullAddress, isPrivyReady } = useWallet();
  const { profile } = useCurrentUserProfile();
  const [isAdmin, setIsAdmin] = useState(false);

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
    <header className="w-full glass sticky top-0 z-40 border-b border-neon-green/10 pt-safe px-4 md:px-6">
      <div className="flex items-center justify-between h-14 md:h-16">
        {/* Brand */}
        <div 
          className="flex items-center gap-2 md:gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="flex items-center gap-2 min-h-[28px] md:min-h-[32px]">
            <img src="/favicon.png" alt="Rougee logo" className="h-5 w-5 md:h-6 md:w-6" />
            <span className="text-xs md:text-sm font-bold neon-text font-mono tracking-wider">ROUGEE.PLAY</span>
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
          {/* How It Works - always visible */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/how-it-works")}
            className="font-mono"
            title="How It Works"
          >
            <HelpCircle className="h-4 w-4 md:h-5 md:w-5 text-primary md:mr-2" />
            <span className="hidden md:inline">HOW IT WORKS</span>
          </Button>
          
          <ThemeSwitcher />
          {isConnected && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin")}
              className="font-mono hidden md:flex border-neon-green/50 text-neon-green hover:bg-neon-green/10"
            >
              <Shield className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">ADMIN</span>
            </Button>
          )}
          {isConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/profile/edit")}
              className="font-mono hidden md:flex"
            >
              <User className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">MY PROFILE</span>
            </Button>
          )}
          {/* Mobile quick profile icon */}
          {isConnected && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (profile) {
                  navigate(`/artist/${fullAddress}`);
                } else {
                  navigate("/profile/edit");
                }
              }}
              className="md:hidden h-9 w-9"
              title="Profile"
            >
              <User className="h-5 w-5" />
            </Button>
          )}
          <WalletButton />
        </div>
      </div>
    </header>
  );
};

export default Header;