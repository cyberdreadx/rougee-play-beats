-- Add locked post fields to feed_posts table
ALTER TABLE public.feed_posts 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS unlock_price NUMERIC(20, 8) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unlock_token_type TEXT DEFAULT NULL, -- 'XRGE', 'ETH', 'KTA', 'USDC', or 'SONG_TOKEN'
ADD COLUMN IF NOT EXISTS unlock_token_address TEXT DEFAULT NULL; -- For song tokens, the token address

-- Create table to track unlocked posts
CREATE TABLE IF NOT EXISTS public.feed_post_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transaction_hash TEXT, -- Store transaction hash for payment verification
  UNIQUE(post_id, wallet_address)
);

-- Enable RLS on unlocks
ALTER TABLE public.feed_post_unlocks ENABLE ROW LEVEL SECURITY;

-- Anyone can view unlocks (to check if they've unlocked a post)
CREATE POLICY "Anyone can view unlocks"
  ON public.feed_post_unlocks
  FOR SELECT
  USING (true);

-- Users can unlock posts (insert)
CREATE POLICY "Users can unlock posts"
  ON public.feed_post_unlocks
  FOR INSERT
  WITH CHECK (wallet_address IS NOT NULL);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feed_post_unlocks_post ON public.feed_post_unlocks(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_unlocks_wallet ON public.feed_post_unlocks(wallet_address);

-- Add constraint to ensure unlock_price is positive if is_locked is true
ALTER TABLE public.feed_posts
ADD CONSTRAINT check_locked_post_has_price 
CHECK (
  (is_locked = false) OR 
  (is_locked = true AND unlock_price IS NOT NULL AND unlock_price > 0 AND unlock_token_type IS NOT NULL)
);

COMMENT ON COLUMN public.feed_posts.is_locked IS 'Whether this post requires payment to view';
COMMENT ON COLUMN public.feed_posts.unlock_price IS 'Price required to unlock the post';
COMMENT ON COLUMN public.feed_posts.unlock_token_type IS 'Token type: XRGE, ETH, KTA, USDC, or SONG_TOKEN';
COMMENT ON COLUMN public.feed_posts.unlock_token_address IS 'Token address for song tokens (null for XRGE, ETH, KTA, USDC)';

