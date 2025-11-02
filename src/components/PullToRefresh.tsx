import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  enabled?: boolean;
}

export const PullToRefresh = ({ 
  onRefresh, 
  threshold = 80,
  enabled = true 
}: PullToRefreshProps) => {
  const { isPulling, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh,
    threshold,
    enabled,
  });

  // Don't render if not pulling or refreshing
  if (!isPulling && !isRefreshing) return null;

  const opacity = Math.min(progress * 2, 1); // Fade in as user pulls
  const rotation = isRefreshing ? 'animate-spin' : '';
  const scale = Math.min(0.5 + (progress * 0.5), 1); // Scale from 0.5 to 1

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.min(pullDistance * 0.5, 60)}px)`,
        transition: isPulling && !isRefreshing ? 'none' : 'transform 0.3s ease-out',
        opacity,
      }}
    >
      <div className="mt-2 px-4 py-2 rounded-full bg-black/90 backdrop-blur-xl border border-neon-green/30 shadow-[0_0_20px_rgba(0,255,159,0.3)]">
        <div className="flex items-center gap-2">
          <RefreshCw 
            className={`w-5 h-5 text-neon-green ${rotation}`}
            style={{
              transform: `scale(${scale}) rotate(${progress * 180}deg)`,
              transition: isRefreshing ? 'transform 0.3s ease' : 'none',
            }}
          />
          <span className="text-xs font-mono text-neon-green uppercase tracking-wider">
            {isRefreshing 
              ? 'Refreshing...' 
              : progress >= 1 
                ? 'Release to refresh' 
                : 'Pull to refresh'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

