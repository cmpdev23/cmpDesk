/**
 * storage.ts
 * ==========
 * 🗂️ Centralized path management for auth data in Electron app.
 *
 * This module provides a single source of truth for all auth-related paths.
 * It uses Electron's `app.getPath('userData')` for cross-platform compatibility.
 *
 * Directory structure:
 *   userData/
 *   └── auth/
 *       ├── browser_profile/     <- Playwright persistent context
 *       ├── cookies.json         <- Persisted cookies (session → persistent)
 *       └── session_state.json   <- Session metadata
 *
 * Future multi-session support (prepared but not implemented):
 *   userData/
 *   └── auth/
 *       ├── inalco/
 *       │   ├── browser_profile/
 *       │   ├── cookies.json
 *       │   └── session_state.json
 *       └── salesforce/
 *           ├── browser_profile/
 *           ├── cookies.json
 *           └── session_state.json
 *
 * Usage:
 *   import { getAuthPaths, ensureAuthDirectories } from './storage';
 *
 *   const paths = getAuthPaths();
 *   console.log(paths.browserProfile); // Full path to browser_profile dir
 *
 *   // Ensure directories exist before using
 *   await ensureAuthDirectories();
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// ELECTRON APP PATH RESOLUTION
// ============================================================================

/**
 * Get the userData path from Electron.
 *
 * In the main process, we can use `app.getPath('userData')`.
 * In the renderer process, we need to use IPC to get it from main.
 *
 * Fallback: Use a local `.cmpdesk` directory in the project root for development.
 */
function getUserDataPath(): string {
  // Try to get from Electron main process
  try {
    // Dynamic import to avoid issues when running outside Electron
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch {
    // Not in Electron main process
  }

  // Try to get from preload-exposed API (renderer process)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getUserDataPath) {
    return (window as any).electronAPI.getUserDataPath();
  }

  // Fallback for development/testing outside Electron
  // Use a local directory in the project
  const fallbackPath = join(process.cwd(), '.cmpdesk-data');
  console.warn(`[auth/storage] Electron not available, using fallback path: ${fallbackPath}`);
  return fallbackPath;
}

// ============================================================================
// PATH DEFINITIONS
// ============================================================================

/**
 * Auth paths configuration.
 *
 * All paths are computed lazily to allow for different userData paths
 * in different environments.
 */
export interface AuthPaths {
  /** Root auth directory: userData/auth */
  authRoot: string;

  /** Browser profile directory for Playwright persistent context */
  browserProfile: string;

  /** Cookies file path (JSON format) */
  cookiesFile: string;

  /** Session state metadata file path (JSON format) */
  sessionStateFile: string;

  /** User data root directory */
  userDataRoot: string;
}

/**
 * Get all auth-related paths.
 *
 * @param sessionId - Optional session identifier for multi-session support.
 *                    Default: 'default'. Future use: 'salesforce', 'inalco', etc.
 *
 * @returns Object containing all auth paths
 *
 * @example
 *   const paths = getAuthPaths();
 *   // paths.browserProfile -> C:/Users/.../AppData/Roaming/cmpDesk/auth/browser_profile
 *
 * @example Multi-session (future)
 *   const sfPaths = getAuthPaths('salesforce');
 *   // sfPaths.browserProfile -> .../auth/salesforce/browser_profile
 */
export function getAuthPaths(sessionId: string = 'default'): AuthPaths {
  const userDataRoot = getUserDataPath();

  // For default session, use flat structure: auth/browser_profile
  // For named sessions, use nested: auth/{sessionId}/browser_profile
  const authRoot =
    sessionId === 'default'
      ? join(userDataRoot, 'auth')
      : join(userDataRoot, 'auth', sessionId);

  return {
    userDataRoot,
    authRoot,
    browserProfile: join(authRoot, 'browser_profile'),
    cookiesFile: join(authRoot, 'cookies.json'),
    sessionStateFile: join(authRoot, 'session_state.json'),
  };
}

// ============================================================================
// DIRECTORY MANAGEMENT
// ============================================================================

/**
 * Ensure all auth directories exist.
 *
 * Creates the directory structure if it doesn't exist:
 *   userData/
 *   └── auth/
 *       └── browser_profile/
 *
 * @param sessionId - Optional session identifier for multi-session support
 *
 * @returns The auth paths object
 */
export function ensureAuthDirectories(sessionId: string = 'default'): AuthPaths {
  const paths = getAuthPaths(sessionId);

  // Create auth root
  if (!existsSync(paths.authRoot)) {
    mkdirSync(paths.authRoot, { recursive: true });
    console.log(`[auth/storage] Created auth directory: ${paths.authRoot}`);
  }

  // Create browser profile directory
  if (!existsSync(paths.browserProfile)) {
    mkdirSync(paths.browserProfile, { recursive: true });
    console.log(`[auth/storage] Created browser profile: ${paths.browserProfile}`);
  }

  return paths;
}

/**
 * Check if auth data exists for a session.
 *
 * @param sessionId - Optional session identifier
 *
 * @returns Object with existence status for each component
 */
export function checkAuthDataExists(sessionId: string = 'default'): {
  authRootExists: boolean;
  browserProfileExists: boolean;
  cookiesFileExists: boolean;
  sessionStateExists: boolean;
} {
  const paths = getAuthPaths(sessionId);

  return {
    authRootExists: existsSync(paths.authRoot),
    browserProfileExists: existsSync(paths.browserProfile),
    cookiesFileExists: existsSync(paths.cookiesFile),
    sessionStateExists: existsSync(paths.sessionStateFile),
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a summary of all auth paths (useful for debugging).
 *
 * @param sessionId - Optional session identifier
 *
 * @returns Formatted string with all paths
 */
export function getAuthPathsSummary(sessionId: string = 'default'): string {
  const paths = getAuthPaths(sessionId);
  const exists = checkAuthDataExists(sessionId);

  return `
Auth Paths (session: ${sessionId})
${'='.repeat(50)}
User Data Root:    ${paths.userDataRoot}
Auth Root:         ${paths.authRoot} ${exists.authRootExists ? '✓' : '✗'}
Browser Profile:   ${paths.browserProfile} ${exists.browserProfileExists ? '✓' : '✗'}
Cookies File:      ${paths.cookiesFile} ${exists.cookiesFileExists ? '✓' : '✗'}
Session State:     ${paths.sessionStateFile} ${exists.sessionStateExists ? '✓' : '✗'}
`.trim();
}

/**
 * List all available session IDs.
 *
 * Scans the auth directory for subdirectories that could be session folders.
 *
 * @returns Array of session IDs (always includes 'default' if auth exists)
 */
export function listSessionIds(): string[] {
  const userDataRoot = getUserDataPath();
  const authRoot = join(userDataRoot, 'auth');

  if (!existsSync(authRoot)) {
    return [];
  }

  const { readdirSync, statSync } = require('fs');
  const sessions: string[] = [];

  // Check if default session exists (flat structure)
  const defaultBrowserProfile = join(authRoot, 'browser_profile');
  if (existsSync(defaultBrowserProfile)) {
    sessions.push('default');
  }

  // Scan for named sessions (nested structure)
  try {
    const entries = readdirSync(authRoot);
    for (const entry of entries) {
      if (entry === 'browser_profile') continue; // Skip default's browser_profile
      if (entry.endsWith('.json')) continue; // Skip files

      const entryPath = join(authRoot, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        // Check if it has a browser_profile subdirectory (valid session)
        const nestedProfile = join(entryPath, 'browser_profile');
        if (existsSync(nestedProfile)) {
          sessions.push(entry);
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  return sessions;
}

// ============================================================================
// ENCRYPTION PLACEHOLDER (Future)
// ============================================================================

/**
 * Placeholder for future encryption support.
 *
 * When encryption is added:
 * - Cookies file will be encrypted at rest
 * - Session state will be encrypted at rest
 * - Key will be derived from machine-specific data
 */
export const ENCRYPTION_CONFIG = {
  enabled: false,
  algorithm: 'aes-256-gcm',
  keyDerivation: 'machine-id', // Future: use machine-id + user-secret
} as const;
