import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { requireWalletAddress } from '../_shared/privy.ts';
import { uploadToIPFS } from '../_shared/ipfs-upload.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-privy-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Edge Function Started');
    console.log('📋 Request Headers:', Object.fromEntries(req.headers.entries()));
    console.log('🔐 Validating Privy token...');
    const privyToken = req.headers.get('x-privy-token');
    const authHeader = req.headers.get('authorization');
    
    // Use x-privy-token if available, otherwise use authorization header
    const tokenToValidate = privyToken || authHeader;
    if (!tokenToValidate) {
      throw new Error('Missing authentication token');
    }
    
    // Ensure the token has Bearer prefix for validation
    const normalizedToken = tokenToValidate.startsWith('Bearer ') ? tokenToValidate : `Bearer ${tokenToValidate}`;
    console.log('🔑 Using token for validation:', normalizedToken.substring(0, 20) + '...');

    // Parse form data early to allow wallet fallback
    const formData = await req.formData();
    const providedWalletAddress = (formData.get('walletAddress') as string | null) || req.headers.get('x-wallet-address');

    const { validatePrivyToken } = await import('../_shared/privy.ts');
    const user = await validatePrivyToken(normalizedToken);

    let walletAddress: string;
    if (providedWalletAddress && typeof providedWalletAddress === 'string' && providedWalletAddress.toLowerCase().startsWith('0x')) {
      // Don't lowercase - preserve original casing from request
      walletAddress = providedWalletAddress;
      console.log('✅ Using wallet from request:', walletAddress);
    } else if (user.walletAddress) {
      // Don't lowercase - preserve original casing from JWT
      walletAddress = user.walletAddress;
      console.log('✅ Using wallet from JWT:', walletAddress);
    } else {
      throw new Error('No wallet address provided');
    }
    console.log('✅ Token validated, wallet:', walletAddress);
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // formData already parsed above
    
    // Define validation schema
    const ProfileSchema = z.object({
      display_name: z.string().min(1).max(100).trim(),
      artist_name: z.string().max(100).trim(),
      bio: z.string().max(500).trim(),
      email: z.string().email().max(255).or(z.literal('')),
      artist_ticker: z.string().max(10).regex(/^[A-Z0-9]*$/),
      social_links: z.string()
    });

    const rawData = {
      display_name: formData.get('display_name') as string,
      artist_name: formData.get('artist_name') as string || '',
      bio: formData.get('bio') as string || '',
      email: formData.get('email') as string || '',
      artist_ticker: formData.get('artist_ticker') as string || '',
      social_links: formData.get('social_links') as string || '{}'
    };

    // Validate
    const validation = ProfileSchema.safeParse(rawData);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validation.error.issues }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { display_name: displayName, artist_name: artistName,
            bio, email, artist_ticker: artistTicker, social_links: socialLinks } = validation.data;
    const emailNotifications = formData.get('email_notifications') === 'true';
    const avatarFile = formData.get('avatar') as File | null;
    const coverFile = formData.get('cover') as File | null;

    // Validate files
    if (avatarFile && avatarFile.size > 0) {
      if (avatarFile.size > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Avatar too large (max 10MB)' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(avatarFile.type)) {
        return new Response(JSON.stringify({ error: 'Invalid avatar type' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }

    if (coverFile && coverFile.size > 0) {
      if (coverFile.size > 20 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Cover too large (max 20MB)' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(coverFile.type)) {
        return new Response(JSON.stringify({ error: 'Invalid cover type' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }

    console.log('Processing profile update for:', walletAddress);

    // Fetch existing profile to preserve image CIDs if not uploading new ones
    // Use case-insensitive comparison for wallet address lookup
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('avatar_cid, cover_cid, artist_ticker, wallet_address')
      .ilike('wallet_address', walletAddress)
      .maybeSingle();
    
    // Use the existing wallet address casing if profile exists
    if (existingProfile?.wallet_address) {
      walletAddress = existingProfile.wallet_address;
    } else {
      // Auto-create profile if it doesn't exist
      console.log('🔄 Profile not found, auto-creating for wallet:', walletAddress);
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          wallet_address: walletAddress,
          display_name: `0x${walletAddress.slice(2, 8)}...${walletAddress.slice(-4)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (createError) {
        console.error('❌ Failed to auto-create profile:', createError);
        throw new Error(`Failed to create profile: ${createError.message}`);
      }
      console.log('✅ Auto-created profile for wallet:', walletAddress);
    }

    // Validate ticker if provided AND if it's different from existing ticker
    if (artistTicker) {
      const tickerRegex = /^[A-Z0-9]{3,10}$/;
      const cleanedTicker = artistTicker.toUpperCase().trim();
      if (!tickerRegex.test(cleanedTicker)) {
        throw new Error('Ticker must be 3-10 characters (A-Z, 0-9 only)');
      }

      // Only check availability if ticker is being changed (ignoring case/whitespace)
      const isTickerChanged = (existingProfile?.artist_ticker || '').toUpperCase().trim() !== cleanedTicker;
      if (isTickerChanged) {
        // Check ticker availability
        const { data: existingTicker } = await supabase
          .from('profiles')
          .select('artist_ticker')
          .eq('artist_ticker', cleanedTicker)
          .neq('wallet_address', walletAddress)
          .maybeSingle();

        if (existingTicker) {
          throw new Error('Ticker already taken');
        }
      }
    }

    // Using shared uploadToIPFS function (Pinata primary, Lighthouse fallback)

    // Helper function to upload JSON metadata to IPFS (Pinata primary, Lighthouse fallback)
    const uploadBufferToIPFS = async (jsonString: string, fileName: string) => {
      console.log(`🔄 Uploading JSON metadata to IPFS (${jsonString.length} chars)...`);
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], fileName, { type: 'application/json' });
      
      try {
        const cid = await uploadToIPFS(file, fileName);
        console.log(`✅ Uploaded JSON metadata to IPFS:`, cid);
        return cid;
      } catch (error: any) {
        console.error(`❌ JSON metadata upload failed:`, error.message);
        throw error;
      }
    };

    // Start with existing CIDs or null
    let avatarCid = existingProfile?.avatar_cid || null;
    let coverCid = existingProfile?.cover_cid || null;

    // Upload avatar if provided
    if (avatarFile) {
      console.log('🔄 Uploading avatar...');
      avatarCid = await uploadToIPFS(avatarFile, `avatar-${walletAddress}.${avatarFile.name.split('.').pop()}`);
      if (!avatarCid) {
        throw new Error('Failed to upload avatar image to IPFS');
      }
    }

    // Upload cover if provided
    if (coverFile) {
      console.log('🔄 Uploading cover photo...');
      coverCid = await uploadToIPFS(coverFile, `cover-${walletAddress}.${coverFile.name.split('.').pop()}`);
      if (!coverCid) {
        throw new Error('Failed to upload cover image to IPFS');
      }
    }

    // Create metadata JSON (no verification status - that's managed in Supabase only)
    const metadata = {
      wallet_address: walletAddress,
      display_name: displayName,
      artist_name: artistName || undefined,
      bio,
      artist_ticker: artistTicker ? artistTicker.toUpperCase() : undefined,
      avatar_cid: avatarCid,
      cover_cid: coverCid,
      social_links: JSON.parse(socialLinks),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upload metadata JSON to IPFS
    let metadataCid = null;
    try {
      console.log('🔄 Uploading metadata JSON...');
      metadataCid = await uploadBufferToIPFS(JSON.stringify(metadata), `profile-${walletAddress}.json`);
    } catch (error) {
      console.error('❌ Metadata upload failed, continuing without IPFS metadata:', error);
      // Continue without IPFS metadata - don't fail the entire operation
    }

    // Update Supabase profiles table
    const profileData: any = {
      wallet_address: walletAddress,
      display_name: displayName,
      bio,
      email: email || null,
      email_notifications: emailNotifications,
      social_links: JSON.parse(socialLinks),
      profile_metadata_cid: metadataCid,
      updated_at: new Date().toISOString(),
    };

    if (artistName) profileData.artist_name = artistName;
    if (avatarCid) profileData.avatar_cid = avatarCid;
    if (coverCid) profileData.cover_cid = coverCid;
    if (artistTicker) {
      profileData.artist_ticker = artistTicker.toUpperCase();
      profileData.ticker_created_at = new Date().toISOString();
    }

    let profile: any = null;
    let dbError: any = null;

    if (existingProfile) {
      // Update existing row by exact match to avoid duplicate inserts
      const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('wallet_address', existingProfile.wallet_address)
        .select()
        .single();
      profile = data;
      dbError = error;
    } else {
      // Insert new row (will be normalized by trigger)
      const { data, error } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();
      profile = data;
      dbError = error;
    }

    if (dbError) {
      console.error('Supabase profile save error:', dbError);
      throw new Error(`Failed to update profile: ${dbError.message || dbError}`);
    }

    console.log('Profile updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        cids: {
          metadata: metadataCid,
          avatar: avatarCid,
          cover: coverCid,
        },
        gatewayUrls: {
          metadata: `https://ipfs.io/ipfs/${metadataCid}`,
          avatar: avatarCid ? `https://ipfs.io/ipfs/${avatarCid}` : null,
          cover: coverCid ? `https://ipfs.io/ipfs/${coverCid}` : null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Edge Function Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      error: error
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
