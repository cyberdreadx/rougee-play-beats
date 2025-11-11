import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { requireWalletAddress } from '../_shared/privy.ts';
import { uploadToIPFS } from '../_shared/ipfs-upload.ts';

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
    
    // Lock settings
    const isLockedRaw = formData.get('is_locked');
    const isLocked = isLockedRaw === 'true' || isLockedRaw === true;
    const unlockPrice = formData.get('unlock_price') as string | null;
    const unlockTokenType = formData.get('unlock_token_type') as string | null;
    const unlockTokenAddress = formData.get('unlock_token_address') as string | null;
    
    console.log('🔒 Lock settings received (raw):', { 
      isLockedRaw, 
      isLockedRawType: typeof isLockedRaw,
      isLocked, 
      unlockPrice, 
      unlockPriceType: typeof unlockPrice,
      unlockTokenType, 
      unlockTokenTypeType: typeof unlockTokenType,
      unlockTokenAddress 
    });

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

    // Upload media to IPFS (Pinata primary, Lighthouse fallback) if provided
    if (mediaFile) {
      console.log('Uploading media to IPFS:', mediaFile.name, 'Size:', mediaFile.size);
      
      try {
        mediaCid = await uploadToIPFS(mediaFile, mediaFile.name);
        mediaType = 'image';
        console.log('✅ Media uploaded to IPFS:', mediaCid);
      } catch (error: any) {
        console.error('❌ IPFS upload failed:', error.message);
        throw new Error(`Failed to upload media: ${error.message}`);
      }
    }

    // Insert post into database
    const postData: any = {
      wallet_address: walletAddress,
      content_text: contentText || null,
      media_cid: mediaCid,
      media_type: mediaType,
      song_id: songId,
    };
    
    // Add lock settings if post is locked
    // Validate: isLocked must be true, unlockPrice must be a valid number > 0, unlockTokenType must be provided
    const hasValidUnlockPrice = unlockPrice && !isNaN(parseFloat(unlockPrice)) && parseFloat(unlockPrice) > 0;
    const hasValidUnlockTokenType = unlockTokenType && unlockTokenType.trim().length > 0;
    
    console.log('🔍 Lock validation:', {
      isLocked,
      hasValidUnlockPrice,
      hasValidUnlockTokenType,
      unlockPriceValue: unlockPrice,
      parsedPrice: unlockPrice ? parseFloat(unlockPrice) : null
    });
    
    if (isLocked && hasValidUnlockPrice && hasValidUnlockTokenType) {
      postData.is_locked = true;
      postData.unlock_price = parseFloat(unlockPrice);
      postData.unlock_token_type = unlockTokenType.trim();
      if (unlockTokenAddress && unlockTokenAddress.trim().length > 0) {
        postData.unlock_token_address = unlockTokenAddress.trim();
      } else {
        postData.unlock_token_address = null;
      }
      console.log('✅ Post will be created as LOCKED:', {
        is_locked: postData.is_locked,
        unlock_price: postData.unlock_price,
        unlock_token_type: postData.unlock_token_type,
        unlock_token_address: postData.unlock_token_address
      });
    } else {
      postData.is_locked = false;
      postData.unlock_price = null;
      postData.unlock_token_type = null;
      postData.unlock_token_address = null;
      console.log('ℹ️ Post will be created as UNLOCKED (public). Reason:', {
        isLocked,
        hasValidUnlockPrice,
        hasValidUnlockTokenType
      });
    }
    
    console.log('📤 Inserting post data:', JSON.stringify(postData, null, 2));
    
    const { data: post, error: insertError } = await supabase
      .from('feed_posts')
      .insert(postData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      });
      // If it's a constraint violation, provide more specific error
      if (insertError.code === '23514') {
        throw new Error(`Database constraint violation: ${insertError.message}. Make sure unlock_price > 0 and unlock_token_type is provided when is_locked is true.`);
      }
      throw insertError;
    }
    
    console.log('✅ Post created successfully:', {
      id: post.id,
      is_locked: post.is_locked,
      unlock_price: post.unlock_price,
      unlock_token_type: post.unlock_token_type
    });

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
