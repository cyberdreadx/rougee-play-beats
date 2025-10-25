# Deploy Auto-Create Profiles Function

## 🚨 QUICK FIX - Run This SQL in Supabase Dashboard

Your migrations are out of sync, so the easiest way is to run this SQL directly:

### Step 1: Go to Supabase Dashboard
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query

### Step 2: Copy and Run This SQL

```sql
-- Auto-create profiles for new wallet connections
-- This ensures every user has a profile entry immediately after connecting with Privy

-- Function to ensure profile exists for a wallet
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(p_wallet_address TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normalize wallet address to lowercase
  p_wallet_address := LOWER(p_wallet_address);
  
  -- Insert profile if it doesn't exist (do nothing if it exists)
  INSERT INTO public.profiles (wallet_address, display_name, created_at, updated_at)
  VALUES (
    p_wallet_address,
    CONCAT(SUBSTRING(p_wallet_address, 1, 6), '...', SUBSTRING(p_wallet_address, -4)), -- Default display name
    NOW(),
    NOW()
  )
  ON CONFLICT (wallet_address) DO NOTHING;
  
  RAISE NOTICE 'Profile ensured for wallet: %', p_wallet_address;
END;
$$;

-- Create a function that can be called from the frontend
CREATE OR REPLACE FUNCTION public.create_my_profile(p_wallet_address TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile JSON;
BEGIN
  -- Ensure profile exists
  PERFORM public.ensure_profile_exists(p_wallet_address);
  
  -- Return the profile
  SELECT row_to_json(p.*)
  INTO v_profile
  FROM public.profiles p
  WHERE LOWER(p.wallet_address) = LOWER(p_wallet_address);
  
  RETURN v_profile;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_profile(TEXT) TO anon, authenticated;

-- Add comments
COMMENT ON FUNCTION public.ensure_profile_exists(TEXT) IS 'Automatically creates a basic profile entry if one does not exist for the given wallet address';
COMMENT ON FUNCTION public.create_my_profile(TEXT) IS 'Creates or retrieves the profile for a wallet address';
```

### Step 3: Verify It Worked
Run this to test:
```sql
SELECT create_my_profile('0xaf6f648e136228673c5ad6a5bcbe105350b40207');
```

You should see a JSON response with the profile data!

### Step 4: Try Saving Profile Again
Now go back to your app and try saving the profile again. It should work!

## ✅ What This Does
- Creates two functions:
  1. `ensure_profile_exists()` - Auto-creates profile if missing
  2. `create_my_profile()` - Frontend can call this
- Grants permissions to anonymous and authenticated users
- Uses lowercase wallet addresses for consistency

## 🎯 Result
After running this SQL:
- Your app will auto-create profiles when users log in
- The "wallet not connected" error should disappear
- Profile save should work properly

Run this SQL now and then try saving your profile! 🚀


