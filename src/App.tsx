import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Web3Provider from "@/providers/Web3Provider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { DualWalletProvider } from "@/contexts/DualWalletContext";
import ScrollToTop from "@/components/ScrollToTop";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { AdDisplay } from "@/components/AdDisplay";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import Layout from "@/components/Layout";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import Trending from "./pages/Trending";
import Upload from "./pages/Upload";
import Artist from "./pages/Artist";
import ProfileEdit from "./pages/ProfileEdit";
import BecomeArtist from "./pages/BecomeArtist";
import Wallet from "./pages/Wallet";
import SongTrade from "./pages/SongTrade";
import Admin from "./pages/Admin";
import Feed from "./pages/Feed";
import Swap from "./pages/Swap";
import Playlists from "./pages/Playlists";
import HowItWorks from "./pages/HowItWorks";
import Tiers from "./pages/Tiers";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import Messages from "./pages/Messages";
import Genre from "./pages/Genre";
import SongEdit from "./pages/SongEdit";
import NotFound from "./pages/NotFound";
import Post from "./pages/Post";
import Settings from "./pages/Settings";
import { LockCodeScreen } from "@/components/LockCodeScreen";
import { useLockCode } from "@/hooks/useLockCode";
import { useWallet } from "@/hooks/useWallet";
import * as React from "react";

const AppContent = () => {
  const location = useLocation();
  const radioPlayer = useRadioPlayer();
  const audioPlayer = useAudioPlayer();
  const [showAdModal, setShowAdModal] = useState(false);
  const { isLocked, lockUpdateTrigger } = useLockCode();
  const [unlockTrigger, setUnlockTrigger] = useState(0);
  
  // Auto-dock player on feed page whenever a song starts playing
  const shouldAutoMinimize = React.useMemo(() => {
    return location.pathname === '/feed' && !!audioPlayer.currentSong;
  }, [location.pathname, audioPlayer.currentSong]);

  // Determine active source (radio or manual)
  const isRadioActive = radioPlayer.isRadioMode;
  const activeSong = isRadioActive ? radioPlayer.currentSong : audioPlayer.currentSong;
  const activeIsPlaying = isRadioActive ? radioPlayer.isPlaying : audioPlayer.isPlaying;

  const handlePlaySong = (song: any) => {
    if (radioPlayer.isRadioMode) {
      radioPlayer.stopRadio();
    }
    audioPlayer.playSong(song);
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    console.log('🔄 Pull to refresh triggered');
    // Force reload the current page
    window.location.reload();
  };

  // Show lock screen if locked
  // Also check sessionStorage directly to handle immediate unlocks and locks
  // Use shouldBeLocked as source of truth since it reads from sessionStorage directly
  const { fullAddress } = useWallet();
  // Include isLocked in dependencies so it recalculates when lock() is called
  const shouldBeLocked = React.useMemo(() => {
    if (!fullAddress) return false;
    const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
    const isVerified = sessionStorage.getItem(sessionKey) === "true";
    const hasLockCode = localStorage.getItem(`lock_code_enabled_${fullAddress.toLowerCase()}`) === "true";
    const requireAfterLogin = localStorage.getItem(`require_pin_after_login_${fullAddress.toLowerCase()}`);
    const requirePin = requireAfterLogin !== null ? requireAfterLogin === "true" : true;
    
    // If lock code is enabled and not verified and require after login, lock
    if (hasLockCode && !isVerified && requirePin) {
      return true;
    }
    return false;
  }, [fullAddress, unlockTrigger, isLocked]); // Added isLocked so it recalculates when lock() is called
  
  // Check sessionStorage directly for immediate lock/unlock detection
  // Priority: isLocked=true locks immediately, isVerified=true unlocks immediately
  // Use state to force re-render when unlockTrigger changes
  const [sessionStorageCheck, setSessionStorageCheck] = React.useState(0);
  
  const actuallyLocked = React.useMemo(() => {
    if (!fullAddress) return isLocked;
    
    // Read sessionStorage directly for immediate detection
    const sessionKey = `lock_code_verified_${fullAddress.toLowerCase()}`;
    // Force a fresh read of sessionStorage - try multiple times if needed
    let isVerified = false;
    try {
      const value = sessionStorage.getItem(sessionKey);
      isVerified = value === "true";
      if (!isVerified && value !== null) {
        console.log('⚠️ actuallyLocked: sessionStorage value is not "true":', value);
      }
    } catch (e) {
      console.error('❌ actuallyLocked: Error reading sessionStorage:', e);
    }
    const hasLockCode = localStorage.getItem(`lock_code_enabled_${fullAddress.toLowerCase()}`) === "true";
    const requireAfterLogin = localStorage.getItem(`require_pin_after_login_${fullAddress.toLowerCase()}`);
    const requirePin = requireAfterLogin !== null ? requireAfterLogin === "true" : true;
    
    console.log('🔍 actuallyLocked: isVerified=', isVerified, 'hasLockCode=', hasLockCode, 'requirePin=', requirePin, 'isLocked=', isLocked, 'unlockTrigger=', unlockTrigger, 'lockUpdateTrigger=', lockUpdateTrigger, 'sessionStorageCheck=', sessionStorageCheck);
    console.log('🔍 actuallyLocked: sessionStorage key=', sessionKey, 'value=', sessionStorage.getItem(sessionKey));
    
    // Priority 1: If user is verified in sessionStorage, unlock immediately (even if isLocked is true)
    // This handles the unlock case when verifyLockCode sets sessionStorage
    if (isVerified) {
      console.log('🔓 actuallyLocked: isVerified=true, unlocking immediately');
      return false;
    }
    
    // Priority 2: If isLocked is true (manual lock was just called), lock immediately
    if (isLocked) {
      console.log('🔒 actuallyLocked: isLocked=true, locking immediately');
      return true;
    }
    
    // Priority 3: If lock code is enabled and not verified and require after login, lock
    if (hasLockCode && !isVerified && requirePin) {
      console.log('🔒 actuallyLocked: Should lock (not verified)');
      return true;
    }
    
    // Default: unlocked
    console.log('🔓 actuallyLocked: Default unlocked');
    return false;
  }, [fullAddress, isLocked, unlockTrigger, lockUpdateTrigger, sessionStorageCheck]); // Added sessionStorageCheck to force recalculation
  
  console.log('🔍 App: isLocked =', isLocked, 'shouldBeLocked =', shouldBeLocked, 'actuallyLocked =', actuallyLocked, 'fullAddress =', fullAddress);
  
  if (actuallyLocked) {
    console.log('🔒 App: Showing lock screen');
    return (
      <LockCodeScreen 
        key={`locked-${unlockTrigger}`}
        onUnlock={() => {
          console.log('🔓 App: onUnlock called, forcing re-render');
          // Force a re-render to check isLocked state again
          setUnlockTrigger(prev => {
            console.log('🔓 App: Unlock trigger incremented from', prev, 'to', prev + 1);
            return prev + 1;
          });
          // Also force a sessionStorage check
          setSessionStorageCheck(prev => {
            console.log('🔓 App: SessionStorage check triggered, prev=', prev);
            return prev + 1;
          });
        }} 
      />
    );
  }
  console.log('✅ App: Not locked, showing main content');

  return (
    <>
      {/* Pull to Refresh - Only on mobile/PWA */}
      <PullToRefresh onRefresh={handleRefresh} />
      
      {radioPlayer.currentAd && (
        <AdDisplay 
          ad={radioPlayer.currentAd} 
          isOpen={!!radioPlayer.currentAd}
          onClose={() => setShowAdModal(false)}
        />
      )}

      <Layout>
        <Routes>
          <Route 
            path="/" 
            element={
              <Trending 
                playSong={handlePlaySong} 
                currentSong={activeSong} 
                isPlaying={activeIsPlaying}
              />
            }
          />
          <Route 
            path="/discover" 
            element={
              <Index 
                playSong={handlePlaySong} 
                currentSong={activeSong} 
                isPlaying={activeIsPlaying}
                isRadioMode={radioPlayer.isRadioMode}
                onToggleRadio={() => {
                  if (radioPlayer.isRadioMode) {
                    radioPlayer.stopRadio();
                  } else {
                    radioPlayer.startRadio();
                  }
                }}
              />
            } 
          />
          <Route path="/upload" element={<Upload />} />
          <Route path="/become-artist" element={<BecomeArtist />} />
          <Route path="/wallet" element={<Wallet playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/tiers" element={<Tiers />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/feed" element={<Feed playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
          <Route path="/post/:postId" element={<Post playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
          <Route path="/artist/:walletAddress" element={<Artist playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/song/:songId" element={<SongTrade playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
          <Route path="/song/:songId/edit" element={<SongEdit />} />
          <Route path="/genre/:genreName" element={<Genre playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/admin" element={<Admin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
      <Footer />
      <AudioPlayer 
        currentSong={activeSong}
        currentAd={isRadioActive ? radioPlayer.currentAd : null}
        isPlaying={activeIsPlaying}
        onPlayPause={isRadioActive ? radioPlayer.togglePlayPause : audioPlayer.togglePlayPause}
        onSongEnd={isRadioActive ? radioPlayer.onMediaEnd : audioPlayer.onSongEnd}
        onNext={!isRadioActive ? audioPlayer.playNext : undefined}
        onPrevious={!isRadioActive ? audioPlayer.playPrevious : undefined}
        onShuffle={!isRadioActive ? audioPlayer.toggleShuffle : undefined}
        onRepeat={!isRadioActive ? audioPlayer.toggleRepeat : undefined}
        initialMinimized={shouldAutoMinimize}
        onClose={() => {
          if (isRadioActive) {
            radioPlayer.stopRadio();
          } else {
            audioPlayer.stopSong();
          }
        }}
        shuffleEnabled={audioPlayer.shuffleEnabled}
        repeatMode={audioPlayer.repeatMode}
      />
    </>
  );
};

const App = () => (
  <HelmetProvider>
    <ThemeProvider>
      <Web3Provider>
        <DualWalletProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PWAUpdatePrompt />
            <BrowserRouter>
              <ScrollToTop />
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </DualWalletProvider>
      </Web3Provider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
