import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from '@privy-io/wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'wagmi/chains';
import { useAccount, useSwitchChain } from 'wagmi';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { config, privyAppId } from '@/config/wallet';
import { useChainChecker } from '@/hooks/useChainChecker';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useAutoCreateProfile } from '@/hooks/useAutoCreateProfile';

// Component to ENFORCE Base network - blocks all other networks
function StrictChainEnforcer({ children }: { children: React.ReactNode }) {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  
  // Auto-switch to Base immediately if on wrong network
  useEffect(() => {
    if (isConnected && chainId && chainId !== base.id && switchChain) {
      console.log('🚫 WRONG NETWORK DETECTED:', chainId, '- Force switching to Base...');
      switchChain({ chainId: base.id });
    }
  }, [isConnected, chainId, switchChain]);
  
  // If not connected, allow access
  if (!isConnected) {
    return <>{children}</>;
  }
  
  // If on wrong network, BLOCK the app with modal
  if (chainId !== base.id) {
    const networkName = chainId === 1 ? 'Ethereum Mainnet' : 
                       chainId === 137 ? 'Polygon' :
                       chainId === 56 ? 'BSC' :
                       chainId === 11155111 ? 'Sepolia Testnet' :
                       `Chain ID ${chainId}`;
    
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-black">
        <div className="max-w-md w-full console-bg tech-border rounded-lg p-8 space-y-6">
          {isPending ? (
            <>
              <Loader2 className="h-16 w-16 text-neon-green animate-spin mx-auto" />
              <h2 className="text-2xl font-mono font-bold text-center">Switching to Base...</h2>
              <p className="text-sm text-muted-foreground text-center">
                Please approve the network switch in your wallet
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto animate-pulse" />
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-mono font-bold text-red-500">Base Network Only</h2>
                <p className="text-sm text-muted-foreground">
                  This app ONLY works on <span className="text-neon-green font-bold">Base Network</span>
                </p>
                <p className="text-xs text-yellow-500">
                  Currently connected to: <span className="font-bold">{networkName}</span>
                </p>
              </div>
              
              <div className="space-y-3">
                <Button
                  onClick={() => switchChain({ chainId: base.id })}
                  variant="neon"
                  className="w-full font-mono"
                  size="lg"
                >
                  SWITCH TO BASE NOW
                </Button>
                
                <div className="text-center text-xs text-muted-foreground">
                  <p>Base Chain ID: {base.id}</p>
                  <p className="mt-2">ETH Mainnet is NOT supported</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

// Component to monitor and enforce Base network
function ChainChecker({ children }: { children: React.ReactNode }) {
  const { isOnCorrectChain, isPhantom } = useChainChecker();
  
  // Extra logging for Phantom users
  
  return <>{children}</>;
}

// Component to manage session persistence
function SessionManager({ children }: { children: React.ReactNode }) {
  const { isSessionChecked, isAuthenticating } = useSessionManager();
  
  // Auto-create profile for new users who connect with Privy
  useAutoCreateProfile();
  
  // Show a subtle loading state while checking session (optional)
  if (isAuthenticating) {
    console.log('🔄 Checking for existing session...');
  }
  
  return <>{children}</>;
}

// Setup queryClient with aggressive caching for Spotify-level performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes - data stays fresh longer
      gcTime: 1000 * 60 * 30, // 30 minutes - keep in memory longer (renamed from cacheTime in TanStack Query v5)
      refetchOnWindowFocus: false, // Don't refetch when user returns to tab
      refetchOnMount: false, // Don't refetch on component mount if data exists
      refetchOnReconnect: false, // Don't refetch on network reconnect
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1, // Retry mutations once
    },
  },
});

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'wallet'],
        defaultChain: base,
        supportedChains: [base],
        embeddedWallets: {
          createOnLogin: 'all-users',
          noPromptOnSignature: true, // Don't show approval for signatures
        },
        externalWallets: {
          requireUserToSwitchChain: true, // Force users to switch to Base
        },
        appearance: {
          theme: 'dark',
          accentColor: '#00FF00',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <SessionManager>
            <StrictChainEnforcer>
              <ChainChecker>
                {children}
              </ChainChecker>
            </StrictChainEnforcer>
          </SessionManager>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}