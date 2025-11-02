import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-privy-token, x-wallet-address',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Simple verification request received');
    console.log('📋 Request method:', req.method);
    console.log('📋 Request URL:', req.url);
    console.log('📋 Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Parse request body with better error handling
    let body: any = {};
    try {
      const text = await req.text();
      console.log('📝 Raw request body:', text.substring(0, 500)); // Log first 500 chars
      if (text) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse request body as JSON:', parseError);
      // Try to parse again in case it's already been consumed
      try {
        body = await req.json();
      } catch (e) {
        console.error('❌ Failed to parse JSON:', e);
        body = {};
      }
    }
    
    const { wallet_address, message } = body;
    
    // Also check headers as fallback
    const headerWallet = req.headers.get('x-wallet-address');
    
    const finalWalletAddress = wallet_address || headerWallet;
    
    console.log('📝 Request data:', { 
      wallet_address, 
      message, 
      headerWallet, 
      finalWalletAddress 
    });
    
    // Validate required fields
    if (!finalWalletAddress) {
      console.error('❌ Missing wallet_address in both body and headers');
      return new Response(
        JSON.stringify({ 
          error: 'wallet_address is required in request body or x-wallet-address header',
          received: { body: !!wallet_address, header: !!headerWallet }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const walletAddrStr = String(finalWalletAddress).toLowerCase().trim();
    
    if (!walletAddrStr.startsWith('0x') && !walletAddrStr.startsWith('keeta_')) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid wallet address format. Must start with 0x or keeta_',
          received: walletAddrStr
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      console.error('SUPABASE_URL present:', !!supabaseUrl);
      console.error('SUPABASE_SERVICE_ROLE_KEY present:', !!supabaseKey);
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error: Missing Supabase credentials'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client
    console.log('🔗 Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client created');

    // Check if user already has a pending request
    console.log('🔍 Checking for existing verification requests...');
    const { data: existingRequest, error: checkError } = await supabase
      .from('verification_requests')
      .select('id, status')
      .eq('wallet_address', walletAddrStr)
      .eq('status', 'pending')
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
      console.error('❌ Error checking existing request:', checkError);
      return new Response(
        JSON.stringify({ 
          error: `Database error: ${checkError.message}`,
          code: checkError.code
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (existingRequest) {
      console.log('⚠️ User already has pending request:', existingRequest.id);
      return new Response(
        JSON.stringify({ 
          error: 'You already have a pending verification request',
          requestId: existingRequest.id
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Insert new verification request
    console.log('📝 Inserting new verification request...');
    const { data: insertedData, error: insertError } = await supabase
      .from('verification_requests')
      .insert({
        wallet_address: walletAddrStr,
        message: message || null,
        status: 'pending',
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create verification request: ${insertError.message}`,
          code: insertError.code,
          details: insertError.details
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Verification request created successfully:', insertedData?.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        requestId: insertedData?.id,
        message: 'Verification request submitted successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Verification request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorStack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});