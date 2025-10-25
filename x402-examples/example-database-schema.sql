-- Database Schema for x402 Integration
-- Add these tables to track x402 payments and API usage

-- Table: x402_payments
-- Stores all verified x402 payments to prevent replay attacks
CREATE TABLE IF NOT EXISTS x402_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_hash TEXT UNIQUE NOT NULL,
  amount DECIMAL(20, 6) NOT NULL, -- USDC amount
  network TEXT NOT NULL DEFAULT 'base',
  sender_address TEXT,
  recipient_address TEXT NOT NULL,
  payment_type TEXT NOT NULL, -- 'premium_play', 'api_call', 'ai_generation', etc.
  metadata JSONB, -- Additional payment details
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick transaction hash lookups (prevent replays)
CREATE INDEX idx_x402_payments_tx_hash ON x402_payments(transaction_hash);
CREATE INDEX idx_x402_payments_recipient ON x402_payments(recipient_address);
CREATE INDEX idx_x402_payments_type ON x402_payments(payment_type);

-- Table: premium_plays
-- Tracks premium song plays with x402 payments
CREATE TABLE IF NOT EXISTS premium_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  artist_wallet TEXT NOT NULL,
  amount_paid DECIMAL(20, 6) NOT NULL,
  artist_revenue DECIMAL(20, 6) NOT NULL, -- 70%
  platform_revenue DECIMAL(20, 6) NOT NULL, -- 20%
  pool_revenue DECIMAL(20, 6) NOT NULL, -- 10%
  transaction_hash TEXT NOT NULL,
  x402_payment_id UUID REFERENCES x402_payments(id),
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX idx_premium_plays_song ON premium_plays(song_id);
CREATE INDEX idx_premium_plays_artist ON premium_plays(artist_wallet);
CREATE INDEX idx_premium_plays_user ON premium_plays(user_wallet);
CREATE INDEX idx_premium_plays_date ON premium_plays(played_at);

-- Table: api_usage_logs
-- Tracks x402 API calls for analytics and billing
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  payment_receipt TEXT NOT NULL,
  amount_paid DECIMAL(20, 6) NOT NULL,
  caller_address TEXT,
  request_metadata JSONB,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  x402_payment_id UUID REFERENCES x402_payments(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for API analytics
CREATE INDEX idx_api_usage_endpoint ON api_usage_logs(endpoint);
CREATE INDEX idx_api_usage_caller ON api_usage_logs(caller_address);
CREATE INDEX idx_api_usage_timestamp ON api_usage_logs(timestamp);

-- Table: artist_x402_revenue
-- Aggregated revenue tracking for artists
CREATE TABLE IF NOT EXISTS artist_x402_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_wallet TEXT NOT NULL UNIQUE,
  total_premium_plays INTEGER DEFAULT 0,
  total_premium_revenue DECIMAL(20, 6) DEFAULT 0,
  total_api_revenue DECIMAL(20, 6) DEFAULT 0,
  total_ai_generation_revenue DECIMAL(20, 6) DEFAULT 0,
  total_exclusive_content_revenue DECIMAL(20, 6) DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for artist lookups
CREATE INDEX idx_artist_revenue_wallet ON artist_x402_revenue(artist_wallet);

-- Table: platform_x402_revenue
-- Platform-wide revenue tracking
CREATE TABLE IF NOT EXISTS platform_x402_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  premium_plays_count INTEGER DEFAULT 0,
  premium_plays_revenue DECIMAL(20, 6) DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  api_calls_revenue DECIMAL(20, 6) DEFAULT 0,
  ai_generation_count INTEGER DEFAULT 0,
  ai_generation_revenue DECIMAL(20, 6) DEFAULT 0,
  total_revenue DECIMAL(20, 6) DEFAULT 0,
  total_artist_payout DECIMAL(20, 6) DEFAULT 0,
  total_platform_fee DECIMAL(20, 6) DEFAULT 0,
  total_pool_contribution DECIMAL(20, 6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for date-based queries
CREATE INDEX idx_platform_revenue_date ON platform_x402_revenue(date);

-- Add premium fields to existing songs table
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_price_usdc DECIMAL(10, 6) DEFAULT 0.01,
ADD COLUMN IF NOT EXISTS premium_play_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS x402_enabled BOOLEAN DEFAULT false;

-- Function: Update artist revenue after premium play
CREATE OR REPLACE FUNCTION update_artist_x402_revenue()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO artist_x402_revenue (
    artist_wallet,
    total_premium_plays,
    total_premium_revenue
  )
  VALUES (
    NEW.artist_wallet,
    1,
    NEW.artist_revenue
  )
  ON CONFLICT (artist_wallet)
  DO UPDATE SET
    total_premium_plays = artist_x402_revenue.total_premium_plays + 1,
    total_premium_revenue = artist_x402_revenue.total_premium_revenue + NEW.artist_revenue,
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update artist revenue on premium play
CREATE TRIGGER trigger_update_artist_revenue
AFTER INSERT ON premium_plays
FOR EACH ROW
EXECUTE FUNCTION update_artist_x402_revenue();

-- Function: Update platform daily revenue
CREATE OR REPLACE FUNCTION update_platform_daily_revenue()
RETURNS TRIGGER AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO platform_x402_revenue (
    date,
    premium_plays_count,
    premium_plays_revenue,
    total_revenue,
    total_artist_payout,
    total_platform_fee,
    total_pool_contribution
  )
  VALUES (
    today,
    1,
    NEW.amount_paid,
    NEW.amount_paid,
    NEW.artist_revenue,
    NEW.platform_revenue,
    NEW.pool_revenue
  )
  ON CONFLICT (date)
  DO UPDATE SET
    premium_plays_count = platform_x402_revenue.premium_plays_count + 1,
    premium_plays_revenue = platform_x402_revenue.premium_plays_revenue + NEW.amount_paid,
    total_revenue = platform_x402_revenue.total_revenue + NEW.amount_paid,
    total_artist_payout = platform_x402_revenue.total_artist_payout + NEW.artist_revenue,
    total_platform_fee = platform_x402_revenue.total_platform_fee + NEW.platform_revenue,
    total_pool_contribution = platform_x402_revenue.total_pool_contribution + NEW.pool_revenue,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update platform daily revenue
CREATE TRIGGER trigger_update_platform_revenue
AFTER INSERT ON premium_plays
FOR EACH ROW
EXECUTE FUNCTION update_platform_daily_revenue();

-- Function: Get artist x402 revenue summary
CREATE OR REPLACE FUNCTION get_artist_x402_summary(artist_wallet_address TEXT)
RETURNS TABLE (
  total_plays BIGINT,
  total_revenue DECIMAL,
  avg_revenue_per_play DECIMAL,
  last_30_days_plays BIGINT,
  last_30_days_revenue DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    SUM(artist_revenue)::DECIMAL,
    AVG(artist_revenue)::DECIMAL,
    COUNT(*) FILTER (WHERE played_at >= NOW() - INTERVAL '30 days')::BIGINT,
    SUM(artist_revenue) FILTER (WHERE played_at >= NOW() - INTERVAL '30 days')::DECIMAL
  FROM premium_plays
  WHERE artist_wallet = artist_wallet_address;
END;
$$ LANGUAGE plpgsql;

-- Function: Get top premium songs
CREATE OR REPLACE FUNCTION get_top_premium_songs(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  song_id UUID,
  title TEXT,
  artist TEXT,
  play_count BIGINT,
  total_revenue DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.title,
    s.artist,
    COUNT(pp.id)::BIGINT AS play_count,
    SUM(pp.amount_paid)::DECIMAL AS total_revenue
  FROM songs s
  JOIN premium_plays pp ON s.id = pp.song_id
  WHERE s.is_premium = true
  GROUP BY s.id, s.title, s.artist
  ORDER BY play_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies

-- Enable RLS on new tables
ALTER TABLE x402_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_x402_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_x402_revenue ENABLE ROW LEVEL SECURITY;

-- x402_payments: Only service role can write, users can read their own
CREATE POLICY "Service role can manage x402_payments"
  ON x402_payments
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Users can view their own payments"
  ON x402_payments
  FOR SELECT
  TO authenticated
  USING (sender_address = auth.jwt() ->> 'wallet_address');

-- premium_plays: Users can view their own plays and artists can view theirs
CREATE POLICY "Users can view their premium plays"
  ON premium_plays
  FOR SELECT
  TO authenticated
  USING (
    user_wallet = auth.jwt() ->> 'wallet_address'
    OR artist_wallet = auth.jwt() ->> 'wallet_address'
  );

CREATE POLICY "Service role can insert premium plays"
  ON premium_plays
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- artist_x402_revenue: Artists can view their own revenue
CREATE POLICY "Artists can view their own x402 revenue"
  ON artist_x402_revenue
  FOR SELECT
  TO authenticated
  USING (artist_wallet = auth.jwt() ->> 'wallet_address');

-- platform_x402_revenue: Public read-only for transparency
CREATE POLICY "Anyone can view platform revenue"
  ON platform_x402_revenue
  FOR SELECT
  TO public
  USING (true);

-- Comments
COMMENT ON TABLE x402_payments IS 'Stores all verified x402 payments to prevent replay attacks';
COMMENT ON TABLE premium_plays IS 'Tracks premium song plays with x402 payments';
COMMENT ON TABLE api_usage_logs IS 'Logs all x402 API calls for analytics';
COMMENT ON TABLE artist_x402_revenue IS 'Aggregated revenue tracking for artists';
COMMENT ON TABLE platform_x402_revenue IS 'Daily platform-wide revenue tracking';

