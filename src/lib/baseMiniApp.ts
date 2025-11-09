/**
 * Base Mini App utilities
 * Functions to interact with Base App context when running as a Mini App
 * Uses the official @farcaster/miniapp-sdk
 */

import { sdk } from '@farcaster/miniapp-sdk';

export interface BaseAppContext {
  sdk: typeof sdk;
  isInIframe: boolean;
  userAgent: string;
}

/**
 * Detect if running in Base App context
 */
export const isBaseMiniApp = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Check if SDK is available (indicates Base App context)
  try {
    // Check if running in iframe (common for Mini Apps)
    const isInIframe = window.self !== window.top;
    
    // Check for Base App specific query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hasBaseAppParam = urlParams.has('baseApp') || urlParams.has('farcaster');
    
    // Check for Base App user agent
    const userAgent = navigator.userAgent.toLowerCase();
    const isBaseAppUA = userAgent.includes('base') || userAgent.includes('farcaster');
    
    return isInIframe || hasBaseAppParam || isBaseAppUA;
  } catch {
    return false;
  }
};

/**
 * Get Base App context if available
 */
export const getBaseAppContext = (): BaseAppContext | null => {
  if (!isBaseMiniApp()) return null;

  try {
    return {
      sdk,
      isInIframe: window.self !== window.top,
      userAgent: navigator.userAgent,
    };
  } catch {
    return null;
  }
};

/**
 * Get the Base Mini App SDK instance
 */
export const getBaseMiniAppSDK = () => {
  try {
    return sdk;
  } catch {
    return null;
  }
};

/**
 * Request wallet connection through Base App
 * Uses the official SDK's context API
 */
export const requestBaseAppWallet = async (): Promise<string | null> => {
  try {
    const context = await sdk.context;
    if (context?.user?.fid) {
      // Base App provides user context with FID
      // Wallet address would be available through context.user.custodyAddress or similar
      return context.user.custodyAddress || null;
    }
  } catch (error) {
    console.error('Failed to request Base App wallet:', error);
  }

  return null;
};

/**
 * Share content through Base App
 * Uses the official SDK's actions API
 */
export const shareInBaseApp = async (content: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> => {
  try {
    // Base App SDK share functionality (if available)
    // Note: Actual API may vary based on SDK version
    await sdk.actions.openUrl(content.url || window.location.href);
    return true;
  } catch (error) {
    console.error('Failed to share in Base App:', error);
    return false;
  }
};

/**
 * Open URL in Base App or external browser
 */
export const openInBaseApp = async (url: string, external = false): Promise<void> => {
  try {
    if (!external) {
      // Use SDK to open URL within Base App
      await sdk.actions.openUrl(url);
    } else {
      // Open in external browser
      window.open(url, '_blank');
    }
  } catch (error) {
    console.error('Failed to open URL in Base App:', error);
    // Fallback to standard window.open
    window.open(url, external ? '_blank' : '_self');
  }
};

/**
 * Get user context from Base App
 */
export const getBaseAppUser = async () => {
  try {
    const context = await sdk.context;
    return context?.user || null;
  } catch (error) {
    console.error('Failed to get Base App user:', error);
    return null;
  }
};
