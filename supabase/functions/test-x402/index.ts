// Minimal x402 test function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-payment',
  'Access-Control-Expose-Headers': 'x-payment-response'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Test x402 function called');
    
    // Check for X-PAYMENT header
    const hasPayment = req.headers.get('x-payment');
    
    if (!hasPayment) {
      console.log('💸 No payment header - returning 402');
      return new Response(JSON.stringify({
        scheme: 'exact',
        resource: 'test-x402',
        mimeType: 'application/json',
        maxTimeoutSeconds: 300,
        description: 'Test payment required',
        accepts: [{
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: '10000', // $0.01 USDC
          network: 'base',
          recipient: '0xDa31C963E979495f4374979127c34E980eF3184e'
        }]
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Payment header found:', hasPayment.substring(0, 50) + '...');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Test x402 payment verified',
      verified: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      error: 'Test failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
