import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Hook to detect if the app is running in Base App (Mini App context)
 * Uses the official @farcaster/miniapp-sdk
 */
export const useBaseMiniApp = () => {
  const [isBaseMiniApp, setIsBaseMiniApp] = useState(false);
  const [baseAppContext, setBaseAppContext] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check for Base App context using the official SDK
    const checkBaseApp = async () => {
      if (typeof window === 'undefined') return false;

      try {
        // Check if SDK is available (indicates Base App context)
        // Check if running in iframe (common for Mini Apps)
        const isInIframe = window.self !== window.top;
        
        // Check for Base App specific query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const hasBaseAppParam = urlParams.has('baseApp') || urlParams.has('farcaster');
        
        // Check for Base App user agent
        const userAgent = navigator.userAgent.toLowerCase();
        const isBaseAppUA = userAgent.includes('base') || userAgent.includes('farcaster');
        
        const detected = isInIframe || hasBaseAppParam || isBaseAppUA;
        setIsBaseMiniApp(detected);

        // Try to get user context from SDK
        if (detected) {
          try {
            const context = await sdk.context;
            const userContext = context?.user;
            
            setBaseAppContext(context);
            setUser(userContext);
            
            console.log('🎯 Base Mini App detected:', {
              isInIframe,
              hasBaseAppParam,
              isBaseAppUA,
              user: userContext,
            });
          } catch (error) {
            // SDK might not be fully initialized yet
            console.log('ℹ️ Base Mini App SDK context not yet available');
          }
        }
      } catch (error) {
        // Not running in Base App context
        console.log('ℹ️ Not running in Base Mini App context');
      }
    };

    checkBaseApp();
  }, []);

  return {
    isBaseMiniApp,
    baseAppContext,
    user,
    // Helper to check if wallet is available through Base App
    hasBaseAppWallet: !!user?.custodyAddress,
    // SDK instance
    sdk: isBaseMiniApp ? sdk : null,
  };
};
