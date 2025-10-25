import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Web3Provider from "@/providers/Web3Provider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ScrollToTop from "@/components/ScrollToTop";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { AdDisplay } from "@/components/AdDisplay";
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
import NotFound from "./pages/NotFound";

const AppContent = () => {
  const radioPlayer = useRadioPlayer();
  const audioPlayer = useAudioPlayer();
  const [showAdModal, setShowAdModal] = useState(false);

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

  return (
    <>
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
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/tiers" element={<Tiers />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/feed" element={<Feed playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
          <Route path="/artist/:walletAddress" element={<Artist playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
          <Route path="/song/:songId" element={<SongTrade playSong={handlePlaySong} currentSong={activeSong} isPlaying={activeIsPlaying} />} />
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
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </Web3Provider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
