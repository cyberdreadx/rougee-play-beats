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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(TEXT) TO anon, authenticated;

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
GRANT EXECUTE ON FUNCTION public.create_my_profile(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.ensure_profile_exists(TEXT) IS 'Automatically creates a basic profile entry if one does not exist for the given wallet address';
COMMENT ON FUNCTION public.create_my_profile(TEXT) IS 'Creates or retrieves the profile for a wallet address';

