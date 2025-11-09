import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Component to initialize Base Mini App SDK
 * Calls sdk.actions.ready() when app is loaded to hide the loading splash screen
 */
export const BaseMiniAppInit = () => {
  useEffect(() => {
    // Initialize Base Mini App SDK
    const initMiniApp = async () => {
      try {
        // Call ready() to hide the loading splash screen and display the app
        await sdk.actions.ready();
        console.log('✅ Base Mini App initialized and ready');
      } catch (error) {
        // If SDK is not available (e.g., not running in Base App), silently fail
        // This allows the app to work normally in regular browsers
        if (error instanceof Error && error.message.includes('sdk')) {
          console.log('ℹ️ Base Mini App SDK not available (running in regular browser)');
        } else {
          console.warn('⚠️ Base Mini App SDK initialization error:', error);
        }
      }
    };

    initMiniApp();
  }, []);

  // This component doesn't render anything
  return null;
};

