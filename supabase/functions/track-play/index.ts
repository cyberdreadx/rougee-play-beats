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

    const { songId, durationSeconds = 0 } = await req.json();

    if (!songId) {
      return new Response(
        JSON.stringify({ error: 'Song ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Record the play
    const { data: playId, error: recordError } = await supabase.rpc('record_play', {
      p_user_wallet: walletAddress.toLowerCase(),
      p_song_id: songId,
      p_duration_seconds: durationSeconds
    });

    if (recordError) {
      console.error('Error recording play:', recordError);
      return new Response(
        JSON.stringify({ error: 'Failed to record play' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get updated play status
    const { data: playStatus, error: statusError } = await supabase.rpc('can_user_play_song', {
      p_user_wallet: walletAddress.toLowerCase(),
      p_song_id: songId,
      p_max_free_plays: 3
    });

    if (statusError) {
      console.error('Error getting play status:', statusError);
      return new Response(
        JSON.stringify({ error: 'Failed to get play status' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        playId,
        playStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-play function:', error);
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
