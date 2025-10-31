-- Add download settings fields to songs table
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS download_type TEXT DEFAULT 'disabled' CHECK (download_type IN ('free', 'purchase_usdc', 'holders_only', 'disabled')),
ADD COLUMN IF NOT EXISTS download_price_usdc NUMERIC(10, 2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.songs.download_enabled IS 'Whether downloads are enabled for this song';
COMMENT ON COLUMN public.songs.download_type IS 'Download access type: free, purchase_usdc, holders_only, or disabled';
COMMENT ON COLUMN public.songs.download_price_usdc IS 'USDC price for download (only used if download_type is purchase_usdc)';

-- Add index for filtering songs by download settings
CREATE INDEX IF NOT EXISTS idx_songs_download_enabled ON public.songs(download_enabled) WHERE download_enabled = true;

