import './polyfills/node-globals';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA functionality (disabled in development)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
        
        // Helper function to safely check for updates
        const checkForUpdate = () => {
          // Only check for updates if we have an active service worker
          if (registration.active) {
            registration.update().catch((error) => {
              // Silently handle common update errors:
              // - 404 if sw.js doesn't exist yet (first deployment)
              // - Network errors during update checks
              // - Fetch errors that are expected
              const isExpectedError = 
                error?.message?.includes('Failed to fetch') ||
                error?.message?.includes('404') ||
                error?.message?.includes('NetworkError') ||
                error?.name === 'TypeError';
              
              if (!isExpectedError) {
                console.warn('⚠️ Service Worker update check failed:', error);
              }
            });
          }
        };
        
        // Check for updates every 5 minutes
        setInterval(checkForUpdate, 5 * 60 * 1000);
        
        // Initial update check (with delay to ensure SW is ready)
        setTimeout(checkForUpdate, 1000);
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('🔄 New service worker found, waiting for install...');
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available! 
                // Don't auto-reload - let the PWAUpdatePrompt component handle it
                console.log('✨ New version available! Showing update prompt...');
              }
            });
          }
        });
      })
      .catch((error) => {
        // Only log if it's not a 404 (file might not exist on first load)
        if (!error?.message?.includes('404')) {
          console.error('❌ Service Worker registration failed:', error);
        }
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
