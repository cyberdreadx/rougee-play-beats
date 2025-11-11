import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Music, TrendingUp, Loader2, Play, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIPFSGatewayUrl } from "@/lib/ipfs";

interface GenreData {
  genre: string;
  count: number;
  topSongCover?: string | null; // Cover CID of top song
}

interface GenresListProps {
  playSong?: (song: any, playlist?: any[]) => void;
}

const GenresList = ({ playSong }: GenresListProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [genres, setGenres] = useState<GenreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGenres();
  }, []);

  const fetchGenres = async () => {
    try {
      setLoading(true);
      
      // Fetch all songs with genres, ordered by play_count to get top songs
      const { data: songs, error } = await supabase
        .from("songs")
        .select("genre, cover_cid, play_count")
        .not("genre", "is", null)
        .not("token_address", "is", null) // Only count deployed songs
        .order("play_count", { ascending: false }); // Order by play count to get top songs

      if (error) throw error;

      // Count occurrences of each genre and track top song's cover
      const genreCounts: { [key: string]: number } = {};
      const genreDisplayNames: { [key: string]: string } = {}; // Store original display name
      const genreTopSongs: { [key: string]: { cover_cid: string | null, play_count: number } } = {};
      
      songs?.forEach((song) => {
        if (song.genre) {
          // Normalize for counting (lowercase + trim)
          const normalizedGenre = song.genre.toLowerCase().trim();
          const originalGenre = song.genre.trim();
          
          // Count by normalized genre
          genreCounts[normalizedGenre] = (genreCounts[normalizedGenre] || 0) + 1;
          
          // Store the most common display name (first one encountered, or keep existing)
          if (!genreDisplayNames[normalizedGenre]) {
            genreDisplayNames[normalizedGenre] = originalGenre;
          }
          
          // Track top song (highest play_count) for each genre
          if (!genreTopSongs[normalizedGenre] || 
              (song.play_count || 0) > (genreTopSongs[normalizedGenre].play_count || 0)) {
            genreTopSongs[normalizedGenre] = {
              cover_cid: song.cover_cid,
              play_count: song.play_count || 0
            };
          }
        }
      });

      // Convert to array with normalized counting but original display names
      const genresArray = Object.entries(genreCounts)
        .map(([normalizedGenre, count]) => ({ 
          genre: genreDisplayNames[normalizedGenre] || normalizedGenre, // Use original display name
          count,
          topSongCover: genreTopSongs[normalizedGenre]?.cover_cid || null
        }))
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
      
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
        .not("genre", "is", null)
        .not("token_address", "is", null) // Only show deployed songs
        .order("play_count", { ascending: false });

      if (error) throw error;

      // Filter songs by genre with case-insensitive matching and whitespace normalization
      const normalizedSearchGenre = genre.toLowerCase().trim();
      const songs = (data || []).filter((song) => {
        if (!song.genre) return false;
        const normalizedSongGenre = song.genre.toLowerCase().trim();
        return normalizedSongGenre === normalizedSearchGenre;
      });

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
      
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist, wallet_address, audio_cid, cover_cid, play_count, ticker, genre, created_at, token_address, ai_usage")
        .not("genre", "is", null)
        .not("token_address", "is", null) // Only show deployed songs
        .order("play_count", { ascending: false });

      if (error) throw error;

      // Filter songs by genre with case-insensitive matching and whitespace normalization
      const normalizedSearchGenre = genre.toLowerCase().trim();
      const songs = (data || []).filter((song) => {
        if (!song.genre) return false;
        const normalizedSongGenre = song.genre.toLowerCase().trim();
        return normalizedSongGenre === normalizedSearchGenre;
      });

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
            {t('discover.noGenres')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-4">
      <div className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold font-mono text-neon-green mb-2">
          🎵 {t('discover.exploreGenres').toUpperCase()}
        </h2>
        <p className="text-sm text-muted-foreground font-mono">
          {t('discover.exploreGenres')} • {genres.length} {t('discover.genresAvailable')}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {genres.map((genreData, index) => (
          <Card
            key={genreData.genre}
            onClick={() => handleGenreClick(genreData.genre)}
            className="group relative aspect-square cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 hover:border-neon-green/50 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
          >
            {/* Background - Top Song Artwork or Gradient */}
            {genreData.topSongCover ? (
              <>
                <img
                  src={getIPFSGatewayUrl(genreData.topSongCover)}
                  alt={`Top song in ${genreData.genre}`}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    // Hide image if it fails to load, show gradient fallback
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-neon-green/20 via-purple-500/20 to-neon-green/10" />
            )}

            {/* Ranking Badge */}
            {index < 3 && (
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-neon-green/20 backdrop-blur-sm flex items-center justify-center border-2 border-neon-green/50 z-10">
                <span className="text-sm font-bold text-neon-green">
                  {index + 1}
                </span>
              </div>
            )}

            {/* Content - Stacked vertically */}
            <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-6 z-10">
              {/* Top section - Genre name */}
              <div className="flex-1 flex items-start">
                <div>
                  {!genreData.topSongCover && (
                    <div className="mb-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-green/30 to-purple-500/30 flex items-center justify-center backdrop-blur-sm border border-neon-green/50">
                        <Music className="w-6 h-6 text-neon-green" />
                      </div>
                    </div>
                  )}
                  <h3 className="font-mono font-bold text-lg md:text-xl text-foreground capitalize group-hover:text-neon-green transition-colors mb-1">
                    {genreData.genre}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
                    <TrendingUp className="w-4 h-4" />
                    <span>
                      {genreData.count} {genreData.count === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom section - Play Buttons */}
              {playSong && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="neon"
                      onClick={(e) => handlePlayAll(genreData.genre, e)}
                      className="flex-1 h-8 text-xs font-mono"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      {t('common.play')}
                    </Button>
                    {genreData.count > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleShufflePlay(genreData.genre, e)}
                        className="h-8 w-8 p-0 font-mono border-neon-green/50 text-neon-green hover:bg-neon-green/10"
                      >
                        <Shuffle className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Hover indicator */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-neon-green/30 rounded-lg pointer-events-none transition-all z-0" />
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GenresList;

