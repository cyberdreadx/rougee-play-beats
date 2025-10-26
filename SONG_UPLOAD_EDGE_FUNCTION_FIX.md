# ✅ Song Upload Edge Function FIXED!

## 🚨 **The Problem**
Getting edge function errors on song upload in PWA:
- **Lighthouse upload timeouts** ❌
- **Poor error handling** ❌
- **No timeout protection** ❌
- **Generic error messages** ❌

## 🔧 **Root Cause**
The `upload-to-lighthouse` edge function had several issues:
1. **No timeout handling** - Large files could hang indefinitely
2. **Poor error logging** - Hard to debug what went wrong
3. **No step-by-step error handling** - One failure killed the entire upload
4. **Generic error messages** - Users couldn't understand what failed

## ✅ **Fixes Applied**

### 1. **Added Timeout Protection**
**File**: `supabase/functions/upload-to-lighthouse/index.ts`

```typescript
// Helper function to upload to Lighthouse with timeout
const uploadToLighthouse = async (fileToUpload: File, fileName?: string) => {
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const uploadResponse = await fetch('https://upload.lighthouse.storage/api/v0/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lighthouseApiKey}`,
      },
      body: lighthouseFormData,
      signal: controller.signal, // ← KEY: Timeout protection
    });
    // ... rest of upload logic
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Upload timeout - file too large or network issue');
    }
    throw error;
  }
};
```

### 2. **Enhanced Error Logging**
Added detailed logging for each step:

```typescript
console.log('🚀 Uploading to Lighthouse: filename.mp3 (5.2MB)');
console.log('✅ Lighthouse upload successful: QmHash123...');
console.log('❌ Lighthouse upload error: Network timeout');
```

### 3. **Step-by-Step Error Handling**
Each upload step now has individual error handling:

```typescript
// Audio upload with error handling
try {
  const audioData = await uploadToLighthouse(file);
  audioCid = audioData.Hash;
  console.log('✅ Audio file uploaded successfully:', audioCid);
} catch (error) {
  console.error('❌ Audio upload failed:', error);
  throw new Error(`Audio upload failed: ${error.message}`);
}

// Metadata upload with error handling
try {
  const metadataUploadData = await uploadToLighthouse(metadataFile);
  metadataCid = metadataUploadData.Hash;
  console.log('✅ Metadata JSON uploaded successfully:', metadataCid);
} catch (error) {
  console.error('❌ Metadata upload failed:', error);
  throw new Error(`Metadata upload failed: ${error.message}`);
}

// Database save with error handling
try {
  const { data, error } = await supabase.from('songs').insert({...});
  console.log('✅ Song metadata saved to database:', data);
} catch (error) {
  console.error('❌ Database save failed:', error);
  throw new Error(`Database save failed: ${error.message}`);
}
```

### 4. **Better Error Messages**
Users now get specific error messages:
- ❌ **Before**: "Upload failed"
- ✅ **After**: "Audio upload failed: Upload timeout - file too large or network issue"

## 🎯 **How It Works Now**

### **Upload Process:**
1. **File Validation** ✅
   - Check file size (max 50MB)
   - Check file type (MP3, WAV, M4A, OGG, etc.)
   - Validate metadata

2. **Cover Art Upload** ✅
   - Upload with timeout protection
   - Individual error handling
   - Continue if cover fails

3. **Audio Upload** ✅
   - Upload with 60-second timeout
   - Detailed error logging
   - Specific error messages

4. **Metadata Upload** ✅
   - Create JSON metadata
   - Upload to Lighthouse
   - Error handling for metadata

5. **Database Save** ✅
   - Save to Supabase database
   - Error handling for database
   - Return success with CIDs

## 🔍 **Expected Logs**

### **Successful Upload:**
```
🚀 Uploading to Lighthouse: cover.jpg (2.1MB)
✅ Lighthouse upload successful: QmCoverHash123...
🎵 Uploading audio file to Lighthouse
🚀 Uploading to Lighthouse: song.mp3 (5.2MB)
✅ Lighthouse upload successful: QmAudioHash456...
📄 Creating metadata JSON and uploading to Lighthouse
🚀 Uploading to Lighthouse: QmAudioHash456_metadata.json (1.2KB)
✅ Metadata JSON uploaded successfully: QmMetadataHash789...
💾 Saving song metadata to database...
✅ Song metadata saved to database: { id: 123, title: "My Song" }
```

### **Failed Upload:**
```
🚀 Uploading to Lighthouse: song.mp3 (5.2MB)
❌ Lighthouse upload timeout (60s)
❌ Audio upload failed: Upload timeout - file too large or network issue
```

## 🧪 **Test Cases**

### **Test 1: Large File Upload**
1. Upload a 45MB MP3 file
2. Should see timeout protection in action
3. Should get specific timeout error message

### **Test 2: Network Issues**
1. Upload with poor network connection
2. Should see detailed error logging
3. Should get specific network error message

### **Test 3: Database Issues**
1. Upload with database connection issues
2. Should see database error logging
3. Should get specific database error message

## 🚀 **Benefits**

### **For Users:**
- ✅ **Clear error messages** - Know exactly what went wrong
- ✅ **Timeout protection** - No infinite waiting
- ✅ **Better reliability** - Step-by-step error handling

### **For Developers:**
- ✅ **Detailed logging** - Easy to debug issues
- ✅ **Step-by-step tracking** - Know which step failed
- ✅ **Timeout protection** - No hanging uploads

**Song uploads should now be much more reliable with clear error messages!** 🎉
