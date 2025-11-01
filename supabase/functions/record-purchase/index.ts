import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
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
    // Validate wallet address from JWT
    const walletAddress = await requireWalletAddress(req);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { songId, artistWalletAddress } = await req.json();

    if (!songId) {
      return new Response(
        JSON.stringify({ error: 'Song ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!artistWalletAddress) {
      return new Response(
        JSON.stringify({ error: 'Artist wallet address is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Normalize wallet address
    const buyerAddress = walletAddress.toLowerCase();

    // Record the purchase using service role to bypass RLS
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('song_purchases')
      .insert({
        song_id: songId,
        buyer_wallet_address: buyerAddress,
        artist_wallet_address: artistWalletAddress.toLowerCase(),
      })
      .select()
      .single();

    if (purchaseError) {
      // Handle unique constraint violation (duplicate purchase)
      if (purchaseError.code === '23505') {
        console.log('Purchase already recorded for this user and song');
        return new Response(
          JSON.stringify({ 
            success: true,
            alreadyExists: true,
            message: 'Purchase already recorded'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Error recording purchase:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to record purchase', details: purchaseError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        purchase: purchaseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in record-purchase function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

