import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgoraStream } from '@/hooks/useAgoraStream';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { 
  Eye,
  MessageCircle,
  DollarSign,
  Heart,
  Share2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { getIPFSGatewayUrl } from '@/lib/ipfs';
import { TipButton } from '@/components/TipButton';

export default function WatchStream() {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  const { fullAddress } = useWallet();
  const [stream, setStream] = useState<any>(null);
  const [artist, setArtist] = useState<any>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [viewerRecordId, setViewerRecordId] = useState<string | null>(null);
  
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const {
    remoteUsers,
    isJoined,
    join,
    leave
  } = useAgoraStream({
    channelName: stream?.channel_name,
    userId: fullAddress || `anon-${Math.random().toString(36).substring(7)}`,
    role: 'audience',
    autoJoin: false
  });

  // Fetch stream details
  useEffect(() => {
    const fetchStream = async () => {
      if (!streamId) return;

      const { data: streamData, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('id', streamId)
        .single();

      if (error) {
        console.error('❌ Failed to fetch stream:', error);
        toast({
          title: 'Stream Not Found',
          description: 'This stream may have ended or does not exist.',
          variant: 'destructive'
        });
        navigate('/');
        return;
      }

      if (!streamData.is_live) {
        toast({
          title: 'Stream Ended',
          description: 'This stream has ended.',
          variant: 'destructive'
        });
        navigate('/');
        return;
      }

      setStream(streamData);
      setViewerCount(streamData.viewer_count || 0);

      // Fetch artist profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', streamData.artist_id)
        .single();

      if (profileError) {
        console.warn('⚠️ Failed to fetch artist profile:', profileError);
        // Try public_profiles as fallback
        const { data: publicProfileData } = await supabase
          .from('public_profiles')
          .select('*')
          .eq('wallet_address', streamData.artist_id)
          .single();
        
        setArtist(publicProfileData || null);
      } else {
        setArtist(profileData);
      }
    };

    fetchStream();
  }, [streamId, navigate]);

  // Join stream when ready
  useEffect(() => {
    if (stream && !isJoined) {
      join(stream.channel_name, fullAddress || `anon-${Date.now()}`);
      
      // Record viewer
      if (fullAddress) {
        recordViewer();
      }
    }
  }, [stream, isJoined]);

  // Record viewer in database
  const recordViewer = async () => {
    if (!streamId || !fullAddress) return;

    const { data, error } = await supabase
      .from('live_stream_viewers')
      .insert({
        stream_id: streamId,
        viewer_id: fullAddress,
        is_watching: true
      })
      .select()
      .single();

    if (!error && data) {
      setViewerRecordId(data.id);
    }
  };

  // Update viewer status on leave
  const updateViewerStatus = async () => {
    if (viewerRecordId) {
      await supabase
        .from('live_stream_viewers')
        .update({
          is_watching: false,
          left_at: new Date().toISOString()
        })
        .eq('id', viewerRecordId);
    }
  };

  // Play remote video
  useEffect(() => {
    if (remoteUsers.length > 0 && remoteVideoRef.current) {
      const remoteUser = remoteUsers[0];
      if (remoteUser.videoTrack) {
        remoteUser.videoTrack.play(remoteVideoRef.current);
      }
      if (remoteUser.audioTrack) {
        remoteUser.audioTrack.setVolume(isMuted ? 0 : 100);
        remoteUser.audioTrack.play();
      }
    }
  }, [remoteUsers, isMuted]);

  // Subscribe to viewer count changes
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`stream-${streamId}-viewers`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${streamId}`
      }, (payload) => {
        if (payload.new.viewer_count !== undefined) {
          setViewerCount(payload.new.viewer_count);
        }
        if (payload.new.is_live === false) {
          toast({
            title: 'Stream Ended',
            description: 'The host has ended this stream.',
          });
          navigate('/');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, navigate]);

  // Subscribe to chat messages
  useEffect(() => {
    if (!streamId) return;

    // Fetch existing messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('live_stream_chat')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true });

      if (data) setChatMessages(data);
    };
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${streamId}-messages`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_chat',
        filter: `stream_id=eq.${streamId}`
      }, (payload) => {
        console.log('💬 New chat message received:', payload);
        // Only add if message doesn't already exist (avoid duplicates)
        setChatMessages(prev => {
          const exists = prev.some(msg => msg.id === payload.new.id);
          if (exists) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Send chat message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !streamId) return;

    const messageText = newMessage.trim();
    const senderId = fullAddress || 'Anonymous';
    
    // Optimistic update - show message immediately
    const tempMessage = {
      id: `temp-${Date.now()}`,
      stream_id: streamId,
      sender_id: senderId,
      message: messageText,
      created_at: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('live_stream_chat')
        .insert({
          stream_id: streamId,
          sender_id: senderId,
          message: messageText
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp message with real one
      if (data) {
        setChatMessages(prev => 
          prev.map(msg => msg.id === tempMessage.id ? data : msg)
        );
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // Remove temp message on error
      setChatMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setNewMessage(messageText); // Restore message text
      toast({
        title: 'Failed to send message',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  };

  // Handle share
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/stream/${streamId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: stream?.title || 'Live Stream',
          text: `Watch ${artist?.artist_name || 'this artist'} live!`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: 'Link Copied',
          description: 'Stream link copied to clipboard!',
        });
      }
    } catch (error) {
      console.log('Share cancelled or failed');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      updateViewerStatus();
      leave();
    };
  }, []);

  if (!stream) {
    return (
      <div className="min-h-screen console-bg pt-[72px] md:pt-[80px] pb-24 md:pb-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-neon-green border-t-transparent rounded-full mx-auto mb-4" />
          <p className="font-mono text-muted-foreground">Loading stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen console-bg pt-[72px] md:pt-[80px] pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="console-bg tech-border p-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <div ref={remoteVideoRef} className="w-full h-full" />
                
                {remoteUsers.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin h-12 w-12 border-4 border-neon-green border-t-transparent rounded-full mx-auto mb-4" />
                      <p className="font-mono text-muted-foreground">Connecting to stream...</p>
                    </div>
                  </div>
                )}

                {/* Live Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-3">
                  <div className="bg-red-500 px-3 py-1 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="font-mono text-white font-bold text-sm">LIVE</span>
                  </div>
                  <div className="console-bg tech-border px-3 py-1 rounded-full flex items-center gap-2">
                    <Eye className="h-4 w-4 text-neon-green" />
                    <span className="font-mono text-sm">{viewerCount}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="absolute bottom-4 right-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsMuted(!isMuted)}
                    className="console-bg"
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              {/* Artist Info */}
              <div className="mt-4 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {artist?.avatar_cid && (
                    <img
                      src={getIPFSGatewayUrl(artist.avatar_cid)}
                      alt={artist.artist_name}
                      className="h-12 w-12 rounded-full object-cover tech-border"
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-mono font-bold">{stream.title}</h2>
                    <p className="text-sm text-muted-foreground font-mono">
                      {artist?.artist_name || artist?.display_name || (stream?.artist_id ? `${stream.artist_id.slice(0, 6)}...${stream.artist_id.slice(-4)}` : 'Unknown Artist')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsLiked(!isLiked)}
                    className={isLiked ? 'text-red-500' : ''}
                  >
                    <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
                  {stream?.artist_id && artist && (
                    <TipButton
                      artistId={stream.artist_id}
                      artistWalletAddress={stream.artist_id}
                      artistName={artist?.artist_name || artist?.display_name || 'this artist'}
                      variant="default"
                      size="default"
                      className="shadow-[0_4px_16px_rgba(0,255,159,0.3)] hover:shadow-[0_6px_24px_rgba(0,255,159,0.4)]"
                    />
                  )}
                </div>
              </div>

              {stream.description && (
                <p className="mt-2 text-sm text-muted-foreground font-mono">{stream.description}</p>
              )}
            </Card>
          </div>

          {/* Chat Sidebar */}
          <div className="lg:col-span-1">
            <Card className="console-bg tech-border h-[600px] flex flex-col">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-neon-green" />
                  <h3 className="font-mono font-bold uppercase">Live Chat</h3>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground font-mono text-sm py-8">
                    Be the first to say something!
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="space-y-1">
                      <div className="text-xs font-mono text-neon-green">
                        {msg.sender_id === 'Anonymous' 
                          ? 'Anonymous' 
                          : `${msg.sender_id.slice(0, 6)}...${msg.sender_id.slice(-4)}`}
                      </div>
                      <div className="text-sm font-mono break-words">{msg.message}</div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-white/10">
                {fullAddress ? (
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Say something..."
                      className="font-mono text-sm"
                      maxLength={200}
                    />
                    <Button onClick={handleSendMessage} size="icon" className="flex-shrink-0">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-mono text-center">
                    Connect wallet to chat
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

