-- Create artist_tips table for x402 protocol tipping
CREATE TABLE IF NOT EXISTS public.artist_tips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id TEXT NOT NULL,
  amount_usd NUMERIC(10, 2) NOT NULL,
  payment_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_artist_tips_artist_id ON public.artist_tips(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_tips_created_at ON public.artist_tips(created_at DESC);

-- Add RLS policies
ALTER TABLE public.artist_tips ENABLE ROW LEVEL SECURITY;

-- Anyone can read tips
CREATE POLICY "Anyone can view tips"
  ON public.artist_tips
  FOR SELECT
  USING (true);

-- Service role can insert (from edge function)
CREATE POLICY "Service role can insert tips"
  ON public.artist_tips
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.artist_tips IS 'Tracks artist tips sent via x402 protocol';
