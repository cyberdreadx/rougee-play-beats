import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import LoginModal from "@/components/LoginModal";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { logAuthEvent, AuthEventType } from "@/lib/authLogger";

const WalletButton = () => {
  const { isConnected, connect, disconnect, isConnecting } = useWallet();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      // Clear all lock code sessionStorage entries before logout
      // This ensures clean logout without lingering lock code state
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('lock_code_verified_')) {
          sessionStorage.removeItem(key);
          console.log('🔓 Logout: Cleared lock code sessionStorage:', key);
        }
      });
      
      // Also clear localStorage lock code verification if any
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (key.startsWith('lock_code_verified_')) {
          localStorage.removeItem(key);
          console.log('🔓 Logout: Cleared lock code localStorage:', key);
        }
      });
      
      await disconnect();
      logAuthEvent(AuthEventType.LOGOUT_SUCCESS);
      toast({
        title: "✅ Disconnected",
        description: "You have been logged out successfully.",
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
      logAuthEvent(AuthEventType.LOGOUT_FAILED, { error });
      toast({
        title: "❌ Disconnect Failed",
        description: "Failed to disconnect. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <>
      <Button 
        variant={isConnected ? "disconnect" : "neon"} 
        size="sm"
        onClick={isConnected ? handleDisconnect : handleLogin}
        disabled={isConnecting || isDisconnecting}
        className="font-mono"
      >
        {isConnecting || isDisconnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {isDisconnecting ? "DISCONNECTING..." : "CONNECTING..."}
          </>
        ) : (
          isConnected ? "[DISCONNECT]" : "[LOGIN]"
        )}
      </Button>

      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        onLogin={handleConnect}
      />
    </>
  );
};

export default WalletButton;