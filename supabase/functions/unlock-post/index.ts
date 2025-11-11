import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json();
    const { postId, transactionHash } = body;
    
    if (!postId) {
      return new Response(JSON.stringify({ error: 'Post ID is required' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Validate JWT token
    const { validatePrivyToken } = await import('../_shared/privy.ts');
    
    let authHeader = req.headers.get('authorization');
    if (!authHeader) {
      const privyToken = req.headers.get('x-privy-token');
      if (privyToken) {
        authHeader = `Bearer ${privyToken}`;
      }
    }
    
    const user = await validatePrivyToken(authHeader);
    const walletAddress = user.walletAddress?.toLowerCase();
    
    if (!walletAddress) {
      return new Response(JSON.stringify({ error: 'No wallet address found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Check if already unlocked
    const { data: existing } = await supabase
      .from('feed_post_unlocks')
      .select('id')
      .eq('post_id', postId)
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, alreadyUnlocked: true }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Record unlock
    const { error: insertError } = await supabase
      .from('feed_post_unlocks')
      .insert({
        post_id: postId,
        wallet_address: walletAddress,
        transaction_hash: transactionHash || null,
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error unlocking post:', error);
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

