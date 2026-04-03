/**
 * AuthStatus.tsx
 * ==============
 * Sidebar component showing authentication status.
 * 
 * Features:
 * - Visual indicator (🔴 disconnected / 🟢 connected)
 * - Login button when disconnected
 * - Reconnect button when session expired
 * - Loading state during authentication
 * 
 * Design System: shadcn/ui + NordVPN Inspired Dark Theme
 * 
 * Usage:
 *   <AuthStatus />
 */

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AuthStatus as AuthStatusType } from '../../types/electron';

// ============================================================================
// TYPES
// ============================================================================

type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'expired' | 'logging-in';

interface AuthState {
  connectionState: ConnectionState;
  status: AuthStatusType | null;
  error: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AuthStatus() {
  const [state, setState] = useState<AuthState>({
    connectionState: 'checking',
    status: null,
    error: null,
  });

  // Check session status on mount and periodically
  const checkStatus = useCallback(async () => {
    try {
      // Check if running in Electron
      if (!window.electronAPI?.auth) {
        setState(prev => ({
          ...prev,
          connectionState: 'disconnected',
          error: 'Electron API non disponible',
        }));
        return;
      }

      const status = await window.electronAPI.auth.getStatus();
      
      let connectionState: ConnectionState = 'disconnected';
      
      if (status.isConnected) {
        // Check if session might be expiring soon (> 12h old)
        if (status.sessionAgeHours > 12) {
          connectionState = 'expired';
        } else {
          connectionState = 'connected';
        }
      }

      setState({
        connectionState,
        status,
        error: status.error || null,
      });
    } catch (e) {
      const error = e as Error;
      setState(prev => ({
        ...prev,
        connectionState: 'disconnected',
        error: error.message,
      }));
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkStatus();
    
    // Re-check every 60 seconds
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Handle login button click
  const handleLogin = async (forceAuth: boolean = false) => {
    setState(prev => ({ ...prev, connectionState: 'logging-in', error: null }));

    try {
      const result = await window.electronAPI.auth.login(forceAuth);
      
      if (result.success) {
        // Re-check status after successful login
        await checkStatus();
      } else {
        setState(prev => ({
          ...prev,
          connectionState: 'disconnected',
          error: result.message || 'Échec de la connexion',
        }));
      }
    } catch (e) {
      const error = e as Error;
      setState(prev => ({
        ...prev,
        connectionState: 'disconnected',
        error: error.message,
      }));
    }
  };

  // Render based on connection state
  return (
    <div className="p-4 border-t border-border">
      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-3">
        <StatusIndicator state={state.connectionState} />
        <span className="text-muted-foreground text-sm">
          {getStatusLabel(state.connectionState)}
        </span>
      </div>

      {/* Error message */}
      {state.error && (
        <div className="mb-3 text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
          {state.error}
        </div>
      )}

      {/* Action button */}
      {state.connectionState !== 'connected' && state.connectionState !== 'checking' && (
        <Button
          onClick={() => handleLogin(state.connectionState === 'expired')}
          disabled={state.connectionState === 'logging-in'}
          variant={state.connectionState === 'logging-in' ? 'secondary' : 'default'}
          className="w-full"
          size="sm"
        >
          {getButtonLabel(state.connectionState)}
        </Button>
      )}

      {/* Session info (when connected) */}
      {state.connectionState === 'connected' && state.status && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Cookies: {state.status.cookieCount}</div>
          {state.status.lastValidated && (
            <div>
              Dernière validation: {formatTimeAgo(state.status.lastValidated)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatusIndicatorProps {
  state: ConnectionState;
}

function StatusIndicator({ state }: StatusIndicatorProps) {
  const getColor = () => {
    switch (state) {
      case 'connected':
        return 'bg-chart-2';
      case 'expired':
        return 'bg-chart-3';
      case 'logging-in':
      case 'checking':
        return 'bg-chart-3 animate-pulse';
      case 'disconnected':
      default:
        return 'bg-destructive';
    }
  };

  return (
    <div className={cn("w-2.5 h-2.5 rounded-full", getColor())} />
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStatusLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Connecté';
    case 'expired':
      return 'Session expirée';
    case 'logging-in':
      return 'Connexion...';
    case 'checking':
      return 'Vérification...';
    case 'disconnected':
    default:
      return 'Non connecté';
  }
}

function getButtonLabel(state: ConnectionState): string {
  switch (state) {
    case 'expired':
      return 'Reconnecter';
    case 'logging-in':
      return 'Connexion en cours...';
    default:
      return 'Se connecter';
  }
}

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffHours > 0) {
    return `il y a ${diffHours}h`;
  } else if (diffMins > 0) {
    return `il y a ${diffMins}min`;
  } else {
    return 'à l\'instant';
  }
}

export default AuthStatus;
