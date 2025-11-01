import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { createPublicClient, http, formatEther, decodeEventLog } from "https://esm.sh/viem@2.0.0";
import { base } from "https://esm.sh/viem@2.0.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BONDING_CURVE_ADDRESS = '0xCeE9c18C448487a1deAac3E14974C826142C50b5' as const;

// ABI for SongTokenBought and SongTokenSold events
const BONDING_CURVE_ABI = [
  {
    type: 'event',
    name: 'SongTokenBought',
    inputs: [
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: true, name: 'songToken', type: 'address' },
      { indexed: false, name: 'xrgeSpent', type: 'uint256' },
      { indexed: false, name: 'tokensBought', type: 'uint256' }
    ]
  },
  {
    type: 'event',
    name: 'SongTokenSold',
    inputs: [
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: true, name: 'songToken', type: 'address' },
      { indexed: false, name: 'tokensSold', type: 'uint256' },
      { indexed: false, name: 'xrgeReceived', type: 'uint256' }
    ]
  }
] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactionHash, songId, tokenAddress } = await req.json();

    if (!transactionHash || !tokenAddress) {
      return new Response(
        JSON.stringify({ error: 'Transaction hash and token address are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if trade already indexed
    const { data: existing } = await supabase
      .from('song_trades')
      .select('id')
      .eq('transaction_hash', transactionHash)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: 'Trade already indexed', id: existing.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get transaction receipt from blockchain
    const publicClient = createPublicClient({
      chain: base,
      transport: http()
    });

    const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash as `0x${string}` });
    if (!receipt) {
      return new Response(
        JSON.stringify({ error: 'Transaction receipt not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get block for timestamp
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const timestamp = Number(block.timestamp) * 1000; // Store as milliseconds (BIGINT in DB)

    // Find SongTokenBought or SongTokenSold event in logs
    let tradeData: {
      trader: string;
      type: 'buy' | 'sell';
      tokenAmount: bigint;
      xrgeAmount: bigint;
    } | null = null;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== BONDING_CURVE_ADDRESS.toLowerCase()) continue;

      try {
        // Try to decode as SongTokenBought
        try {
          const decoded = decodeEventLog({
            abi: BONDING_CURVE_ABI,
            data: log.data,
            topics: log.topics
          });

          if (decoded.eventName === 'SongTokenBought') {
            const args = decoded.args as any;
            if (args.songToken?.toLowerCase() === tokenAddress.toLowerCase()) {
              tradeData = {
                trader: args.buyer,
                type: 'buy',
                tokenAmount: args.tokensBought,
                xrgeAmount: args.xrgeSpent
              };
              break;
            }
          }

          if (decoded.eventName === 'SongTokenSold') {
            const args = decoded.args as any;
            if (args.songToken?.toLowerCase() === tokenAddress.toLowerCase()) {
              tradeData = {
                trader: args.seller,
                type: 'sell',
                tokenAmount: args.tokensSold,
                xrgeAmount: args.xrgeReceived
              };
              break;
            }
          }
        } catch (e) {
          // Not the event we're looking for, continue
          continue;
        }
      } catch (e) {
        // Decode failed, skip this log
        continue;
      }
    }

    if (!tradeData) {
      return new Response(
        JSON.stringify({ error: 'No trade event found in transaction' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calculate price per token
    const tokenAmount = parseFloat(formatEther(tradeData.tokenAmount));
    const xrgeAmount = parseFloat(formatEther(tradeData.xrgeAmount));
    const priceInXRGE = tokenAmount > 0 ? xrgeAmount / tokenAmount : 0;

    // Determine if this is a deploy (first trade)
    const { data: existingTrades } = await supabase
      .from('song_trades')
      .select('id')
      .eq('token_address', tokenAddress.toLowerCase())
      .limit(1);

    const tradeType = existingTrades && existingTrades.length === 0 && tradeData.type === 'sell' 
      ? 'deploy' 
      : tradeData.type;

    // Insert trade into database
    const { data: tradeRecord, error: insertError } = await supabase
      .from('song_trades')
      .insert({
        song_id: songId || null,
        token_address: tokenAddress.toLowerCase(),
        transaction_hash: transactionHash.toLowerCase(),
        block_number: Number(receipt.blockNumber),
        trade_timestamp: timestamp,
        trader_address: tradeData.trader.toLowerCase(),
        trade_type: tradeType,
        token_amount: tokenAmount.toString(),
        xrge_amount: xrgeAmount.toString(),
        price_in_xrge: priceInXRGE.toString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting trade:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to index trade', details: insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        trade: tradeRecord
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in index-song-trade function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

