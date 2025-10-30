import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from '@/components/ui/use-toast';
import { logAuthEvent, AuthEventType } from '@/lib/authLogger';

/**
 * Hook to manage Privy session persistence and restoration
 * Handles automatic session restoration on app load
 */
export const useSessionManager = () => {
  const { ready, authenticated, user } = usePrivy();
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      // Wait for Privy to be ready
      if (!ready) return;


      // Session check complete
      setIsSessionChecked(true);

      // If authenticated, session was restored
      if (authenticated && user) {
        // First try specific wallet types
        let walletAccount = user.linkedAccounts?.find((account: any) =>
          ['wallet', 'smart_wallet', 'embedded_wallet'].includes(account.type)
        ) as any;
        
        // Fallback: Try to find ANY account with an Ethereum address
        if (!walletAccount && user.linkedAccounts) {
          walletAccount = user.linkedAccounts.find((account: any) => 
            account.address && 
            typeof account.address === 'string' && 
            account.address.startsWith('0x') &&
            account.address.length === 42
          ) as any;
          
          if (walletAccount) {
          }
        }
        
        if (walletAccount?.address) {
          setSessionRestored(true);
          
          logAuthEvent(AuthEventType.SESSION_RESTORED, {
            userId: user.id,
            walletAddress: walletAccount.address,
          });
          
          // Show welcome back message (but only if not first visit)
          const isFirstVisit = !localStorage.getItem('rougee_visited');
          if (!isFirstVisit) {
            toast({
              title: "👋 Welcome back!",
              description: "Your session has been restored.",
            });
          }
          localStorage.setItem('rougee_visited', 'true');
        }
      } else {
        console.log('ℹ️ No existing session found');
      }
    };

    checkSession();
  }, [ready, authenticated, user]);

  // Monitor for session expiration
  useEffect(() => {
    if (isSessionChecked && !authenticated && sessionRestored) {
      console.warn('⚠️ Session expired');
      logAuthEvent(AuthEventType.SESSION_EXPIRED);
      toast({
        title: "⏰ Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
      setSessionRestored(false);
    }
  }, [authenticated, isSessionChecked, sessionRestored]);

  return {
    isSessionChecked,
    sessionRestored,
    isAuthenticating: ready && !isSessionChecked,
  };
};

