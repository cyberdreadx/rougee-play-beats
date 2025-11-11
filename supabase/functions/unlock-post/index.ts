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
    
    // Get post creator address for verification
    const { data: postData, error: postError } = await supabase
      .from('feed_posts')
      .select('wallet_address')
      .eq('id', postId)
      .single();

    if (postError || !postData) {
      console.error('❌ Failed to fetch post:', postError);
      return new Response(JSON.stringify({ error: 'Post not found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const creatorAddress = postData.wallet_address.toLowerCase();

    // Verify the transaction is confirmed and successful (with retry logic)
    // Note: Frontend already waits for confirmation, but we retry in case of RPC delays
    let receipt;
    let verified = false;
    const maxRetries = 3; // Reduced from 5 since frontend already confirmed
    const retryDelay = 1000; // Reduced from 2s to 1s

    const publicClient = createPublicClient({
      chain: base,
      transport: http('https://base-mainnet.g.alchemy.com/v2/24-aCNa8b19h_zgsR_292')
    });

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🔍 Attempting to fetch transaction receipt (attempt ${attempt + 1}/${maxRetries})...`);
        receipt = await publicClient.getTransactionReceipt({ hash: transactionHash as `0x${string}` });
        
        if (receipt && receipt.status === 'success') {
          verified = true;
          console.log('✅ Transaction receipt verified on attempt', attempt + 1);
          break;
        } else if (receipt && receipt.status !== 'success') {
          console.error('❌ Transaction failed:', receipt.status);
          return new Response(JSON.stringify({ error: 'Transaction failed on blockchain' }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }
      } catch (verifyError: any) {
        // Check if it's a "not found" error (transaction not yet indexed)
        const isNotFoundError = verifyError?.message?.toLowerCase().includes('not found') || 
                                verifyError?.message?.toLowerCase().includes('does not exist') ||
                                verifyError?.code === -32000;
        
        if (isNotFoundError && attempt < maxRetries - 1) {
          console.log(`⏳ Transaction receipt not indexed yet, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          console.error('❌ Failed to verify transaction receipt:', verifyError);
          return new Response(JSON.stringify({ 
            error: 'Failed to verify transaction', 
            details: verifyError?.message || 'Could not fetch transaction receipt from blockchain. The transaction may still be processing.' 
          }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }
      }
    }

    if (!verified || !receipt) {
      console.error('❌ Transaction not confirmed after all retries');
      return new Response(JSON.stringify({ error: 'Transaction not confirmed. Please wait a moment and try again.' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    
    // Verify the transaction sender matches the wallet address
    if (receipt.from.toLowerCase() !== walletAddress) {
      console.error('❌ Transaction sender mismatch:', receipt.from, 'vs', walletAddress);
      return new Response(JSON.stringify({ error: 'Transaction sender does not match wallet address' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Verify the transaction is a token transfer (check logs for Transfer event)
    // ERC20 Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
    const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const hasTransferEvent = receipt.logs.some(log => 
      log.topics && log.topics[0] === transferEventSignature
    );

    if (!hasTransferEvent) {
      console.warn('⚠️ Transaction does not appear to be a token transfer, but proceeding anyway');
    }

    console.log('✅ Transaction verified successfully');

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

