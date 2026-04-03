/**
 * browser-context.ts
 * ==================
 * 🌐 Low-level Playwright browser context management.
 *
 * This module handles:
 * - Persistent browser context (user_data_dir)
 * - Cookie persistence (session cookies → file → restore)
 * - Session state metadata
 * - Authentication flow orchestration
 *
 * IMPORTANT: This is a low-level module. Use SessionManager for high-level API.
 *
 * Architecture:
 *   SessionManager (session-manager.ts)
 *       └── BrowserContext (this file)
 *           └── Storage (storage.ts)
 *           └── Playwright persistent context
 *
 * Usage:
 *   import { getAuthenticatedContext } from './browser-context';
 *
 *   const { context, page, close } = await getAuthenticatedContext();
 *   try {
 *       await page.goto("https://...");
 *   } finally {
 *       await close(); // Saves session state
 *   }
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { chromium, type BrowserContext, type Page } from 'playwright';

import { getAuthPaths, ensureAuthDirectories } from './storage';
import type {
  Cookie,
  PersistedCookie,
  SessionState,
  SessionStatus,
  BrowserContextOptions,
  AuthenticatedContextResult,
  AuthTargetConfig,
} from './types';
import { AuthenticationError, AUTH_TARGETS } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Default authentication target */
const DEFAULT_AUTH_TARGET: AuthTargetConfig = AUTH_TARGETS.INALCO;

/** Default authentication timeout in seconds */
const DEFAULT_AUTH_TIMEOUT_SECONDS = 180;

/** Session validation check interval in milliseconds */
const SESSION_CHECK_INTERVAL_MS = 2000;

/** Cookie persistence duration (24 hours) in seconds */
const COOKIE_PERSIST_DURATION_SECONDS = 24 * 60 * 60;

// ============================================================================
// COOKIE MANAGEMENT
// ============================================================================

/**
 * Save all cookies to file, converting session cookies to persistent.
 *
 * CRITICAL: Chromium does NOT persist session cookies (expires=-1) even with
 * user_data_dir. We must save them explicitly with an artificial expiration.
 *
 * Also deduplicates cookies to prevent accumulation over multiple sessions.
 *
 * @param context - Playwright BrowserContext
 * @param sessionId - Session identifier for path resolution
 */
export async function saveCookies(
  context: BrowserContext,
  sessionId: string = 'default'
): Promise<void> {
  const paths = getAuthPaths(sessionId);
  const cookies = await context.cookies();

  // Convert session cookies to persistent (24 hours from now)
  const futureExpiry = Math.floor(Date.now() / 1000) + COOKIE_PERSIST_DURATION_SECONDS;
  const now = Math.floor(Date.now() / 1000);

  // Deduplicate cookies: keep only the most recent version of each (name, domain, path)
  const seen = new Map<string, PersistedCookie>();

  for (const cookie of cookies) {
    const key = `${cookie.name}|${cookie.domain || ''}|${cookie.path || '/'}`;
    const cookieCopy: PersistedCookie = {
      ...cookie,
      expires: cookie.expires ?? -1,
    };

    // If no expiry or session cookie, set artificial expiry
    if (cookieCopy.expires === -1) {
      cookieCopy.expires = futureExpiry;
    }

    // Skip already expired cookies
    if (cookieCopy.expires <= now) {
      continue;
    }

    // Keep only the latest version (overwrite previous)
    seen.set(key, cookieCopy);
  }

  const persistedCookies = Array.from(seen.values());

  writeFileSync(paths.cookiesFile, JSON.stringify(persistedCookies, null, 2), 'utf-8');
  console.log(
    `[auth] 💾 Saved ${persistedCookies.length} cookies (deduped from ${cookies.length})`
  );
}

/**
 * Restore cookies from file into the browser context.
 *
 * Filters expired cookies and deduplicates before restoring.
 *
 * @param context - Playwright BrowserContext
 * @param sessionId - Session identifier for path resolution
 *
 * @returns Number of cookies restored
 */
export async function restoreCookies(
  context: BrowserContext,
  sessionId: string = 'default'
): Promise<number> {
  const paths = getAuthPaths(sessionId);

  if (!existsSync(paths.cookiesFile)) {
    console.debug('[auth] No persisted cookies file found');
    return 0;
  }

  try {
    const cookies: Cookie[] = JSON.parse(readFileSync(paths.cookiesFile, 'utf-8'));

    // Filter out expired cookies and deduplicate
    const now = Math.floor(Date.now() / 1000);
    const seen = new Map<string, Cookie>();

    for (const cookie of cookies) {
      // Skip expired cookies
      if ((cookie.expires ?? 0) <= now) {
        continue;
      }

      // Deduplicate by (name, domain, path)
      const key = `${cookie.name}|${cookie.domain || ''}|${cookie.path || '/'}`;
      seen.set(key, cookie);
    }

    const validCookies = Array.from(seen.values());

    if (validCookies.length === 0) {
      console.log('[auth] All persisted cookies have expired');
      return 0;
    }

    // Add cookies to context
    await context.addCookies(validCookies);
    console.log(`[auth] 🍪 Restored ${validCookies.length} cookies`);
    return validCookies.length;
  } catch (e) {
    const error = e as Error;
    console.warn(`[auth] Could not restore cookies: ${error.message}`);
    return 0;
  }
}

// ============================================================================
// SESSION STATE MANAGEMENT
// ============================================================================

/**
 * Save current session state metadata.
 * Also saves cookies explicitly since Chromium doesn't persist session cookies.
 *
 * @param context - Playwright BrowserContext
 * @param sessionId - Session identifier
 * @param authTarget - Authentication target configuration
 */
export async function saveSessionState(
  context: BrowserContext,
  sessionId: string = 'default',
  authTarget: AuthTargetConfig = DEFAULT_AUTH_TARGET
): Promise<void> {
  const paths = getAuthPaths(sessionId);

  // First, save cookies explicitly
  await saveCookies(context, sessionId);

  const cookies = await context.cookies();
  const authCookies = cookies.filter((c) => authTarget.authCookieNames.includes(c.name));

  const state: SessionState = {
    lastValidated: new Date().toISOString(),
    authCookiesPresent: authCookies.length > 0,
    cookieCount: cookies.length,
    domains: [...new Set(cookies.map((c) => c.domain || ''))],
    sessionId,
  };

  writeFileSync(paths.sessionStateFile, JSON.stringify(state, null, 2), 'utf-8');
  console.debug(`[auth] Session state saved: ${JSON.stringify(state)}`);
}

/**
 * Load session state metadata if it exists.
 *
 * @param sessionId - Session identifier
 *
 * @returns Session state or null if not found
 */
export function loadSessionState(sessionId: string = 'default'): SessionState | null {
  const paths = getAuthPaths(sessionId);

  if (!existsSync(paths.sessionStateFile)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(paths.sessionStateFile, 'utf-8'));
  } catch (e) {
    const error = e as Error;
    console.warn(`[auth] Could not load session state: ${error.message}`);
    return null;
  }
}

/**
 * Get the age of the last validated session in hours.
 *
 * @param sessionId - Session identifier
 *
 * @returns Age in hours, or Infinity if no session
 */
export function getSessionAgeHours(sessionId: string = 'default'): number {
  const state = loadSessionState(sessionId);
  if (!state || !state.lastValidated) {
    return Infinity;
  }

  const lastValidated = new Date(state.lastValidated).getTime();
  const now = Date.now();
  return (now - lastValidated) / (1000 * 60 * 60);
}

/**
 * Check session status without opening a browser.
 *
 * @param sessionId - Session identifier
 *
 * @returns Session status object
 */
export function checkSessionStatus(sessionId: string = 'default'): SessionStatus {
  const paths = getAuthPaths(sessionId);

  const result: SessionStatus = {
    isValid: false,
    cookieCount: 0,
    domains: [],
    lastValidated: null,
    profileExists: existsSync(paths.browserProfile),
    cookiesFileExists: existsSync(paths.cookiesFile),
    sessionAgeHours: getSessionAgeHours(sessionId),
  };

  // Load session state
  const state = loadSessionState(sessionId);
  if (state) {
    result.lastValidated = state.lastValidated;
    result.cookieCount = state.cookieCount || 0;
    result.domains = state.domains || [];
    result.isValid = state.authCookiesPresent || false;
  }

  // Check cookies file for more accurate count
  if (existsSync(paths.cookiesFile)) {
    try {
      const cookies: Cookie[] = JSON.parse(readFileSync(paths.cookiesFile, 'utf-8'));
      const now = Math.floor(Date.now() / 1000);
      const validCookies = cookies.filter((c) => (c.expires ?? 0) > now);
      result.cookieCount = validCookies.length;
      result.domains = [...new Set(validCookies.map((c) => c.domain || ''))];
    } catch {
      // Ignore parse errors
    }
  }

  return result;
}

// ============================================================================
// AUTH COOKIE VALIDATION
// ============================================================================

/**
 * Check if the context has authentication cookies for the target.
 *
 * @param context - Playwright BrowserContext
 * @param authTarget - Authentication target configuration
 *
 * @returns True if at least one auth cookie is present
 */
export async function hasAuthCookies(
  context: BrowserContext,
  authTarget: AuthTargetConfig = DEFAULT_AUTH_TARGET
): Promise<boolean> {
  const cookies = await context.cookies();
  const cookieNames = new Set(cookies.map((c) => c.name));
  return authTarget.authCookieNames.some((name) => cookieNames.has(name));
}

// ============================================================================
// BROWSER CONTEXT FACTORY
// ============================================================================

/**
 * Get an authenticated browser context with persistent session.
 *
 * This is the main entry point for browser context creation. It:
 *   1. Launches Chromium with a persistent user_data_dir
 *   2. Restores cookies from the previous session
 *   3. Validates the session is still active
 *   4. Prompts for re-authentication if needed (headless=false only)
 *
 * @param options - Browser context options
 *
 * @returns Authenticated context result with close function
 *
 * @throws {AuthenticationError} If authentication fails or times out
 *
 * @example
 *   const { context, page, close } = await getAuthenticatedContext();
 *   try {
 *       await page.goto("https://...");
 *   } finally {
 *       await close();
 *   }
 */
export async function getAuthenticatedContext(
  options: BrowserContextOptions = {}
): Promise<AuthenticatedContextResult> {
  const {
    headless = false,
    forceAuth = false,
    sessionId = 'default',
    viewport = { width: 1280, height: 900 },
    authTimeoutSeconds = DEFAULT_AUTH_TIMEOUT_SECONDS,
  } = options;

  // Resolve auth target (currently only INALCO supported)
  const authTarget = DEFAULT_AUTH_TARGET;

  // Ensure directories exist
  const paths = ensureAuthDirectories(sessionId);

  console.log('[auth] 🌐 Launching browser...');
  console.log(`[auth] Browser profile: ${paths.browserProfile}`);

  // Launch with persistent context (keeps cookies between runs)
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(paths.browserProfile, {
      headless,
      viewport,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
  } catch (e) {
    const error = e as Error;
    if (error.message.includes('lock') || error.message.includes('already in use')) {
      throw new AuthenticationError(
        'Browser profile is locked. Another browser instance may be using it. Close it and try again.',
        'BROWSER_PROFILE_LOCKED',
        { profilePath: paths.browserProfile }
      );
    }
    throw e;
  }

  // Restore explicit cookies (session cookies aren't persisted by Chromium)
  await restoreCookies(context, sessionId);

  // Get or create a page
  const page: Page = context.pages()[0] || (await context.newPage());

  // Check if we need to authenticate
  const needsAuth = forceAuth || !(await hasAuthCookies(context, authTarget));

  if (needsAuth) {
    if (headless) {
      console.error('[auth] ❌ Session expired and headless mode cannot handle MFA.');
      console.error('[auth]    Run with headless=false to re-authenticate.');
      await context.close();
      throw new AuthenticationError(
        'Session expired - re-authentication required (headless mode cannot handle MFA)',
        'HEADLESS_AUTH_REQUIRED'
      );
    }

    console.log('[auth] 🔐 Authentication required - navigating to login...');
    await page.goto(authTarget.homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for auth cookies to appear (MFA flow)
    console.log(`[auth] ⏳ Waiting for authentication (timeout: ${authTimeoutSeconds}s)...`);
    console.log('[auth]    Please complete the login process in the browser window.');

    const startTime = Date.now();
    const timeoutMs = authTimeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      if (await hasAuthCookies(context, authTarget)) {
        console.log('[auth] ✅ Authentication successful!');
        break;
      }
      await page.waitForTimeout(SESSION_CHECK_INTERVAL_MS);
    }

    if (!(await hasAuthCookies(context, authTarget))) {
      console.error('[auth] ❌ Authentication timeout');
      await context.close();
      throw new AuthenticationError(
        `Authentication timeout after ${authTimeoutSeconds} seconds`,
        'AUTH_TIMEOUT',
        { timeoutSeconds: authTimeoutSeconds }
      );
    }

    // Save the new session
    await saveSessionState(context, sessionId, authTarget);
  } else {
    console.log('[auth] ✅ Session already authenticated');
  }

  // Return context with a close helper that saves state
  const close = async (): Promise<void> => {
    await saveSessionState(context, sessionId, authTarget);
    await context.close();
  };

  return { context, page, close };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Re-export auth target configuration for convenience.
 */
export { AUTH_TARGETS } from './types';
