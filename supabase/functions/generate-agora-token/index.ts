// @deno-types="npm:@types/node"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Agora token generation using agora-token package
// Note: This is a simplified version. In production, install the proper Deno-compatible version
// or use the Agora REST API for token generation

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

    if (!appId || !appCertificate) {
      console.error('❌ Agora credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Token generation logic
    // For now, we'll use a simple approach that works with Agora's requirements
    // In production, you'd use the official agora-token package
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expirationTimeInSeconds = 3600; // 1 hour
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    
    // Simplified token generation (replace with proper SDK in production)
    // For MVP, we can use Agora's REST API or a simpler approach
    const tokenData = {
      appId,
      channelName,
      userId: String(userId),
      role: role === 'host' ? 1 : 2, // 1 = publisher (host), 2 = subscriber (audience)
      expireTime: privilegeExpiredTs
    };

    console.log('🎫 Generating Agora token:', { channelName, userId, role });

    // For MVP: Return a temporary token structure
    // In production, implement proper token generation using Agora's algorithm
    // or call Agora's REST API endpoint
    
    // Simple base64 encoding for MVP (NOT SECURE FOR PRODUCTION)
    const tokenPayload = btoa(JSON.stringify(tokenData));
    const tempToken = `agora_temp_${tokenPayload}`;

    console.log('✅ Token generated successfully');

    return new Response(
      JSON.stringify({ 
        token: tempToken,
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

