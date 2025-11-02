import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, Step, STATUS } from 'react-joyride';

interface AppTutorialProps {
  onComplete?: () => void;
}

export const AppTutorial = ({ onComplete }: AppTutorialProps) => {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check if user has seen the tutorial
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      // Start tutorial after a brief delay to let the page load
      setTimeout(() => setRun(true), 1000);
    }
  }, []);

  const steps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="text-center">
          <h2 className="text-2xl font-bold font-mono neon-text mb-3">Welcome to Rougee! 🎵</h2>
          <p className="text-base mb-2">Your music trading platform where songs become tradeable assets.</p>
          <p className="text-sm text-muted-foreground">Let's show you around!</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="trending"]',
      content: (
        <div>
          <h3 className="font-bold font-mono mb-2">📈 Trending Songs</h3>
          <p className="text-sm">Discover hot songs with rising prices and high trading volume. Click any song to view its trading page.</p>
        </div>
      ),
      placement: 'bottom',
      disableScrolling: false,
      scrollOffset: 100,
      disableOverlayClose: false,
    },
    {
      target: '[data-tour="featured-chart"]',
      content: (
        <div>
          <h3 className="font-bold font-mono mb-2">📊 Price Charts</h3>
          <p className="text-sm">View real-time trading data and price movements. Toggle between Candlestick and Price views.</p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="play-button"]',
      content: (
        <div>
          <h3 className="font-bold font-mono mb-2">🎧 Listen & Discover</h3>
          <p className="text-sm">Play songs directly from the trending page. The best music rises to the top through trading!</p>
        </div>
      ),
      placement: 'left',
    },
    {
      target: '[data-tour="upload"]',
      content: (
        <div>
          <h3 className="font-bold font-mono mb-2">⬆️ Upload Your Music</h3>
          <p className="text-sm">Create your artist profile and upload songs. Your music becomes a tradeable token on the blockchain!</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="wallet"]',
      content: (
        <div>
          <h3 className="font-bold font-mono mb-2">💰 Connect Wallet</h3>
          <p className="text-sm">Connect your wallet to trade songs, earn from plays, and build your music portfolio.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: 'body',
      content: (
        <div className="text-center">
          <h2 className="text-2xl font-bold font-mono neon-text mb-3">You're All Set! 🚀</h2>
          <p className="text-base mb-2">Start exploring, trading, and discovering amazing music.</p>
          <p className="text-sm text-muted-foreground">You can restart this tour anytime from Settings.</p>
        </div>
      ),
      placement: 'center',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index } = data;

    // When moving to step 2 (index 1), ensure the target element is visible
    if (action === 'next' && index === 1) {
      // Small delay to ensure scrolling completes
      setTimeout(() => {
        const target = document.querySelector('[data-tour="trending"]');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        }
      }, 300);
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem('hasSeenTutorial', 'true');
      
      // Force cleanup and fix any overflow issues
      setTimeout(() => {
        // Remove any Joyride overlays/spotlights that might remain
        const joyrideOverlays = document.querySelectorAll('[class*="react-joyride"]');
        joyrideOverlays.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.display = 'none';
          }
        });
        
        // Ensure body/html don't have overflow
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.overflowX = 'hidden';
        document.documentElement.style.maxWidth = '100vw';
        document.body.style.maxWidth = '100vw';
        
        // Remove any inline styles that might cause overflow
        const root = document.getElementById('root');
        if (root) {
          root.style.overflowX = 'hidden';
          root.style.maxWidth = '100vw';
        }
      }, 100);
      
      onComplete?.();
    }
  };

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        continuous
        showProgress
        showSkipButton
        scrollToFirstStep
        disableScrolling={false}
        spotlightClicks
        disableOverlayClose
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#00ff9f',
            textColor: '#ffffff',
            backgroundColor: '#1a1a1a',
            overlayColor: 'rgba(0, 0, 0, 0.8)',
            arrowColor: '#1a1a1a',
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: 12,
            padding: 20,
            fontSize: 14,
            fontFamily: 'monospace',
            maxWidth: '90vw',
            width: 'auto',
          },
          tooltipContainer: {
            maxWidth: '90vw',
            overflow: 'hidden',
          },
          overlay: {
            overflow: 'hidden',
          },
          buttonNext: {
            backgroundColor: '#00ff9f',
            color: '#000',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            borderRadius: 8,
            padding: '8px 16px',
          },
          buttonBack: {
            color: '#888',
            fontFamily: 'monospace',
          },
          buttonSkip: {
            color: '#888',
            fontFamily: 'monospace',
          },
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip Tour',
        }}
      />
      {/* Force overflow fix after tutorial */}
      {!run && (
        <style>{`
          html, body, #root {
            overflow-x: hidden !important;
            max-width: 100vw !important;
            position: relative !important;
          }
          body > * {
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
        `}</style>
      )}
    </>
  );
};

// Hook to manually restart the tutorial
export const useRestartTutorial = () => {
  return () => {
    localStorage.removeItem('hasSeenTutorial');
    window.location.reload();
  };
};
