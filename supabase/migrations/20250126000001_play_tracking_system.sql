-- Play Tracking System Migration
-- Tracks user plays per song with limits and ownership

-- Create user_plays table to track individual plays
CREATE TABLE IF NOT EXISTS user_plays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet_address TEXT NOT NULL,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  play_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_plays_wallet_song ON user_plays(user_wallet_address, song_id);
CREATE INDEX IF NOT EXISTS idx_user_plays_played_at ON user_plays(played_at);

-- Create user_song_ownership table to track ownership
CREATE TABLE IF NOT EXISTS user_song_ownership (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet_address TEXT NOT NULL,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  ownership_type TEXT NOT NULL CHECK (ownership_type IN ('purchased', 'created', 'gifted')),
  token_amount DECIMAL(20, 8) DEFAULT 0,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_wallet_address, song_id)
);

-- Create index for ownership queries
CREATE INDEX IF NOT EXISTS idx_ownership_wallet_song ON user_song_ownership(user_wallet_address, song_id);
CREATE INDEX IF NOT EXISTS idx_ownership_song ON user_song_ownership(song_id);

-- Function to get play count for a user and song
CREATE OR REPLACE FUNCTION get_user_play_count(
  p_user_wallet TEXT,
  p_song_id UUID
) RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM user_plays
    WHERE user_wallet_address = p_user_wallet
    AND song_id = p_song_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user owns a song
CREATE OR REPLACE FUNCTION user_owns_song(
  p_user_wallet TEXT,
  p_song_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_song_ownership
    WHERE user_wallet_address = p_user_wallet
    AND song_id = p_song_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can play a song
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
BEGIN
  -- Get current play count
  play_count := get_user_play_count(p_user_wallet, p_song_id);
  
  -- Check if user owns the song
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

-- Function to record a play
CREATE OR REPLACE FUNCTION record_play(
  p_user_wallet TEXT,
  p_song_id UUID,
  p_duration_seconds INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  play_id UUID;
BEGIN
  -- Insert the play record
  INSERT INTO user_plays (user_wallet_address, song_id, play_duration_seconds)
  VALUES (p_user_wallet, p_song_id, p_duration_seconds)
  RETURNING id INTO play_id;
  
  RETURN play_id;
END;
$$ LANGUAGE plpgsql;

-- Function to grant ownership (for purchases, gifts, etc.)
CREATE OR REPLACE FUNCTION grant_song_ownership(
  p_user_wallet TEXT,
  p_song_id UUID,
  p_ownership_type TEXT,
  p_token_amount DECIMAL DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  ownership_id UUID;
BEGIN
  -- Insert or update ownership record
  INSERT INTO user_song_ownership (user_wallet_address, song_id, ownership_type, token_amount)
  VALUES (p_user_wallet, p_song_id, p_ownership_type, p_token_amount)
  ON CONFLICT (user_wallet_address, song_id)
  DO UPDATE SET
    ownership_type = EXCLUDED.ownership_type,
    token_amount = EXCLUDED.token_amount,
    acquired_at = NOW()
  RETURNING id INTO ownership_id;
  
  RETURN ownership_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for security
ALTER TABLE user_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_song_ownership ENABLE ROW LEVEL SECURITY;

-- Users can only see their own plays
CREATE POLICY "Users can view their own plays" ON user_plays
  FOR SELECT USING (user_wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can only see their own ownership
CREATE POLICY "Users can view their own ownership" ON user_song_ownership
  FOR SELECT USING (user_wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can insert their own plays
CREATE POLICY "Users can record their own plays" ON user_plays
  FOR INSERT WITH CHECK (user_wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can insert their own ownership
CREATE POLICY "Users can record their own ownership" ON user_song_ownership
  FOR INSERT WITH CHECK (user_wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');
