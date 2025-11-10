-- Fix get_user_play_count to use LOWER for case-insensitive matching
-- This ensures it matches plays recorded with LOWER(user_wallet_address)

CREATE OR REPLACE FUNCTION get_user_play_count(
  p_user_wallet TEXT,
  p_song_id UUID
) RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM user_plays
    WHERE LOWER(user_wallet_address) = LOWER(p_user_wallet)
    AND song_id = p_song_id
  );
END;
$$ LANGUAGE plpgsql;

-- Also update can_user_play_song to ensure it uses normalized wallet addresses
CREATE OR REPLACE FUNCTION can_user_play_song(
  p_user_wallet TEXT,
  p_song_id UUID,
  p_max_free_plays INTEGER DEFAULT 5
) RETURNS JSON AS $$
DECLARE
  play_count INTEGER;
  is_owner BOOLEAN;
  can_play BOOLEAN;
  remaining_plays INTEGER;
  normalized_wallet TEXT;
BEGIN
  -- Normalize wallet address for consistent comparison
  normalized_wallet := LOWER(p_user_wallet);
  
  -- Get current play count
  play_count := get_user_play_count(normalized_wallet, p_song_id);
  
  -- Check if user owns the song
  is_owner := user_owns_song(normalized_wallet, p_song_id);
  
  -- Determine if user can play
  can_play := is_owner OR play_count < p_max_free_plays;
  
  -- Calculate remaining plays
  remaining_plays := GREATEST(0, p_max_free_plays - play_count);
  
  RETURN json_build_object(
    'can_play', can_play,
    'is_owner', is_owner,
    'play_count', play_count,
    'remaining_plays', remaining_plays,
    'max_free_plays', p_max_free_plays
  );
END;
$$ LANGUAGE plpgsql;

-- Also update user_owns_song for consistency
CREATE OR REPLACE FUNCTION user_owns_song(
  p_user_wallet TEXT,
  p_song_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_song_ownership
    WHERE LOWER(user_wallet_address) = LOWER(p_user_wallet)
    AND song_id = p_song_id
  );
END;
$$ LANGUAGE plpgsql;

-- Also update record_play to normalize wallet address for consistency
CREATE OR REPLACE FUNCTION record_play(
  p_user_wallet TEXT,
  p_song_id UUID,
  p_duration_seconds INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  play_id UUID;
BEGIN
  -- Insert the play record with normalized wallet address
  INSERT INTO user_plays (user_wallet_address, song_id, play_duration_seconds)
  VALUES (LOWER(p_user_wallet), p_song_id, p_duration_seconds)
  RETURNING id INTO play_id;
  
  RETURN play_id;
END;
$$ LANGUAGE plpgsql;

