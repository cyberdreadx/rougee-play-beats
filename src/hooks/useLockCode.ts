import { useState, useEffect } from "react";
import { useWallet } from "./useWallet";

// Simple hash function (in production, use a more secure method)
const hashCode = (code: string): string => {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

// Get storage key for lock code hash (per wallet)
const getStorageKey = (walletAddress: string): string => {
  return `lock_code_hash_${walletAddress.toLowerCase()}`;
};

// Get storage key for lock code enabled flag (per wallet)
const getEnabledKey = (walletAddress: string): string => {
  return `lock_code_enabled_${walletAddress.toLowerCase()}`;
};

// Get storage key for auto-lock timeout (per wallet)
const getAutoLockTimeoutKey = (walletAddress: string): string => {
  return `auto_lock_timeout_${walletAddress.toLowerCase()}`;
};

// Get storage key for require pin after login setting (per wallet)
const getRequirePinAfterLoginKey = (walletAddress: string): string => {
  return `require_pin_after_login_${walletAddress.toLowerCase()}`;
};

// Default auto-lock timeout: 5 minutes (in milliseconds)
const DEFAULT_AUTO_LOCK_TIMEOUT = 5 * 60 * 1000;

export const useLockCode = () => {
  const { fullAddress } = useWallet();
  const [isLocked, setIsLocked] = useState(false);
  const [hasLockCode, setHasLockCode] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState<number>(DEFAULT_AUTO_LOCK_TIMEOUT);
  const [requirePinAfterLogin, setRequirePinAfterLogin] = useState<boolean>(true);
  const [lockUpdateTrigger, setLockUpdateTrigger] = useState(0);

  // Check if lock code is set for current wallet (only on mount or address change)
  useEffect(() => {
    if (fullAddress) {
      const enabled = localStorage.getItem(getEnabledKey(fullAddress)) === "true";
      setHasLockCode(enabled);
      
      // Load auto-lock timeout setting
      const savedTimeout = localStorage.getItem(getAutoLockTimeoutKey(fullAddress));
      if (savedTimeout) {
        setAutoLockTimeout(parseInt(savedTimeout, 10));
      } else {
        setAutoLockTimeout(DEFAULT_AUTO_LOCK_TIMEOUT);
      }
      
      // Load require pin after login setting
      const requirePinAfterLoginSetting = localStorage.getItem(getRequirePinAfterLoginKey(fullAddress));
      if (requirePinAfterLoginSetting !== null) {
        setRequirePinAfterLogin(requirePinAfterLoginSetting === "true");
      } else {
        setRequirePinAfterLogin(true); // Default to requiring pin after login
      }
      
      // Check if user should be locked (if lock code is enabled and not verified in this session)
      // IMPORTANT: Check sessionStorage for verification status
      // NOTE: Add a small delay to ensure sessionStorage writes from verifyLockCode are complete
      if (enabled) {
        const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
        
        // Use a function to check verification with retry logic
        const checkVerification = (retryCount = 0) => {
          const isVerified = sessionStorage.getItem(sessionKey) === "true";
          
          console.log('🔍 useEffect: enabled=', enabled, 'isVerified=', isVerified, 'sessionKey=', sessionKey, 'retryCount=', retryCount);
          console.log('🔍 useEffect: sessionStorage.getItem(sessionKey)=', sessionStorage.getItem(sessionKey));
          
          // Check if we should require pin after login
          const requireAfterLogin = requirePinAfterLoginSetting !== null 
            ? requirePinAfterLoginSetting === "true" 
            : true; // Default to true
          
          console.log('🔍 useEffect: requireAfterLogin=', requireAfterLogin);
          
          // If verified, always unlock (don't override manual unlock)
          if (isVerified) {
            console.log('🔓 useEffect: Unlocking - verified in sessionStorage');
            setIsLocked(false);
            return;
          }
          
          // If not verified and require after login, lock
          // BUT: Only if lockUpdateTrigger hasn't changed recently (meaning no recent unlock)
          if (!isVerified && requireAfterLogin) {
            // If this is the first check and sessionStorage is null, it might be a timing issue
            // Wait a bit and retry once before locking
            if (retryCount === 0 && sessionStorage.getItem(sessionKey) === null) {
              console.log('⏳ useEffect: sessionStorage is null, retrying in 100ms...');
              setTimeout(() => checkVerification(1), 100);
              return;
            }
            
            console.log('🔒 useEffect: Locking - not verified and require after login');
            setIsLocked(true);
          } else {
            // If don't require after login, unlock
            console.log('🔓 useEffect: Unlocking - requireAfterLogin=', requireAfterLogin);
            setIsLocked(false);
          }
        };
        
        // Add a small delay to ensure sessionStorage writes from verifyLockCode are complete
        // This is especially important if verifyLockCode just ran
        // Use a longer delay when lockUpdateTrigger changes (indicating a recent unlock attempt)
        const delay = lockUpdateTrigger > 0 ? 200 : 50;
        const timeoutId = setTimeout(() => checkVerification(0), delay);
        return () => clearTimeout(timeoutId);
      } else {
        // No lock code enabled, ensure unlocked
        console.log('🔓 useEffect: No lock code enabled, unlocking');
        setIsLocked(false);
      }
    } else {
      setIsLocked(false);
      setHasLockCode(false);
      setAutoLockTimeout(DEFAULT_AUTO_LOCK_TIMEOUT);
      setRequirePinAfterLogin(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullAddress, lockUpdateTrigger]); // Include lockUpdateTrigger to re-check after unlock

  // Set lock code
  const setLockCode = (code: string): boolean => {
    if (!fullAddress) return false;
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      return false; // Invalid code
    }

    const codeHash = hashCode(code);
    localStorage.setItem(getStorageKey(fullAddress), codeHash);
    localStorage.setItem(getEnabledKey(fullAddress), "true");
    
    // Mark as verified in this session
    const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
    sessionStorage.setItem(sessionKey, "true");
    
    setHasLockCode(true);
    setIsLocked(false);
    return true;
  };

  // Verify lock code
  const verifyLockCode = (code: string): boolean => {
    if (!fullAddress) {
      console.error('❌ verifyLockCode: No fullAddress');
      return false;
    }
    
    const storedHash = localStorage.getItem(getStorageKey(fullAddress));
    if (!storedHash) {
      console.error('❌ verifyLockCode: No stored hash');
      return false;
    }
    
    const codeHash = hashCode(code);
    const isValid = codeHash === storedHash;
    
    if (isValid) {
      // Mark as verified in this session FIRST
      const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
      sessionStorage.setItem(sessionKey, "true");
      console.log('✅ verifyLockCode: Code valid, marked verified in sessionStorage');
      
      // Verify it was set
      const verifyCheck = sessionStorage.getItem(sessionKey);
      console.log('✅ verifyLockCode: Verification check:', verifyCheck);
      
      // Update state immediately - this will trigger a re-render
      // Use a callback to ensure it updates even if React batches
      setIsLocked(false);
      console.log('✅ verifyLockCode: Set isLocked to false');
      
      // Also trigger unlock update to force App component to recalculate
      setLockUpdateTrigger(prev => {
        console.log('✅ verifyLockCode: Triggering unlock update, prev=', prev, 'to', prev + 1);
        return prev + 1;
      });
    } else {
      console.log('❌ verifyLockCode: Code invalid');
    }
    
    return isValid;
  };

  // Remove lock code
  const removeLockCode = (): boolean => {
    if (!fullAddress) return false;
    
    localStorage.removeItem(getStorageKey(fullAddress));
    localStorage.removeItem(getEnabledKey(fullAddress));
    
    // Clear session verification
    const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
    sessionStorage.removeItem(sessionKey);
    
    setHasLockCode(false);
    setIsLocked(false);
    return true;
  };

  // Clear lock (for logout)
  const clearLock = () => {
    if (fullAddress) {
      const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
      sessionStorage.removeItem(sessionKey);
    }
    setIsLocked(true);
  };

  // Lock the app (for manual lock)
  const lock = () => {
    if (fullAddress) {
      const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
      sessionStorage.removeItem(sessionKey);
      console.log('🔒 lock(): Cleared sessionStorage, key:', sessionKey);
      // Verify it was cleared
      const verifyCleared = sessionStorage.getItem(sessionKey);
      console.log('🔒 lock(): Verification cleared check:', verifyCleared);
    }
    // Update state immediately - this will trigger a re-render
    setIsLocked(true);
    console.log('🔒 lock(): Set isLocked to true');
    
    // Trigger lock update to force App component to recalculate
    setLockUpdateTrigger(prev => prev + 1);
  };
  
  // Function to trigger lock update from external components
  const triggerLockUpdate = () => {
    setLockUpdateTrigger(prev => prev + 1);
  };

  // Auto-lock timer based on inactivity
  useEffect(() => {
    if (!fullAddress || !hasLockCode || isLocked) {
      return; // Don't set up auto-lock if no wallet, no lock code, or already locked
    }

    let timeoutId: NodeJS.Timeout;
    const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
    const lastActivityKey = `last_activity_${fullAddress.toLowerCase()}`;

    // Activity tracking functions
    const resetAutoLockTimer = () => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Update last activity time
      sessionStorage.setItem(lastActivityKey, Date.now().toString());

      // Set new timeout
      timeoutId = setTimeout(() => {
        // Check if still verified (user might have manually unlocked)
        const isVerified = sessionStorage.getItem(sessionKey) === "true";
        if (isVerified && hasLockCode) {
          sessionStorage.removeItem(sessionKey);
          setIsLocked(true); // Update state to trigger re-render
        }
      }, autoLockTimeout);
    };

    // Initial setup - check if enough time has passed since last activity
    const lastActivity = sessionStorage.getItem(lastActivityKey);
    if (lastActivity) {
      const timeSinceActivity = Date.now() - parseInt(lastActivity, 10);
      if (timeSinceActivity >= autoLockTimeout) {
        // Enough time has passed, lock immediately
        sessionStorage.removeItem(sessionKey);
        setIsLocked(true); // Update state to trigger re-render
        return;
      } else {
        // Reset timer with remaining time
        timeoutId = setTimeout(() => {
          const isVerified = sessionStorage.getItem(sessionKey) === "true";
          if (isVerified && hasLockCode) {
            sessionStorage.removeItem(sessionKey);
            setIsLocked(true); // Update state to trigger re-render
          }
        }, autoLockTimeout - timeSinceActivity);
      }
    } else {
      // No previous activity, set normal timeout
      resetAutoLockTimer();
    }

    // Activity event listeners
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, resetAutoLockTimer, { passive: true });
    });

    // Reset timer when window gains focus
    const handleFocus = () => {
      resetAutoLockTimer();
    };
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetAutoLockTimer);
      });
      window.removeEventListener('focus', handleFocus);
    };
  }, [fullAddress, hasLockCode, isLocked, autoLockTimeout]);

  // Set auto-lock timeout
  const setAutoLockTimeoutSetting = (minutes: number): boolean => {
    if (!fullAddress) return false;
    const timeoutMs = minutes * 60 * 1000;
    localStorage.setItem(getAutoLockTimeoutKey(fullAddress), timeoutMs.toString());
    setAutoLockTimeout(timeoutMs);
    return true;
  };

  // Get auto-lock timeout in minutes
  const getAutoLockTimeoutMinutes = (): number => {
    return Math.round(autoLockTimeout / (60 * 1000));
  };

  // Set require pin after login setting
  const setRequirePinAfterLoginSetting = (require: boolean): boolean => {
    if (!fullAddress) return false;
    localStorage.setItem(getRequirePinAfterLoginKey(fullAddress), require.toString());
    setRequirePinAfterLogin(require);
    return true;
  };

  // Clear lock when wallet disconnects (logout)
  useEffect(() => {
    if (!fullAddress) {
      // User logged out - clear lock verification
      setIsLocked(false);
      // Note: fullAddress is null here, but we'll clear any stale session data
      // This effect runs when fullAddress changes to null (logout)
    }
  }, [fullAddress]);

  return {
    isLocked,
    hasLockCode,
    setLockCode,
    verifyLockCode,
    removeLockCode,
    clearLock,
    lock,
    autoLockTimeoutMinutes: getAutoLockTimeoutMinutes(),
    setAutoLockTimeout: setAutoLockTimeoutSetting,
    requirePinAfterLogin,
    setRequirePinAfterLogin: setRequirePinAfterLoginSetting,
    lockUpdateTrigger, // Export trigger so App can use it
    triggerLockUpdate, // Export function to trigger updates
  };
};

