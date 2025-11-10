import { Flame, Music, TrendingUp, BarChart3, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TrendingSongRow from "./TrendingSongRow";
import TrendingSongCard from "./TrendingSongCard";
import { SongRowSkeleton } from "./TrendingSongRowSkeleton";
import { SongCardSkeleton } from "./TrendingSongCardSkeleton";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  wallet_address: string;
  audio_cid: string;
  cover_cid: string | null;
  play_count: number;
  token_address?: string | null;
  ticker: string | null;
  ai_usage?: 'none' | 'partial' | 'full' | null;
}

type SortField = 'trending' | 'price' | 'change' | 'volume' | 'marketCap' | 'plays';
type SortDirection = 'asc' | 'desc';

interface TrendingSongsTableProps {
  songs: Song[];
  displayedSongs: Song[];
  loading: boolean;
  searchQuery: string | null;
  sortField: SortField;
  sortDirection: SortDirection;
  displayLimit: number | null;
  visibleCount: number;
  sortedSongs: Song[];
  onSort: (field: SortField) => void;
  onDisplayLimitChange: (limit: number | null) => void;
  onStatsUpdate: (songId: string, volume: number, change: number, marketCap: number, price: number) => void;
  playSong?: (song: any) => void;
  currentSong?: any;
  isPlaying?: boolean;
}

const TrendingSongsTable = ({
  songs,
  displayedSongs,
  loading,
  searchQuery,
  sortField,
  sortDirection,
  displayLimit,
  visibleCount,
  sortedSongs,
  onSort,
  onDisplayLimitChange,
  onStatsUpdate,
  playSong,
  currentSong,
  isPlaying,
}: TrendingSongsTableProps) => {
  return (
    <div className="space-y-4">
      {/* Enhanced Sort & Filter Controls */}
      <div className="flex flex-col gap-3 md:gap-4 mb-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 md:p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] md:text-xs text-muted-foreground font-mono flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            SORT BY:
          </span>
          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
            {[
              { field: 'trending' as SortField, label: '🔥 TRENDING', icon: Flame },
              { field: 'price' as SortField, label: 'PRICE', icon: TrendingUp },
              { field: 'change' as SortField, label: '24H%', icon: TrendingUp },
              { field: 'volume' as SortField, label: 'VOLUME', icon: BarChart3 },
              { field: 'plays' as SortField, label: 'PLAYS', icon: Music },
            ].map(({ field, label, icon: Icon }) => (
              <button
                key={field}
                onClick={() => onSort(field)}
                className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-mono transition-all flex items-center gap-1 ${
                  sortField === field 
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-[0_0_8px_rgba(0,255,159,0.3)]' 
                    : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30 hover:text-neon-green'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label} {sortField === field && (sortDirection === 'desc' ? '↓' : '↑')}
              </button>
            ))}
          </div>
        </div>
        
        {/* Display Limit Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] md:text-xs text-muted-foreground font-mono flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            SHOW:
          </span>
          {[10, 20, 50].map((limit) => (
            <button
              key={limit}
              onClick={() => onDisplayLimitChange(limit)}
              className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-mono transition-all ${
                displayLimit === limit
                  ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-[0_0_8px_rgba(0,255,159,0.3)]' 
                  : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30 hover:text-neon-green'
              }`}
            >
              TOP {limit}
            </button>
          ))}
          <button
            onClick={() => onDisplayLimitChange(null)}
            className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-mono transition-all ${
              displayLimit === null
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-[0_0_8px_rgba(0,255,159,0.3)]' 
                : 'bg-background/50 text-muted-foreground border border-border hover:border-neon-green/30 hover:text-neon-green'
            }`}
          >
            ALL
          </button>
        </div>
      </div>
      
      {/* Enhanced Desktop Table View */}
      <div className="hidden md:block md:rounded-xl border border-white/20 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,255,159,0.1)]">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="font-mono text-muted-foreground w-12">#</TableHead>
              <TableHead className="font-mono text-muted-foreground">NAME</TableHead>
              <TableHead className="font-mono text-muted-foreground text-center w-32">CHART</TableHead>
              <TableHead className="font-mono text-muted-foreground text-center w-32">WAVEFORM</TableHead>
              <TableHead 
                className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                onClick={() => onSort('price')}
              >
                <div className="flex items-center justify-end gap-1">
                  PRICE
                  {sortField === 'price' && (
                    <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                onClick={() => onSort('change')}
              >
                <div className="flex items-center justify-end gap-1">
                  24H%
                  {sortField === 'change' && (
                    <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                onClick={() => onSort('volume')}
              >
                <div className="flex items-center justify-end gap-1">
                  VOLUME
                  {sortField === 'volume' && (
                    <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                onClick={() => onSort('marketCap')}
              >
                <div className="flex items-center justify-end gap-1">
                  MKT CAP
                  {sortField === 'marketCap' && (
                    <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="font-mono text-muted-foreground text-right cursor-pointer hover:text-neon-green transition-colors select-none"
                onClick={() => onSort('plays')}
              >
                <div className="flex items-center justify-end gap-1">
                  PLAYS
                  {sortField === 'plays' && (
                    <span className="text-neon-green">{sortDirection === 'desc' ? '↓' : '↑'}</span>
                  )}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <>
                {[...Array(10)].map((_, i) => (
                  <SongRowSkeleton key={`skeleton-row-${i}`} />
                ))}
              </>
            ) : displayedSongs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Music className="w-12 h-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground font-mono">
                      {searchQuery ? 'No songs found matching your search' : 'No deployed songs yet'}
                    </p>
                    {searchQuery && (
                      <p className="text-xs text-muted-foreground/70 font-mono">
                        Try a different search term
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {displayedSongs.map((song, index) => (
                  <TrendingSongRow 
                    key={song.id} 
                    song={song} 
                    index={index} 
                    onStatsUpdate={onStatsUpdate}
                    playSong={playSong}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                  />
                ))}
                {/* Loading indicator for infinite scroll */}
                {!loading && visibleCount < (displayLimit ? Math.min(sortedSongs.length, displayLimit) : sortedSongs.length) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground font-mono text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading more songs...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Mobile Card View */}
      <div className="md:hidden space-y-1.5">
        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <SongCardSkeleton key={`skeleton-card-${i}`} />
            ))}
          </>
        ) : displayedSongs.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Music className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-muted-foreground font-mono">
                {searchQuery ? 'No songs found matching your search' : 'No deployed songs yet'}
              </p>
              {searchQuery && (
                <p className="text-xs text-muted-foreground/70 font-mono">
                  Try a different search term
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {displayedSongs.map((song, index) => (
              <TrendingSongCard 
                key={song.id} 
                song={song}
                index={index}
                onStatsUpdate={onStatsUpdate}
                playSong={playSong}
                currentSong={currentSong}
                isPlaying={isPlaying}
              />
            ))}
            {/* Loading indicator for infinite scroll */}
            {!loading && visibleCount < (displayLimit ? Math.min(sortedSongs.length, displayLimit) : sortedSongs.length) && (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground font-mono text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TrendingSongsTable;

