import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { base } from 'wagmi/chains';

const NetworkInfo = () => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) return null;

  const networks = [
    { chain: base, name: 'Base' },
  ];

  const currentNetwork = networks.find(n => n.chain.id === chainId);

  return (
    <div className="px-6 py-2 console-bg border-b tech-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-mono text-muted-foreground">
            NETWORK:
          </span>
          <span className="text-sm font-mono text-neon-green">
            {currentNetwork?.name || 'Unknown Network'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {networks.map(({ chain, name }) => (
            <Button
              key={chain.id}
              variant={chainId === chain.id ? "neon" : "tech"}
              size="sm"
              onClick={() => switchChain({ chainId: chain.id })}
              className="text-xs"
            >
              {name}
            </Button>
          ))}
          <span className="text-xs font-mono text-muted-foreground/60">
            KTA coming soon
          </span>
        </div>
      </div>
    </div>
  );
};

export default NetworkInfo;