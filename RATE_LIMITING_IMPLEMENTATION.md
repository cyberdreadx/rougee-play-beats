# Rate Limiting Implementation

## Overview
Comprehensive rate limiting has been implemented across the application to prevent API abuse, reduce server load, and improve performance.

## Implementation Details

### 1. Edge Functions Rate Limiting

#### Shared Rate Limiting Utility
**File**: `supabase/functions/_shared/rateLimit.ts`

- **In-memory rate limiting** (resets on function restart)
- **Per-wallet rate limiting**: Limits requests by wallet address
- **Per-IP rate limiting**: Limits requests by IP address
- **Combined rate limiting**: Checks both wallet and IP

#### Functions with Rate Limiting

##### `add-song-comment`
- **Limit**: 10 comments per minute per wallet/IP
- **Window**: 60 seconds
- **Response**: 429 (Too Many Requests) with `Retry-After: 60` header

##### `track-play`
- **Limit**: 30 play tracks per minute per wallet/IP
- **Window**: 60 seconds
- **Response**: 429 (Too Many Requests) with `Retry-After: 60` header

### 2. Client-Side Throttling

#### Throttle Utilities
**File**: `src/lib/throttle.ts`

- **`throttle()`**: Limits how often a function can be called
- **`debounce()`**: Delays function execution until after a period of inactivity
- **`createRateLimiter()`**: Creates a rate limiter with max calls per window

### 3. Search Debouncing

#### Trending Page Search
**File**: `src/pages/Trending.tsx`

- **Debounce delay**: 500ms
- **Behavior**: Search queries are debounced to avoid excessive API calls
- **Initial load**: Fetches immediately (no debounce)

### 4. Periodic Refresh Rate Limiting

#### Trending Page Refresh
**File**: `src/pages/Trending.tsx`

- **Refresh interval**: 60 seconds (increased from 30s)
- **Behavior**: Only refreshes when not searching
- **Purpose**: Reduces server load while still catching new songs

### 5. Caching (Existing)

#### Data Caching
- **`useSong24hData`**: 30-second cache
- **`useTokenHolders`**: 60-second cache
- **Trade data**: 5-minute cache

## Rate Limits Summary

| Endpoint/Feature | Limit | Window | Type |
|-----------------|-------|--------|------|
| `add-song-comment` | 10 | 1 minute | Per wallet/IP |
| `track-play` | 30 | 1 minute | Per wallet/IP |
| Search queries | Debounced | 500ms | Client-side |
| Trending refresh | 1 | 60 seconds | Periodic |

## Benefits

1. **Prevents API Abuse**: Limits how many requests a user can make
2. **Reduces Server Load**: Fewer unnecessary API calls
3. **Improves Performance**: Caching + rate limiting = faster responses
4. **Better UX**: Debouncing prevents lag from rapid typing
5. **Cost Savings**: Fewer RPC calls = lower infrastructure costs

## Error Handling

When rate limited, edge functions return:
```json
{
  "error": "Rate limit exceeded. Please wait before [action].",
  "reason": "IP rate limit exceeded" // or "Wallet rate limit exceeded"
}
```

**HTTP Status**: `429 Too Many Requests`
**Headers**: `Retry-After: 60`

## Future Improvements

1. **Persistent Rate Limiting**: Use Redis/database instead of in-memory
2. **Request Queue**: Use `useRequestQueue` hook for blockchain queries
3. **Adaptive Rate Limiting**: Adjust limits based on server load
4. **Rate Limit Headers**: Return `X-RateLimit-*` headers to clients

## Testing

To test rate limiting:

1. **Comments**: Try posting 11 comments in 1 minute → Should get 429 on 11th
2. **Play Tracking**: Try tracking 31 plays in 1 minute → Should get 429 on 31st
3. **Search**: Type rapidly in search → Should only search after 500ms pause

## Notes

- Rate limiting is **per edge function instance** (in-memory)
- Rate limits **reset on function restart**
- For production, consider using **persistent storage** (Redis/database)
- Client-side throttling is **best-effort** (can be bypassed)

