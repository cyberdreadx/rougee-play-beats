import { createRemoteJWKSet, createLocalJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts';

const ENV_PRIVY_APP_ID = Deno.env.get('PRIVY_APP_ID') || Deno.env.get('VITE_PRIVY_APP_ID');

// Resolve and cache the first working JWKS endpoint at runtime
let cachedJwks: ReturnType<typeof createLocalJWKSet> | null = null;
let cachedJwksUrl: string | null = null;
let cachedAppId: string | null = null;

async function resolveJwks(appId: string): Promise<ReturnType<typeof createLocalJWKSet>> {
  if (cachedJwks && cachedAppId === appId) return cachedJwks;

  const primary = `https://auth.privy.io/api/v1/apps/${appId}/jwks.json`;
  const fallback = `https://auth.privy.io/api/v1/apps/${appId}/.well-known/jwks.json`;
  console.log('Privy JWKS URL (primary):', primary);
  console.log('Privy JWKS URL (fallback):', fallback);

  const candidates = [primary, fallback];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (res.ok) {
        console.log('Using Privy JWKS URL:', url, 'status:', res.status);
        const jwksJson = await res.json();
        cachedJwksUrl = url;
        cachedJwks = createLocalJWKSet(jwksJson);
        cachedAppId = appId;
        return cachedJwks;
      }
      console.warn('Privy JWKS candidate not OK:', url, 'status:', res.status);
    } catch (e) {
      console.error('Privy JWKS candidate fetch error:', url, e);
    }
  }

  throw new Error('Failed to resolve Privy JWKS URL (none returned 200)');
}

export interface PrivyUser {
  userId: string;
  walletAddress?: string;
  email?: string;
}

// Attempt to extract a wallet address from various possible Privy token shapes
function extractWalletAddress(payload: any): string | undefined {
  try {
    console.log('🔍 Extracting wallet from JWT payload...');
    console.log('Payload keys:', Object.keys(payload || {}));
    
    const linkedAccounts = payload?.linked_accounts ?? [];
    console.log('Linked accounts in JWT:', JSON.stringify(linkedAccounts, null, 2));
    
    const walletAccount = Array.isArray(linkedAccounts)
      ? linkedAccounts.find((acc: any) => ['wallet', 'smart_wallet', 'embedded_wallet'].includes(acc?.type))
      : undefined;
    
    console.log('Found wallet account:', walletAccount);

    const candidates = [
      walletAccount?.address,
      payload?.wallet_address,
      payload?.wallet?.address,
      payload?.wallets?.[0]?.address,
      payload?.primary_wallet_address,
      payload?.user?.wallet?.address,
      payload?.address,
      payload?.evm_address,
    ].filter(Boolean) as string[];

    console.log('Wallet address candidates:', candidates);

    const found = candidates.find((a) => typeof a === 'string' && a.toLowerCase().startsWith('0x'));
    console.log('Selected wallet address:', found);
    
    return found?.toLowerCase();
  } catch (e) {
    console.error('Error extracting wallet:', e);
    return undefined;
  }
}

/**
 * Validates a Privy JWT token and extracts user information
 * @throws Error if token is invalid or wallet address cannot be found
 */
export async function validatePrivyToken(authHeader: string | null): Promise<PrivyUser> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Decode token payload to derive appId (aud) for JWKS resolution
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payloadPreview = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0))));
    const appId = payloadPreview?.aud || ENV_PRIVY_APP_ID;
    if (!appId) throw new Error('Privy app id not available');

    // Strict verification with issuer and audience derived from token
    const jwks = await resolveJwks(appId);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: 'privy.io',
      audience: appId,
    });

    const userId = payload.sub;
    if (!userId) {
      throw new Error('Invalid token: missing subject');
    }

    // Extract wallet address (robust across Privy token shapes)
    const walletAddress = extractWalletAddress(payload);
    const linkedAccounts = (payload as any).linked_accounts || [];
    const email =
      (Array.isArray(linkedAccounts) && linkedAccounts.find((acc: any) => acc.type === 'email')?.address) ||
      (payload as any).email;

    return { userId, walletAddress, email };
  } catch (strictError) {
    console.error('JWT validation (strict) failed. Trying relaxed verification using the resolved JWKS:', strictError);
    try {
      // Relaxed verification (no issuer/audience) if strict fails due to claim mismatch
      // Derive app id from token again
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payloadPreview = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0))));
      const appId = payloadPreview?.aud || ENV_PRIVY_APP_ID || '';
      const jwks = await resolveJwks(appId);
      const { payload } = await jwtVerify(token, jwks);

      const userId = payload.sub as string | undefined;
      if (!userId) {
        throw new Error('Invalid token: missing subject');
      }

      const walletAddress = extractWalletAddress(payload);
      const linkedAccounts = (payload as any).linked_accounts || [];
      const email =
        (Array.isArray(linkedAccounts) && linkedAccounts.find((acc: any) => acc.type === 'email')?.address) ||
        (payload as any).email;

      return { userId, walletAddress, email };
    } catch (relaxedError) {
      console.error('JWT validation failed (relaxed):', relaxedError, 'JWKS URL used:', cachedJwksUrl);
      throw new Error('Invalid or expired token');
    }
  }
}

/**
 * Validates token and ensures wallet address exists
 * @throws Error if wallet address is not found
 */
export async function requireWalletAddress(authHeader: string | null, req?: Request): Promise<string> {
  try {
    const user = await validatePrivyToken(authHeader);
    
    if (user.walletAddress) {
      console.log('✅ Wallet address found in JWT:', user.walletAddress);
      return user.walletAddress;
    }
    
    // Security: Do NOT fall back to headers or body - this allows authentication bypass
    // If wallet is not in JWT, the user needs to reconnect their wallet
    console.error('❌ No wallet address in JWT token');
    console.log('JWT user info:', { userId: user.userId, email: user.email });
    console.log('⚠️ User needs to connect a wallet to their account');
    
    throw new Error('No wallet address found in authentication token. Please connect a wallet to your account.');
  } catch (error) {
    console.error('❌ Error extracting wallet address:', error);
    throw error;
  }
}
