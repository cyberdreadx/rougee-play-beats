# 🔍 Play Tracking Debug Guide

## 🚨 **Current Issue**
The `user_plays` table is empty, meaning plays aren't being recorded.

## 🔧 **Debug Steps**

### **Step 1: Check Console Logs**
Look for these logs when playing a song:
- `🎵 Starting play recording timer for: [song title]`
- `🎵 Recording play for song: [song title]`
- `🎵 Recording play for: {wallet: "0x...", songId: "...", duration: 0}`

### **Step 2: Test Manual Insert**
1. Open `test-play-insert.html` in browser
2. Click "Test Insert Play" button
3. Check if record appears in `user_plays` table

### **Step 3: Check Authentication**
Verify these values in console:
- `fullAddress` - Should show wallet address
- `authenticated` - Should be `true`
- `playStatus` - Should show play status object

### **Step 4: Check Database Functions**
Look for these RPC errors:
- `function "record_play" does not exist`
- `function "can_user_play_song" does not exist`

## 🎯 **Expected Behavior**

### **When Playing a Song:**
1. **Console logs** should show:
   ```
   🎵 Starting play recording timer for: Song Title
   🎵 Recording play for song: Song Title
   🎵 Recording play for: {wallet: "0x...", songId: "...", duration: 0}
   ```

2. **Database insert** should happen:
   - Either via RPC function `record_play`
   - Or via direct insert to `user_plays` table

3. **Table should update**:
   - New record in `user_plays` table
   - With user wallet address and song ID

## 🚀 **Fixes Applied**

### **1. Enhanced Logging**
```typescript
console.log('🎵 Starting play recording timer for:', currentSong.title);
console.log('🎵 Recording play for song:', currentSong.title);
console.log('🎵 Recording play for:', { wallet: fullAddress, songId: targetSongId, duration: durationSeconds });
```

### **2. Direct Insert Fallback**
```typescript
// If RPC function doesn't exist, try direct insert
const { data: insertData, error: insertError } = await supabase
  .from('user_plays')
  .insert({
    user_wallet_address: fullAddress.toLowerCase(),
    song_id: targetSongId,
    play_duration_seconds: durationSeconds
  })
  .select();
```

### **3. Better Error Handling**
```typescript
if (!fullAddress || !targetSongId) {
  console.log('❌ Cannot record play: missing wallet address or song ID');
  return false;
}
```

## 🧪 **Test Cases**

### **Test 1: Console Logs**
1. **Open browser console**
2. **Play a song**
3. **Look for logs** starting with `🎵`
4. **Should see** play recording attempts

### **Test 2: Manual Insert**
1. **Open `test-play-insert.html`**
2. **Click "Test Insert Play"**
3. **Check result** - Should show success or error
4. **Check database** - Should see new record

### **Test 3: Authentication Check**
1. **Check console** for wallet address
2. **Verify** `authenticated` is `true`
3. **Verify** `playStatus` is not null

## 🔍 **Common Issues**

### **Issue 1: No Console Logs**
- **Cause**: Play recording not triggered
- **Fix**: Check if `authenticated` and `playStatus?.canPlay` are true

### **Issue 2: RPC Function Errors**
- **Cause**: Database functions not deployed
- **Fix**: System falls back to direct insert

### **Issue 3: Authentication Issues**
- **Cause**: Wallet not connected properly
- **Fix**: Check `fullAddress` and `authenticated` values

### **Issue 4: Database Permissions**
- **Cause**: RLS policies blocking inserts
- **Fix**: Check RLS policies in Supabase dashboard

## 📊 **Expected Database Records**

### **user_plays Table Should Show:**
```
id: uuid
user_wallet_address: "0xec2F9eFd0A5118bB7F5C3C768249F5bD96ecDDEc"
song_id: "actual-song-id"
played_at: "2025-01-26T00:00:00Z"
play_duration_seconds: 0
```

## 🚀 **Next Steps**

1. **Check console logs** when playing songs
2. **Test manual insert** with HTML file
3. **Verify authentication** is working
4. **Check database** for new records
5. **Report findings** for further debugging

**The play tracking system should now record plays properly!** 🎉
