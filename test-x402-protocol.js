#!/usr/bin/env node
/**
 * x402 Protocol Test Script
 * Tests the artist tipping endpoint using HTTP 402 Payment Required flow
 * 
 * Usage: node test-x402-protocol.js [artistAddress] [amount]
 */

import https from 'https';

// Configuration
const ENDPOINT = 'https://phybdsfwycygroebrsdx.supabase.co/functions/v1/tip-artist';
const DEFAULT_ARTIST = '0xdf833f835c29040597e3bb84e2edf554df25d3eb';
const DEFAULT_AMOUNT = '1.00';

// Parse command line arguments
const artistAddress = process.argv[2] || DEFAULT_ARTIST;
const tipAmount = process.argv[3] || DEFAULT_AMOUNT;

console.log('\n🚀 x402 Protocol Test Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`📍 Endpoint: ${ENDPOINT}`);
console.log(`🎨 Artist: ${artistAddress}`);
console.log(`💰 Amount: $${tipAmount} USD\n`);

// Helper function to make HTTP requests
function makeRequest(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Step 1: Send initial request (expect 402)
async function step1_InitialRequest() {
  console.log('📤 STEP 1: Sending initial request (expecting HTTP 402)...\n');
  
  const url = `${ENDPOINT}/${artistAddress}`;
  
  try {
    const response = await makeRequest(url, {
      method: 'POST',
    }, {
      amount: tipAmount,
      artistWallet: artistAddress,
    });

    console.log(`   Status: ${response.status}`);
    
    if (response.status === 402) {
      console.log('   ✅ Received 402 Payment Required (CORRECT!)\n');
      console.log('   📋 Payment Requirements:');
      
      const requirement = response.data.accepts[0];
      console.log(`      Asset: ${requirement.asset}`);
      console.log(`      Amount: ${requirement.maxAmountRequired} (${parseInt(requirement.maxAmountRequired) / 1_000_000} USDC)`);
      console.log(`      Network: ${requirement.network}`);
      console.log(`      Pay To: ${requirement.payTo}`);
      console.log(`      Description: ${requirement.description}\n`);
      
      return requirement;
    } else {
      console.log(`   ⚠️  Expected 402 but got ${response.status}\n`);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return null;
  }
}

// Step 2: Create payment payload (demo mode)
function step2_CreatePayment(requirements) {
  console.log('🔐 STEP 2: Creating payment payload (DEMO MODE)...\n');
  
  // In a real x402 client using x402-axios, this would:
  // 1. Use the user's private key to sign the payment
  // 2. Create a proper EIP-712 signature
  // 3. Format according to x402 payment specification
  
  const payload = {
    version: '1.0',
    payment: {
      network: requirements.network,
      asset: requirements.asset,
      amount: requirements.maxAmountRequired,
      payTo: requirements.payTo,
      from: '0xDemoSenderWallet',
      signature: 'demo_signature_0x123456789abcdef',
      timestamp: Date.now(),
      nonce: Math.floor(Math.random() * 1000000),
    },
    demo: true,
  };
  
  console.log('   ✅ Payment payload created');
  console.log('   ⚠️  NOTE: This is a DEMO payload');
  console.log('   ⚠️  In production, use real wallet signatures via x402-axios\n');
  console.log('   Payload:', JSON.stringify(payload, null, 2));
  console.log();
  
  return payload;
}

// Step 3: Retry with payment header
async function step3_RetryWithPayment(payload) {
  console.log('📤 STEP 3: Retrying request with X-PAYMENT header...\n');
  
  const url = `${ENDPOINT}/${artistAddress}`;
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  
  try {
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'X-PAYMENT': encodedPayload,
      },
    }, {
      amount: tipAmount,
      artistWallet: artistAddress,
    });

    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('   ✅ Payment accepted! (HTTP 200)\n');
      console.log('   🎉 Tip recorded successfully!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      console.log();
      
      // Check for payment verification response
      const paymentResponse = response.headers['x-payment-response'];
      if (paymentResponse) {
        console.log('   📋 Payment Verification:');
        console.log('   ', JSON.parse(paymentResponse));
        console.log();
      }
      
      return true;
    } else {
      console.log(`   ⚠️  Expected 200 but got ${response.status}\n`);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

// Main execution
async function runTest() {
  console.log('🎬 Starting x402 Protocol Test Flow\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Step 1: Initial request (expect 402)
  const requirements = await step1_InitialRequest();
  
  if (!requirements) {
    console.log('❌ Test failed at Step 1\n');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Step 2: Create payment payload
  const payload = step2_CreatePayment(requirements);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Step 3: Retry with payment
  const success = await step3_RetryWithPayment(payload);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (success) {
    console.log('🎊 x402 PROTOCOL TEST COMPLETE! ✅\n');
    console.log('Summary:');
    console.log('  ✅ Step 1: 402 Payment Required received');
    console.log('  ✅ Step 2: Payment payload created');
    console.log('  ✅ Step 3: Payment accepted (200 OK)');
    console.log('\n✨ Your x402 endpoint is working correctly!\n');
    process.exit(0);
  } else {
    console.log('❌ x402 PROTOCOL TEST FAILED\n');
    process.exit(1);
  }
}

// Run the test
runTest().catch((error) => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
