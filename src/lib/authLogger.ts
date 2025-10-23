/**
 * Authentication error logging and monitoring utility
 * Provides structured logging for auth events with categorization
 */

export enum AuthEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT_SUCCESS = 'LOGOUT_SUCCESS',
  LOGOUT_FAILED = 'LOGOUT_FAILED',
  SESSION_RESTORED = 'SESSION_RESTORED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TOKEN_REFRESH_SUCCESS = 'TOKEN_REFRESH_SUCCESS',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  WALLET_CONNECTED = 'WALLET_CONNECTED',
  WALLET_CONNECTION_FAILED = 'WALLET_CONNECTION_FAILED',
  EMAIL_LOGIN_SUCCESS = 'EMAIL_LOGIN_SUCCESS',
  EMAIL_LOGIN_FAILED = 'EMAIL_LOGIN_FAILED',
  CHAIN_SWITCH_REQUIRED = 'CHAIN_SWITCH_REQUIRED',
  CHAIN_SWITCH_FAILED = 'CHAIN_SWITCH_FAILED',
}

export interface AuthLogEntry {
  type: AuthEventType;
  timestamp: string;
  userId?: string;
  walletAddress?: string;
  email?: string;
  error?: string;
  metadata?: Record<string, any>;
}

class AuthLogger {
  private logs: AuthLogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory

  /**
   * Log an authentication event
   */
  log(
    type: AuthEventType,
    data?: {
      userId?: string;
      walletAddress?: string;
      email?: string;
      error?: any;
      metadata?: Record<string, any>;
    }
  ) {
    const entry: AuthLogEntry = {
      type,
      timestamp: new Date().toISOString(),
      userId: data?.userId,
      walletAddress: data?.walletAddress,
      email: data?.email,
      error: data?.error ? String(data.error) : undefined,
      metadata: data?.metadata,
    };

    // Add to in-memory logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest
    }

    // Console logging with emoji indicators
    const emoji = this.getEmoji(type);
    console.log(`${emoji} [AUTH] ${type}`, {
      timestamp: entry.timestamp,
      ...data,
    });

    // Store critical errors in localStorage for debugging
    if (this.isErrorEvent(type)) {
      this.storeErrorLog(entry);
    }

    // In production, you could send to an analytics service
    if (import.meta.env.PROD) {
      this.sendToAnalytics(entry);
    }
  }

  /**
   * Get all logs
   */
  getLogs(): AuthLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by event type
   */
  getLogsByType(type: AuthEventType): AuthLogEntry[] {
    return this.logs.filter((log) => log.type === type);
  }

  /**
   * Get error logs
   */
  getErrorLogs(): AuthLogEntry[] {
    return this.logs.filter((log) => this.isErrorEvent(log.type));
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get emoji indicator for event type
   */
  private getEmoji(type: AuthEventType): string {
    switch (type) {
      case AuthEventType.LOGIN_SUCCESS:
      case AuthEventType.EMAIL_LOGIN_SUCCESS:
      case AuthEventType.WALLET_CONNECTED:
      case AuthEventType.SESSION_RESTORED:
      case AuthEventType.TOKEN_REFRESH_SUCCESS:
        return '✅';
      case AuthEventType.LOGIN_FAILED:
      case AuthEventType.EMAIL_LOGIN_FAILED:
      case AuthEventType.WALLET_CONNECTION_FAILED:
      case AuthEventType.SESSION_EXPIRED:
      case AuthEventType.TOKEN_REFRESH_FAILED:
      case AuthEventType.CHAIN_SWITCH_FAILED:
        return '❌';
      case AuthEventType.LOGOUT_SUCCESS:
        return '👋';
      case AuthEventType.CHAIN_SWITCH_REQUIRED:
        return '⚠️';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Check if event type is an error
   */
  private isErrorEvent(type: AuthEventType): boolean {
    return type.includes('FAILED') || type.includes('EXPIRED');
  }

  /**
   * Store error log in localStorage for debugging
   */
  private storeErrorLog(entry: AuthLogEntry) {
    try {
      const key = 'rougee_auth_errors';
      const stored = localStorage.getItem(key);
      const errors = stored ? JSON.parse(stored) : [];
      errors.push(entry);
      // Keep only last 20 errors
      if (errors.length > 20) {
        errors.shift();
      }
      localStorage.setItem(key, JSON.stringify(errors));
    } catch (e) {
      console.warn('Failed to store auth error:', e);
    }
  }

  /**
   * Send to analytics service (placeholder for future implementation)
   */
  private sendToAnalytics(entry: AuthLogEntry) {
    // TODO: Implement analytics service integration
    // Examples: PostHog, Mixpanel, Google Analytics, Sentry
    // This could also send to your own backend for monitoring
    
    // Example:
    // analytics.track(entry.type, {
    //   userId: entry.userId,
    //   timestamp: entry.timestamp,
    //   error: entry.error,
    // });
  }
}

// Singleton instance
const authLogger = new AuthLogger();

export default authLogger;

// Convenience functions
export const logAuthEvent = (type: AuthEventType, data?: Parameters<typeof authLogger.log>[1]) => {
  authLogger.log(type, data);
};

export const getAuthLogs = () => authLogger.getLogs();
export const getAuthErrorLogs = () => authLogger.getErrorLogs();
export const clearAuthLogs = () => authLogger.clearLogs();
export const exportAuthLogs = () => authLogger.exportLogs();

