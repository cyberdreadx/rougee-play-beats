# Basescan API Setup Guide

## Overview
The app uses Basescan API V2 to fetch accurate token holder counts for songs on the Base network.

## Getting an API Key

1. **Visit Basescan**: https://basescan.org/myapikey
2. **Sign up/Login** with your email
3. **Create a new API key** (free tier is sufficient)
4. **Copy your API key** (e.g., `A84UAM841UERUYD3SE5SZDPKQYY82C6ZDC`)

## Development Setup (Local)

Create a `.env.local` file in your project root:

```bash
# .env.local
VITE_BASESCAN_API_KEY=YOUR_API_KEY_HERE
```

Then **restart your dev server**:
```bash
npm run dev
```

## Production Setup (Netlify)

1. **Go to Netlify Dashboard** → Your Site → Site Settings → Environment Variables
2. **Add a new variable**:
   - **Key**: `VITE_BASESCAN_API_KEY`
   - **Value**: Your Basescan API key
   - **Scopes**: Check "Production" and "Deploy previews"
3. **Redeploy** your site for changes to take effect

## Usage in Code

The API key is automatically loaded from environment variables:

```typescript
const basescanApiKey = import.meta.env.VITE_BASESCAN_API_KEY || '';
```

### Components Using Basescan API:
- **SongTrade.tsx** - Displays detailed holder list on song trade page
- **Trending.tsx** (via useTokenHolders hook) - Shows holder count in trending table
- **useTokenHolders.ts** - Reusable hook with 30-second caching

## Security Notes

⚠️ **Important**: Even with environment variables, the API key is still visible in browser network requests because it's sent in the URL.

### Current Security:
- ✅ API key not in source code (git)
- ✅ 30-second client-side caching to reduce calls
- ⚠️ Still visible in browser DevTools → Network tab

### Basescan Rate Limits (Free Tier):
- **5 calls/second**
- **100,000 calls/day**

With our 30-second caching, this should be more than enough for normal usage.

### Future Improvement (Optional):
For maximum security, create a Supabase Edge Function that:
1. Stores API key in Supabase secrets (server-side only)
2. Frontend calls your edge function
3. Edge function calls Basescan API
4. API key never exposed to frontend

Example:
```typescript
// supabase/functions/get-token-holders/index.ts
const basescanApiKey = Deno.env.get('BASESCAN_API_KEY');
// ... make API call server-side
```

## Testing

To verify the API key is working:

1. Open DevTools → Console
2. Navigate to a song trade page or trending page
3. Look for logs:
   ```
   📡 Querying Basescan API V2 for holders...
   ✅ Basescan returned X holders
   ```

If you see errors like "API key not configured" or "NOTOK", check your environment variable setup.

## Troubleshooting

### API Key Not Working
- ✅ Check `.env.local` exists and has correct variable name
- ✅ Restart dev server after creating `.env.local`
- ✅ Verify API key is valid on Basescan website
- ✅ Check for typos in variable name

### Still Showing 0 Holders
- Check browser console for API errors
- Verify the song has a valid `token_address`
- Check if you've hit rate limits (wait 1 minute and try again)

### Production Deployment Issues
- Verify environment variable is set in Netlify
- Redeploy after adding environment variable
- Check build logs for warnings

