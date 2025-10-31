-- Add OG image cache URL column to songs table
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS og_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.songs.og_image_url IS 'Cached URL for OG/social media images (stored in Supabase Storage) for reliable social sharing';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_songs_og_image_url ON public.songs(og_image_url) WHERE og_image_url IS NOT NULL;

