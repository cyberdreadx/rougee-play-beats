// Test script to debug the edge function
const SUPABASE_URL = 'https://phybdsfwycygroebrsdx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoeWJkc2Z3eWN5Z3JvZWJyc2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzM5NjksImV4cCI6MjA3MjI0OTk2OX0.wQY7tt0gN1fvRjgHiPJK7I1M9ZhmgTbLNffGvcbWJko';

async function testEdgeFunction() {
  console.log('🧪 Testing Edge Function...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/test-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'x-wallet-address': '0xAf6F648E136228673C5ad6A5bcbE105350b40207'
      }
    });

    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.text();
    console.log('📊 Response Body:', data);
    
    if (response.ok) {
      console.log('✅ Test passed!');
    } else {
      console.log('❌ Test failed with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testEdgeFunction();
