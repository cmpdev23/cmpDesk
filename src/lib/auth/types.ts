/**
 * types.ts
 * ========
 * TypeScript type definitions for the auth module.
 *
 * This file centralizes all type definitions used across:
 * - storage.ts
 * - browser-context.ts
 * - session-manager.ts
 */

import type { BrowserContext, Page } from 'playwright';

// ============================================================================
// COOKIE TYPES
// ============================================================================

/**
 * Cookie object as returned by Playwright.
 * Extended with our persistence fields.
 */
export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number; // Unix timestamp in seconds
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Persisted cookie with artificial expiration.
 * Session cookies (expires=-1) are converted to persistent cookies
 * with a 24-hour expiration.
 */
export interface PersistedCookie extends Cookie {
  expires: number; // Always set for persisted cookies
}

// ============================================================================
// SESSION STATE TYPES
// ============================================================================

/**
 * Session state metadata stored in session_state.json.
 *
 * This tracks:
 * - When the session was last validated
 * - Whether required auth cookies are present
 * - Summary statistics for debugging
 */
export interface SessionState {
  /** ISO timestamp of last successful validation */
  lastValidated: string;

  /** True if required auth cookies were present at last validation */
  authCookiesPresent: boolean;

  /** Total number of cookies at last save */
  cookieCount: number;

  /** List of unique cookie domains */
  domains: string[];

  /** Session identifier (for multi-session support) */
  sessionId?: string;
}

/**
 * Session status returned by quick check (no browser required).
 */
export interface SessionStatus {
  /** Overall validity assessment */
  isValid: boolean;

  /** Number of non-expired cookies */
  cookieCount: number;

  /** Unique domains in cookies */
  domains: string[];

  /** ISO timestamp of last validation (from session_state.json) */
  lastValidated: string | null;

  /** Whether browser profile directory exists */
  profileExists: boolean;

  /** Whether cookies file exists */
  cookiesFileExists: boolean;

  /** Age of session in hours since last validation */
  sessionAgeHours: number;
}

// ============================================================================
// BROWSER CONTEXT TYPES
// ============================================================================

/**
 * Options for creating an authenticated browser context.
 */
export interface BrowserContextOptions {
  /**
   * Run browser in headless mode (no visible window).
   * Set to false when MFA/manual authentication is needed.
   * @default false
   */
  headless?: boolean;

  /**
   * Force re-authentication even if session appears valid.
   * @default false
   */
  forceAuth?: boolean;

  /**
   * Session identifier for multi-session support.
   * @default 'default'
   */
  sessionId?: string;

  /**
   * Viewport dimensions for the browser window.
   * @default { width: 1280, height: 900 }
   */
  viewport?: { width: number; height: number };

  /**
   * Timeout for authentication flow in seconds.
   * @default 180
   */
  authTimeoutSeconds?: number;
}

/**
 * Result of getAuthenticatedContext().
 */
export interface AuthenticatedContextResult {
  /** Playwright BrowserContext with cookies loaded */
  context: BrowserContext;

  /** Main page (first page or newly created) */
  page: Page;

  /**
   * Close function that saves session state before closing.
   * Always call this instead of context.close() directly.
   */
  close: () => Promise<void>;
}

// ============================================================================
// SESSION MANAGER TYPES
// ============================================================================

/**
 * Options for SessionManager constructor.
 */
export interface SessionManagerOptions {
  /**
   * Run browser in headless mode (no visible window).
   * Set to false when MFA/manual authentication is needed.
   * @default false
   */
  headless?: boolean;

  /**
   * Force re-authentication even if session appears valid.
   * @default false
   */
  forceAuth?: boolean;

  /**
   * Session identifier for multi-session support.
   * @default 'default'
   */
  sessionId?: string;
}

/**
 * Navigation options for SessionManager.goto().
 */
export interface NavigationOptions {
  /**
   * When to consider navigation succeeded.
   * @default 'domcontentloaded'
   */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

  /**
   * Maximum navigation time in milliseconds.
   * @default 30000
   */
  timeout?: number;
}

/**
 * Cookie filter options for SessionManager.cookies().
 */
export interface CookieFilterOptions {
  /**
   * Filter cookies by domain substring.
   * Example: 'salesforce.com' matches '.salesforce.com' and 'my.salesforce.com'
   */
  filterDomain?: string | null;
}

/**
 * Screenshot options for SessionManager.saveScreenshot().
 */
export interface ScreenshotOptions {
  /**
   * Custom path for the screenshot file.
   * If not provided, auto-generates path in screenshots directory.
   */
  path?: string | null;

  /**
   * Capture full scrollable page.
   * @default true
   */
  fullPage?: boolean;
}

// ============================================================================
// AUTH CONFIGURATION TYPES
// ============================================================================

/**
 * Authentication target configuration.
 *
 * Defines how to authenticate with a specific service.
 */
export interface AuthTargetConfig {
  /** Unique identifier for this auth target */
  id: string;

  /** Display name */
  name: string;

  /** Home URL to navigate to for authentication */
  homeUrl: string;

  /**
   * Cookie names that indicate successful authentication.
   * At least one must be present for session to be valid.
   */
  authCookieNames: readonly string[];

  /**
   * Domains where auth cookies should be present.
   */
  authDomains: readonly string[];
}

/**
 * Pre-configured auth targets.
 */
export const AUTH_TARGETS = {
  /**
   * INALCO authentication (primary target).
   */
  INALCO: {
    id: 'inalco',
    name: 'INALCO',
    homeUrl: 'https://iaa.secureweb.inalco.com/MKMWPN23/home',
    authCookieNames: ['.ASPXAUTH', 'ee-authenticated'],
    authDomains: ['inalco.com'],
  },

  /**
   * Salesforce authentication (secondary target, uses SSO via INALCO).
   */
  SALESFORCE: {
    id: 'salesforce',
    name: 'Salesforce',
    homeUrl: 'https://indall.lightning.force.com/lightning/page/home',
    authCookieNames: ['sid', 'sfdc_lv2', 'oid'],
    authDomains: ['salesforce.com', 'force.com'],
  },
} as const;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Custom error for authentication failures.
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'SESSION_EXPIRED'
      | 'AUTH_TIMEOUT'
      | 'HEADLESS_AUTH_REQUIRED'
      | 'BROWSER_PROFILE_LOCKED'
      | 'UNKNOWN',
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Custom error for session manager operations.
 */
export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_OPENED' | 'ALREADY_OPENED' | 'CONTEXT_CLOSED' | 'UNKNOWN',
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SessionError';
  }
}
