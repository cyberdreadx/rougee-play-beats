# 🔧 Edge Function Debug Guide

## 🚨 Current Issue
The `update-artist-profile` edge function is returning **HTTP 400** errors, but we need to see the actual error message.

## 🧪 Debug Steps

### Step 1: Test the Simple Function
1. **Open** `test-edge-function.html` in your browser
2. **Click "Test Edge Function"** button
3. **Check the console** for detailed logs
4. **Check the result** on the page

This will test the basic database connection and profile creation.

### Step 2: Check Supabase Dashboard Logs
1. **Go to** [Supabase Dashboard](https://supabase.com/dashboard/project/phybdsfwycygroebrsdx/functions)
2. **Click** on `update-artist-profile` function
3. **Go to** "Logs" tab
4. **Look for** recent error messages

### Step 3: Test the Main Function
Try saving your profile again and check:
- **Browser Console** for detailed error messages
- **Network Tab** for the actual HTTP response body
- **Supabase Logs** for server-side errors

## 🔍 What to Look For

### Common Issues:
1. **Database Permissions**: Profile table might not allow inserts
2. **Environment Variables**: Missing LIGHTHOUSE_API_KEY or SUPABASE keys
3. **Form Data**: Invalid form data being sent
4. **Privy Token**: Token validation failing
5. **File Upload**: Avatar/cover file issues

### Expected Logs:
```
🚀 Edge Function Started
📋 Request Headers: {...}
🔐 Validating Privy token...
✅ Token validated, wallet: 0x...
🔄 Profile not found, auto-creating for wallet: 0x...
✅ Auto-created profile for wallet: 0x...
Processing profile update for: 0x...
```

## 🛠️ Quick Fixes

### If Database Permission Error:
```sql
-- Run this in Supabase SQL Editor
GRANT INSERT, UPDATE, SELECT ON profiles TO anon, authenticated;
```

### If Environment Variables Missing:
Check Supabase Dashboard → Settings → Edge Functions → Environment Variables

### If Form Data Invalid:
Check the form data being sent in the network request

## 📊 Test Results

After running the test, you should see:
- ✅ **Simple test passes**: Database connection works
- ❌ **Main function fails**: Issue is in the main function logic

## 🎯 Next Steps

1. **Run the test** and share the results
2. **Check Supabase logs** for the actual error
3. **We'll fix** the specific issue once we see the error message

The test function will help us isolate whether it's a database issue or a function logic issue! 🚀
