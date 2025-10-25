# 🔧 Lighthouse IPFS Debug Guide

## 🎯 Current Issue
The edge function is hanging on "Uploading avatar..." - this means the Lighthouse IPFS upload is failing or timing out.

## 🔍 Possible Causes

### 1. Missing LIGHTHOUSE_API_KEY
The most likely cause is that the `LIGHTHOUSE_API_KEY` environment variable is not set in your Supabase project.

### 2. Invalid API Key
The API key might be expired or incorrect.

### 3. Network Issues
Lighthouse API might be down or slow.

## 🛠️ Quick Fixes

### Step 1: Check Environment Variables
1. **Go to** [Supabase Dashboard](https://supabase.com/dashboard/project/phybdsfwycygroebrsdx/settings/edge-functions)
2. **Click** "Edge Functions" tab
3. **Check** if `LIGHTHOUSE_API_KEY` is set
4. **If missing**, add it with your Lighthouse API key

### Step 2: Get Lighthouse API Key
1. **Go to** [Lighthouse Dashboard](https://lighthouse.storage/)
2. **Sign up/Login** with your wallet
3. **Go to** "API Keys" section
4. **Create** a new API key
5. **Copy** the key

### Step 3: Add to Supabase
1. **In Supabase Dashboard** → Settings → Edge Functions
2. **Add** environment variable:
   - **Name**: `LIGHTHOUSE_API_KEY`
   - **Value**: `your_lighthouse_api_key_here`
3. **Save** and **redeploy** the function

## 🧪 Test Without IPFS

The updated edge function now has **fallback logic** - it will save the profile even if IPFS fails:

```typescript
try {
  console.log('🔄 Uploading avatar...');
  avatarCid = await uploadToLighthouse(avatarFile, `avatar-${walletAddress}.${avatarFile.name.split('.').pop()}`);
} catch (error) {
  console.error('❌ Avatar upload failed, continuing without avatar:', error);
  // Continue without avatar - don't fail the entire operation
}
```

## 📊 Expected Behavior

### If LIGHTHOUSE_API_KEY is missing:
```
❌ LIGHTHOUSE_API_KEY environment variable is missing
❌ Avatar upload failed, continuing without avatar: [error]
Profile updated successfully
```

### If API key is invalid:
```
❌ Lighthouse upload failed: 401 Unauthorized
❌ Avatar upload failed, continuing without avatar: [error]
Profile updated successfully
```

### If everything works:
```
🔄 Uploading avatar... (12345 bytes)
✅ Uploaded avatar to Lighthouse: QmHash...
Profile updated successfully
```

## 🎯 Next Steps

1. **Check** if `LIGHTHOUSE_API_KEY` is set in Supabase
2. **If missing**, get a Lighthouse API key and add it
3. **Try saving** your profile again
4. **Check Supabase logs** for detailed error messages

The profile should save successfully now, even if IPFS is having issues! 🚀

