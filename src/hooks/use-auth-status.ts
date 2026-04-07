/**
 * @file src/hooks/use-auth-status.ts
 * @description Hook to check authentication status from Electron main process.
 * 
 * Provides reactive auth state for React components:
 * - isConnected: true if valid session exists
 * - isChecking: true while checking status
 * - isExpired: true if session > 12h old
 * - error: error message if check failed
 * 
 * Usage:
 *   const { isConnected, isChecking } = useAuthStatus();
 *   if (isChecking) return <Spinner />;
 *   if (!isConnected) return <LoginRequired />;
 */

import { useState, useEffect, useCallback } from 'react';
import type { AuthStatus } from '@/types/electron';

export type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'expired';

export interface UseAuthStatusResult {
  /** Current connection state */
  connectionState: ConnectionState;
  /** True if session is valid and connected */
  isConnected: boolean;
  /** True if currently checking status */
  isChecking: boolean;
  /** True if session might be expired (>12h) */
  isExpired: boolean;
  /** Full auth status from main process */
  status: AuthStatus | null;
  /** Error message if check failed */
  error: string | null;
  /** Manually refresh auth status */
  refresh: () => Promise<void>;
}

/**
 * Hook to monitor authentication status.
 * 
 * @param options - Hook options
 * @param options.pollInterval - Interval in ms to refresh status (default: 60000)
 * @param options.autoRefresh - Whether to auto-refresh on interval (default: true)
 * 
 * @returns Auth status object
 * 
 * @example
 *   const { isConnected, isChecking } = useAuthStatus();
 *   
 *   if (isChecking) return <Loading />;
 *   if (!isConnected) return <PleaseLogin />;
 *   return <MainContent />;
 */
export function useAuthStatus(options: {
  pollInterval?: number;
  autoRefresh?: boolean;
} = {}): UseAuthStatusResult {
  const { pollInterval = 60000, autoRefresh = true } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      // Check if running in Electron
      if (!window.electronAPI?.auth) {
        setConnectionState('disconnected');
        setError('Electron API non disponible');
        return;
      }

      const authStatus = await window.electronAPI.auth.getStatus();
      setStatus(authStatus);

      if (authStatus.isConnected) {
        // Check if session might be expiring (>12h old)
        if (authStatus.sessionAgeHours > 12) {
          setConnectionState('expired');
        } else {
          setConnectionState('connected');
        }
        setError(null);
      } else {
        setConnectionState('disconnected');
        setError(authStatus.error || null);
      }
    } catch (e) {
      const err = e as Error;
      setConnectionState('disconnected');
      setError(err.message);
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Auto-refresh on interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(checkStatus, pollInterval);
    return () => clearInterval(interval);
  }, [checkStatus, pollInterval, autoRefresh]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isChecking: connectionState === 'checking',
    isExpired: connectionState === 'expired',
    status,
    error,
    refresh: checkStatus,
  };
}

export default useAuthStatus;
