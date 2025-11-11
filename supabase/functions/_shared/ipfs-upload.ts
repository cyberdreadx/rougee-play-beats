// Shared IPFS upload function with Pinata (primary) and Lighthouse (fallback)

export interface UploadResult {
  Hash: string;
  Name?: string;
  Size?: string;
}

/**
 * Upload file to IPFS using Pinata (primary) or Lighthouse (fallback)
 * @param file - File to upload
 * @param fileName - Optional filename
 * @returns CID hash of uploaded file
 */
export async function uploadToIPFS(
  file: File,
  fileName?: string
): Promise<string> {
  const pinataJWT = Deno.env.get('PINATA_JWT');
  const lighthouseApiKey = Deno.env.get('LIGHTHOUSE_API_KEY');

  if (!pinataJWT && !lighthouseApiKey) {
    throw new Error('No IPFS service configured. Please set PINATA_JWT or LIGHTHOUSE_API_KEY');
  }

  // Try Pinata first (more reliable)
  if (pinataJWT) {
    try {
      console.log('📌 Attempting Pinata upload...');
      const cid = await uploadToPinata(file, fileName || file.name, pinataJWT, 3);
      console.log('✅ Pinata upload successful:', cid);
      return cid;
    } catch (error: any) {
      console.error('❌ Pinata upload failed after retries:', error.message);
      // Only fall through to Lighthouse if it's a service error, not auth/permission errors
      if (error.message.includes('authentication failed') || 
          error.message.includes('access denied') ||
          error.message.includes('account has been disabled') ||
          error.message.includes('rate limit exceeded')) {
        // Don't try Lighthouse for auth/permission/account errors - throw immediately
        throw new Error(`Pinata upload failed: ${error.message}`);
      }
      console.warn('⚠️ Pinata upload failed, trying Lighthouse fallback...');
      // Fall through to Lighthouse
    }
  }

  // Fallback to Lighthouse
  if (lighthouseApiKey) {
    try {
      console.log('🪶 Attempting Lighthouse upload (fallback)...');
      const result = await uploadToLighthouse(file, fileName || file.name, lighthouseApiKey);
      console.log('✅ Lighthouse upload successful:', result.Hash);
      return result.Hash;
    } catch (error: any) {
      console.error('❌ Lighthouse upload also failed:', error.message);
      const pinataError = pinataJWT ? 'Pinata failed (see logs above)' : 'Pinata not configured';
      throw new Error(`Both IPFS services failed. ${pinataError}. Lighthouse error: ${error.message}`);
    }
  }

  throw new Error('No IPFS service available');
}

/**
 * Upload file to Pinata using the v3 API (more reliable)
 * Based on: https://docs.pinata.cloud/files/uploading-files
 * Includes retry logic with exponential backoff for transient errors
 */
async function uploadToPinata(
  file: File,
  fileName: string,
  jwt: string,
  retries: number = 3
): Promise<string> {
  const maxRetries = retries;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('file', file, fileName);

      // Pinata metadata (optional but recommended)
      const metadata = JSON.stringify({
        name: fileName,
      });
      formData.append('pinataMetadata', metadata);

      // Pinata options (optional) - use CID v1 for better compatibility
      const options = JSON.stringify({
        cidVersion: 1,
      });
      formData.append('pinataOptions', options);

      // Dynamic timeout based on file size (min 60s, +30s per 5MB)
      const fileSizeMB = file.size / (1024 * 1024);
      const timeoutMs = Math.max(60000, 60000 + Math.ceil(fileSizeMB / 5) * 30000);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Use the v3 API endpoint (more reliable than v1)
        const response = await fetch('https://uploads.pinata.cloud/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwt}`,
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          let errorData;
          try {
            errorText && (errorData = JSON.parse(errorText));
          } catch {
            // Not JSON, use text
          }
          
          const errorMessage = errorData?.error?.message || errorData?.error || errorText || response.statusText;
          
          // Handle specific errors
          if (response.status === 401) {
            throw new Error('Pinata authentication failed. Please check your JWT token.');
          } else if (response.status === 403) {
            // Check if account is disabled
            if (errorMessage.toLowerCase().includes('disabled') || errorData?.error?.message?.toLowerCase().includes('disabled')) {
              throw new Error('Pinata account has been disabled. Please contact Pinata support or check your account status at https://app.pinata.cloud/');
            }
            throw new Error('Pinata access denied. Please check your API key permissions.');
          } else if (response.status === 429) {
            // Rate limit - retry with longer backoff
            if (attempt < maxRetries - 1) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt) * 2, 30000); // Max 30s
              console.warn(`⚠️ Pinata rate limit (429), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
            throw new Error('Pinata rate limit exceeded. Please try again later.');
          } else if (response.status === 502 || response.status === 503 || response.status === 504) {
            // Gateway errors - retry with exponential backoff
            if (attempt < maxRetries - 1) {
              const backoffMs = response.status === 503 
                ? Math.min(5000 * Math.pow(2, attempt), 20000) // 5s, 10s, 20s for 503
                : Math.min(2000 * Math.pow(2, attempt), 10000); // 2s, 4s, 8s for 502/504
              console.warn(`⚠️ Pinata service error (${response.status}), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
            throw new Error(`Pinata service error (${response.status}): ${errorMessage}`);
          } else if (response.status >= 500) {
            // Other 5xx errors - retry
            if (attempt < maxRetries - 1) {
              const backoffMs = Math.min(2000 * Math.pow(2, attempt), 10000);
              console.warn(`⚠️ Pinata server error (${response.status}), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
            throw new Error(`Pinata service error (${response.status}): ${errorMessage}`);
          }
          
          // 4xx errors (except 401, 403, 429) - don't retry
          throw new Error(`Pinata upload failed (${response.status}): ${errorMessage}`);
        }

        const result = await response.json();
        
        // v3 API returns 'cid' instead of 'IpfsHash'
        const cid = result.cid || result.IpfsHash;
        
        if (!cid) {
          console.error('Pinata response:', result);
          throw new Error('Pinata upload succeeded but no CID returned');
        }

        return cid;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          if (attempt < maxRetries - 1) {
            const backoffMs = Math.min(2000 * Math.pow(2, attempt), 10000);
            console.warn(`⚠️ Pinata upload timed out, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }
          throw new Error(`Pinata upload timed out after ${timeoutMs}ms`);
        }
        throw error;
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Pinata upload attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
      
      // If it's a non-retryable error (401, 403, or 4xx that's not 429), throw immediately
      if (error.message.includes('authentication failed') || 
          error.message.includes('access denied') ||
          (error.message.includes('failed (4') && !error.message.includes('429'))) {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Pinata upload failed after all retries');
}

/**
 * Upload file to Lighthouse (fallback)
 */
async function uploadToLighthouse(
  file: File,
  fileName: string,
  apiKey: string
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file, fileName);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch('https://upload.lighthouse.storage/api/v0/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Lighthouse upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Lighthouse upload timed out after 60 seconds');
    }
    throw error;
  }
}

