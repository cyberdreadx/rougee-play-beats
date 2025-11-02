# Agora Livestreaming Setup Guide

## 🚀 Live Streaming Feature

Your app now has full livestreaming capabilities powered by Agora!

### ✨ Features Implemented:
1. ✅ **Go Live** - Artists can broadcast live video/audio
2. ✅ **Watch Streams** - Viewers can watch and interact  
3. ✅ **Live Chat** - Real-time chat during streams
4. ✅ **Viewer Count** - Live viewer tracking
5. ✅ **Live Streams Feed** - Discover active streams
6. ✅ **Mobile Support** - Full PWA compatibility

---

## 📋 Setup Instructions

### 1. Create Agora Account

1. Go to [Agora Console](https://console.agora.io/)
2. Sign up for a free account
3. Create a new project
4. Get your **App ID**

### 2. Configure Environment Variables

**Frontend (.env):**
```bash
VITE_AGORA_APP_ID=your_agora_app_id_here
```

**Backend (Supabase Edge Functions):**
```bash
# Run this command to set the environment variable
supabase secrets set AGORA_APP_ID=your_agora_app_id_here
supabase secrets set AGORA_APP_CERTIFICATE=your_agora_app_certificate_here
```

### 3. Deploy Database Migration

```bash
# Run the migration to create live streaming tables
supabase db push

# Or manually apply:
supabase db push --file supabase/migrations/20250202000000_create_live_streams.sql
```

### 4. Deploy Edge Function

```bash
# Deploy the Agora token generation function
supabase functions deploy generate-agora-token

# Test the function
supabase functions invoke generate-agora-token \
  --data '{"channelName":"test-channel","userId":"test-user","role":"host"}'
```

### 5. Update Supabase Config

Make sure `supabase/config.toml` includes:

```toml
[functions.generate-agora-token]
verify_jwt = false
```

---

## 🎮 How to Use

### For Artists (Broadcasting):

1. Navigate to **"GO LIVE"** in the sidebar (artists only)
2. Enter stream title and description
3. Allow camera and microphone access
4. Click **"GO LIVE"** button
5. You're now broadcasting! 🔴
6. Click **"END STREAM"** when finished

### For Viewers (Watching):

1. See live streams on **Trending** or **Discover** pages
2. Click on any live stream thumbnail
3. Watch the stream and chat in real-time
4. Send tips during the stream (coming soon)

---

## 💰 Agora Pricing

### Free Tier:
- **10,000 minutes per month** (~167 hours)
- Perfect for testing and early-stage growth

### After Free Tier:
- **~$0.99 per 1,000 minutes** (~$0.001/min)
- Example: 100 viewers × 1 hour = $6
- Very affordable compared to competitors

### Usage Examples:
| Scenario | Monthly Cost |
|----------|-------------|
| 10 streams × 1 hour × 100 viewers | **FREE** |
| 50 streams × 1 hour × 100 viewers | ~$24 |
| 100 streams × 2 hours × 200 viewers | ~$96 |

---

## 🔧 Technical Details

### Files Created:
- `src/lib/agora.ts` - Agora SDK utilities
- `src/hooks/useAgoraStream.ts` - Stream management hook
- `src/pages/GoLive.tsx` - Broadcaster page
- `src/pages/WatchStream.tsx` - Viewer page
- `src/components/LiveStreams.tsx` - Live streams feed
- `supabase/functions/generate-agora-token/` - Token generation
- `supabase/migrations/20250202000000_create_live_streams.sql` - Database schema

### Database Tables:
- `live_streams` - Stream metadata
- `live_stream_viewers` - Viewer tracking
- `live_stream_chat` - Live chat messages
- `live_stream_tips` - Tips during streams

### Features:
- Real-time video/audio streaming
- Host/audience role system
- Automatic viewer count updates
- Live chat with Supabase Realtime
- Stream recording (future)
- Tipping during streams (future)

---

## 🐛 Troubleshooting

### Stream Won't Start:
- Check camera/microphone permissions
- Verify Agora App ID is correct
- Check browser console for errors
- Try a different browser

### Can't See Video:
- Check if using HTTPS or localhost
- Verify token generation is working
- Check Agora console for channel activity

### Chat Not Working:
- Check Supabase Realtime is enabled
- Verify RLS policies are set correctly
- Check browser console for websocket errors

---

## 🚀 Future Enhancements (Optional):

1. **Screen Sharing** - Share your screen during streams
2. **Recording** - Save streams to IPFS
3. **Tipping** - Send tokens during live streams
4. **Co-hosting** - Multiple hosts in one stream
5. **Stream Scheduling** - Schedule streams in advance
6. **Notifications** - Alert followers when you go live
7. **Stream Replays** - Watch past streams
8. **Virtual Gifts** - Send animated gifts during streams

---

## 📚 Resources

- [Agora Documentation](https://docs.agora.io/en/video-calling/get-started/get-started-sdk)
- [Agora Web SDK Reference](https://api-ref.agora.io/en/video-sdk/web/4.x/index.html)
- [Agora Console](https://console.agora.io/)

---

## 💡 Notes

- **Token Security**: The edge function generates tokens server-side for security
- **Bandwidth**: Agora optimizes bandwidth based on network conditions
- **Quality**: Default is 720p @ 30fps, configurable in `src/lib/agora.ts`
- **Latency**: ~300ms with UDP, suitable for real-time interaction
- **Mobile**: Full support via PWA, works on iOS/Android browsers

---

## ✅ Checklist

- [ ] Create Agora account
- [ ] Get App ID and Certificate
- [ ] Set environment variables
- [ ] Deploy database migration
- [ ] Deploy edge function
- [ ] Test "Go Live" feature
- [ ] Test watching a stream
- [ ] Test live chat
- [ ] Verify viewer count updates

---

🎉 **You're all set!** Artists can now go live and interact with their fans in real-time!

