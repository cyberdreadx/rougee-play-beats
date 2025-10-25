import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface NetworkGuardProps {
  children: React.ReactNode;
  showWarning?: boolean;
  autoSwitch?: boolean; // New prop to enable automatic switching
}

export const NetworkGuard = ({ children, showWarning = true, autoSwitch = true }: NetworkGuardProps) => {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  // Automatically attempt to switch network on mount if wrong network
  useEffect(() => {
    if (autoSwitch && isConnected && chainId !== base.id && switchChain) {
      console.log('🔄 NetworkGuard: Auto-switching to Base...');
      switchChain({ chainId: base.id });
    }
  }, [autoSwitch, isConnected, chainId, switchChain]);

  if (!isConnected) return <>{children}</>;

  const isWrongNetwork = chainId !== base.id;

  if (isWrongNetwork && showWarning) {
    const networkName = chainId === 1 ? 'Ethereum Mainnet' : 
                       chainId === 137 ? 'Polygon' :
                       chainId === 56 ? 'BSC' :
                       `Chain ID ${chainId}`;

    return (
      <div className="flex flex-col items-center justify-center p-6 md:p-8 space-y-4 console-bg tech-border rounded-lg">
        {isPending ? (
          <>
            <Loader2 className="h-12 w-12 text-neon-green animate-spin" />
            <h3 className="text-lg md:text-xl font-mono font-bold text-center">Switching Networks...</h3>
            <p className="text-xs md:text-sm text-muted-foreground text-center max-w-md">
              Switching from <span className="text-yellow-500 font-semibold">{networkName}</span> to{' '}
              <span className="text-neon-green font-semibold">Base Network</span>
            </p>
          </>
        ) : (
          <>
            <AlertTriangle className="h-12 w-12 text-yellow-500 animate-pulse" />
            <h3 className="text-lg md:text-xl font-mono font-bold text-center">Wrong Network Detected</h3>
            <p className="text-xs md:text-sm text-muted-foreground text-center max-w-md">
              You're currently on <span className="text-yellow-500 font-semibold">{networkName}</span>.<br />
              This app only works on <span className="text-neon-green font-semibold">Base Network</span>.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button
                onClick={() => switchChain({ chainId: base.id })}
                disabled={isPending}
                variant="neon"
                className="font-mono w-full"
              >
                SWITCH TO BASE NETWORK
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Chain ID: {base.id}
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return <>{children}</>;
};

