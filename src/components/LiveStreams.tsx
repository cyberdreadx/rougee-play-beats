import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye, Radio } from 'lucide-react';
import { getIPFSGatewayUrl } from '@/lib/ipfs';
import { useAgoraStream } from '@/hooks/useAgoraStream';

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

  const fetchLiveStreams = useCallback(async () => {
    try {
      // Get all streams marked as live
      const { data: streamsData, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('is_live', true)
        .order('viewer_count', { ascending: false })
        .order('started_at', { ascending: false })
        .limit(limit * 2); // Get more to filter

      if (error) throw error;

      // Check which streams are actually active
      const activeStreams: any[] = [];
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      for (const stream of streamsData || []) {
        // Check if stream has active viewers
        const { data: activeViewers } = await supabase
          .from('live_stream_viewers')
          .select('id')
          .eq('stream_id', stream.id)
          .eq('is_watching', true)
          .limit(1);

        const hasActiveViewers = (activeViewers?.length || 0) > 0;
        const recentlyUpdated = new Date(stream.updated_at) > new Date(fiveMinutesAgo);
        const updatedWithin10Min = new Date(stream.updated_at) > new Date(tenMinutesAgo);

        // Stream is active if:
        // 1. Has active viewers, OR
        // 2. Was updated in the last 5 minutes (heartbeat), OR
        // 3. Was updated in the last 10 minutes (recently started)
        if (hasActiveViewers || recentlyUpdated || updatedWithin10Min) {
          activeStreams.push(stream);
        } else {
          // Mark inactive streams as not live
          await supabase
            .from('live_streams')
            .update({ 
              is_live: false,
              ended_at: new Date().toISOString()
            })
            .eq('id', stream.id);
        }
      }

      // Limit to requested number
      const limitedStreams = activeStreams.slice(0, limit);
      setStreams(limitedStreams);

      // Fetch artist profiles
      if (limitedStreams && limitedStreams.length > 0) {
        const artistIds = [...new Set(limitedStreams.map(s => s.artist_id))];
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
  }, [limit]);

  useEffect(() => {
    // Clean up old streams that are still marked as live
    const cleanupOldStreams = async () => {
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        // Mark streams older than 24 hours as not live
        await supabase
          .from('live_streams')
          .update({ 
            is_live: false,
            ended_at: new Date().toISOString()
          })
          .eq('is_live', true)
          .lt('started_at', twentyFourHoursAgo);
      } catch (error) {
        console.error('❌ Failed to cleanup old streams:', error);
        // Don't block if cleanup fails
      }
    };

    cleanupOldStreams();
    fetchLiveStreams();

    // Subscribe to live stream changes for real-time updates
    const channel = supabase
      .channel('live-streams-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_streams'
      }, (payload) => {
        console.log('📡 Live stream update:', payload);
        // Update viewer count in real-time
        if (payload.eventType === 'UPDATE' && payload.new) {
          setStreams(prev => prev.map(stream => 
            stream.id === payload.new.id 
              ? { 
                  ...stream, 
                  viewer_count: payload.new.viewer_count !== undefined ? payload.new.viewer_count : stream.viewer_count, 
                  is_live: payload.new.is_live !== undefined ? payload.new.is_live : stream.is_live,
                  updated_at: payload.new.updated_at || stream.updated_at
                }
              : stream
          ));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          // New stream added - refetch to get full data
          fetchLiveStreams();
        } else if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && payload.new?.is_live === false)) {
          // Stream ended - remove from list
          setStreams(prev => prev.filter(stream => stream.id !== (payload.old?.id || payload.new?.id)));
        } else {
          // Other changes - refetch
          fetchLiveStreams();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_viewers'
      }, (payload) => {
        console.log('👁️ Viewer update:', payload);
        // Viewer count changes trigger updates to live_streams via database trigger
        // The trigger will update viewer_count, which will trigger the live_streams subscription above
        // But we can also directly update if we know the stream_id
        if (payload.new?.stream_id) {
          // The database trigger will update the live_streams table, which will trigger the subscription above
          // So we just need to wait for that update
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLiveStreams]);

  if (loading) {
    return (
      <div className={`${className} w-full overflow-x-auto pb-4 mb-0`}>
        <div className="flex gap-4 px-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-white/5" />
              <div className="h-3 w-16 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (streams.length === 0) {
    return null; // Don't show section if no live streams
  }

  return (
    <div className={`${className} w-full`}>
      <div className="flex items-center gap-2 mb-3 px-4">
        <Radio className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-mono font-bold neon-text">LIVE STREAMS</h2>
      </div>
      <div className="w-full overflow-x-auto pb-4 mb-0">
        <div className="flex gap-4 px-4">
        {streams.map((stream) => {
          const artist = artists[stream.artist_id];
          return (
            <LiveStreamPreview
              key={stream.id}
              stream={stream}
              artist={artist}
              onClick={() => navigate(`/stream/${stream.id}`)}
            />
          );
        })}
        </div>
      </div>
    </div>
  );
}

// Small preview component for each live stream
function LiveStreamPreview({ stream, artist, onClick }: { stream: LiveStream; artist?: any; onClick: () => void }) {
  const videoRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    remoteUsers,
    join,
    leave,
    isJoined
  } = useAgoraStream({
    channelName: stream.channel_name,
    userId: `preview-${stream.id}-${Date.now()}`,
    role: 'audience',
    autoJoin: false
  });

  // Join channel on hover with delay to avoid too many simultaneous connections
  useEffect(() => {
    if (isHovered && stream.channel_name && !isJoined && !isConnecting) {
      // Wait 500ms before joining to avoid joining on accidental hovers
      hoverTimeoutRef.current = setTimeout(async () => {
        try {
          setIsConnecting(true);
          await join(stream.channel_name, `preview-${stream.id}-${Date.now()}`);
        } catch (error: any) {
          // Silently fail for preview connections - don't show errors to users
          // Common errors: invalid App ID, connection issues, etc.
          // Just show thumbnail instead of video preview
          if (error?.message?.includes('invalid vendor key') || 
              error?.message?.includes('CAN_NOT_GET_GATEWAY_SERVER') ||
              error?.message?.includes('can not find appid')) {
            // App ID not configured - this is expected if not set up yet
            console.debug('🔇 Preview connection skipped (App ID not configured)');
          } else {
            console.debug('🔇 Preview connection failed:', error?.message || error);
          }
        } finally {
          setIsConnecting(false);
        }
      }, 500);
    } else if (!isHovered && isJoined) {
      // Leave immediately when not hovered
      try {
        leave();
      } catch (error) {
        // Silently fail on leave - not critical
        console.debug('🔇 Failed to leave preview channel:', error);
      }
    }
    
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (isJoined) {
        try {
          leave();
        } catch (error) {
          // Ignore errors on cleanup
        }
      }
    };
  }, [isHovered, stream.channel_name, stream.id, join, leave, isJoined, isConnecting]);

  // Play remote video when available
  useEffect(() => {
    if (remoteUsers.length > 0 && videoRef.current) {
      const remoteUser = remoteUsers[0];
      if (remoteUser.videoTrack) {
        try {
          remoteUser.videoTrack.play(videoRef.current);
        } catch (error) {
          // Silently fail - just show thumbnail instead
          console.debug('🔇 Failed to play preview video:', error);
        }
      }
    }
  }, [remoteUsers]);

  return (
    <div
      className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-16 h-16">
        <div className="w-full h-full rounded-full p-[2px] bg-gradient-to-tr from-red-500 via-red-500 to-red-500">
          <div className="w-full h-full rounded-full bg-background p-[2px]">
            <div className="w-full h-full rounded-full overflow-hidden relative">
              {/* Video preview or fallback */}
              {isHovered && remoteUsers.length > 0 ? (
                <div ref={videoRef} className="w-full h-full rounded-full overflow-hidden" style={{ objectFit: 'cover' }} />
              ) : stream.thumbnail_cid || artist?.cover_cid ? (
                <img
                  src={getIPFSGatewayUrl(stream.thumbnail_cid || artist.cover_cid)}
                  alt={stream.title}
                  className="w-full h-full object-cover"
                />
              ) : artist?.avatar_cid ? (
                <img
                  src={getIPFSGatewayUrl(artist.avatar_cid)}
                  alt={artist.artist_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Avatar className="w-full h-full">
                  <AvatarImage src={undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {artist?.artist_name?.[0]?.toUpperCase() || stream.artist_id.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
        {/* Live Badge */}
        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 border-2 border-background">
          <span className="w-2 h-2 bg-white rounded-full block animate-pulse" />
        </div>
        {/* Viewer Count */}
        {stream.viewer_count > 0 && (
          <div className="absolute -bottom-1 -left-1 bg-black/80 backdrop-blur-sm rounded-full px-1.5 py-0.5 border border-white/20 flex items-center gap-1">
            <Eye className="h-2 w-2 text-neon-green" />
            <span className="text-[8px] font-mono text-white">{stream.viewer_count}</span>
          </div>
        )}
      </div>
      <span className="text-xs font-mono max-w-[80px] truncate hover:text-neon-green transition-colors">
        {artist?.artist_name || stream.artist_id.slice(0, 6) + '...' + stream.artist_id.slice(-4)}
      </span>
    </div>
  );
}

