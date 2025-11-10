// Rate limiting utility for edge functions
// Uses in-memory storage (resets on function restart)

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory rate limit map (resets on function restart)
const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (wallet address, IP, etc.)
 * @param limit - Maximum number of requests allowed
 * @param window - Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export const rateLimit = (
  identifier: string,
  limit: number,
  window: number
): boolean => {
  const now = Date.now();
  const key = identifier.toLowerCase();
  const record = rateLimitMap.get(key);

  // No record or window expired - allow request
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + window });
    return true;
  }

  // Check if limit exceeded
  if (record.count >= limit) {
    return false;
  }

  // Increment count
  record.count++;
  return true;
};

/**
 * Get remaining requests for an identifier
 * @param identifier - Unique identifier
 * @returns Number of remaining requests, or null if no record
 */
export const getRemainingRequests = (identifier: string): number | null => {
  const key = identifier.toLowerCase();
  const record = rateLimitMap.get(key);
  
  if (!record) return null;
  
  const now = Date.now();
  if (now > record.resetTime) return null;
  
  // Assuming limit is stored somewhere - for now return count
  // In production, you'd want to store the limit with the record
  return record.count;
};

/**
 * Get client IP from request headers
 */
export const getClientIP = (req: Request): string => {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip'); // Cloudflare
  
  return forwardedFor?.split(',')[0]?.trim() || 
         realIP || 
         cfConnectingIP || 
         'unknown';
};

/**
 * Rate limit by wallet address
 * @param walletAddress - Wallet address
 * @param limit - Maximum requests per window
 * @param window - Time window in milliseconds
 */
export const rateLimitByWallet = (
  walletAddress: string,
  limit: number,
  window: number
): boolean => {
  return rateLimit(`wallet:${walletAddress}`, limit, window);
};

/**
 * Rate limit by IP address
 * @param ip - IP address
 * @param limit - Maximum requests per window
 * @param window - Time window in milliseconds
 */
export const rateLimitByIP = (
  ip: string,
  limit: number,
  window: number
): boolean => {
  return rateLimit(`ip:${ip}`, limit, window);
};

/**
 * Combined rate limiting (wallet + IP)
 * @param walletAddress - Wallet address
 * @param ip - IP address
 * @param limit - Maximum requests per window
 * @param window - Time window in milliseconds
 */
export const rateLimitCombined = (
  walletAddress: string | undefined,
  ip: string,
  limit: number,
  window: number
): { allowed: boolean; reason?: string } => {
  // Check IP first (stricter)
  if (!rateLimitByIP(ip, limit, window)) {
    return { allowed: false, reason: 'IP rate limit exceeded' };
  }
  
  // Check wallet if provided
  if (walletAddress && !rateLimitByWallet(walletAddress, limit, window)) {
    return { allowed: false, reason: 'Wallet rate limit exceeded' };
  }
  
  return { allowed: true };
};

