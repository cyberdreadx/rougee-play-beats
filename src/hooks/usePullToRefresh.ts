import { useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Distance to trigger refresh (pixels)
  enabled?: boolean;
}

export const usePullToRefresh = ({ 
  onRefresh, 
  threshold = 80,
  enabled = true 
}: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isAtTop = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    let rafId: number;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start if we're at the top of the page
      if (window.scrollY === 0) {
        isAtTop.current = true;
        startY.current = e.touches[0].clientY;
      } else {
        isAtTop.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      // Only pull down, not up
      if (distance > 0 && window.scrollY === 0) {
        // Prevent default scrolling behavior when pulling
        if (distance > 10) {
          e.preventDefault();
        }

        setIsPulling(true);
        
        // Use requestAnimationFrame for smoother updates
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          // Apply resistance effect (gets harder to pull further)
          const resistance = Math.pow(distance / threshold, 0.7);
          setPullDistance(Math.min(distance * resistance, threshold * 1.5));
        });
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isRefreshing) return;

      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } catch (error) {
          console.error('Pull to refresh error:', error);
        } finally {
          // Delay hiding to show completed animation
          setTimeout(() => {
            setIsRefreshing(false);
            setIsPulling(false);
            setPullDistance(0);
          }, 500);
        }
      } else {
        // Animate back if threshold not reached
        setIsPulling(false);
        setPullDistance(0);
      }

      isAtTop.current = false;
      if (rafId) cancelAnimationFrame(rafId);
    };

    // Add touch listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [enabled, onRefresh, threshold, isPulling, pullDistance, isRefreshing]);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    progress: Math.min(pullDistance / threshold, 1), // 0 to 1
  };
};

