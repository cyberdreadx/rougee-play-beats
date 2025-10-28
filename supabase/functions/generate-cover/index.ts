// AI Cover Generation Edge Function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, genre, style } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({
        error: 'Prompt is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enhanced prompt for better album cover results
    const enhancedPrompt = `${prompt}, ${style || 'album cover, square format, high quality'}, ${genre ? `${genre} music` : 'music'}, professional album artwork, detailed, vibrant colors`;

    console.log('🎨 Generating AI cover with prompt:', enhancedPrompt);

    // Try getimg.ai first (free tier - 40 credits/day)
    try {
      const getimgApiKey = Deno.env.get('GETIMG_API_KEY');
      if (getimgApiKey) {
        console.log('🆓 Trying getimg.ai (free tier)...');
        
        // Try different models in order of preference (cheapest first)
        const models = ['flux-schnell', 'seedream-v4'];
        let getimgResponse;
        let getimgData;
        
        for (const model of models) {
          console.log(`🔄 Trying getimg.ai model: ${model}`);
          
          // Model-specific parameters
          const steps = model === 'flux-schnell' ? 4 : 20;
          const guidance = model === 'flux-schnell' ? 1.0 : 7.5;
          const n = model === 'flux-schnell' ? 1 : 4; // FLUX Schnell only supports 1 image
          
          getimgResponse = await fetch(`https://api.getimg.ai/v1/${model}/text-to-image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getimgApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: enhancedPrompt,
              width: 1024,
              height: 1024,
              steps: steps,
              n: n,
              guidance: guidance,
            }),
          });
          
          if (getimgResponse.ok) {
            getimgData = await getimgResponse.json();
            console.log(`✅ getimg.ai success with model: ${model}`);
            break;
          } else {
            const errorData = await getimgResponse.json();
            console.log(`❌ getimg.ai failed with model: ${model}`, errorData);
          }
        }

        if (getimgResponse && getimgResponse.ok) {
          // Handle different response formats
          let images = [];
          if (getimgData.images && getimgData.images.length > 0) {
            // Array format
            images = getimgData.images;
          } else if (getimgData.image) {
            // Single image format (base64)
            images = [`data:image/jpeg;base64,${getimgData.image}`];
          }
          
          console.log('✅ getimg.ai success:', images.length, 'images');
          
          return new Response(JSON.stringify({
            images: images,
            provider: 'getimg.ai',
            prompt: enhancedPrompt,
            cost: getimgData.cost || 0,
            seed: getimgData.seed || 'unknown'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (getimgError) {
      console.log('❌ getimg.ai failed:', getimgError);
    }

    // Fallback to DALL-E 3
    console.log('🔄 Falling back to DALL-E 3...');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('No AI API keys configured');
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1, // DALL-E 3 only generates 1 image at a time
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('✅ DALL-E 3 success:', openaiData.data?.length || 0, 'images');
    
    return new Response(JSON.stringify({
      images: openaiData.data.map((item: any) => item.url),
      provider: 'dall-e-3',
      prompt: enhancedPrompt,
      cost: '$0.040' // DALL-E 3 cost per image
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error generating cover:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate cover',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
