-- Normalize existing wallet addresses in user_plays table
-- This ensures all existing plays use lowercase wallet addresses

UPDATE public.user_plays
SET user_wallet_address = LOWER(user_wallet_address)
WHERE user_wallet_address != LOWER(user_wallet_address);

-- Also normalize user_song_ownership table for consistency
UPDATE public.user_song_ownership
SET user_wallet_address = LOWER(user_wallet_address)
WHERE user_wallet_address != LOWER(user_wallet_address);

-- Add a check constraint to ensure all future inserts use lowercase
-- First, let's make sure all existing data is normalized
DO $$
BEGIN
  -- Check if there are any non-lowercase wallet addresses
  IF EXISTS (
    SELECT 1 FROM public.user_plays 
    WHERE user_wallet_address != LOWER(user_wallet_address)
  ) THEN
    RAISE NOTICE 'Found non-lowercase wallet addresses in user_plays, normalizing...';
    UPDATE public.user_plays
    SET user_wallet_address = LOWER(user_wallet_address)
    WHERE user_wallet_address != LOWER(user_wallet_address);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.user_song_ownership 
    WHERE user_wallet_address != LOWER(user_wallet_address)
  ) THEN
    RAISE NOTICE 'Found non-lowercase wallet addresses in user_song_ownership, normalizing...';
    UPDATE public.user_song_ownership
    SET user_wallet_address = LOWER(user_wallet_address)
    WHERE user_wallet_address != LOWER(user_wallet_address);
  END IF;
END $$;

