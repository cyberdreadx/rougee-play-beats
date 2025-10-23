# Auth Logger Quick Reference Guide

## Overview

The `authLogger` utility provides structured logging for all authentication events in Rougee Play. It helps track user authentication flows, debug issues, and monitor security events.

## Import

```typescript
import { logAuthEvent, AuthEventType } from '@/lib/authLogger';
```

## Quick Start

### Log a Success Event

```typescript
logAuthEvent(AuthEventType.LOGIN_SUCCESS);
```

### Log an Error Event

```typescript
logAuthEvent(AuthEventType.LOGIN_FAILED, {
  error: error.message,
  metadata: { method: 'email' }
});
```

### Log with User Context

```typescript
logAuthEvent(AuthEventType.SESSION_RESTORED, {
  userId: user.id,
  walletAddress: wallet.address,
  email: user.email,
});
```

## Available Event Types

### Login Events
```typescript
AuthEventType.LOGIN_SUCCESS          // ✅ Generic login success
AuthEventType.LOGIN_FAILED           // ❌ Generic login failure
AuthEventType.EMAIL_LOGIN_SUCCESS    // ✅ Email-specific login success
AuthEventType.EMAIL_LOGIN_FAILED     // ❌ Email-specific login failure
```

### Wallet Events
```typescript
AuthEventType.WALLET_CONNECTED          // ✅ Wallet connected successfully
AuthEventType.WALLET_CONNECTION_FAILED  // ❌ Wallet connection failed
```

### Session Events
```typescript
AuthEventType.SESSION_RESTORED   // ✅ Session restored on app load
AuthEventType.SESSION_EXPIRED    // ❌ Session expired
```

### Token Events
```typescript
AuthEventType.TOKEN_REFRESH_SUCCESS  // ✅ JWT token refreshed
AuthEventType.TOKEN_REFRESH_FAILED   // ❌ JWT refresh failed
```

### Logout Events
```typescript
AuthEventType.LOGOUT_SUCCESS  // ✅ User logged out
AuthEventType.LOGOUT_FAILED   // ❌ Logout failed
```

### Chain Events
```typescript
AuthEventType.CHAIN_SWITCH_REQUIRED  // ⚠️ User needs to switch chain
AuthEventType.CHAIN_SWITCH_FAILED    // ❌ Chain switch failed
```

## Data Structure

### AuthLogEntry

```typescript
interface AuthLogEntry {
  type: AuthEventType;         // Event type (required)
  timestamp: string;            // ISO timestamp (auto-generated)
  userId?: string;              // Privy user ID
  walletAddress?: string;       // Wallet address
  email?: string;               // User email
  error?: string;               // Error message
  metadata?: Record<string, any>; // Additional context
}
```

## Usage Examples

### Example 1: Login Handler

```typescript
const handleLogin = async () => {
  try {
    const user = await login();
    logAuthEvent(AuthEventType.LOGIN_SUCCESS, {
      userId: user.id,
    });
  } catch (error) {
    logAuthEvent(AuthEventType.LOGIN_FAILED, {
      error: error.message,
      metadata: {
        attemptedAt: Date.now(),
        userAgent: navigator.userAgent,
      }
    });
  }
};
```

### Example 2: Wallet Connection

```typescript
const connectWallet = async () => {
  try {
    const wallet = await connect();
    logAuthEvent(AuthEventType.WALLET_CONNECTED, {
      walletAddress: wallet.address,
      metadata: {
        walletType: wallet.type,
        chainId: wallet.chainId,
      }
    });
  } catch (error) {
    logAuthEvent(AuthEventType.WALLET_CONNECTION_FAILED, {
      error: error.message,
    });
  }
};
```

### Example 3: Session Restoration

```typescript
useEffect(() => {
  if (authenticated && user) {
    logAuthEvent(AuthEventType.SESSION_RESTORED, {
      userId: user.id,
      walletAddress: getWalletAddress(user),
    });
  }
}, [authenticated, user]);
```

### Example 4: Token Refresh

```typescript
const refreshToken = async () => {
  try {
    const token = await getAccessToken();
    logAuthEvent(AuthEventType.TOKEN_REFRESH_SUCCESS, {
      userId: user?.id,
    });
    return token;
  } catch (error) {
    logAuthEvent(AuthEventType.TOKEN_REFRESH_FAILED, {
      error: error.message,
      userId: user?.id,
    });
    throw error;
  }
};
```

## Debugging Functions

### Get All Logs

```typescript
import { getAuthLogs } from '@/lib/authLogger';

const logs = getAuthLogs();
console.log('All auth events:', logs);
```

### Get Error Logs Only

```typescript
import { getAuthErrorLogs } from '@/lib/authLogger';

const errors = getAuthErrorLogs();
console.log('Auth errors:', errors);
```

### Export Logs as JSON

```typescript
import { exportAuthLogs } from '@/lib/authLogger';

const json = exportAuthLogs();
// Download or send to support
```

### Clear Logs

```typescript
import { clearAuthLogs } from '@/lib/authLogger';

clearAuthLogs();
```

## Console Output

Auth events appear in console with emoji indicators:

```
✅ [AUTH] LOGIN_SUCCESS { timestamp: "...", userId: "..." }
❌ [AUTH] LOGIN_FAILED { timestamp: "...", error: "..." }
👋 [AUTH] LOGOUT_SUCCESS { timestamp: "...", userId: "..." }
⚠️ [AUTH] CHAIN_SWITCH_REQUIRED { timestamp: "...", ... }
ℹ️ [AUTH] SESSION_RESTORED { timestamp: "...", ... }
```

## LocalStorage

Error events are automatically saved to localStorage:

**Key:** `rougee_auth_errors`  
**Max Entries:** 20 (oldest removed when limit reached)  
**Access:**
```typescript
const errors = JSON.parse(localStorage.getItem('rougee_auth_errors') || '[]');
```

## Production Considerations

### Analytics Integration

The logger includes a placeholder for analytics:

```typescript
// In authLogger.ts, update sendToAnalytics():
private sendToAnalytics(entry: AuthLogEntry) {
  if (window.analytics) {
    window.analytics.track(entry.type, {
      userId: entry.userId,
      timestamp: entry.timestamp,
    });
  }
}
```

### Error Reporting

Integrate with Sentry or similar:

```typescript
// In authLogger.ts, add to storeErrorLog():
if (import.meta.env.PROD) {
  Sentry.captureException(new Error(entry.type), {
    extra: entry,
  });
}
```

## Best Practices

### ✅ DO:
- Log all authentication events (success and failure)
- Include relevant context (userId, walletAddress)
- Use appropriate event types
- Add metadata for debugging

### ❌ DON'T:
- Log sensitive data (passwords, private keys, full JWTs)
- Log in tight loops (use sparingly)
- Rely on logs for critical business logic
- Include PII without user consent

## Performance

- **Memory:** ~100 events kept in memory
- **Storage:** ~20 errors in localStorage (~10KB)
- **Network:** No network calls (unless analytics configured)
- **CPU:** Negligible impact

## Troubleshooting

### Logs Not Appearing?
- Check console for emoji indicators
- Verify import path is correct
- Ensure event type is from AuthEventType enum

### localStorage Full?
- Clear old logs: `clearAuthLogs()`
- Reduce MAX_LOGS in authLogger.ts
- Implement log rotation

### Missing Events?
- Verify logAuthEvent is called in try/catch
- Check if error is thrown before log call
- Review event type spelling

## TypeScript

The auth logger is fully typed:

```typescript
// ✅ Type-safe
logAuthEvent(AuthEventType.LOGIN_SUCCESS, {
  userId: "123",
  metadata: { source: "email" }
});

// ❌ TypeScript error - invalid event type
logAuthEvent("INVALID_EVENT", {}); // Error!

// ❌ TypeScript error - wrong data type
logAuthEvent(AuthEventType.LOGIN_SUCCESS, {
  userId: 123 // Error! Should be string
});
```

## Support

For issues or questions:
1. Check console logs with emoji indicators
2. Export auth logs: `exportAuthLogs()`
3. Review error logs: `getAuthErrorLogs()`
4. Check localStorage: `rougee_auth_errors`

## Examples in Codebase

See these files for real implementations:
- `src/components/LoginModal.tsx`
- `src/components/WalletButton.tsx`
- `src/hooks/useSessionManager.ts`
- `src/hooks/usePrivyToken.ts`

---

**Need help?** Check `PRIVY_LOGIN_IMPROVEMENTS.md` for full context.

