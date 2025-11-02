# Agora Token Generation - Production Implementation Guide

## ⚠️ Current Implementation (MVP)

The current edge function at `supabase/functions/generate-agora-token/index.ts` uses a **simplified token generation** that's good for development but should be upgraded for production.

## 🔧 For Production: Use Proper Token Generation

### Option 1: Use Agora REST API (Recommended for Deno)

Update the edge function to call Agora's REST API:

```typescript
// supabase/functions/generate-agora-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const { channelName, userId, role } = await req.json();
    
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
    
    if (!appId || !appCertificate) {
      throw new Error('Agora credentials not configured');
    }

    // Call Agora's token server REST API
    const agoraApiUrl = `https://api.agora.io/v1/apps/${appId}/channel/${channelName}/token`;
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + 3600; // 1 hour

    const agoraResponse = await fetch(agoraApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${appId}:${appCertificate}`)}`
      },
      body: JSON.stringify({
        uid: String(userId),
        role: role === 'host' ? 'publisher' : 'subscriber',
        expire_time: privilegeExpiredTs
      })
    });

    if (!agoraResponse.ok) {
      throw new Error(`Agora API error: ${agoraResponse.statusText}`);
    }

    const tokenData = await agoraResponse.json();

    return new Response(
      JSON.stringify({ 
        token: tokenData.token,
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
```

### Option 2: Use Deno-Compatible Token Generation Library

Install a Deno-compatible version of the token generator:

```typescript
// This requires finding or creating a Deno-compatible version of agora-token
// Check https://deno.land/x for available packages
```

### Option 3: Use a Separate Node.js Service

Create a separate microservice in Node.js:

```typescript
// tokenService.js (Node.js)
const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const app = express();
app.use(express.json());

app.post('/generate-token', (req, res) => {
  const { channelName, userId, role } = req.body;
  
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + 3600;
  
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    userId,
    role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
    privilegeExpiredTs
  );
  
  res.json({ token, channelName, appId, userId, expiresAt: privilegeExpiredTs });
});

app.listen(3001);
```

Then call this service from your Supabase edge function.

## 🎯 Quick Test (Current MVP Implementation)

The current implementation will work for testing and MVP, but you should upgrade it before production launch.

To test the current setup:

1. Set environment variables:
```bash
supabase secrets set AGORA_APP_ID=your_app_id
supabase secrets set AGORA_APP_CERTIFICATE=your_app_certificate
```

2. Deploy the function:
```bash
supabase functions deploy generate-agora-token
```

3. Test it:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-agora-token \
  -H "Content-Type: application/json" \
  -d '{"channelName":"test","userId":"user123","role":"host"}'
```

## 📚 Resources

- [Agora Token Generation API](https://docs.agora.io/en/video-calling/develop/authentication-workflow#token-generation)
- [Agora REST API](https://docs.agora.io/en/video-calling/reference/restful-api)
- [Token Security Best Practices](https://docs.agora.io/en/video-calling/develop/authentication-workflow#token-security-best-practices)

## ⚡ For Quick MVP Launch

The current implementation is **good enough for MVP** testing with:
- Limited number of concurrent streams (< 10)
- Trusted users only
- Development/staging environment

For production with real users and scale, implement one of the proper token generation methods above.

