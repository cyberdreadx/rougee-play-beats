import React, { useRef } from "react";
import { useWallet } from "@/hooks/useWallet";
import NetworkInfo from "@/components/NetworkInfo";
import SearchBar from "@/components/SearchBar";
import TrendingArtists from "@/components/TrendingArtists";
import TopSongs, { TopSongsRef } from "@/components/TopSongs";
import StoriesBar from "@/components/StoriesBar";
import LandingHero from "@/components/LandingHero";
import MusicBars from "@/components/MusicBars";
import GenresList from "@/components/GenresList";
import logo from "@/assets/logo.png";
import { RadioToggle } from "@/components/RadioToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  token_address?: string | null;
  play_count: number;
  created_at: string;
}

interface IndexProps {
  playSong: (song: Song) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  isRadioMode?: boolean;
  onToggleRadio?: () => void;
}

const Index = ({ playSong, currentSong, isPlaying, isRadioMode, onToggleRadio }: IndexProps) => {
  const [activeTab, setActiveTab] = React.useState("DISCOVER");
  const topSongsRef = useRef<TopSongsRef>(null);
  const { isConnected } = useWallet();

  const handlePlayCountUpdate = () => {
    topSongsRef.current?.refreshSongs();
  };

  // Show landing page for non-connected wallets
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-24 md:pb-20">
        <LandingHero />
        
        {/* Discovery Sections */}
        <div className="flex-1 w-full overflow-x-hidden space-y-6 pb-8">
          <div className="px-4">
            <h2 className="text-lg font-bold font-mono mb-3 text-primary">
              🔥 TRENDING ARTISTS
            </h2>
          </div>
          <TrendingArtists />
          
          <div className="px-4">
            <h2 className="text-lg font-bold font-mono mb-3 text-primary">
              🎵 TOP SONGS
            </h2>
          </div>
          <TopSongs 
            ref={topSongsRef}
            onPlaySong={playSong}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlayCountUpdate={handlePlayCountUpdate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-20 flex flex-col overflow-x-hidden">
      <NetworkInfo />
      <div className="flex items-center justify-between px-4 md:px-6 py-4 gap-3">
        {onToggleRadio && (
          <RadioToggle 
            isRadioMode={isRadioMode || false} 
            onToggle={onToggleRadio}
          />
        )}
      </div>
      <div className="flex-1 w-full overflow-x-hidden">
        {/* Compact hero header (keeps logo/title tagline visible after login) */}
        <div className="text-center px-4 md:px-6 pt-2 md:pt-3">
          <div className="mb-2 flex justify-center">
            <img src={logo} alt="ROUGEE Logo" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-primary/20" />
          </div>
          <h1 className="text-lg md:text-xl font-bold mb-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            ROUGEE
          </h1>
          <p className="text-[11px] md:text-sm text-muted-foreground mb-3">
            The decentralized music platform where artists own their content and fans discover amazing beats
          </p>
        </div>
        {/* Search bar with music bars inline */}
        <div className="flex items-center justify-center gap-3 px-4 md:px-6 py-3 md:py-4">
          <MusicBars bars={6} className="h-6 md:h-8 flex-shrink-0" />
          <div className="max-w-2xl w-full">
            <SearchBar />
          </div>
        </div>
        <div className="px-2 md:px-0">
          <StoriesBar />
        </div>
        
        {/* Tabs for different discovery sections */}
        <Tabs defaultValue="artists" className="w-full">
          <div className="px-4 md:px-6 mb-4">
            <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto bg-white/5 backdrop-blur-xl border border-white/10">
              <TabsTrigger 
                value="artists" 
                className="font-mono data-[state=active]:bg-neon-green data-[state=active]:text-black"
              >
                ARTISTS
              </TabsTrigger>
              <TabsTrigger 
                value="songs" 
                className="font-mono data-[state=active]:bg-neon-green data-[state=active]:text-black"
              >
                SONGS
              </TabsTrigger>
              <TabsTrigger 
                value="genres" 
                className="font-mono data-[state=active]:bg-neon-green data-[state=active]:text-black"
              >
                GENRES
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="artists" className="px-2 md:px-0 mt-0">
            <TrendingArtists />
          </TabsContent>

          <TabsContent value="songs" className="px-2 md:px-0 mt-0">
            <TopSongs 
              ref={topSongsRef}
              onPlaySong={playSong}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlayCountUpdate={handlePlayCountUpdate}
            />
          </TabsContent>

          <TabsContent value="genres" className="px-2 md:px-0 mt-0">
            <GenresList playSong={playSong} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;