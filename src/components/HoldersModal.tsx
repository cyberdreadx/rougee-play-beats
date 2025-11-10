import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { CheckCircle, Loader2 } from "lucide-react";
import { getIPFSGatewayUrl } from "@/lib/ipfs";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Holder {
  wallet_address: string;
  artist_name?: string | null;
  avatar_cid?: string | null;
  verified?: boolean | null;
}

interface SongHolding {
  id: string;
  title: string;
  artist: string;
  cover_cid?: string | null;
}

interface HoldersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddresses: string[];
  title: string;
}

export function HoldersModal({ open, onOpenChange, walletAddresses, title }: HoldersModalProps) {
  const navigate = useNavigate();
  const [holders, setHolders] = useState<Holder[]>([]);
  const [songHoldings, setSongHoldings] = useState<SongHolding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHolders = async () => {
      if (!open || walletAddresses.length === 0) return;

      setLoading(true);
      try {
        // Separate artist addresses from song IDs
        const artistAddresses = walletAddresses.filter(addr => !addr.startsWith('song_'));
        const songIds = walletAddresses
          .filter(addr => addr.startsWith('song_'))
          .map(addr => addr.replace('song_', ''));

        // Fetch artist profiles
        let holdersData: Holder[] = [];
        if (artistAddresses.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('wallet_address, artist_name, avatar_cid, verified')
            .in('wallet_address', artistAddresses);

          if (error) throw error;

          // Create map of fetched profiles
          const profileMap = new Map(
            data?.map(p => [p.wallet_address?.toLowerCase(), p]) || []
          );

          // Ensure all wallet addresses are represented
          holdersData = artistAddresses.map(address => ({
            wallet_address: address,
            ...(profileMap.get(address.toLowerCase()) || {})
          }));
        }

        // Fetch song data
        let songsData: SongHolding[] = [];
        if (songIds.length > 0) {
          const { data: songs, error: songsError } = await supabase
            .from('songs')
            .select('id, title, artist, cover_cid')
            .in('id', songIds);

          if (songsError) throw songsError;
          songsData = songs || [];
        }

        setHolders(holdersData);
        setSongHoldings(songsData);
      } catch (error) {
        console.error('Error fetching holders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHolders();
  }, [open, walletAddresses]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="console-bg tech-border max-w-md max-h-[80vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-mono text-neon-green">{title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-neon-green" />
          </div>
        ) : holders.length === 0 && songHoldings.length === 0 ? (
          <p className="font-mono text-muted-foreground text-center py-8">No {title.toLowerCase()} found</p>
        ) : (
          <div className="space-y-3">
            {/* Artists Section */}
            {holders.length > 0 && (
              <>
                <div className="text-sm font-mono text-neon-green font-semibold border-b border-neon-green/20 pb-2">
                  ARTISTS ({holders.length})
                </div>
                {holders.map((holder) => (
                  <div
                    key={holder.wallet_address}
                    className="flex items-center gap-3 p-3 rounded tech-border hover:border-neon-green transition-colors cursor-pointer"
                    onClick={() => {
                      navigate(`/artist/${holder.wallet_address}`);
                      onOpenChange(false);
                    }}
                  >
                    {holder.avatar_cid ? (
                      <img
                        src={getIPFSGatewayUrl(holder.avatar_cid)}
                        alt={holder.artist_name || 'User'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary text-sm font-mono">
                          {holder.artist_name?.[0] || holder.wallet_address.slice(2, 4).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold flex items-center gap-1 truncate">
                        <span className="truncate">{holder.artist_name || `${holder.wallet_address.slice(0, 6)}...${holder.wallet_address.slice(-4)}`}</span>
                        {holder.verified && (
                          <CheckCircle className="h-3 w-3 text-neon-green flex-shrink-0" aria-label="Verified" />
                        )}
                      </p>
                      <button
                        className="text-xs font-mono text-muted-foreground hover:text-neon-green transition-colors truncate text-left block w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(holder.wallet_address);
                          toast({ title: "Address copied!", description: holder.wallet_address });
                        }}
                      >
                        {holder.wallet_address}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Songs Section */}
            {songHoldings.length > 0 && (
              <>
                {holders.length > 0 && <div className="border-t border-neon-green/20 pt-3 mt-3"></div>}
                <div className="text-sm font-mono text-neon-green font-semibold border-b border-neon-green/20 pb-2">
                  SONGS ({songHoldings.length})
                </div>
                {songHoldings.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-3 rounded tech-border hover:border-neon-green transition-colors cursor-pointer"
                    onClick={() => {
                      navigate(`/song/${song.id}`);
                      onOpenChange(false);
                    }}
                  >
                    {song.cover_cid ? (
                      <img
                        src={getIPFSGatewayUrl(song.cover_cid)}
                        alt={song.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
                        <span className="text-primary text-sm font-mono">
                          {song.title.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold truncate">
                        {song.title}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        by {song.artist}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
