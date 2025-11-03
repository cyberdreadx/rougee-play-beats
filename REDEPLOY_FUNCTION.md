# How to Redeploy the Agora Token Function

## The Problem

You set `AGORA_APP_CERTIFICATE` in Supabase secrets, but the edge function is still running with the OLD code/secrets. You need to **restart or redeploy** it.

## Option 1: Restart via Dashboard (Quickest)

1. Go to https://supabase.com/dashboard/project/phybdsfwycygroebrsdx/functions
2. Find `generate-agora-token` in the list
3. Click on it
4. Look for a "Restart" or "Redeploy" button
5. Click it

## Option 2: Deploy via CLI

If you have Supabase CLI installed:

```bash
npx supabase functions deploy generate-agora-token
```

## Option 3: Via Supabase Dashboard - Manual Deploy

1. Go to https://supabase.com/dashboard/project/phybdsfwycygroebrsdx/settings/functions
2. Scroll to "Edge Functions"
3. Find `generate-agora-token`
4. Click "Deploy" or "Redeploy"

## How to Verify It Worked

After redeploying, check the edge function logs:

1. Go to https://supabase.com/dashboard/project/phybdsfwycygroebrsdx/functions/generate-agora-token/logs
2. Try going live again
3. Look for this log:
   ```
   ✅ Token generated successfully { tokenLength: 241, tokenPrefix: "007b1ec84b23d5a4ff2b..." }
   ```
4. The token should still be 241 characters

## If Still Failing

The edge function might be caching. Try:

1. **Hard refresh your browser**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Check secrets are set**:
   ```bash
   npx supabase secrets list
   ```
   You should see both:
   - `AGORA_APP_ID`
   - `AGORA_APP_CERTIFICATE`

3. **Verify the certificate format**:
   - Should be 32 characters
   - All hexadecimal (0-9, a-f)
   - No spaces, no line breaks
   - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## Alternative: Disable Certificate Temporarily

If you want to test without dealing with certificates:

1. Go to Agora Console: https://console.agora.io/
2. Find your project (App ID: `b1ec84b23d5a4ff2be53476e9c7e38e8`)
3. Look for "Primary Certificate" section
4. Click "Disable"
5. Try going live - it should work without a token

This proves the basic integration works, then you can re-enable the certificate for production security.

