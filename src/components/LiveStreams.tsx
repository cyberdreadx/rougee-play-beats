import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Radio } from 'lucide-react';
import { getIPFSGatewayUrl } from '@/lib/ipfs';

interface LiveStream {
  id: string;
  artist_id: string;
  channel_name: string;
  title: string;
  description: string | null;
  is_live: boolean;
  viewer_count: number;
  started_at: string;
  thumbnail_cid: string | null;
}

interface LiveStreamsProps {
  className?: string;
  limit?: number;
}

export default function LiveStreams({ className = '', limit = 6 }: LiveStreamsProps) {
  const navigate = useNavigate();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [artists, setArtists] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveStreams();

    // Subscribe to live stream changes
    const channel = supabase
      .channel('live-streams-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_streams'
      }, () => {
        fetchLiveStreams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit]);

  const fetchLiveStreams = async () => {
    try {
      const { data: streamsData, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('is_live', true)
        .order('viewer_count', { ascending: false })
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      setStreams(streamsData || []);

      // Fetch artist profiles
      if (streamsData && streamsData.length > 0) {
        const artistIds = [...new Set(streamsData.map(s => s.artist_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('wallet_address', artistIds);

        if (profilesData) {
          const artistsMap: Record<string, any> = {};
          profilesData.forEach(profile => {
            artistsMap[profile.wallet_address] = profile;
          });
          setArtists(artistsMap);
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch live streams:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`${className} space-y-4`}>
        <h2 className="text-2xl font-mono font-bold neon-text flex items-center gap-2">
          <Radio className="h-6 w-6 text-red-500" />
          LIVE NOW
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="console-bg tech-border animate-pulse">
              <div className="aspect-video bg-white/5 rounded-t-lg" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/5 rounded" />
                <div className="h-3 bg-white/5 rounded w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (streams.length === 0) {
    return null; // Don't show section if no live streams
  }

  return (
    <div className={`${className} space-y-4`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-mono font-bold neon-text flex items-center gap-2">
          <Radio className="h-6 w-6 text-red-500" />
          LIVE NOW
        </h2>
        {streams.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/discover')}
            className="font-mono text-neon-green hover:text-neon-green"
          >
            VIEW ALL
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {streams.map((stream) => {
          const artist = artists[stream.artist_id];
          return (
            <Card
              key={stream.id}
              className="console-bg tech-border overflow-hidden hover:border-neon-green/50 transition-all cursor-pointer group"
              onClick={() => navigate(`/stream/${stream.id}`)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-black">
                {stream.thumbnail_cid || artist?.cover_cid ? (
                  <img
                    src={getIPFSGatewayUrl(stream.thumbnail_cid || artist.cover_cid)}
                    alt={stream.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black to-gray-900">
                    <Radio className="h-16 w-16 text-neon-green/20" />
                  </div>
                )}
                
                {/* Live Badge */}
                <div className="absolute top-2 left-2 bg-red-500 px-2 py-1 rounded flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="font-mono text-white font-bold text-xs">LIVE</span>
                </div>

                {/* Viewer Count */}
                <div className="absolute top-2 right-2 console-bg tech-border px-2 py-1 rounded flex items-center gap-1">
                  <Eye className="h-3 w-3 text-neon-green" />
                  <span className="font-mono text-xs">{stream.viewer_count || 0}</span>
                </div>

                {/* Play Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-center">
                    <Radio className="h-12 w-12 text-white mx-auto mb-2" />
                    <p className="font-mono text-white text-sm">WATCH LIVE</p>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-2">
                <h3 className="font-mono font-bold text-sm truncate group-hover:text-neon-green transition-colors">
                  {stream.title}
                </h3>
                <div className="flex items-center gap-2">
                  {artist?.avatar_cid && (
                    <img
                      src={getIPFSGatewayUrl(artist.avatar_cid)}
                      alt={artist.artist_name}
                      className="h-6 w-6 rounded-full object-cover tech-border"
                    />
                  )}
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {artist?.artist_name || `${stream.artist_id.slice(0, 6)}...${stream.artist_id.slice(-4)}`}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

