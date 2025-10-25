import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-privy-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 TEST FUNCTION STARTED');
    console.log('📋 Request Headers:', Object.fromEntries(req.headers.entries()));
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get wallet address from headers
    const walletAddress = req.headers.get('x-wallet-address');
    if (!walletAddress) {
      throw new Error('No wallet address provided');
    }

    console.log('🔍 Testing with wallet:', walletAddress);

    // Test 1: Check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('wallet_address', walletAddress)
      .maybeSingle();

    console.log('📊 Profile fetch result:', { existingProfile, fetchError });

    // Test 2: Try to create profile if it doesn't exist
    if (!existingProfile) {
      console.log('🔄 Creating new profile...');
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          wallet_address: walletAddress,
          display_name: `0x${walletAddress.slice(2, 8)}...${walletAddress.slice(-4)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      console.log('📊 Profile creation result:', { newProfile, createError });
      
      if (createError) {
        throw new Error(`Failed to create profile: ${createError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test completed successfully',
        walletAddress,
        profileExists: !!existingProfile
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Test Function Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
