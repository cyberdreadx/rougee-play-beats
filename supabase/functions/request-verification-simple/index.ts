import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-privy-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Simple verification request received');
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { wallet_address, message } = body;
    
    console.log('📝 Request data:', { wallet_address, message });
    
    // Validate required fields
    if (!wallet_address) {
      throw new Error('wallet_address is required');
    }
    
    if (typeof wallet_address !== 'string' || (!wallet_address.startsWith('0x') && !wallet_address.startsWith('keeta_'))) {
      throw new Error('Invalid wallet address format. Must start with 0x or keeta_');
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user already has a pending request
    const { data: existingRequest } = await supabase
      .from('verification_requests')
      .select('id, status')
      .eq('wallet_address', wallet_address.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      throw new Error('You already have a pending verification request');
    }

    // Insert new verification request
    const { error } = await supabase
      .from('verification_requests')
      .insert({
        wallet_address: wallet_address.toLowerCase(),
        message: message || null,
        status: 'pending',
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Verification request created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification request submitted successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Verification request error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
