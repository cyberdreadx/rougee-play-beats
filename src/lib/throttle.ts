/**
 * Throttle function - limits how often a function can be called
 * @param func - Function to throttle
 * @param delay - Minimum delay between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      // Enough time has passed, call immediately
      lastCall = now;
      func.apply(this, args);
    } else {
      // Schedule call for when delay has passed
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function - delays function execution until after a period of inactivity
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Rate limiter - allows a maximum number of calls within a time window
 * @param maxCalls - Maximum number of calls allowed
 * @param windowMs - Time window in milliseconds
 * @returns Function that returns true if call is allowed, false if rate limited
 */
export function createRateLimiter(maxCalls: number, windowMs: number) {
  const calls: number[] = [];

  return (): boolean => {
    const now = Date.now();
    
    // Remove calls outside the window
    while (calls.length > 0 && calls[0] < now - windowMs) {
      calls.shift();
    }
    
    // Check if we've exceeded the limit
    if (calls.length >= maxCalls) {
      return false;
    }
    
    // Record this call
    calls.push(now);
    return true;
  };
}

