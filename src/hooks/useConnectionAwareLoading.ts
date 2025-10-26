import { useState, useEffect } from 'react';

interface ConnectionInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export const useConnectionAwareLoading = () => {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [isFastConnection, setIsFastConnection] = useState(false);

  useEffect(() => {
    // Check if connection API is available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateConnectionInfo = () => {
        const info: ConnectionInfo = {
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          saveData: connection.saveData || false
        };
        
        setConnectionInfo(info);
        
        // Determine connection speed
        const slowTypes = ['2g', 'slow-2g'];
        const fastTypes = ['4g', '3g'];
        
        setIsSlowConnection(slowTypes.includes(info.effectiveType) || info.saveData);
        setIsFastConnection(fastTypes.includes(info.effectiveType) && !info.saveData);
      };
      
      // Initial check
      updateConnectionInfo();
      
      // Listen for connection changes
      connection.addEventListener('change', updateConnectionInfo);
      
      return () => {
        connection.removeEventListener('change', updateConnectionInfo);
      };
    } else {
      // Fallback: assume fast connection if API not available
      setIsFastConnection(true);
    }
  }, []);

  const getPreloadStrategy = (): 'none' | 'metadata' | 'auto' => {
    if (isSlowConnection) {
      return 'metadata'; // Only load metadata on slow connections
    }
    return 'auto'; // Load full file on fast connections
  };

  const getGatewayCount = (): number => {
    if (isSlowConnection) {
      return 2; // Fewer fallbacks on slow connections
    }
    return 4; // More fallbacks on fast connections
  };

  const shouldPreloadNext = (): boolean => {
    return isFastConnection && !isSlowConnection;
  };

  return {
    connectionInfo,
    isSlowConnection,
    isFastConnection,
    getPreloadStrategy,
    getGatewayCount,
    shouldPreloadNext
  };
};
