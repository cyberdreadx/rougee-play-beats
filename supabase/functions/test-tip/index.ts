// Simple test function for tip-artist
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-payment',
  'Access-Control-Expose-Headers': 'x-payment-response',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Handle health check
    if (pathParts[pathParts.length - 1] === 'health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'test-tip',
        protocol: 'x402',
        mode: 'test',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract artistId from URL path
    const artistId = pathParts[pathParts.length - 1];
    if (!artistId) {
      return new Response(JSON.stringify({
        error: 'Missing artist ID',
        message: 'Artist ID is required in the URL path'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const tipAmount = body.amount || '1.00';
    const artistWallet = body.artistWallet || artistId;

    console.log('💸 Test tip request:', {
      artistId,
      artistWallet,
      amount: tipAmount,
    });

    // Check for X-PAYMENT header
    const hasPayment = req.headers.get('x-payment');
    
    if (!hasPayment) {
      // Return 402 Payment Required with x402 protocol format
      const amountInTokens = (parseFloat(tipAmount) * 1_000_000).toString(); // USDC 6 decimals
      
      const paymentRequirements = {
        scheme: 'exact' as const,
        resource: `test-tip/${artistId}`,
        mimeType: 'application/json',
        maxTimeoutSeconds: 300,
        description: `Test tip ${tipAmount} to artist`,
        accepts: [{
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
          amount: amountInTokens,
          network: 'base' as const,
          recipient: artistWallet,
        }],
      };
      
      return new Response(JSON.stringify(paymentRequirements), {
        status: 402,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Payment header exists - simulate success
    console.log('✅ Payment header detected:', hasPayment.substring(0, 50) + '...');

    return new Response(JSON.stringify({
      success: true,
      message: `Test tip successful: $${tipAmount} to ${artistId}`,
      artistId,
      artistWallet,
      amount: tipAmount,
      verified: true,
      test: true,
      network: 'base',
      asset: 'USDC',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error processing test tip:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process test tip',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
