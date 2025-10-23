import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from '@privy-io/wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'wagmi/chains';

import { config, privyAppId } from '@/config/wallet';
import { useChainChecker } from '@/hooks/useChainChecker';
import { useSessionManager } from '@/hooks/useSessionManager';

// Component to monitor and enforce Base network
function ChainChecker({ children }: { children: React.ReactNode }) {
  const { isOnCorrectChain, isPhantom } = useChainChecker();
  
  // Extra logging for Phantom users
  if (isPhantom) {
    console.log('👻 Phantom wallet active, on correct chain:', isOnCorrectChain);
  }
  
  return <>{children}</>;
}

// Component to manage session persistence
function SessionManager({ children }: { children: React.ReactNode }) {
  const { isSessionChecked, isAuthenticating } = useSessionManager();
  
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
            <ChainChecker>
              {children}
            </ChainChecker>
          </SessionManager>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}