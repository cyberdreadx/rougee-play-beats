import AgoraRTC, { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
  UID
} from 'agora-rtc-sdk-ng';

// Initialize Agora SDK
// Enable dual stream mode for better performance
AgoraRTC.setLogLevel(3); // 0: DEBUG, 1: INFO, 2: WARNING, 3: ERROR, 4: NONE

// Create a client instance
export function createAgoraClient(mode: 'rtc' | 'live' = 'live') {
  const client = AgoraRTC.createClient({
    mode: mode, // 'live' for broadcasting, 'rtc' for real-time communication
    codec: 'vp8' // 'vp8' or 'h264'
  });
  
  return client;
}

// Create microphone and camera tracks
export async function createLocalTracks(
  audioConfig?: { 
    ANS?: boolean; // Automatic Noise Suppression
    AEC?: boolean; // Acoustic Echo Cancellation
  },
  videoConfig?: {
    encoderConfig?: string | {
      width?: number;
      height?: number;
      frameRate?: number;
      bitrateMin?: number;
      bitrateMax?: number;
    };
    optimizationMode?: 'motion' | 'detail';
  }
) {
  try {
    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
      {
        ANS: audioConfig?.ANS ?? true,
        AEC: audioConfig?.AEC ?? true,
      },
      {
        encoderConfig: videoConfig?.encoderConfig ?? '720p_2',
        optimizationMode: videoConfig?.optimizationMode ?? 'detail'
      }
    );
    
    console.log('✅ Local tracks created successfully');
    return { audioTrack, videoTrack };
  } catch (error) {
    console.error('❌ Failed to create local tracks:', error);
    throw error;
  }
}

// Create screen sharing track
export async function createScreenTrack(
  config?: {
    encoderConfig?: string | {
      width?: number;
      height?: number;
      frameRate?: number;
      bitrateMin?: number;
      bitrateMax?: number;
    };
    optimizationMode?: 'motion' | 'detail';
  }
) {
  try {
    const screenTrack = await AgoraRTC.createScreenVideoTrack(
      {
        encoderConfig: config?.encoderConfig ?? '1080p_1',
        optimizationMode: config?.optimizationMode ?? 'detail'
      },
      'auto' // 'auto', 'screen', 'window', or 'application'
    );
    
    console.log('✅ Screen track created successfully');
    return screenTrack;
  } catch (error) {
    console.error('❌ Failed to create screen track:', error);
    throw error;
  }
}

// Join a channel
export async function joinChannel(
  client: IAgoraRTCClient,
  token: string,
  channelName: string,
  userId: UID,
  appId?: string
) {
  try {
    // Use provided appId, fallback to env var, or throw error
    const agoraAppId = appId || import.meta.env.VITE_AGORA_APP_ID;
    
    if (!agoraAppId) {
      throw new Error('Agora App ID is required. Please set VITE_AGORA_APP_ID or provide appId parameter.');
    }
    
    console.log('🔌 Joining channel:', { 
      channelName, 
      userId, 
      appId: agoraAppId,
      appIdLength: agoraAppId?.length,
      appIdType: typeof agoraAppId,
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 20)
    });
    
    // Ensure appId is a non-empty string
    if (!agoraAppId || agoraAppId.trim() === '') {
      throw new Error('Agora App ID is empty or invalid');
    }
    
    // Try with token first, if it fails with INVALID_VENDOR_KEY, try without token
    // (Agora allows joining without token if Primary Certificate is disabled in console)
    try {
      await client.join(
        agoraAppId,
        channelName,
        token,
        userId
      );
    } catch (firstError: any) {
      if (firstError.message?.includes('invalid vendor key') || 
          firstError.message?.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
        console.warn('⚠️ Token rejected, trying without token (certificate may be disabled in Agora Console)');
        // Try again with null token (works when certificate is disabled)
        await client.join(
          agoraAppId,
          channelName,
          null,
          userId
        );
        console.log('✅ Joined without token (certificate disabled mode)');
      } else {
        throw firstError;
      }
    }
    
    console.log('✅ Joined channel successfully:', channelName);
    return true;
  } catch (error) {
    console.error('❌ Failed to join channel:', error);
    throw error;
  }
}

// Leave a channel
export async function leaveChannel(client: IAgoraRTCClient) {
  try {
    await client.leave();
    console.log('✅ Left channel successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to leave channel:', error);
    throw error;
  }
}

// Publish local tracks
export async function publishTracks(
  client: IAgoraRTCClient,
  tracks: (IMicrophoneAudioTrack | ICameraVideoTrack)[]
) {
  try {
    await client.publish(tracks);
    console.log('✅ Published tracks successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to publish tracks:', error);
    throw error;
  }
}

// Unpublish local tracks
export async function unpublishTracks(
  client: IAgoraRTCClient,
  tracks?: (IMicrophoneAudioTrack | ICameraVideoTrack)[]
) {
  try {
    if (tracks) {
      await client.unpublish(tracks);
    } else {
      await client.unpublish();
    }
    console.log('✅ Unpublished tracks successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to unpublish tracks:', error);
    throw error;
  }
}

// Subscribe to a remote user
export async function subscribeToUser(
  client: IAgoraRTCClient,
  user: any,
  mediaType: 'audio' | 'video'
) {
  try {
    await client.subscribe(user, mediaType);
    console.log(`✅ Subscribed to ${mediaType} from user ${user.uid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to subscribe to ${mediaType}:`, error);
    throw error;
  }
}

// Get list of available cameras
export async function getCameras() {
  try {
    const cameras = await AgoraRTC.getCameras();
    console.log('📹 Available cameras:', cameras);
    return cameras;
  } catch (error) {
    console.error('❌ Failed to get cameras:', error);
    return [];
  }
}

// Get list of available microphones
export async function getMicrophones() {
  try {
    const microphones = await AgoraRTC.getMicrophones();
    console.log('🎤 Available microphones:', microphones);
    return microphones;
  } catch (error) {
    console.error('❌ Failed to get microphones:', error);
    return [];
  }
}

// Check browser compatibility
export function checkSystemRequirements() {
  const result = AgoraRTC.checkSystemRequirements();
  console.log('🖥️ System requirements check:', result);
  return result;
}

// Video encoder configurations
export const VIDEO_ENCODER_CONFIGS = {
  '120p': { width: 160, height: 120, frameRate: 15, bitrateMin: 65, bitrateMax: 130 },
  '240p': { width: 320, height: 240, frameRate: 15, bitrateMin: 200, bitrateMax: 400 },
  '360p': { width: 640, height: 360, frameRate: 15, bitrateMin: 400, bitrateMax: 800 },
  '480p': { width: 640, height: 480, frameRate: 15, bitrateMin: 500, bitrateMax: 1000 },
  '720p': { width: 1280, height: 720, frameRate: 30, bitrateMin: 1130, bitrateMax: 2260 },
  '1080p': { width: 1920, height: 1080, frameRate: 30, bitrateMin: 2080, bitrateMax: 4160 },
};

export { AgoraRTC };
export type { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
  UID
};

