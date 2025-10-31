import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-privy-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ImageDimensions {
  width: number;
  height: number;
}

// Target dimensions for OG images (recommended by social platforms)
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: parseError?.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { songId, coverCid } = requestBody;

    if (!songId || !coverCid) {
      return new Response(
        JSON.stringify({ error: 'Missing songId or coverCid' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if OG image already exists
    const { data: existingSong } = await supabaseAdmin
      .from('songs')
      .select('og_image_url')
      .eq('id', songId)
      .single();

    if (existingSong?.og_image_url) {
      // Verify the cached image still exists
      try {
        const imageUrl = new URL(existingSong.og_image_url);
        const pathParts = imageUrl.pathname.split('/');
        const bucket = pathParts[2]; // e.g., /storage/v1/object/public/og-images/...
        const filePath = pathParts.slice(4).join('/'); // e.g., songs/{songId}.jpg
        
        const { data: fileData } = await supabaseAdmin.storage
          .from('og-images')
          .list(filePath.split('/')[0], { limit: 1, search: filePath.split('/')[1] });

        if (fileData && fileData.length > 0) {
          // Cached image exists, return it
          return new Response(
            JSON.stringify({ 
              success: true, 
              ogImageUrl: existingSong.og_image_url,
              cached: true 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      } catch (error) {
        console.log('Cached image not found, will regenerate:', error);
        // Continue to generate new image
      }
    }

    // Fetch image from IPFS
    console.log(`🔄 Fetching cover image from IPFS: ${coverCid}`);
    const ipfsGateways = [
      'https://gateway.lighthouse.storage/ipfs',
      'https://dweb.link/ipfs',
      'https://ipfs.io/ipfs',
      'https://cloudflare-ipfs.com/ipfs',
    ];

    let imageBlob: Blob | null = null;
    let imageResponse: Response | null = null;

    for (const gateway of ipfsGateways) {
      try {
        const ipfsUrl = `${gateway}/${coverCid}`;
        imageResponse = await fetch(ipfsUrl, {
          headers: {
            'Accept': 'image/*',
          },
        });

        if (imageResponse.ok) {
          imageBlob = await imageResponse.blob();
          console.log(`✅ Fetched image from ${gateway}`);
          break;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch from ${gateway}:`, error);
        continue;
      }
    }

    if (!imageBlob || !imageResponse) {
      throw new Error('Failed to fetch image from IPFS gateways');
    }

    // Process and resize image for OG
    console.log('🖼️ Processing image for OG dimensions...');
    const processedImage = await processImageForOG(imageBlob, imageResponse.headers.get('content-type') || 'image/jpeg');

    // Upload to Supabase Storage
    const fileName = `songs/${songId}.jpg`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('og-images')
      .upload(fileName, processedImage, {
        contentType: 'image/jpeg',
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload OG image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('og-images')
      .getPublicUrl(fileName);

    const ogImageUrl = urlData.publicUrl;

    // Update song record with OG image URL
    const { error: updateError } = await supabaseAdmin
      .from('songs')
      .update({ og_image_url: ogImageUrl })
      .eq('id', songId);

    if (updateError) {
      console.error('Database update error:', updateError);
      // Don't fail the request if update fails - the image is still uploaded
    }

    console.log(`✅ OG image cached successfully: ${ogImageUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ogImageUrl,
        cached: false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in cache-og-image function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to cache OG image',
        details: error.toString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Process image to OG dimensions (1200x630)
async function processImageForOG(imageBlob: Blob, contentType: string): Promise<Blob> {
  // Use Canvas API if available, otherwise return original
  // Note: Deno Deploy doesn't have native Canvas support, so we'll use a simpler approach
  // For production, you might want to use an external image processing service or library

  // For now, we'll return the original image
  // In a production setup, you'd want to:
  // 1. Load image into canvas
  // 2. Resize to 1200x630 maintaining aspect ratio (with letterboxing if needed)
  // 3. Convert to JPEG if not already
  // 4. Optimize quality

  // Simple implementation: return original (you can enhance this with sharp.js or similar)
  // The image will still work for OG tags, just not optimized dimensions
  
  // If you have access to an image processing library, use it here:
  // const processed = await resizeImage(imageBlob, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);
  
  // For now, return the original blob
  // Make sure it's JPEG
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    return imageBlob;
  }

  // If not JPEG, we'd need to convert it (which requires image processing)
  // For simplicity, return as-is and let browsers handle it
  return imageBlob;
}

