// @deno-types="npm:@types/node"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildTokenWithUid, Role } from "./agora-token-builder.ts";

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-privy-token',
      }
    });
  }

  try {
    const { channelName, userId, role } = await req.json();

    if (!channelName || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing channelName or userId' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Get Agora credentials from environment variables
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    console.log('🔑 Checking Agora credentials:', {
      hasAppId: !!appId,
      appIdLength: appId?.length,
      hasCertificate: !!appCertificate,
      certificateLength: appCertificate?.length,
      certificatePrefix: appCertificate?.substring(0, 8) + '...'
    });

    if (!appId || !appCertificate) {
      console.error('❌ Agora credentials not configured', {
        hasAppId: !!appId,
        hasCertificate: !!appCertificate
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing App ID or Certificate' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Token generation using proper Agora algorithm
    console.log('🎫 Generating Agora token:', { channelName, userId, role });
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expirationTimeInSeconds = 3600; // 1 hour
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    
    const agoraRole = role === 'host' ? Role.PUBLISHER : Role.SUBSCRIBER;
    
    const token = await buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      userId,
      agoraRole,
      privilegeExpiredTs
    );

    console.log('✅ Token generated successfully', { 
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 20) + '...'
    });

    return new Response(
      JSON.stringify({ 
        token: token,
        channelName,
        appId,
        userId: String(userId),
        expiresAt: privilegeExpiredTs
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error: any) {
    console.error('❌ Error generating Agora token:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});

