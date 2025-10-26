import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Music, TrendingUp, Loader2, Play, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenreData {
  genre: string;
  count: number;
}

interface GenresListProps {
  playSong?: (song: any, playlist?: any[]) => void;
}

const GenresList = ({ playSong }: GenresListProps) => {
  const navigate = useNavigate();
  const [genres, setGenres] = useState<GenreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGenres();
  }, []);

  const fetchGenres = async () => {
    try {
      setLoading(true);
      
      // Fetch all songs with genres
      const { data: songs, error } = await supabase
        .from("songs")
        .select("genre")
        .not("genre", "is", null)
        .not("token_address", "is", null); // Only count deployed songs

      if (error) throw error;

      // Count occurrences of each genre
      const genreCounts: { [key: string]: number } = {};
      songs?.forEach((song) => {
        if (song.genre) {
          const genre = song.genre.trim();
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      });

      // Convert to array and sort by count
      const genresArray = Object.entries(genreCounts)
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count);

      setGenres(genresArray);
    } catch (error) {
      console.error("Error fetching genres:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreClick = (genre: string) => {
    // Navigate to dedicated genre page
    navigate(`/genre/${encodeURIComponent(genre)}`);
  };

  const handlePlayAll = async (genre: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation to genre page
    
    if (!playSong) return;
    
    try {
      console.log('🎵 Fetching all songs for genre:', genre);
      
      const { data: songs, error } = await supabase
        .from("songs")
        .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
        .eq("genre", genre)
        .not("token_address", "is", null) // Only show deployed songs
        .order("play_count", { ascending: false });

      if (error) throw error;

      if (songs && songs.length > 0) {
        console.log('🎵 Playing all songs in genre:', genre, 'Count:', songs.length);
        playSong(songs[0], songs);
      }
    } catch (error) {
      console.error('Error fetching genre songs for playback:', error);
    }
  };

  const handleShufflePlay = async (genre: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation to genre page
    
    if (!playSong) return;
    
    try {
      console.log('🎵 Fetching all songs for shuffle play in genre:', genre);
      
      const { data: songs, error } = await supabase
        .from("songs")
        .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
        .eq("genre", genre)
        .not("token_address", "is", null) // Only show deployed songs
        .order("play_count", { ascending: false });

      if (error) throw error;

      if (songs && songs.length > 0) {
        // Shuffle the songs array
        const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);
        console.log('🎵 Shuffle playing all songs in genre:', genre, 'Count:', shuffledSongs.length);
        playSong(shuffledSongs[0], shuffledSongs);
      }
    } catch (error) {
      console.error('Error fetching genre songs for shuffle play:', error);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
        </div>
      </div>
    );
  }

  if (genres.length === 0) {
    return (
      <div className="w-full px-4 py-8">
        <Card className="p-6 text-center">
          <Music className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground font-mono">
            No genres found yet
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-4">
      <div className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold font-mono text-neon-green mb-2">
          🎵 EXPLORE GENRES
        </h2>
        <p className="text-sm text-muted-foreground font-mono">
          Discover music by genre • {genres.length} genres available
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {genres.map((genreData, index) => (
          <Card
            key={genreData.genre}
            onClick={() => handleGenreClick(genreData.genre)}
            className="group relative p-4 cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 hover:border-neon-green/50 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            {/* Ranking Badge */}
            {index < 3 && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-neon-green/20 flex items-center justify-center border border-neon-green/50">
                <span className="text-xs font-bold text-neon-green">
                  {index + 1}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-green/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Music className="w-6 h-6 text-neon-green" />
              </div>

              {/* Genre Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-mono font-bold text-base text-foreground truncate capitalize group-hover:text-neon-green transition-colors">
                  {genreData.genre}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <TrendingUp className="w-3 h-3" />
                  <span>
                    {genreData.count} {genreData.count === 1 ? 'song' : 'songs'}
                  </span>
                </div>
              </div>
            </div>

            {/* Play Buttons - Show on hover */}
            {playSong && (
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="neon"
                    onClick={(e) => handlePlayAll(genreData.genre, e)}
                    className="h-7 px-2 text-xs font-mono"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Play
                  </Button>
                  {genreData.count > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleShufflePlay(genreData.genre, e)}
                      className="h-7 px-2 text-xs font-mono border-neon-green/50 text-neon-green hover:bg-neon-green/10"
                    >
                      <Shuffle className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Hover indicator */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-neon-green/30 rounded-lg pointer-events-none transition-all" />
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GenresList;

