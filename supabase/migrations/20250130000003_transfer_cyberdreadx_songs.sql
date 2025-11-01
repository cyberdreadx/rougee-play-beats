-- Transfer songs from cyberdreadx wallet to cyberdreadxx wallet
-- Old wallet: 0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc
-- New wallet: 0xc0dca68efdcc63ad109b301585b4b8e38cae344e

-- First, let's verify what will be changed (run these SELECTs first)
SELECT id, title, wallet_address 
FROM public.songs 
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

SELECT wallet_address, artist_name 
FROM public.public_profiles 
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Update songs table wallet_address
UPDATE public.songs
SET wallet_address = '0xc0dca68efdcc63ad109b301585b4b8e38cae344e'
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Update public_profiles table
-- NOTE: If the new wallet already has a profile, we delete the old one instead
-- This prevents the duplicate key constraint violation
-- The profile stats will be recalculated automatically based on songs

-- Check if new wallet profile exists
SELECT 'Existing profile for new wallet:', wallet_address, artist_name, total_songs, total_plays
FROM public.public_profiles 
WHERE LOWER(wallet_address) = LOWER('0xc0dca68efdcc63ad109b301585b4b8e38cae344e');

-- Delete the old profile (new wallet already has one, stats will recalculate)
DELETE FROM public.public_profiles
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Update song_purchases table artist_wallet_address
UPDATE public.song_purchases
SET artist_wallet_address = '0xc0dca68efdcc63ad109b301585b4b8e38cae344e'
WHERE LOWER(artist_wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Update playlists table
UPDATE public.playlists
SET wallet_address = '0xc0dca68efdcc63ad109b301585b4b8e38cae344e'
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Verify the changes after running the updates
SELECT id, title, wallet_address 
FROM public.songs 
WHERE LOWER(wallet_address) = LOWER('0xc0dca68efdcc63ad109b301585b4b8e38cae344e');

SELECT wallet_address, artist_name 
FROM public.public_profiles 
WHERE LOWER(wallet_address) = LOWER('0xc0dca68efdcc63ad109b301585b4b8e38cae344e');

