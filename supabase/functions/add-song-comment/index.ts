import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { requireWalletAddress } from '../_shared/privy.ts';
import { rateLimitCombined, getClientIP } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-privy-token',
};

// Rate limits: 10 comments per minute per wallet/IP
const COMMENT_RATE_LIMIT = 10;
const COMMENT_RATE_WINDOW = 60 * 1000; // 1 minute

const commentSchema = z.object({
  songId: z.string().uuid(),
  commentText: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment is too long'),
  walletAddress: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { songId, commentText, walletAddress: providedWalletAddress } = commentSchema.parse({
      songId: body.songId,
      commentText: body.commentText,
      walletAddress: body.walletAddress,
    });

    // Accept wallet address from request body (no JWT required - same as upload-story)
    let walletAddress: string | undefined = undefined;
    if (providedWalletAddress && typeof providedWalletAddress === 'string' && providedWalletAddress.toLowerCase().startsWith('0x')) {
      walletAddress = providedWalletAddress.toLowerCase();
      console.log('✅ Using wallet from request:', walletAddress);
    }

    if (!walletAddress) {
      throw new Error('No wallet address provided');
    }

    // Rate limiting: 10 comments per minute per wallet/IP
    const clientIP = getClientIP(req);
    const rateLimitCheck = rateLimitCombined(walletAddress, clientIP, COMMENT_RATE_LIMIT, COMMENT_RATE_WINDOW);
    
    if (!rateLimitCheck.allowed) {
      console.warn(`⚠️ Rate limit exceeded for ${walletAddress} (${clientIP}): ${rateLimitCheck.reason}`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait before posting another comment.',
          reason: rateLimitCheck.reason
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabase
      .from('comments')
      .insert({
        song_id: songId,
        wallet_address: walletAddress,
        comment_text: commentText,
      });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('add-song-comment error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
