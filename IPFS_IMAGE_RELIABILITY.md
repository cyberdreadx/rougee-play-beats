# IPFS Image Loading Reliability Fix

## Problem
Images from IPFS sometimes fail to load because:
1. IPFS gateways can be slow or temporarily unavailable
2. Browser `<img>` tags don't automatically retry if a gateway fails
3. Network issues may affect specific gateways differently

## Solution
Created an `IPFSImage` component that automatically handles gateway fallback.

### Features
- **Automatic Fallback**: Tries multiple IPFS gateways (up to 5 by default) if the first one fails
- **Lazy Loading**: Uses native browser lazy loading for performance
- **Fallback Placeholder**: Shows a fallback image if all gateways fail
- **Logging**: Console logs help debug gateway issues

### Usage

#### Basic Usage
```tsx
import { IPFSImage } from '@/components/IPFSImage';

<IPFSImage
  cid="QmYourCIDHere"
  alt="Description"
  className="w-10 h-10 rounded-full"
/>
```

#### With Custom Fallback
```tsx
<IPFSImage
  cid={song.cover_cid}
  alt={song.title}
  fallback="/placeholder-cover.png"
  className="w-full h-full object-cover"
/>
```

#### With Custom Retry Count
```tsx
<IPFSImage
  cid={profile.avatar_cid}
  alt="Avatar"
  maxRetries={3}
  fallback="/default-avatar.png"
  className="w-12 h-12 rounded-full"
/>
```

### Gateway Selection
The component uses `getIPFSGatewayUrls()` from `src/lib/ipfs.ts`, which provides:
1. **Primary Gateway**: Lighthouse (fastest for this app)
2. **Fallback Gateways**: dweb.link, ipfs.io, Cloudflare, Pinata, etc.
3. **Smart Caching**: Remembers which gateways work best

### How It Works
1. Component loads with the first gateway URL
2. If image fails to load (`onError`), automatically switches to next gateway
3. Tries up to `maxRetries` gateways (default: 5)
4. If all gateways fail, shows fallback image
5. Logs progress to console for debugging

### Migration Guide

**Before:**
```tsx
<img 
  src={getIPFSGatewayUrl(song.cover_cid)} 
  alt="Cover" 
  className="w-10 h-10"
/>
```

**After:**
```tsx
<IPFSImage 
  cid={song.cover_cid}
  alt="Cover" 
  className="w-10 h-10"
/>
```

### Where to Use
Replace regular `<img>` tags with `IPFSImage` for:
- ✅ Avatar images (`avatar_cid`)
- ✅ Cover images (`cover_cid`)
- ✅ Post media (`media_cid`)
- ✅ Story thumbnails
- ❌ NOT for audio files (those use `getIPFSGatewayUrl` with proxy)

### Performance Impact
- **Minimal**: Component uses lazy loading and only retries on failure
- **Better UX**: Users see images that would otherwise fail to load
- **Smart**: Stops trying after reasonable attempts, shows fallback

### Monitoring
Check browser console for IPFSImage logs:
- `[IPFSImage] Trying gateway X/Y for CID: ...` - Attempting fallback
- `[IPFSImage] Successfully loaded from gateway X: ...` - Success
- `[IPFSImage] All gateways failed for CID: ...` - All attempts failed

### Future Improvements
- [ ] Add loading spinner while trying gateways
- [ ] Persist working gateway preferences in localStorage
- [ ] Add retry button for failed images
- [ ] Track gateway success rates for analytics

