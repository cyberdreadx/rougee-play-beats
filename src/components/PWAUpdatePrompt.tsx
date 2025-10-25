import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export const PWAUpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      console.log('📱 PWAUpdatePrompt: Initializing...', import.meta.env.PROD ? 'PROD' : 'DEV');
      
      // In dev mode, show test prompt after 5 seconds (for testing)
      if (!import.meta.env.PROD) {
        console.log('🔧 Dev mode: Test prompt available');
        return;
      }

      // PRODUCTION MODE
      // Check for updates every 60 seconds
      const checkInterval = setInterval(() => {
        navigator.serviceWorker.ready.then((reg) => {
          console.log('🔍 Checking for updates...');
          reg.update();
        });
      }, 60000); // Check every minute

      // Listen for updates
      navigator.serviceWorker.ready.then((reg) => {
        console.log('✅ Service worker ready:', reg);
        setRegistration(reg);

        // Check if there's an update waiting immediately
        if (reg.waiting) {
          console.log('🎉 Update waiting on mount!');
          setShowPrompt(true);
        }

        if (reg.installing) {
          console.log('🔧 Service worker installing...');
        }

        // Listen for new updates
        reg.addEventListener('updatefound', () => {
          console.log('🆕 Update found!');
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              console.log('📊 Worker state changed:', newWorker.state);
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available!
                console.log('✨ New version installed and ready!');
                setShowPrompt(true);
                // Update registration reference
                setRegistration(reg);
              }
            });
          }
        });
      }).catch(err => {
        console.error('❌ Service worker ready failed:', err);
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Message from service worker:', event.data);
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          setShowPrompt(true);
        }
      });

      return () => clearInterval(checkInterval);
    }
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);

    console.log('🔄 Update button clicked, registration:', registration);
    console.log('🔄 Waiting worker:', registration?.waiting);

    if (!registration) {
      console.error('❌ No registration found');
      // Force reload anyway
      window.location.reload();
      return;
    }

    const waitingWorker = registration.waiting || registration.installing;
    
    if (!waitingWorker) {
      console.warn('⚠️ No waiting/installing worker, forcing reload...');
      // Force reload anyway
      window.location.reload();
      return;
    }

    console.log('✅ Sending SKIP_WAITING to service worker...');
    
    // Tell the waiting service worker to activate
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // Set up controller change listener BEFORE sending message
    let controllerChanged = false;
    const handleControllerChange = () => {
      if (!controllerChanged) {
        controllerChanged = true;
        console.log('✅ Controller changed, reloading...');
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Fallback: If controller doesn't change within 2 seconds, force reload
    setTimeout(() => {
      if (!controllerChanged) {
        console.log('⏰ Timeout reached, forcing reload...');
        window.location.reload();
      }
    }, 2000);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // User dismissed, show again in 5 minutes
    setTimeout(() => {
      if (registration && registration.waiting) {
        setShowPrompt(true);
      }
    }, 5 * 60 * 1000);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] animate-in slide-in-from-bottom-5">
      <div className="console-bg tech-border rounded-lg p-4 shadow-2xl border-neon-green/50">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-neon-green/20 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-neon-green" />
            </div>
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="space-y-1">
              <h3 className="font-mono font-bold text-sm">Update Available! 🚀</h3>
              <p className="text-xs text-muted-foreground">
                A new version of ROUGEE.PLAY is ready. Update now for the latest features and fixes.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleUpdate}
                disabled={isUpdating}
                variant="neon"
                size="sm"
                className="font-mono text-xs h-8"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Update Now
                  </>
                )}
              </Button>

              <Button
                onClick={handleDismiss}
                disabled={isUpdating}
                variant="outline"
                size="sm"
                className="font-mono text-xs h-8"
              >
                Later
              </Button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            disabled={isUpdating}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

