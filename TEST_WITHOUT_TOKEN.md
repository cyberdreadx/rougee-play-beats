# Testing Agora Without Token (Temporary)

## Why This Might Help

The error "invalid vendor key, can not find appid" suggests the App ID `b1ec84b23d5a4ff2be53476e9c7e38e8` might not be registered in Agora's system or token authentication is enabled but configured incorrectly.

## Quick Test: Disable Token Authentication

1. **Go to Agora Console** https://console.agora.io/
2. **Click on your project** (the one with App ID `b1ec84b23d5a4ff2be53476e9c7e38e8`)
3. **Look for "Authentication" or "App Certificate" settings**
4. **Temporarily DISABLE the Primary Certificate**
   - This allows you to join channels without a token
   - Good for testing if the App ID itself is valid

5. **Try joining without a token**:
   - The SDK will work with just the App ID
   - No token needed when certificate is disabled

## If This Works

It means:
- ✅ Your App ID is valid
- ✅ The SDK connection works
- ❌ The token generation is the problem

Then we need to fix the token generation.

## If This Still Doesn't Work

It means:
- ❌ The App ID `b1ec84b23d5a4ff2be53476e9c7e38e8` is not valid in Agora's system
- You may need to:
  1. Create a NEW project in Agora Console
  2. Get the NEW App ID
  3. Update `AGORA_APP_ID` in Supabase secrets

## How to Test Without Token (Code Change)

Temporarily modify the join call to pass `null` for token when certificate is disabled:

```typescript
// In agora.ts, change:
await client.join(
  agoraAppId,
  channelName,
  token,  // ← Pass null when testing without certificate
  userId
);

// To:
await client.join(
  agoraAppId,
  channelName,
  null,  // ← Test without token
  userId
);
```

## Recommended Steps

1. **Verify App ID in Agora Console**
   - Make sure `b1ec84b23d5a4ff2be53476e9c7e38e8` shows up in your projects
   - Check if it's the correct project

2. **Check Certificate Status**
   - Is the Primary Certificate enabled?
   - If yes, copy the certificate and set it in Supabase secrets
   - If no, try joining without a token first

3. **Test the Token Server**
   - Use Agora's online token generator: https://webdemo.agora.io/token-builder/
   - Input your App ID, Certificate, Channel Name, and UID
   - Compare the generated token format with ours

4. **Deploy the New Token Generation**
   - The code is ready in `supabase/functions/generate-agora-token/`
   - Just needs to be deployed
   - Make sure `AGORA_APP_CERTIFICATE` is set in Supabase

## Token Format Reference

A valid Agora RTC token looks like:
```
007b1ec84b23d5a4ff2be53476e9c7e38e8IAGABC123DEF456GHI789...
```

- Starts with version: `007`
- Followed by App ID: `b1ec84b23d5a4ff2be53476e9c7e38e8`
- Then encoded token data

If your token doesn't match this format, it will be rejected.

