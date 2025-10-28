-- Add song_id column to feed_posts table
ALTER TABLE public.feed_posts 
ADD COLUMN IF NOT EXISTS song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_feed_posts_song_id ON public.feed_posts(song_id);

COMMENT ON COLUMN public.feed_posts.song_id IS 'Song that plays with this post (mandatory for new posts)';
