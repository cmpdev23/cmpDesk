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
 * Design System: shadcn/ui (radix-lyra preset)
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

type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'expired' | 'logging-in' | 'logging-out' | 'testing';

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

  // Handle logout button click
  const handleLogout = async () => {
    setState(prev => ({ ...prev, connectionState: 'logging-out', error: null }));

    try {
      const result = await window.electronAPI.auth.logout();
      
      if (result.success) {
        // Re-check status after logout
        await checkStatus();
      } else {
        setState(prev => ({
          ...prev,
          connectionState: 'disconnected',
          error: result.message || 'Erreur lors de la déconnexion',
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

  // Handle test connection button click
  const handleTestConnection = async () => {
    setState(prev => ({ ...prev, connectionState: 'testing', error: null }));

    try {
      const result = await window.electronAPI.auth.testConnection();
      
      if (result.success) {
        // Re-check status after test (session may have been refreshed)
        await checkStatus();
      } else {
        setState(prev => ({
          ...prev,
          connectionState: 'connected', // Keep as connected since test failed but session might still be valid
          error: result.message || 'Erreur lors du test',
        }));
      }
    } catch (e) {
      const error = e as Error;
      setState(prev => ({
        ...prev,
        connectionState: 'connected',
        error: error.message,
      }));
    }
  };

  // Render based on connection state
  return (
    <div className="p-4 border-t border-sidebar-border">
      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-3">
        <StatusIndicator state={state.connectionState} />
        <span className="text-sidebar-foreground text-sm">
          {getStatusLabel(state.connectionState)}
        </span>
      </div>

      {/* Error message */}
      {state.error && (
        <div className="mb-3 text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
          {state.error}
        </div>
      )}

      {/* Login button (when disconnected/expired) */}
      {state.connectionState !== 'connected' && state.connectionState !== 'checking' && state.connectionState !== 'logging-out' && (
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

      {/* Session info and logout (when connected) */}
      {state.connectionState === 'connected' && state.status && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Cookies: {state.status.cookieCount}</div>
            {state.status.lastValidated && (
              <div>
                Dernière validation: {formatTimeAgo(state.status.lastValidated)}
              </div>
            )}
          </div>
          
          {/* Test connection button */}
          <Button
            onClick={handleTestConnection}
            variant="default"
            size="sm"
            className="w-full"
          >
            Tester la connexion
          </Button>
          
          {/* Logout button */}
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="w-full text-xs"
          >
            Se déconnecter
          </Button>
        </div>
      )}

      {/* Logging out state */}
      {state.connectionState === 'logging-out' && (
        <Button
          disabled
          variant="secondary"
          size="sm"
          className="w-full"
        >
          Déconnexion...
        </Button>
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
      case 'logging-out':
      case 'checking':
      case 'testing':
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
    case 'logging-out':
      return 'Déconnexion...';
    case 'checking':
      return 'Vérification...';
    case 'testing':
      return 'Test en cours...';
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
