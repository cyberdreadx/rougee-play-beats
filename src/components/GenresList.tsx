import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Music, TrendingUp, Loader2 } from "lucide-react";

interface GenreData {
  genre: string;
  count: number;
}

const GenresList = () => {
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

            {/* Hover indicator */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-neon-green/30 rounded-lg pointer-events-none transition-all" />
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GenresList;

