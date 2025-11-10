import { useNavigate } from "react-router-dom";
import { Flame, Music } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArtistRowSkeleton } from "./TrendingArtistRowSkeleton";

interface Artist {
  wallet_address: string;
  artist_name: string;
  artist_ticker: string | null;
  avatar_cid: string | null;
  total_songs: number;
  total_plays: number;
  verified: boolean;
}

interface TrendingArtistsTableProps {
  artists: Artist[];
  loading: boolean;
  searchQuery: string | null;
  displayLimit: number | null;
  onDisplayLimitChange: (limit: number | null) => void;
}

const TrendingArtistsTable = ({
  artists,
  loading,
  searchQuery,
  displayLimit,
  onDisplayLimitChange,
}: TrendingArtistsTableProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Display Limit Filter for Artists */}
      <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
        <span className="text-xs text-muted-foreground font-mono">SHOW:</span>
        <button
          onClick={() => onDisplayLimitChange(10)}
          className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
            displayLimit === 10
              ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
              : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
          }`}
        >
          TOP 10
        </button>
        <button
          onClick={() => onDisplayLimitChange(20)}
          className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
            displayLimit === 20
              ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
              : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
          }`}
        >
          TOP 20
        </button>
        <button
          onClick={() => onDisplayLimitChange(50)}
          className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
            displayLimit === 50
              ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
              : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
          }`}
        >
          TOP 50
        </button>
        <button
          onClick={() => onDisplayLimitChange(null)}
          className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
            displayLimit === null
              ? 'bg-neon-green/20 text-neon-green border border-neon-green/50' 
              : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30'
          }`}
        >
          ALL
        </button>
      </div>
      
      <div className="md:rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="font-mono text-muted-foreground w-8 md:w-12 text-xs md:text-sm px-2 md:px-4">#</TableHead>
              <TableHead className="font-mono text-muted-foreground text-xs md:text-sm px-2 md:px-4">ARTIST</TableHead>
              <TableHead className="font-mono text-muted-foreground text-xs md:text-sm px-2 md:px-4 hidden md:table-cell">TICKER</TableHead>
              <TableHead className="font-mono text-muted-foreground text-right text-xs md:text-sm px-2 md:px-4">SONGS</TableHead>
              <TableHead className="font-mono text-muted-foreground text-right text-xs md:text-sm px-2 md:px-4">PLAYS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <>
                {[...Array(10)].map((_, i) => (
                  <ArtistRowSkeleton key={`skeleton-artist-${i}`} />
                ))}
              </>
            ) : artists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Music className="w-12 h-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground font-mono">
                      {searchQuery ? 'No artists found matching your search' : 'No artists yet'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              artists.slice(0, displayLimit || undefined).map((artist, index) => (
                <TableRow
                  key={artist.wallet_address}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/artist/${artist.wallet_address}`)}
                >
                  <TableCell className="font-mono text-muted-foreground text-xs md:text-sm px-2 md:px-4">
                    #{index + 1}
                  </TableCell>
                  <TableCell className="px-2 md:px-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      {artist.avatar_cid ? (
                        <img
                          src={getIPFSGatewayUrl(artist.avatar_cid)}
                          alt={artist.artist_name}
                          className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-neon-green/10 flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-neon-green text-xs md:text-base">
                            {artist.artist_name[0]}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs md:text-sm truncate">{artist.artist_name}</div>
                        {/* Show ticker on mobile under name */}
                        {artist.artist_ticker && (
                          <div className="md:hidden text-[10px] font-mono text-neon-green">
                            ${artist.artist_ticker}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 md:px-4 hidden md:table-cell">
                    {artist.artist_ticker && (
                      <span className="text-xs font-mono text-neon-green">
                        ${artist.artist_ticker}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-right text-xs md:text-sm px-2 md:px-4">
                    {artist.total_songs}
                  </TableCell>
                  <TableCell className="font-mono text-right text-xs md:text-sm px-2 md:px-4">
                    <Flame className="w-3 h-3 md:w-4 md:h-4 inline mr-1 text-orange-500" />
                    {artist.total_plays}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TrendingArtistsTable;

