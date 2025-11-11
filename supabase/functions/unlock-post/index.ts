import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http } from 'https://esm.sh/viem@2.0.0';
import { base } from 'https://esm.sh/viem@2.0.0/chains';

// Wrap everything in try-catch to ensure errors are logged

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-privy-token',
};

serve(async (req) => {
  try {
    // Log immediately when function is called
    console.log('🚀 unlock-post function called');
    console.log('📋 Method:', req.method);
    console.log('📋 URL:', req.url);
    
    if (req.method === 'OPTIONS') {
      console.log('✅ OPTIONS request - returning CORS headers');
      return new Response(null, { headers: corsHeaders });
    }
    console.log('🔧 Initializing Supabase client...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client created');
    
    console.log('📦 Parsing request body...');
    const body = await req.json();
    console.log('📦 Request body:', { postId: body.postId, hasTransactionHash: !!body.transactionHash, walletAddress: body.walletAddress });
    const { postId, transactionHash, walletAddress: providedWalletAddress } = body;
    
    if (!postId) {
      return new Response(JSON.stringify({ error: 'Post ID is required' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (!transactionHash) {
      return new Response(JSON.stringify({ error: 'Transaction hash is required' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Verify transaction and get sender address from blockchain (no JWT needed!)
    console.log('🔗 Verifying blockchain transaction:', transactionHash);
    
    let walletAddress: string;
    
    if (providedWalletAddress && typeof providedWalletAddress === 'string' && providedWalletAddress.toLowerCase().startsWith('0x')) {
      // Use provided wallet address, but verify it matches the transaction sender
      walletAddress = providedWalletAddress.toLowerCase();
      console.log('✅ Using wallet address from request:', walletAddress);
    } else {
      // Get wallet address from transaction
      try {
        const publicClient = createPublicClient({
          chain: base,
          transport: http('https://base-mainnet.g.alchemy.com/v2/24-aCNa8b19h_zgsR_292')
        });
        
        const tx = await publicClient.getTransaction({ hash: transactionHash as `0x${string}` });
        walletAddress = tx.from.toLowerCase();
        console.log('✅ Extracted wallet address from transaction:', walletAddress);
      } catch (txError: any) {
        console.error('❌ Failed to verify transaction:', txError);
        return new Response(JSON.stringify({ 
          error: 'Failed to verify transaction', 
          details: txError?.message || 'Could not fetch transaction from blockchain' 
        }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }
    
    // Verify the transaction is confirmed and successful
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http('https://base-mainnet.g.alchemy.com/v2/24-aCNa8b19h_zgsR_292')
      });
      
      const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash as `0x${string}` });
      
      if (!receipt || receipt.status !== 'success') {
        console.error('❌ Transaction failed or not confirmed');
        return new Response(JSON.stringify({ error: 'Transaction not confirmed or failed' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      
      // Verify the transaction sender matches the wallet address
      if (receipt.from.toLowerCase() !== walletAddress) {
        console.error('❌ Transaction sender mismatch:', receipt.from, 'vs', walletAddress);
        return new Response(JSON.stringify({ error: 'Transaction sender does not match wallet address' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      
      console.log('✅ Transaction verified successfully');
    } catch (verifyError: any) {
      console.error('❌ Failed to verify transaction receipt:', verifyError);
      return new Response(JSON.stringify({ 
        error: 'Failed to verify transaction', 
        details: verifyError?.message || 'Could not verify transaction on blockchain' 
      }), 
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
    console.error('❌ Error in unlock-post function:', error);
    console.error('❌ Error type:', error?.constructor?.name);
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // Don't return 401 for blockchain verification errors - use 400 instead
    const statusCode = 400;
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    );
  }
});

