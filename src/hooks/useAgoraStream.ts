import { useState, useEffect, useCallback } from 'react';
import { 
  createAgoraClient, 
  createLocalTracks,
  joinChannel,
  leaveChannel,
  publishTracks,
  unpublishTracks,
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack
} from '@/lib/agora';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseAgoraStreamOptions {
  channelName?: string;
  userId?: string;
  role: 'host' | 'audience';
  autoJoin?: boolean;
}

export function useAgoraStream({
  channelName,
  userId,
  role,
  autoJoin = false
}: UseAgoraStreamOptions) {
  const [client] = useState<IAgoraRTCClient>(() => createAgoraClient('live'));
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // Set client role
  useEffect(() => {
    const setRole = async () => {
      try {
        await client.setClientRole(role);
        console.log(`✅ Client role set to: ${role}`);
      } catch (error) {
        console.error('❌ Failed to set client role:', error);
      }
    };
    setRole();
  }, [client, role]);

  // Handle remote user published
  useEffect(() => {
    const handleUserPublished = async (user: any, mediaType: 'audio' | 'video') => {
      console.log(`👤 User ${user.uid} published ${mediaType}`);
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        setRemoteUsers(prev => {
          const exists = prev.find(u => u.uid === user.uid);
          if (exists) {
            return prev.map(u => u.uid === user.uid ? user : u);
          }
          return [...prev, user];
        });
      }
      
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    };

    const handleUserUnpublished = (user: any, mediaType: 'audio' | 'video') => {
      console.log(`👤 User ${user.uid} unpublished ${mediaType}`);
      if (mediaType === 'video') {
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      }
    };

    const handleUserLeft = (user: any) => {
      console.log(`👤 User ${user.uid} left`);
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-left', handleUserLeft);
    };
  }, [client]);

  // Get Agora token from backend
  const getToken = useCallback(async (channel: string, uid: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-agora-token', {
        body: { 
          channelName: channel,
          userId: uid,
          role: role
        }
      });

      if (error) throw error;
      
      console.log('🎫 Received Agora token:', { 
        hasToken: !!data?.token, 
        appId: data?.appId,
        appIdLength: data?.appId?.length,
        appIdType: typeof data?.appId,
        channelName: data?.channelName,
        fullResponse: data
      });
      
      if (!data?.token) {
        throw new Error('Invalid token response: missing token');
      }
      
      if (!data?.appId) {
        console.error('⚠️ No App ID in token response. Supabase secrets may not be set.');
        throw new Error('Agora App ID not found in server response. Please set AGORA_APP_ID in Supabase secrets.');
      }
      
      return { token: data.token, appId: data.appId };
    } catch (error: any) {
      console.error('❌ Failed to get Agora token:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to get streaming token. Please try again.',
        variant: 'destructive'
      });
      throw error;
    }
  }, [role]);

  // Join channel
  const join = useCallback(async (channel?: string, uid?: string) => {
    const targetChannel = channel || channelName;
    const targetUserId = uid || userId;

    if (!targetChannel || !targetUserId) {
      throw new Error('Channel name and user ID are required');
    }

    try {
      const { token, appId } = await getToken(targetChannel, targetUserId);
      
      if (!appId) {
        throw new Error('Agora App ID not found. Please configure VITE_AGORA_APP_ID or check server configuration.');
      }
      
      console.log('🔌 Joining channel with App ID:', appId);
      await joinChannel(client, token, targetChannel, targetUserId, appId);
      setIsJoined(true);
      
      toast({
        title: 'Connected',
        description: 'Successfully joined the stream!',
      });
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to join channel:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to join stream',
        variant: 'destructive'
      });
      throw error;
    }
  }, [channelName, userId, client, getToken]);

  // Leave channel
  const leave = useCallback(async () => {
    try {
      // Stop local tracks
      localAudioTrack?.stop();
      localAudioTrack?.close();
      localVideoTrack?.stop();
      localVideoTrack?.close();
      
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      
      await leaveChannel(client);
      setIsJoined(false);
      setIsPublishing(false);
      setRemoteUsers([]);
      
      console.log('✅ Successfully left channel');
      return true;
    } catch (error) {
      console.error('❌ Failed to leave channel:', error);
      throw error;
    }
  }, [client, localAudioTrack, localVideoTrack]);

  // Start publishing (for hosts)
  const startPublishing = useCallback(async () => {
    if (role !== 'host') {
      console.warn('⚠️ Only hosts can publish streams');
      return false;
    }

    try {
      const { audioTrack, videoTrack } = await createLocalTracks();
      
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      
      await publishTracks(client, [audioTrack, videoTrack]);
      setIsPublishing(true);
      
      toast({
        title: 'Live!',
        description: 'You are now broadcasting!',
      });
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to start publishing:', error);
      toast({
        title: 'Broadcast Failed',
        description: error.message || 'Failed to start broadcasting',
        variant: 'destructive'
      });
      throw error;
    }
  }, [client, role]);

  // Stop publishing
  const stopPublishing = useCallback(async () => {
    try {
      if (localAudioTrack || localVideoTrack) {
        const tracks = [];
        if (localAudioTrack) tracks.push(localAudioTrack);
        if (localVideoTrack) tracks.push(localVideoTrack);
        
        await unpublishTracks(client, tracks as any);
        
        localAudioTrack?.stop();
        localAudioTrack?.close();
        localVideoTrack?.stop();
        localVideoTrack?.close();
        
        setLocalAudioTrack(null);
        setLocalVideoTrack(null);
        setIsPublishing(false);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to stop publishing:', error);
      throw error;
    }
  }, [client, localAudioTrack, localVideoTrack]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [localAudioTrack, isAudioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [localVideoTrack, isVideoEnabled]);

  // Auto join if specified
  useEffect(() => {
    if (autoJoin && channelName && userId && !isJoined) {
      join();
    }
  }, [autoJoin, channelName, userId, isJoined, join]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isJoined) {
        leave();
      }
    };
  }, []);

  return {
    client,
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
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
  };
}

