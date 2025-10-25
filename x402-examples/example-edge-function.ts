// Example: Supabase Edge Function for x402 API Gateway
// supabase/functions/x402-api-gateway/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-payment-receipt, x-payment-amount',
};

// x402 API pricing structure
const API_PRICING = {
  '/api/v1/song/stream': { price: 0.01, description: 'Stream a song' },
  '/api/v1/trending': { price: 0.001, description: 'Get trending songs' },
  '/api/v1/artist/tracks': { price: 0.005, description: 'Get artist tracks' },
  '/api/v1/playlist/generate': { price: 0.05, description: 'Generate AI playlist' },
  '/api/v1/analytics/song': { price: 0.02, description: 'Get song analytics' },
  '/api/v1/analytics/artist': { price: 0.05, description: 'Get artist analytics' },
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.pathname;

    // Check if endpoint exists in pricing
    const pricingInfo = API_PRICING[endpoint];
    if (!pricingInfo) {
      return new Response(
        JSON.stringify({ error: 'Endpoint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for payment receipt header
    const paymentReceipt = req.headers.get('X-Payment-Receipt');
    
    if (!paymentReceipt) {
      // Return 402 Payment Required with payment details
      return new Response(
        JSON.stringify({
          error: 'Payment Required',
          payment: {
            amount: pricingInfo.price,
            currency: 'USDC',
            network: 'base',
            recipient: Deno.env.get('PLATFORM_WALLET_ADDRESS'),
            description: pricingInfo.description,
          }
        }),
        {
          status: 402,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Payment-Amount': `${pricingInfo.price}`,
            'X-Payment-Currency': 'USDC',
            'X-Payment-Network': 'base',
            'X-Payment-Address': Deno.env.get('PLATFORM_WALLET_ADDRESS'),
          }
        }
      );
    }

    // Verify payment
    const paymentVerified = await verifyX402Payment(paymentReceipt, pricingInfo.price);

    if (!paymentVerified) {
      return new Response(
        JSON.stringify({ error: 'Payment verification failed' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log API usage
    await logAPIUsage({
      endpoint,
      paymentReceipt,
      amount: pricingInfo.price,
      timestamp: new Date().toISOString(),
    });

    // Route to appropriate handler
    let responseData;
    switch (endpoint) {
      case '/api/v1/song/stream':
        responseData = await handleStreamSong(url.searchParams.get('id'));
        break;
      case '/api/v1/trending':
        responseData = await handleGetTrending();
        break;
      case '/api/v1/artist/tracks':
        responseData = await handleGetArtistTracks(url.searchParams.get('wallet'));
        break;
      case '/api/v1/playlist/generate':
        responseData = await handleGeneratePlaylist(await req.json());
        break;
      case '/api/v1/analytics/song':
        responseData = await handleSongAnalytics(url.searchParams.get('id'));
        break;
      case '/api/v1/analytics/artist':
        responseData = await handleArtistAnalytics(url.searchParams.get('wallet'));
        break;
      default:
        responseData = { error: 'Not implemented' };
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-API-Version': '1.0',
          'X-Payment-Verified': 'true',
        }
      }
    );

  } catch (error) {
    console.error('API Gateway Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Verify x402 payment on-chain
async function verifyX402Payment(receipt: string, expectedAmount: number): Promise<boolean> {
  try {
    // Parse receipt (contains transaction hash and metadata)
    const receiptData = JSON.parse(atob(receipt));
    
    const { transactionHash, amount, network, recipient } = receiptData;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction already used (prevent replay attacks)
    const { data: existing } = await supabase
      .from('x402_payments')
      .select('id')
      .eq('transaction_hash', transactionHash)
      .single();

    if (existing) {
      console.error('Transaction already used');
      return false;
    }

    // Verify transaction on blockchain
    // TODO: Use viem to verify on Base blockchain
    const verified = await verifyOnChain(transactionHash, amount, network, recipient);

    if (!verified) {
      return false;
    }

    // Store payment record
    await supabase
      .from('x402_payments')
      .insert({
        transaction_hash: transactionHash,
        amount: amount,
        network: network,
        recipient: recipient,
        verified_at: new Date().toISOString(),
      });

    return true;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
}

// Verify transaction on blockchain
async function verifyOnChain(
  txHash: string,
  expectedAmount: number,
  network: string,
  expectedRecipient: string
): Promise<boolean> {
  // TODO: Implement blockchain verification using viem
  // 1. Connect to Base RPC
  // 2. Get transaction receipt
  // 3. Verify USDC transfer event
  // 4. Check amount and recipient match
  
  return true; // Placeholder
}

// Log API usage for analytics
async function logAPIUsage(data: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase
    .from('api_usage_logs')
    .insert({
      endpoint: data.endpoint,
      payment_receipt: data.paymentReceipt,
      amount_paid: data.amount,
      timestamp: data.timestamp,
    });
}

// API Handlers

async function handleStreamSong(songId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: song } = await supabase
    .from('songs')
    .select('*')
    .eq('id', songId)
    .single();

  if (!song) {
    throw new Error('Song not found');
  }

  // Increment play count
  await supabase.rpc('increment_play_count', { song_id: songId });

  return {
    song: {
      id: song.id,
      title: song.title,
      artist: song.artist,
      audio_url: `https://gateway.lighthouse.storage/ipfs/${song.audio_cid}`,
      cover_url: song.cover_cid ? `https://gateway.lighthouse.storage/ipfs/${song.cover_cid}` : null,
    }
  };
}

async function handleGetTrending() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title, artist, play_count, created_at')
    .order('play_count', { ascending: false })
    .limit(50);

  return { trending: songs };
}

async function handleGetArtistTracks(wallet: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .eq('artist_wallet', wallet)
    .order('created_at', { ascending: false });

  return { tracks: songs };
}

async function handleGeneratePlaylist(params: any) {
  // TODO: Implement AI playlist generation
  // Use genre, mood, duration to create personalized playlist
  return {
    playlist: {
      id: 'generated-' + Date.now(),
      name: 'AI Generated Playlist',
      tracks: [],
      generated_at: new Date().toISOString(),
    }
  };
}

async function handleSongAnalytics(songId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get play counts over time
  const { data: analytics } = await supabase
    .from('song_plays')
    .select('played_at, count')
    .eq('song_id', songId)
    .order('played_at', { ascending: false });

  return { analytics };
}

async function handleArtistAnalytics(wallet: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get aggregate stats for artist
  const { data: stats } = await supabase
    .from('songs')
    .select('play_count')
    .eq('artist_wallet', wallet);

  const totalPlays = stats?.reduce((sum, song) => sum + (song.play_count || 0), 0) || 0;

  return {
    analytics: {
      total_plays: totalPlays,
      total_songs: stats?.length || 0,
      average_plays: stats?.length ? totalPlays / stats.length : 0,
    }
  };
}

