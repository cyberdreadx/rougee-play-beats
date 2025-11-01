import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Mail, Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "@/components/ui/use-toast";
import { logAuthEvent, AuthEventType } from "@/lib/authLogger";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: () => void;
}

const LoginModal = ({ open, onOpenChange }: LoginModalProps) => {
  const { login } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'wallet' | null>(null);

  const handleEmailLogin = async () => {
    setIsLoading(true);
    setLoginMethod('email');
    try {
      await login({
        loginMethods: ['email'],
      });
      logAuthEvent(AuthEventType.EMAIL_LOGIN_SUCCESS);
      onOpenChange(false);
      toast({
        title: "✅ Login Successful",
        description: "Welcome to Rougee!",
      });
    } catch (error) {
      console.error('Email login failed:', error);
      logAuthEvent(AuthEventType.EMAIL_LOGIN_FAILED, { 
        error,
        metadata: { method: 'email' }
      });
      toast({
        title: "❌ Login Failed",
        description: "Failed to login with email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setLoginMethod(null);
    }
  };

  const handleWalletConnect = async () => {
    setIsLoading(true);
    setLoginMethod('wallet');
    try {
      await login({
        loginMethods: ['wallet'],
      });
      logAuthEvent(AuthEventType.WALLET_CONNECTED);
      onOpenChange(false);
      toast({
        title: "✅ Wallet Connected",
        description: "Your wallet is now connected!",
      });
    } catch (error) {
      console.error('Wallet connection failed:', error);
      logAuthEvent(AuthEventType.WALLET_CONNECTION_FAILED, { 
        error,
        metadata: { method: 'wallet' }
      });
      toast({
        title: "❌ Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setLoginMethod(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl">LOGIN</DialogTitle>
          <DialogDescription className="font-mono">
            Connect with email or your wallet
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-4">
          <Button
            variant="neon"
            size="lg"
            onClick={handleEmailLogin}
            disabled={isLoading}
            className="w-full font-mono flex items-center justify-center gap-2"
          >
            {isLoading && loginMethod === 'email' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                LOGGING IN...
              </>
            ) : (
              <>
                <Mail className="h-5 w-5" />
                LOGIN WITH EMAIL
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            onClick={handleWalletConnect}
            disabled={isLoading}
            className="w-full font-mono flex items-center justify-center gap-2"
          >
            {isLoading && loginMethod === 'wallet' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                CONNECTING...
              </>
            ) : (
              <>
                <Wallet className="h-5 w-5" />
                CONNECT WALLET
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
