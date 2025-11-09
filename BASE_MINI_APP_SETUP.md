# Base Mini App Setup Guide

This guide explains how ROUGEE.PLAY is configured as a Base Mini App, following the [official Base Mini Apps migration guide](https://docs.base.org/mini-apps/quickstart/migrate-existing-apps).

## What is a Base Mini App?

Base Mini Apps are lightweight web applications that run natively within clients like the Base App. They allow users to:
- Access your app instantly without downloads
- Experience seamless wallet interactions
- Discover your app directly in the social feed
- Share content easily within the Base ecosystem

## Setup Overview

### 1. Install MiniApp SDK

The official Base Mini App SDK is installed:

```bash
npm install @farcaster/miniapp-sdk
```

**Status:** ✅ Installed

### 2. Trigger App Display

The app calls `sdk.actions.ready()` when loaded to hide the loading splash screen. This is handled by the `BaseMiniAppInit` component:

```typescript
import { sdk } from '@farcaster/miniapp-sdk';

// Once app is ready to be displayed
await sdk.actions.ready();
```

**Status:** ✅ Implemented in `src/components/BaseMiniAppInit.tsx`

### 3. Host the Manifest

The manifest file is available at `https://rougee.app/.well-known/farcaster.json`.

**Status:** ✅ Located at `public/.well-known/farcaster.json`

### 4. Manifest Structure

The manifest follows the official Base Mini App format:

```json
{
  "accountAssociation": {
    "header": "",
    "payload": "",
    "signature": ""
  },
  "baseBuilder": {
    "ownerAddress": "0x"
  },
  "miniapp": {
    "version": "1",
    "name": "ROUGEE.PLAY",
    "homeUrl": "https://rougee.app",
    "iconUrl": "https://rougee.app/icons/manifest-icon-512.maskable.png",
    "splashImageUrl": "https://rougee.app/rougee-new-og.jpg",
    "splashBackgroundColor": "#000000",
    "webhookUrl": "https://rougee.app/api/webhook",
    "subtitle": "Stream. Launch. Trade. Own.",
    "description": "Decentralized music platform. Stream, trade, and support artists on the blockchain.",
    "screenshotUrls": ["https://rougee.app/rougee-new-og.jpg"],
    "primaryCategory": "music",
    "tags": ["music", "blockchain", "nft", "trading", "streaming"],
    "heroImageUrl": "https://rougee.app/rougee-new-og.jpg",
    "tagline": "Stream music. Own music. Be music.",
    "ogTitle": "ROUGEE.PLAY - Decentralized Music Platform",
    "ogDescription": "Decentralized music platform. Stream, trade, and support artists on the blockchain.",
    "ogImageUrl": "https://rougee.app/rougee-new-og.jpg",
    "noindex": false
  }
}
```

**Status:** ✅ Configured

**⚠️ Important:** You need to:
1. Update `baseBuilder.ownerAddress` with your Base Account address
2. Generate `accountAssociation` credentials (see Step 5)

### 5. Create Account Association Credentials

The `accountAssociation` fields in the manifest are used to verify ownership of your app.

**Steps to generate:**

1. **Deploy your app** - Ensure all changes are live so the manifest file is available at `https://rougee.app/.well-known/farcaster.json`

2. **Navigate to Base Build** - Go to the [Base Build Account association tool](https://build.base.org/account-association)

3. **Paste your domain** - Enter `rougee.app` in the "App URL" field and click "Submit"

4. **Verify** - Click the "Verify" button and follow the instructions to generate the `accountAssociation` fields

5. **Update manifest** - Copy the generated `accountAssociation` fields and paste them into `public/.well-known/farcaster.json`:

```json
{
  "accountAssociation": {
    "header": "eyJmaWQiOjkxNTIsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgwMmVmNzkwRGQ3OTkzQTM1ZkQ4NDdDMDUzRURkQUU5NDBEMDU1NTk2In0",
    "payload": "eyJkb21haW4iOiJhcHAuZXhhbXBsZS5jb20ifQ",
    "signature": "MHgwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwYzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMTIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxNzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEyNDdhNDhlZGJmMTMwZDU0MmIzMWQzZTg1ZDUyOTAwMmEwNDNkMjM5NjZiNWVjNTNmYjhlNzUzZmIyYzc1MWFmNTI4MWFiYTgxY2I5ZDE3NDAyY2YxMzQxOGI2MTcwYzFiODY3OTExZDkxN2UxMzU3MmVkMWIwYzNkYzEyM2Q1ODAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMjVmMTk4MDg2YjJkYjE3MjU2NzMxYmM0NTY2NzNiOTZiY2VmMjNmNTFkMWZiYWNkZDdjNDM3OWVmNjU0NjU1NzJmMWQwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwOGE3YjIyNzQ3OTcwNjUyMjNhMjI3NzY1NjI2MTc1NzQ2ODZlMmU2NzY1NzQyMjJjMjI2MzY4NjE2YzZjNjU2ZTY3NjUyMjNhMjI2NDJkMzQ0YjMzMzMzNjUyNDY3MDc0MzE0NTYxNjQ2Yjc1NTE0ODU3NDg2ZDc5Mzc1Mzc1Njk2YjQ0MzI0ZjM1NGE2MzRhNjM2YjVhNGM3NDUzMzczODIyMmMyMjZmNzI2OTY3Njk2ZTIyM2EyMjY4NzQ3NDcwNzMzYTJmMmY2YjY1Nzk3MzJlNjM2ZjY5NmU2MjYxNzM2NTJlNjM2ZjZkMjIyYzIyNjM3MjZmNzM3MzRmNzI2OTY3Njk2ZTIyM2E2NjYxNmM3MzY1N2QwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMA"
  },
  "miniapp": {...}
}
```

**Status:** ⚠️ **TODO** - Generate credentials after deployment

**Note:** Because you are signing with your Base Account, the `signature` field will be significantly longer than if you were to sign directly with your Farcaster custody wallet.

### 6. Add Embed Metadata

The `fc:miniapp` metadata is added to `index.html` for rich embeds when your app is shared:

```html
<meta name="fc:miniapp" content='{
  "version": "next",
  "imageUrl": "https://rougee.app/rougee-new-og.jpg",
  "button": {
    "title": "Play Now",
    "action": {
      "type": "launch_miniapp",
      "name": "ROUGEE.PLAY",
      "url": "https://rougee.app"
    }
  }
}' />
```

**Status:** ✅ Added to `index.html`

### 7. Push to Production

Deploy all changes to production.

**Status:** ⚠️ **TODO** - Deploy after completing steps above

### 8. Preview Your App

Use the [Base Build Preview tool](https://build.base.org/preview) to validate your app:

1. Add your app URL (`https://rougee.app`) to view the embeds
2. Click the launch button to verify the app launches as expected
3. Use the "Account association" tab to verify the association credentials were created correctly
4. Use the "Metadata" tab to see the metadata added from the manifest and identify any missing fields

**Status:** ⚠️ **TODO** - Preview after deployment

### 9. Post to Publish

To publish your app, create a post in the Base app with your app's URL: `https://rougee.app`

**Status:** ⚠️ **TODO** - Post after preview validation

## Implementation Details

### SDK Integration

The app uses the official `@farcaster/miniapp-sdk`:

```typescript
import { sdk } from '@farcaster/miniapp-sdk';

// Initialize when app loads
await sdk.actions.ready();
```

**Component:** `src/components/BaseMiniAppInit.tsx`

### Utilities

Base Mini App utilities are available in `src/lib/baseMiniApp.ts`:

```typescript
import { 
  isBaseMiniApp, 
  getBaseAppContext, 
  requestBaseAppWallet,
  getBaseAppUser 
} from '@/lib/baseMiniApp';

// Check if running in Base App
if (isBaseMiniApp()) {
  // Base App specific logic
}

// Get user context
const user = await getBaseAppUser();
```

### Hook

A React hook is available for Base Mini App detection:

```typescript
import { useBaseMiniApp } from '@/hooks/useBaseMiniApp';

const { isBaseMiniApp, baseAppContext, hasBaseAppWallet } = useBaseMiniApp();
```

## Deployment Configuration

### Netlify (`netlify.toml`)

The manifest file is configured to be accessible:

```toml
[[redirects]]
  from = "/.well-known/farcaster.json"
  to = "/.well-known/farcaster.json"
  status = 200
  force = true
```

### Vite

The manifest file is in the `public/.well-known/` directory, which Vite automatically serves as static assets.

## Next Steps

1. ✅ Install `@farcaster/miniapp-sdk`
2. ✅ Update manifest structure
3. ✅ Add `fc:miniapp` meta tag
4. ✅ Integrate SDK and call `sdk.actions.ready()`
5. ⚠️ Update `baseBuilder.ownerAddress` with your Base Account address
6. ⚠️ Generate `accountAssociation` credentials using Base Build
7. ⚠️ Deploy to production
8. ⚠️ Preview using Base Build Preview tool
9. ⚠️ Post to Base App to publish

## Resources

- [Official Migration Guide](https://docs.base.org/mini-apps/quickstart/migrate-existing-apps)
- [Base Build Account Association](https://build.base.org/account-association)
- [Base Build Preview](https://build.base.org/preview)
- [Base Mini App Documentation](https://docs.base.org/mini-apps)
- [MiniKit Framework](https://www.base.org/build/minikit)

---

**Note:** Follow the official migration guide for the most up-to-date instructions and best practices.
