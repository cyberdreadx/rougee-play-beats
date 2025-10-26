import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Play, Pause, TrendingUp, ArrowLeft, Loader2, Shuffle } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSongPrice } from "@/hooks/useSongBondingCurve";
import { Address } from "viem";

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
  genre: string;
  ticker: string;
  ai_usage?: string;
}

interface GenreProps {
  playSong?: (song: Song) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}

const Genre = ({ playSong, currentSong, isPlaying }: GenreProps) => {
  const { genreName } = useParams<{ genreName: string }>();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (genreName) {
      fetchGenreSongs(genreName);
    }
  }, [genreName]);

  const fetchGenreSongs = async (genre: string) => {
    try {
      setLoading(true);
      const decodedGenre = decodeURIComponent(genre);

      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
        .eq("genre", decodedGenre)
        .not("token_address", "is", null) // Only show deployed songs
        .order("play_count", { ascending: false });

      if (error) throw error;

      setSongs(data || []);
    } catch (error) {
      console.error("Error fetching genre songs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24 md:pb-20 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-neon-green" />
      </div>
    );
  }

  const decodedGenre = genreName ? decodeURIComponent(genreName) : "Unknown";

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-20">
      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/discover")}
            className="mb-4 text-muted-foreground hover:text-neon-green"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Discover
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center">
              <Music className="w-8 h-8 md:w-10 md:h-10 text-neon-green" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold font-mono text-neon-green capitalize">
                {decodedGenre}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground font-mono mt-1">
                {songs.length} {songs.length === 1 ? 'song' : 'songs'} available
              </p>
            </div>
            {songs.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="neon"
                  onClick={() => {
                    console.log('🎵 Playing all songs in genre:', decodedGenre, 'Count:', songs.length);
                    // Play the first song and pass all songs as playlist
                    playSong(songs[0], songs);
                  }}
                  className="font-mono"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play All
                </Button>
                {songs.length > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      console.log('🎵 Shuffle playing all songs in genre:', decodedGenre, 'Count:', songs.length);
                      // Shuffle the songs array and play the first one
                      const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);
                      playSong(shuffledSongs[0], shuffledSongs);
                    }}
                    className="font-mono border-neon-green/50 text-neon-green hover:bg-neon-green/10"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Shuffle
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Songs List */}
        {songs.length === 0 ? (
          <Card className="p-8 text-center">
            <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold font-mono mb-2">No songs found</h3>
            <p className="text-muted-foreground font-mono mb-4">
              There are no songs in the {decodedGenre} genre yet.
            </p>
            <Button variant="neon" onClick={() => navigate("/upload")}>
              Upload First Song
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                playSong={playSong}
                currentSong={currentSong}
                isPlaying={isPlaying}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Song Card Component
const SongCard = ({ 
  song, 
  playSong, 
  currentSong, 
  isPlaying 
}: { 
  song: Song;
  playSong?: (song: Song) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
}) => {
  const navigate = useNavigate();
  const { prices } = useTokenPrices();
  const { price: priceInXRGE } = useSongPrice(song.token_address as Address);
  
  const priceXRGE = parseFloat(priceInXRGE) || 0;
  const priceUSD = priceXRGE * (prices.xrge || 0);
  
  const totalSupply = 1_000_000_000;
  const marketCap = priceUSD * totalSupply;

  const coverUrl = song.cover_cid 
    ? getIPFSGatewayUrl(song.cover_cid, undefined, true)
    : '/placeholder-cover.png';

  const isThisSongPlaying = currentSong?.id === song.id && isPlaying;

  return (
    <Card 
      className="group relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-neon-green/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
      onClick={() => navigate(`/song/${song.id}`)}
    >
      {/* Album Cover */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={coverUrl}
          alt={song.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-cover.png';
          }}
        />
        
        {/* Play Button Overlay */}
        {playSong && song.audio_cid && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              playSong(song);
            }}
            className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-neon-green hover:bg-neon-green/80 active:bg-neon-green/70 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-2xl shadow-neon-green/50 z-20 opacity-0 group-hover:opacity-100"
          >
            {isThisSongPlaying ? (
              <Pause className="w-6 h-6 text-black fill-black" />
            ) : (
              <Play className="w-6 h-6 text-black fill-black ml-0.5" />
            )}
          </button>
        )}

        {/* AI Badge */}
        {song.ai_usage && song.ai_usage !== 'none' && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-purple-500/80 backdrop-blur-sm text-white text-xs font-mono font-bold border border-purple-400/50">
            AI
          </div>
        )}
      </div>

      {/* Song Info */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-mono font-bold text-base text-foreground truncate group-hover:text-neon-green transition-colors">
            {song.title}
          </h3>
          <p className="text-sm text-muted-foreground font-mono truncate">
            {song.artist || "Unknown Artist"}
          </p>
        </div>

        {/* Stats */}
        <div className="space-y-2 text-xs font-mono">
          {song.ticker && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ticker:</span>
              <span className="text-neon-green font-semibold">${song.ticker}</span>
            </div>
          )}
          
          {priceUSD > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Price:</span>
              <span className="text-neon-green font-semibold">
                ${priceUSD < 0.000001 ? priceUSD.toFixed(10) : priceUSD < 0.01 ? priceUSD.toFixed(8) : priceUSD.toFixed(6)}
              </span>
            </div>
          )}

          {marketCap > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Market Cap:</span>
              <span className="text-neon-green font-semibold">
                ${marketCap < 1 ? marketCap.toFixed(6) : marketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Plays:</span>
            <span className="flex items-center gap-1 text-foreground">
              <TrendingUp className="w-3 h-3" />
              {song.play_count?.toLocaleString() || 0}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default Genre;

