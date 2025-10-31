-- Update play limit from 5 to 3 free plays
-- This changes the default maximum free plays before requiring purchase

-- Update the can_user_play_song function default parameter
CREATE OR REPLACE FUNCTION can_user_play_song(
  p_user_wallet TEXT,
  p_song_id UUID,
  p_max_free_plays INTEGER DEFAULT 3
) RETURNS JSON AS $$
DECLARE
  play_count INTEGER;
  is_owner BOOLEAN;
  can_play BOOLEAN;
  remaining_plays INTEGER;
BEGIN
  -- Get current play count
  play_count := get_user_play_count(p_user_wallet, p_song_id);
  
  -- Check if user owns the song (has token holdings)
  -- Note: This checks user_song_ownership table, but ownership should be based on actual token holdings
  -- The frontend should verify token balance for more accurate ownership checks
  is_owner := user_owns_song(p_user_wallet, p_song_id);
  
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

