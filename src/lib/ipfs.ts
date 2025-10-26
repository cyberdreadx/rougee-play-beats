// IPFS utilities for fetching and validating data

// Multiple IPFS gateways for redundancy and to avoid security blocks
// Ordered by actual working status and speed based on debug results
const IPFS_GATEWAYS = [
  'https://gateway.lighthouse.storage/ipfs', // Lighthouse (PRIMARY - your gateway, fastest working)
  'https://dweb.link/ipfs',                  // Protocol Labs gateway (fast and reliable)
  'https://ipfs.io/ipfs',                    // Public IPFS gateway (reliable but slower)
  'https://cloudflare-ipfs.com/ipfs',        // Cloudflare IPFS gateway (CORS issues, moved to fallback)
  'https://gateway.pinata.cloud/ipfs',       // Pinata gateway (timeout issues, moved to fallback)
  'https://ipfs.fleek.co/ipfs',              // Fleek gateway
  'https://gateway.ipfs.io/ipfs',            // Alternative IPFS.io
  'https://ipfs.infura.io/ipfs',             // Infura gateway
  // NOTE: nftstorage.link REMOVED - causing failures on mobile
];

// Cache for working gateways to avoid repeated failures
const gatewayCache = new Map<string, boolean>();

export const getIPFSGatewayUrl = (cid: string, preferredGateway?: string, useProxy = false): string => {
  if (!cid) return '';
  
  // Use proxy if enabled (recommended for audio files to avoid CORS)
  if (useProxy) {
    return `https://phybdsfwycygroebrsdx.supabase.co/functions/v1/ipfs-proxy/${cid}`;
  }
  
  // Use preferred gateway if provided
  if (preferredGateway) {
    return `${preferredGateway}/${cid}`;
  }
  
  // Try to use a cached working gateway first
  for (const [gateway, isWorking] of gatewayCache.entries()) {
    if (isWorking) {
      return `${gateway}/${cid}`;
    }
  }
  
  // Fallback to first gateway (Lighthouse is most reliable for this app)
  return `${IPFS_GATEWAYS[0]}/${cid}`;
};

// Function to get multiple gateway URLs for fallback
export const getIPFSGatewayUrls = (cid: string, count: number = 3, useProxy = false): string[] => {
  if (!cid) return [];
  
  const urls: string[] = [];
  
  // If using proxy, return proxy URLs with different gateways as fallback
  if (useProxy) {
    urls.push(`https://phybdsfwycygroebrsdx.supabase.co/functions/v1/ipfs-proxy/${cid}`);
    
    // Add direct gateway URLs as fallbacks
    for (const gateway of IPFS_GATEWAYS.slice(0, count - 1)) {
      urls.push(`${gateway}/${cid}`);
    }
    return urls;
  }
  
  // Add working gateways first
  for (const [gateway, isWorking] of gatewayCache.entries()) {
    if (isWorking && urls.length < count) {
      urls.push(`${gateway}/${cid}`);
    }
  }
  
  // Fill remaining slots with available gateways
  for (const gateway of IPFS_GATEWAYS) {
    if (!urls.some(url => url.includes(gateway)) && urls.length < count) {
      urls.push(`${gateway}/${cid}`);
    }
  }
  
  // Add proxy as final fallback if we have space
  if (urls.length < count) {
    urls.push(`https://phybdsfwycygroebrsdx.supabase.co/functions/v1/ipfs-proxy/${cid}`);
  }
  
  return urls;
};

export const fetchFromIPFS = async (cid: string, preferredGateway?: string): Promise<any> => {
  if (!cid) throw new Error('CID is required');
  
  // Try multiple gateways with fallback
  const gatewaysToTry = preferredGateway 
    ? [preferredGateway, ...IPFS_GATEWAYS]
    : IPFS_GATEWAYS;
  
  let lastError: Error | null = null;
  
  for (const gateway of gatewaysToTry) {
    try {
      const url = `${gateway}/${cid}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Add timeout to avoid hanging
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        // Cache this gateway as working
        gatewayCache.set(gateway, true);
        return response.json();
      }
      
      // If response is not ok, mark gateway as potentially problematic
      if (response.status >= 500) {
        gatewayCache.set(gateway, false);
      }
      
    } catch (error) {
      lastError = error as Error;
      // Mark gateway as failed
      gatewayCache.set(gateway, false);
      console.warn(`Gateway ${gateway} failed:`, error);
    }
  }
  
  throw new Error(`Failed to fetch from IPFS with all gateways. Last error: ${lastError?.message}`);
};

// Function to get a random working gateway
export const getRandomIPFSGateway = (): string => {
  const workingGateways = Array.from(gatewayCache.entries())
    .filter(([_, isWorking]) => isWorking)
    .map(([gateway, _]) => gateway);
  
  if (workingGateways.length > 0) {
    return workingGateways[Math.floor(Math.random() * workingGateways.length)];
  }
  
  // Fallback to first gateway if no working gateways cached
  return IPFS_GATEWAYS[0];
};

// Function to get all available gateways
export const getAllIPFSGateways = (): string[] => {
  return [...IPFS_GATEWAYS];
};

// Function to test gateway availability
export const testGateway = async (gateway: string, testCid: string = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'): Promise<boolean> => {
  try {
    const url = `${gateway}/${testCid}`;
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second timeout for testing
    });
    
    const isWorking = response.ok;
    gatewayCache.set(gateway, isWorking);
    return isWorking;
  } catch (error) {
    gatewayCache.set(gateway, false);
    return false;
  }
};


export const fetchProfileFromIPFS = async (metadataCid: string) => {
  const metadata = await fetchFromIPFS(metadataCid);
  return {
    ...metadata,
    avatarUrl: metadata.avatar_cid ? getIPFSGatewayUrl(metadata.avatar_cid) : null,
    coverUrl: metadata.cover_cid ? getIPFSGatewayUrl(metadata.cover_cid) : null,
  };
};

export const validateCID = (cid: string): boolean => {
  if (!cid) return false;
  // Basic CID validation (v0 and v1)
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58,})$/.test(cid);
};

export const getOptimizedImageUrl = (cid: string, width?: number, preferredGateway?: string): string => {
  const baseUrl = getIPFSGatewayUrl(cid, preferredGateway);
  return width ? `${baseUrl}?w=${width}` : baseUrl;
};
