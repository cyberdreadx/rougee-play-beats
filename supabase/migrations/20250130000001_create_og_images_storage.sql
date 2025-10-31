-- Create storage bucket for OG images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'og-images',
  'og-images',
  true,
  5242880, -- 5MB limit (OG images should be small)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for og-images bucket
-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Anyone can view OG images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload OG images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update OG images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete OG images" ON storage.objects;

-- Anyone can view OG images (needed for social crawlers)
CREATE POLICY "Anyone can view OG images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'og-images');

-- Service role can upload OG images
CREATE POLICY "Service role can upload OG images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'og-images'
);

-- Service role can update OG images
CREATE POLICY "Service role can update OG images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'og-images')
WITH CHECK (bucket_id = 'og-images');

-- Service role can delete OG images
CREATE POLICY "Service role can delete OG images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'og-images');

