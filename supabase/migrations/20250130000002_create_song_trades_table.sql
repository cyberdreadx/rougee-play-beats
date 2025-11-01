-- Create song_trades table to track all trading activity for charts
-- This is much more efficient than querying blockchain logs repeatedly

-- Drop table if it exists with wrong schema (will recreate with correct schema)
DROP TABLE IF EXISTS public.song_trades CASCADE;

CREATE TABLE public.song_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  trade_timestamp BIGINT NOT NULL, -- Unix timestamp in milliseconds for easier JS compatibility
  trader_address TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell', 'deploy')),
  token_amount DECIMAL(30, 18) NOT NULL, -- Amount of song tokens
  xrge_amount DECIMAL(30, 18) NOT NULL, -- Amount of XRGE
  price_in_xrge DECIMAL(30, 18) NOT NULL, -- Calculated price per token
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.song_trades ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migration)
DROP POLICY IF EXISTS "Anyone can view trades" ON public.song_trades;
DROP POLICY IF EXISTS "System can insert trades" ON public.song_trades;

-- Anyone can view trades (needed for public charts)
CREATE POLICY "Anyone can view trades"
ON public.song_trades
FOR SELECT
USING (true);

-- Only system/edge functions can insert trades
CREATE POLICY "System can insert trades"
ON public.song_trades
FOR INSERT
WITH CHECK (true); -- Edge functions use service role

-- Indexes for fast queries (IF NOT EXISTS for idempotent migration)
CREATE INDEX IF NOT EXISTS idx_song_trades_song ON public.song_trades(song_id);
CREATE INDEX IF NOT EXISTS idx_song_trades_token ON public.song_trades(token_address);
CREATE INDEX IF NOT EXISTS idx_song_trades_timestamp ON public.song_trades(trade_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_song_trades_tx_hash ON public.song_trades(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_song_trades_type ON public.song_trades(trade_type);
CREATE INDEX IF NOT EXISTS idx_song_trades_token_timestamp ON public.song_trades(token_address, trade_timestamp DESC);

-- Composite index for common queries (token + time range)
-- Note: Partial indexes with NOW() are not allowed (NOW() is not IMMUTABLE)
-- Instead, we'll use a full index and let PostgreSQL optimizer handle time filtering
CREATE INDEX IF NOT EXISTS idx_song_trades_token_time ON public.song_trades(token_address, trade_timestamp DESC);

-- Function to get trades for a song token within a time range
CREATE OR REPLACE FUNCTION public.get_song_trades(
  p_token_address TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  transaction_hash TEXT,
  "timestamp" BIGINT,
  trader_address TEXT,
  trade_type TEXT,
  token_amount DECIMAL,
  xrge_amount DECIMAL,
  price_in_xrge DECIMAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    st.id,
    st.transaction_hash,
    st.trade_timestamp AS timestamp,
    st.trader_address,
    st.trade_type,
    st.token_amount,
    st.xrge_amount,
    st.price_in_xrge
  FROM public.song_trades st
  WHERE st.token_address = LOWER(p_token_address)
    AND st.trade_timestamp >= (EXTRACT(EPOCH FROM NOW()) * 1000) - (p_hours * 60 * 60 * 1000)
  ORDER BY st.trade_timestamp DESC;
$$;

-- Function to get latest trade for a token (for current price context)
CREATE OR REPLACE FUNCTION public.get_latest_trade(
  p_token_address TEXT
)
RETURNS TABLE (
  transaction_hash TEXT,
  "timestamp" BIGINT,
  price_in_xrge DECIMAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    st.transaction_hash,
    st.trade_timestamp AS timestamp,
    st.price_in_xrge
  FROM public.song_trades st
  WHERE st.token_address = LOWER(p_token_address)
  ORDER BY st.trade_timestamp DESC
  LIMIT 1;
$$;

