-- QUICK SQL SCRIPT TO TRANSFER SONGS FROM CYBERDREADX TO CYBERDREADXX
-- Copy and paste this entire script into Supabase SQL Editor
-- Old wallet: 0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc
-- New wallet: 0xc0dca68efdcc63ad109b301585b4b8e38cae344e

BEGIN;

-- First, see what will be changed
SELECT 'Songs to transfer:', COUNT(*) 
FROM public.songs 
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Check if new wallet profile exists
SELECT 'Existing profile for new wallet:', wallet_address, artist_name, total_songs, total_plays
FROM public.public_profiles 
WHERE LOWER(wallet_address) = LOWER('0xc0dca68efdcc63ad109b301585b4b8e38cae344e');

-- Check old wallet profile
SELECT 'Old wallet profile:', wallet_address, artist_name, total_songs, total_plays
FROM public.public_profiles 
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Update songs table (this should work fine)
UPDATE public.songs
SET wallet_address = '0xc0dca68efdcc63ad109b301585b4b8e38cae344e'
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Update song_purchases table
UPDATE public.song_purchases
SET artist_wallet_address = '0xc0dca68efdcc63ad109b301585b4b8e38cae344e'
WHERE LOWER(artist_wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Update playlists table
UPDATE public.playlists
SET wallet_address = '0xc0dca68efdcc63ad109b301585b4b8e38cae344e'
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- For public_profiles: Since new wallet already has a profile, we'll delete the old one
-- The stats will be recalculated automatically based on songs
DELETE FROM public.public_profiles
WHERE LOWER(wallet_address) = LOWER('0x5a12c4a5995f4585bda7be7ddda1a110e0b526fc');

-- Verify the changes
SELECT 'Songs now in new wallet:', COUNT(*) 
FROM public.songs 
WHERE LOWER(wallet_address) = LOWER('0xc0dca68efdcc63ad109b301585b4b8e38cae344e');

SELECT 'Profile for new wallet:', wallet_address, artist_name, total_songs, total_plays
FROM public.public_profiles 
WHERE LOWER(wallet_address) = LOWER('0xc0dca68efdcc63ad109b301585b4b8e38cae344e');

-- If everything looks good, commit. If something's wrong, run ROLLBACK;
COMMIT;

