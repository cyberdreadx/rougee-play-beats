# Agora Setup Instructions - CRITICAL

## ⚠️ Current Error: "invalid vendor key, can not find appid"

This error means the Agora App ID is **not set** in your Supabase secrets.

## Step-by-Step Fix

### 1. Get Your Agora Credentials

1. Go to https://console.agora.io/
2. Sign up/login
3. Create a new project (or use existing)
4. Click on your project
5. **CRITICAL**: Enable "Primary Certificate" if it's not already enabled
   - Look for "App Certificate" section
   - If you see "Enable", click it to enable the certificate
   - Copy the certificate that appears (32-character string)
6. Copy both:
   - **App ID**: A 32-character hexadecimal string (looks like: `b1ec84b23d5a4ff2be53476e9c7e38e8`)
   - **App Certificate**: A 32-character string (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

⚠️ **IMPORTANT**: Without the App Certificate enabled, token-based authentication will not work!

### 2. Set Supabase Secrets

**IMPORTANT**: These must be set in Supabase, NOT in your local `.env` file!

#### Option A: Using Supabase CLI (Recommended)

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref phybdsfwycygroebrsdx

# Set the secrets
supabase secrets set AGORA_APP_ID=your_actual_app_id_here
supabase secrets set AGORA_APP_CERTIFICATE=your_actual_certificate_here
```

#### Option B: Using Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/phybdsfwycygroebrsdx/settings/functions
2. Scroll to "Secrets" section
3. Click "Add new secret"
4. Add:
   - Name: `AGORA_APP_ID`
   - Value: Your App ID from Agora Console
5. Add another:
   - Name: `AGORA_APP_CERTIFICATE`
   - Value: Your App Certificate from Agora Console
6. Click "Save"

### 3. Redeploy Edge Function

After setting secrets, you need to redeploy the edge function:

```bash
supabase functions deploy generate-agora-token
```

### 4. Test

1. Refresh your browser (hard refresh: Ctrl+Shift+R)
2. Try to go live again
3. Check browser console for this log:
   ```
   🎫 Received Agora token: {
     hasToken: true,
     appId: "a1b2c3d4..." // Should see your actual App ID
   }
   ```

## Verification Checklist

- [ ] I have an Agora account
- [ ] I have copied my App ID from Agora Console
- [ ] I have set `AGORA_APP_ID` in Supabase secrets
- [ ] I have set `AGORA_APP_CERTIFICATE` in Supabase secrets
- [ ] I have redeployed the edge function
- [ ] I have hard-refreshed my browser

## What the Error Looks Like

❌ **Before fixing**:
```
🎫 Received Agora token: {
  hasToken: true,
  appId: undefined  // ← THIS IS THE PROBLEM
}
❌ Failed to join channel: invalid vendor key, can not find appid
```

✅ **After fixing**:
```
🎫 Received Agora token: {
  hasToken: true,
  appId: "a1b2c3d4e5f6g7h8..."  // ← YOUR ACTUAL APP ID
}
✅ Joined channel successfully
```

## Still Not Working?

If you still see the error after setting secrets:

1. Check the edge function logs in Supabase Dashboard:
   - Go to https://supabase.com/dashboard/project/phybdsfwycygroebrsdx/functions
   - Click on `generate-agora-token`
   - Look for this log:
     ```
     ✅ Token generated successfully
     ```
   - If you see "Agora credentials not configured", the secrets are not set correctly

2. Verify secrets are set:
   ```bash
   supabase secrets list
   ```
   You should see `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` in the list

3. Check browser console for the full token response:
   - Look for "🎫 Received Agora token" with `fullResponse` field
   - The `appId` should be a non-empty string

## Need Help?

Share these logs:
1. Browser console logs starting with "🎫 Received Agora token"
2. Edge function logs from Supabase Dashboard
3. Output of `supabase secrets list`

