import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { requireWalletAddress } from '../_shared/privy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-privy-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lighthouseApiKey = Deno.env.get('LIGHTHOUSE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Validating Privy token...');
    console.log('Authorization header present:', !!req.headers.get('authorization'));
    console.log('x-privy-token header present:', !!req.headers.get('x-privy-token'));
    
    const formData = await req.formData();
    const providedWalletAddress = formData.get('walletAddress') as string | null;
    
    // Validate JWT token (this throws if invalid/expired)
    const { validatePrivyToken } = await import('../_shared/privy.ts');
    
    // Get the token - prefer Authorization header, fall back to x-privy-token
    let authHeader = req.headers.get('authorization');
    if (!authHeader) {
      const privyToken = req.headers.get('x-privy-token');
      if (privyToken) {
        authHeader = `Bearer ${privyToken}`;
      }
    }
    
    console.log('Auth header to validate:', authHeader ? 'present' : 'missing');
    const user = await validatePrivyToken(authHeader);
    
    // Use wallet from form data if provided, otherwise try to extract from JWT
    let walletAddress: string;
    if (providedWalletAddress && typeof providedWalletAddress === 'string' && providedWalletAddress.toLowerCase().startsWith('0x')) {
      walletAddress = providedWalletAddress.toLowerCase();
    } else if (user.walletAddress) {
      walletAddress = user.walletAddress;
    } else {
      throw new Error('No wallet address provided');
    }
    console.log('Wallet address validated:', walletAddress);
    const contentText = formData.get('content_text') as string;
    const mediaFile = formData.get('media') as File | null;
    const songId = formData.get('song_id') as string | null;

    // Validate that song_id is provided (mandatory for new posts)
    if (!songId) {
      return new Response(JSON.stringify({ error: 'Song selection is required for posts' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Validate input
    const PostSchema = z.object({
      content_text: z.string().max(360).optional(),
      song_id: z.string().uuid()
    });

    const validation = PostSchema.safeParse({ content_text: contentText || '', song_id: songId });
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: validation.error.issues }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Validate media
    if (mediaFile && mediaFile.size > 0) {
      if (mediaFile.size > 20 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Media too large (max 20MB)' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(mediaFile.type)) {
        return new Response(JSON.stringify({ error: 'Invalid media type. Only images and GIFs allowed.' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }

    console.log('Creating feed post for wallet:', walletAddress);

    let mediaCid: string | null = null;
    let mediaType: string | null = null;

    // Upload media to Lighthouse if provided
    if (mediaFile) {
      console.log('Uploading media to Lighthouse:', mediaFile.name, 'Size:', mediaFile.size);

      const attemptUpload = async (attempt: number) => {
        const uploadFormData = new FormData();
        uploadFormData.append('file', mediaFile);

        const timeoutMs = 90000; // 90 seconds
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const uploadResponse = await fetch(
            'https://upload.lighthouse.storage/api/v0/add',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lighthouseApiKey}`,
              },
              body: uploadFormData,
              signal: controller.signal,
            }
          );

          clearTimeout(timer);

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text().catch(() => '');
            console.error(`Lighthouse upload failed (attempt ${attempt}):`, uploadResponse.status, errorText);
            throw new Error(`Lighthouse upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
          }

          const uploadData = await uploadResponse.json();
          return uploadData;
        } catch (uploadError: any) {
          clearTimeout(timer);
          console.error(`Upload error (attempt ${attempt}):`, uploadError);
          throw uploadError;
        }
      };

      let lastError: any = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const uploadData = await attemptUpload(attempt);
          mediaCid = uploadData.Hash;
          mediaType = 'image';

          console.log('Media uploaded to IPFS:', mediaCid);
          break;
        } catch (e: any) {
          lastError = e;
          if (e?.name === 'AbortError') {
            console.warn(`Upload attempt ${attempt} timed out after 90s`);
          }
          // Small backoff before retrying
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }

      if (!mediaCid) {
        const reason = lastError?.name === 'AbortError'
          ? 'Media upload timed out. Please try again shortly.'
          : `Failed to upload media: ${lastError?.message || 'Unknown error'}`;
        throw new Error(reason);
      }
    }

    // Insert post into database
    const { data: post, error: insertError } = await supabase
      .from('feed_posts')
      .insert({
        wallet_address: walletAddress,
        content_text: contentText || null,
        media_cid: mediaCid,
        media_type: mediaType,
        song_id: songId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log('Feed post created:', post.id);

    return new Response(
      JSON.stringify({
        success: true,
        post,
        mediaUrl: mediaCid ? `https://ipfs.io/ipfs/${mediaCid}` : null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error creating feed post:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
