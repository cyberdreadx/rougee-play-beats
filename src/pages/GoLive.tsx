import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgoraStream } from '@/hooks/useAgoraStream';
import { useWallet } from '@/hooks/useWallet';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Radio, 
  StopCircle, 
  Eye,
  MessageCircle,
  DollarSign,
  Users,
  Settings
} from 'lucide-react';

export default function GoLive() {
  const navigate = useNavigate();
  const { fullAddress } = useWallet();
  const { isArtist, profile } = useCurrentUserProfile();
  const [streamId, setStreamId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string>('');
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const localVideoRef = useRef<HTMLDivElement>(null);

  const {
    localVideoTrack,
    localAudioTrack,
    isJoined,
    isPublishing,
    isAudioEnabled,
    isVideoEnabled,
    join,
    leave,
    startPublishing,
    stopPublishing,
    toggleAudio,
    toggleVideo
  } = useAgoraStream({
    channelName,
    userId: fullAddress || '',
    role: 'host'
  });

  // Redirect if not an artist or verified
  useEffect(() => {
    // Allow if user is an artist OR verified OR has any profile
    const canGoLive = isArtist || profile?.verified || profile;
    
    if (!canGoLive && fullAddress) {
      console.log('🔒 Go Live access denied:', { isArtist, verified: profile?.verified, hasProfile: !!profile });
      toast({
        title: 'Artist Profile Required',
        description: 'Please create an artist profile to go live.',
        variant: 'destructive'
      });
      navigate('/become-artist');
    }
  }, [isArtist, profile, fullAddress, navigate]);

  // Play local video preview
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play(localVideoRef.current);
    }
    
    return () => {
      if (localVideoTrack) {
        localVideoTrack.stop();
      }
    };
  }, [localVideoTrack]);

  // Subscribe to viewer count changes
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`stream-${streamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${streamId}`
      }, (payload) => {
        if (payload.new.viewer_count !== undefined) {
          setViewerCount(payload.new.viewer_count);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to chat messages
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`chat-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_chat',
        filter: `stream_id=eq.${streamId}`
      }, (payload) => {
        setChatMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Start live stream
  const handleGoLive = async () => {
    if (!streamTitle.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for your stream',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Generate unique channel name
      const channel = `${fullAddress}-${Date.now()}`;
      setChannelName(channel);

      // Create stream record in database
      const { data: stream, error: dbError } = await supabase
        .from('live_streams')
        .insert({
          artist_id: fullAddress,
          channel_name: channel,
          title: streamTitle,
          description: streamDescription,
          is_live: true
        })
        .select()
        .single();

      if (dbError) throw dbError;
      
      setStreamId(stream.id);

      // Join Agora channel
      await join(channel, fullAddress);
      
      // Start publishing
      await startPublishing();
      
      setIsSettingUp(false);
      
      toast({
        title: '🔴 You\'re Live!',
        description: 'Your stream is now broadcasting',
      });
    } catch (error: any) {
      console.error('❌ Failed to go live:', error);
      toast({
        title: 'Failed to Go Live',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    }
  };

  // End live stream
  const handleEndStream = async () => {
    try {
      // Stop publishing
      await stopPublishing();
      
      // Leave channel
      await leave();
      
      // Update stream record
      if (streamId) {
        await supabase
          .from('live_streams')
          .update({
            is_live: false,
            ended_at: new Date().toISOString()
          })
          .eq('id', streamId);
      }
      
      toast({
        title: 'Stream Ended',
        description: 'Your live stream has ended',
      });
      
      navigate('/');
    } catch (error: any) {
      console.error('❌ Failed to end stream:', error);
      toast({
        title: 'Error',
        description: 'Failed to end stream properly',
        variant: 'destructive'
      });
    }
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !streamId) return;

    try {
      await supabase.from('live_stream_chat').insert({
        stream_id: streamId,
        sender_id: fullAddress,
        message: newMessage
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    }
  };

  if (isSettingUp) {
    return (
      <div className="min-h-screen console-bg pt-[72px] md:pt-[80px] pb-24 md:pb-6 px-4">
        <div className="max-w-4xl mx-auto py-8">
          <div className="flex items-center gap-3 mb-6">
            <Radio className="h-8 w-8 text-neon-green" />
            <h1 className="text-3xl font-mono font-bold neon-text">GO LIVE</h1>
          </div>

          <Card className="console-bg tech-border p-6">
            <div className="space-y-6">
              {/* Video Preview */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <div ref={localVideoRef} className="w-full h-full" />
                {!localVideoTrack && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <VideoOff className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Stream Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-mono text-muted-foreground mb-2 uppercase">
                    Stream Title *
                  </label>
                  <Input
                    value={streamTitle}
                    onChange={(e) => setStreamTitle(e.target.value)}
                    placeholder="What's happening?"
                    className="font-mono"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono text-muted-foreground mb-2 uppercase">
                    Description (Optional)
                  </label>
                  <Textarea
                    value={streamDescription}
                    onChange={(e) => setStreamDescription(e.target.value)}
                    placeholder="Tell viewers what to expect..."
                    className="font-mono resize-none"
                    rows={3}
                    maxLength={500}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleVideo}
                    className={isVideoEnabled ? '' : 'bg-red-500/20 border-red-500/50'}
                  >
                    {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-red-500" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleAudio}
                    className={isAudioEnabled ? '' : 'bg-red-500/20 border-red-500/50'}
                  >
                    {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-red-500" />}
                  </Button>
                </div>

                <Button
                  onClick={handleGoLive}
                  className="neon-button font-mono px-8"
                  disabled={!streamTitle.trim()}
                >
                  <Radio className="h-5 w-5 mr-2" />
                  GO LIVE
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Live streaming view
  return (
    <div className="min-h-screen console-bg pt-[72px] md:pt-[80px] pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="console-bg tech-border p-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <div ref={localVideoRef} className="w-full h-full" />
                
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

                {/* Controls Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={toggleVideo}
                      className={`console-bg ${!isVideoEnabled ? 'bg-red-500/20 border-red-500/50' : ''}`}
                    >
                      {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-red-500" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={toggleAudio}
                      className={`console-bg ${!isAudioEnabled ? 'bg-red-500/20 border-red-500/50' : ''}`}
                    >
                      {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-red-500" />}
                    </Button>
                  </div>

                  <Button
                    onClick={handleEndStream}
                    variant="destructive"
                    className="font-mono"
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    END STREAM
                  </Button>
                </div>
              </div>

              {/* Stream Info */}
              <div className="mt-4 space-y-2">
                <h2 className="text-xl font-mono font-bold">{streamTitle}</h2>
                {streamDescription && (
                  <p className="text-sm text-muted-foreground font-mono">{streamDescription}</p>
                )}
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="console-bg tech-border p-4 text-center">
                <Eye className="h-6 w-6 text-neon-green mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold">{viewerCount}</div>
                <div className="text-xs text-muted-foreground font-mono uppercase">Viewers</div>
              </Card>
              <Card className="console-bg tech-border p-4 text-center">
                <MessageCircle className="h-6 w-6 text-primary mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold">{chatMessages.length}</div>
                <div className="text-xs text-muted-foreground font-mono uppercase">Messages</div>
              </Card>
              <Card className="console-bg tech-border p-4 text-center">
                <DollarSign className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-mono font-bold">0</div>
                <div className="text-xs text-muted-foreground font-mono uppercase">Tips</div>
              </Card>
            </div>
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
                    No messages yet...
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="space-y-1">
                      <div className="text-xs font-mono text-neon-green">
                        {msg.sender_id.slice(0, 6)}...{msg.sender_id.slice(-4)}
                      </div>
                      <div className="text-sm font-mono">{msg.message}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Say something..."
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleSendMessage} size="icon" className="flex-shrink-0">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

