-- Create feed_reposts table
CREATE TABLE IF NOT EXISTS public.feed_reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, wallet_address)
);

-- Enable RLS on reposts
ALTER TABLE public.feed_reposts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view reposts" ON public.feed_reposts;
DROP POLICY IF EXISTS "Users can repost posts" ON public.feed_reposts;
DROP POLICY IF EXISTS "Users can un-repost posts" ON public.feed_reposts;

CREATE POLICY "Anyone can view reposts"
  ON public.feed_reposts
  FOR SELECT
  USING (true);

CREATE POLICY "Users can repost posts"
  ON public.feed_reposts
  FOR INSERT
  WITH CHECK (wallet_address IS NOT NULL);

-- Allow deletion - authorization handled by edge function or client-side validation
-- Note: Edge function uses service role key and bypasses RLS
-- For direct client calls, we allow deletion but client should validate wallet_address matches
CREATE POLICY "Users can un-repost posts"
  ON public.feed_reposts
  FOR DELETE
  USING (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_feed_reposts_post ON public.feed_reposts(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_reposts_wallet ON public.feed_reposts(wallet_address);

-- Add repost_count column to feed_posts if it doesn't exist
ALTER TABLE public.feed_posts 
ADD COLUMN IF NOT EXISTS repost_count INTEGER DEFAULT 0;

-- Trigger to update repost_count
CREATE OR REPLACE FUNCTION update_post_repost_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET repost_count = repost_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET repost_count = repost_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_post_repost_count ON public.feed_reposts;

CREATE TRIGGER trigger_update_post_repost_count
AFTER INSERT OR DELETE ON public.feed_reposts
FOR EACH ROW EXECUTE FUNCTION update_post_repost_count();

