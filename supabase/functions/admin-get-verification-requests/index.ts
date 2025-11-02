import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validatePrivyToken } from '../_shared/privy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-privy-token, x-wallet-address',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Admin verification requests - Starting request');
    
    let walletAddress: string | null = null;
    
    // Try multiple methods to get wallet address
    // Method 1: Check x-wallet-address header (direct from client)
    const headerWallet = req.headers.get('x-wallet-address');
    if (headerWallet) {
      console.log('✅ Wallet from x-wallet-address header:', headerWallet);
      walletAddress = headerWallet.toLowerCase();
    }
    
    // Method 2: Try Privy token (if Authorization header exists)
    if (!walletAddress) {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        try {
          const privyUser = await validatePrivyToken(authHeader);
          if (privyUser.walletAddress) {
            console.log('✅ Wallet from Privy token:', privyUser.walletAddress);
            walletAddress = privyUser.walletAddress.toLowerCase();
          }
        } catch (error) {
          console.warn('⚠️ Privy token validation failed:', error);
          // Continue to next method
        }
      }
    }
    
    // Method 3: Check Supabase auth session
    if (!walletAddress) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization') || '' }
          }
        }
      );
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user?.user_metadata?.wallet_address) {
        console.log('✅ Wallet from Supabase session:', user.user_metadata.wallet_address);
        walletAddress = user.user_metadata.wallet_address.toLowerCase();
      }
    }
    
    if (!walletAddress) {
      console.error('❌ No wallet address found via any method');
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please connect your wallet.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ Final wallet address:', walletAddress);

    // Create service role client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user is admin using server-side validation
    console.log('🔍 Checking admin status for wallet:', walletAddress);
    const { data: isAdmin, error: adminError } = await supabase
      .rpc('is_admin', { check_wallet: walletAddress });

    if (adminError) {
      console.error('❌ Error checking admin status:', adminError);
      throw new Error(`Admin check failed: ${adminError.message}`);
    }

    console.log('🔍 Admin check result:', isAdmin);

    if (!isAdmin) {
      console.log(`❌ Unauthorized admin access attempt from ${walletAddress}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch verification requests with profile data
    console.log('🔍 Fetching verification requests...');
    
    // First, let's try without the foreign key relationship to see if that's the issue
    const { data: requests, error } = await supabase
      .from('verification_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching verification requests:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    console.log('✅ Successfully fetched verification requests:', requests?.length || 0);
    console.log('📋 Requests data:', JSON.stringify(requests, null, 2));

    // Now try to get profile data separately for each request
    const requestsWithProfiles = await Promise.all(
      (requests || []).map(async (request) => {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('artist_name, display_name, artist_ticker, avatar_cid, total_songs, total_plays, verified')
          .eq('wallet_address', request.wallet_address)
          .maybeSingle();
        
        if (profileError) {
          console.warn('⚠️ Error fetching profile for', request.wallet_address, ':', profileError);
        }
        
        return {
          ...request,
          profiles: profile || null
        };
      })
    );

    console.log('✅ Requests with profiles:', requestsWithProfiles?.length || 0);

    console.log(`Admin ${walletAddress} fetched ${requestsWithProfiles?.length || 0} verification requests`);

    return new Response(
      JSON.stringify({ data: requestsWithProfiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin verification requests error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
