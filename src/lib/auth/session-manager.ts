/**
 * session-manager.ts
 * ==================
 * 🎯 High-level session management API.
 *
 * This is the PRIMARY entry point for all code that needs authenticated browser access.
 * It provides a simple, clean API that encapsulates all the complexity of:
 * - Browser context management
 * - Cookie persistence
 * - Session validation
 * - Authentication flow
 *
 * Architecture:
 *   SessionManager (this file) ← USE THIS
 *       └── browser-context.ts (low-level)
 *           └── storage.ts (paths)
 *           └── Playwright
 *
 * Usage:
 *   import { SessionManager } from './auth';
 *
 *   // Option 1: try/finally (recommended)
 *   const session = new SessionManager();
 *   try {
 *       await session.open();
 *       await session.page.goto("https://...");
 *       console.log(await session.page.title());
 *   } finally {
 *       await session.close();
 *   }
 *
 *   // Option 2: withSession helper
 *   import { withSession } from './auth';
 *
 *   await withSession(async (session) => {
 *       await session.goto("https://...");
 *       return session.page.title();
 *   });
 */

import type { BrowserContext, Page, Response } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';

import {
  getAuthenticatedContext,
  checkSessionStatus,
  loadSessionState,
  getSessionAgeHours,
} from './browser-context';
import { getAuthPaths } from './storage';
import type {
  SessionManagerOptions,
  NavigationOptions,
  CookieFilterOptions,
  ScreenshotOptions,
  Cookie,
  SessionStatus,
} from './types';
import { SessionError } from './types';

// ============================================================================
// SESSION MANAGER CLASS
// ============================================================================

/**
 * High-level session manager for authenticated browser access.
 *
 * This class provides a simple API for:
 * - Opening/closing authenticated browser sessions
 * - Navigating to URLs
 * - Managing cookies
 * - Taking screenshots
 *
 * The session persists between app restarts via:
 * - Persistent browser profile (user_data_dir)
 * - Explicit cookie persistence (session cookies → file)
 *
 * @example
 *   const session = new SessionManager();
 *   try {
 *       await session.open();
 *       await session.goto("https://example.com");
 *       console.log(session.isAuthenticated); // true
 *   } finally {
 *       await session.close();
 *   }
 */
export class SessionManager {
  private _headless: boolean;
  private _forceAuth: boolean;
  private _sessionId: string;

  private _context: BrowserContext | null = null;
  private _page: Page | null = null;
  private _closeFn: (() => Promise<void>) | null = null;
  private _isAuthenticated: boolean = false;

  /**
   * Create a new SessionManager.
   *
   * @param options - Session manager options
   * @param options.headless - Run browser without visible window (default: false)
   *                          Set to false when MFA authentication is needed.
   * @param options.forceAuth - Force re-authentication even if session seems valid
   * @param options.sessionId - Session identifier for multi-session support
   */
  constructor(options: SessionManagerOptions = {}) {
    this._headless = options.headless ?? false;
    this._forceAuth = options.forceAuth ?? false;
    this._sessionId = options.sessionId ?? 'default';
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  /**
   * Get the Playwright BrowserContext.
   *
   * @throws {SessionError} If session is not opened
   */
  get context(): BrowserContext {
    if (!this._context) {
      throw new SessionError(
        'SessionManager must be opened first: await session.open()',
        'NOT_OPENED'
      );
    }
    return this._context;
  }

  /**
   * Get the main Playwright Page.
   *
   * @throws {SessionError} If session is not opened
   */
  get page(): Page {
    if (!this._page) {
      throw new SessionError(
        'SessionManager must be opened first: await session.open()',
        'NOT_OPENED'
      );
    }
    return this._page;
  }

  /**
   * Check if the session is authenticated.
   */
  get isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  /**
   * Check if the session is currently open.
   */
  get isOpen(): boolean {
    return this._context !== null;
  }

  /**
   * Get the session identifier.
   */
  get sessionId(): string {
    return this._sessionId;
  }

  // ==========================================================================
  // LIFECYCLE METHODS
  // ==========================================================================

  /**
   * Open the session and initialize the browser.
   *
   * This is the main entry point. It:
   * 1. Launches a persistent browser context
   * 2. Restores cookies from the previous session
   * 3. Validates/re-authenticates if needed
   *
   * @returns This SessionManager instance (for chaining)
   *
   * @throws {SessionError} If session is already open
   * @throws {AuthenticationError} If authentication fails
   *
   * @example
   *   const session = new SessionManager();
   *   await session.open();
   */
  async open(): Promise<SessionManager> {
    if (this._context) {
      throw new SessionError('SessionManager is already open. Call close() first.', 'ALREADY_OPENED');
    }

    const { context, page, close } = await getAuthenticatedContext({
      headless: this._headless,
      forceAuth: this._forceAuth,
      sessionId: this._sessionId,
    });

    this._context = context;
    this._page = page;
    this._closeFn = close;
    this._isAuthenticated = true;

    return this;
  }

  /**
   * Close the session and save cookies.
   *
   * Always call this when done, preferably in a finally block.
   * This saves the session state for next time.
   *
   * @example
   *   try {
   *       await session.open();
   *       // ... do work ...
   *   } finally {
   *       await session.close();
   *   }
   */
  async close(): Promise<void> {
    if (this._closeFn) {
      await this._closeFn();
      this._closeFn = null;
      this._context = null;
      this._page = null;
      this._isAuthenticated = false;
    }
  }

  // ==========================================================================
  // NAVIGATION METHODS
  // ==========================================================================

  /**
   * Navigate to a URL with sensible defaults.
   *
   * Uses 'domcontentloaded' by default instead of 'networkidle'
   * (important for Salesforce Lightning which does constant polling).
   *
   * @param url - URL to navigate to
   * @param options - Navigation options
   *
   * @returns Playwright Response or null
   *
   * @example
   *   await session.goto("https://example.com");
   *   await session.goto("https://example.com", { waitUntil: 'load', timeout: 60000 });
   */
  async goto(url: string, options: NavigationOptions = {}): Promise<Response | null> {
    const { waitUntil = 'domcontentloaded', timeout = 30000 } = options;
    return this.page.goto(url, { waitUntil, timeout });
  }

  /**
   * Wait for a specified time.
   *
   * @param milliseconds - Time to wait (default: 2000ms)
   *
   * @example
   *   await session.wait(5000); // Wait 5 seconds
   */
  async wait(milliseconds: number = 2000): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  /**
   * Wait for the page to reach a certain load state.
   *
   * @param state - Load state to wait for
   * @param options - Additional options
   *
   * @example
   *   await session.waitForLoadState('networkidle');
   */
  async waitForLoadState(
    state: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded',
    options: { timeout?: number } = {}
  ): Promise<void> {
    await this.page.waitForLoadState(state, options);
  }

  // ==========================================================================
  // COOKIE METHODS
  // ==========================================================================

  /**
   * Get cookies from the current context.
   *
   * @param options - Filter options
   *
   * @returns Array of cookies
   *
   * @example
   *   const all = await session.cookies();
   *   const sf = await session.cookies({ filterDomain: 'salesforce.com' });
   */
  async cookies(options: CookieFilterOptions = {}): Promise<Cookie[]> {
    const allCookies = await this.context.cookies();

    if (options.filterDomain) {
      return allCookies.filter((c) => (c.domain || '').includes(options.filterDomain!));
    }

    return allCookies;
  }

  /**
   * Add cookies to the current context.
   *
   * @param cookies - Cookies to add
   *
   * @example
   *   await session.addCookies([
   *       { name: 'test', value: 'value', domain: '.example.com', path: '/' }
   *   ]);
   */
  async addCookies(cookies: Cookie[]): Promise<void> {
    await this.context.addCookies(cookies);
  }

  /**
   * Clear all cookies from the current context.
   *
   * @example
   *   await session.clearCookies();
   */
  async clearCookies(): Promise<void> {
    await this.context.clearCookies();
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Save a screenshot of the current page.
   *
   * @param options - Screenshot options
   *
   * @returns Path to the saved screenshot file
   *
   * @example
   *   const path = await session.saveScreenshot();
   *   const path = await session.saveScreenshot({ path: './debug.png' });
   */
  async saveScreenshot(options: ScreenshotOptions = {}): Promise<string> {
    let { path: screenshotPath } = options;
    const { fullPage = true } = options;

    if (!screenshotPath) {
      // Auto-generate path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const paths = getAuthPaths(this._sessionId);
      const screenshotsDir = join(dirname(paths.authRoot), 'screenshots');
      mkdirSync(screenshotsDir, { recursive: true });
      screenshotPath = join(screenshotsDir, `screenshot_${timestamp}.png`);
    }

    await this.page.screenshot({ path: screenshotPath, fullPage });
    console.log(`[auth] 📸 Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  /**
   * Get the current page URL.
   *
   * @returns Current URL string
   */
  url(): string {
    return this.page.url();
  }

  /**
   * Get the current page title.
   *
   * @returns Page title
   */
  async title(): Promise<string> {
    return this.page.title();
  }

  /**
   * Execute JavaScript in the page context.
   *
   * @param pageFunction - Function to execute
   * @param arg - Argument to pass to the function
   *
   * @returns Result of the function
   *
   * @example
   *   const result = await session.evaluate(() => document.title);
   *   const result = await session.evaluate((x) => x * 2, 21);
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async evaluate<R>(pageFunction: () => R | Promise<R>): Promise<R>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async evaluate<R, Arg>(pageFunction: (arg: Arg) => R | Promise<R>, arg: Arg): Promise<R>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async evaluate<R, Arg>(pageFunction: any, arg?: Arg): Promise<R> {
    return this.page.evaluate(pageFunction, arg);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Execute an action with a managed session.
 *
 * This helper automatically opens and closes the session,
 * ensuring proper cleanup even if an error occurs.
 *
 * @param action - Async function to execute with the session
 * @param options - Session manager options
 *
 * @returns Result of the action
 *
 * @example
 *   const title = await withSession(async (session) => {
 *       await session.goto("https://example.com");
 *       return session.title();
 *   });
 *
 * @example With options
 *   await withSession(
 *       async (session) => { ... },
 *       { headless: true }
 *   );
 */
export async function withSession<T>(
  action: (session: SessionManager) => Promise<T>,
  options: SessionManagerOptions = {}
): Promise<T> {
  const session = new SessionManager(options);
  try {
    await session.open();
    return await action(session);
  } finally {
    await session.close();
  }
}

/**
 * Quick session status check without opening a browser.
 *
 * @param sessionId - Session identifier (default: 'default')
 *
 * @returns Session status object
 *
 * @example
 *   const status = quickSessionCheck();
 *   if (status.isValid) {
 *       console.log("Session is valid!");
 *   }
 */
export function quickSessionCheck(sessionId: string = 'default'): SessionStatus {
  return checkSessionStatus(sessionId);
}

/**
 * Get the age of the current session in hours.
 *
 * @param sessionId - Session identifier (default: 'default')
 *
 * @returns Age in hours, or Infinity if no session exists
 *
 * @example
 *   const hours = getSessionAge();
 *   if (hours > 12) {
 *       console.log("Session may be stale");
 *   }
 */
export function getSessionAge(sessionId: string = 'default'): number {
  return getSessionAgeHours(sessionId);
}

/**
 * Load session state metadata.
 *
 * @param sessionId - Session identifier (default: 'default')
 *
 * @returns Session state or null if not found
 */
export { loadSessionState };
