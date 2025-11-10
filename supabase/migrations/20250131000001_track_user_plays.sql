-- Update increment_play_count to also track individual user plays
-- This function now records each play in the user_plays table

CREATE OR REPLACE FUNCTION public.increment_play_count(
  song_id uuid,
  user_wallet_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet text;
  v_play_id uuid;
BEGIN
  -- Increment play count and capture wallet address
  UPDATE public.songs
  SET play_count = play_count + 1,
      updated_at = now()
  WHERE id = song_id
  RETURNING wallet_address INTO v_wallet;

  -- If we have the artist wallet, update their aggregate stats
  IF v_wallet IS NOT NULL THEN
    PERFORM public.update_artist_stats(v_wallet);
  END IF;

  -- If user_wallet_address is provided, record individual play
  IF user_wallet_address IS NOT NULL THEN
    -- Insert play record into user_plays table
    -- Since this function is SECURITY DEFINER, it bypasses RLS
    INSERT INTO public.user_plays (user_wallet_address, song_id, played_at)
    VALUES (LOWER(user_wallet_address), song_id, now());
    
    -- Note: We track every play, even if the same user plays the same song multiple times
    -- This allows us to see play history and patterns
  END IF;
END;
$$;

-- Ensure anon and authenticated can execute this RPC
GRANT EXECUTE ON FUNCTION public.increment_play_count(uuid, text) TO anon, authenticated;

-- Also create a simpler version that accepts just song_id for backward compatibility
CREATE OR REPLACE FUNCTION public.increment_play_count(song_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet text;
BEGIN
  -- Increment play count and capture wallet address
  UPDATE public.songs
  SET play_count = play_count + 1,
      updated_at = now()
  WHERE id = song_id
  RETURNING wallet_address INTO v_wallet;

  -- If we have the artist wallet, update their aggregate stats
  IF v_wallet IS NOT NULL THEN
    PERFORM public.update_artist_stats(v_wallet);
  END IF;
  
  -- Note: Without user_wallet_address, we don't track individual plays
  -- This maintains backward compatibility
END;
$$;

-- Ensure anon and authenticated can execute this RPC
GRANT EXECUTE ON FUNCTION public.increment_play_count(uuid) TO anon, authenticated;

