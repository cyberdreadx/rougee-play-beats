-- Add NSFW column to songs table
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS nsfw BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.songs.nsfw IS 'Whether this song contains content that is not safe for work / 18+ only';

-- Add index for filtering NSFW songs
CREATE INDEX IF NOT EXISTS idx_songs_nsfw ON public.songs(nsfw) WHERE nsfw = true;
