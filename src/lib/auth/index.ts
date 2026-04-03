/**
 * Auth Module - Central Export
 * ============================
 *
 * This is the main entry point for the auth module.
 * Import everything you need from here:
 *
 *   import { SessionManager, withSession, getAuthPaths } from '@/lib/auth';
 *
 * Module Structure:
 * -----------------
 *   index.ts          ← YOU ARE HERE (central exports)
 *   ├── session-manager.ts  ← High-level API (SessionManager class)
 *   ├── browser-context.ts  ← Low-level Playwright management
 *   ├── storage.ts          ← Path management for Electron
 *   └── types.ts            ← TypeScript type definitions
 *
 * Quick Start:
 * ------------
 *   // Option 1: SessionManager class (recommended)
 *   import { SessionManager } from '@/lib/auth';
 *
 *   const session = new SessionManager();
 *   try {
 *       await session.open();
 *       await session.goto("https://example.com");
 *       console.log(await session.title());
 *   } finally {
 *       await session.close();
 *   }
 *
 *   // Option 2: withSession helper (cleaner for one-off tasks)
 *   import { withSession } from '@/lib/auth';
 *
 *   const title = await withSession(async (session) => {
 *       await session.goto("https://example.com");
 *       return session.title();
 *   });
 *
 *   // Option 3: Quick status check (no browser)
 *   import { quickSessionCheck } from '@/lib/auth';
 *
 *   const status = quickSessionCheck();
 *   console.log(status.isValid, status.cookieCount);
 */

// ============================================================================
// HIGH-LEVEL API (Use these!)
// ============================================================================

// SessionManager - The main class for authenticated browser sessions
export { SessionManager, withSession, quickSessionCheck, getSessionAge, loadSessionState } from './session-manager';

// ============================================================================
// STORAGE (Path management)
// ============================================================================

// Path management functions
export {
  getAuthPaths,
  ensureAuthDirectories,
  checkAuthDataExists,
  getAuthPathsSummary,
  listSessionIds,
  ENCRYPTION_CONFIG,
} from './storage';

// Path types
export type { AuthPaths } from './storage';

// ============================================================================
// LOW-LEVEL API (Use only if you know what you're doing)
// ============================================================================

// Browser context management (low-level)
export {
  getAuthenticatedContext,
  saveCookies,
  restoreCookies,
  saveSessionState,
  checkSessionStatus,
  hasAuthCookies,
  getSessionAgeHours,
  AUTH_TARGETS,
} from './browser-context';

// ============================================================================
// TYPES
// ============================================================================

// Cookie types
export type { Cookie, PersistedCookie } from './types';

// Session types
export type { SessionState, SessionStatus } from './types';

// Options types
export type {
  BrowserContextOptions,
  AuthenticatedContextResult,
  SessionManagerOptions,
  NavigationOptions,
  CookieFilterOptions,
  ScreenshotOptions,
} from './types';

// Configuration types
export type { AuthTargetConfig } from './types';

// Error types
export { AuthenticationError, SessionError } from './types';
