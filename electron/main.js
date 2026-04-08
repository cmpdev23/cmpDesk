/**
 * electron/main.js
 * ================
 * Main process for cmpDesk Electron application.
 *
 * Responsibilities:
 * - Window management
 * - IPC handlers for auth operations
 * - Bridge between renderer and Node.js modules (Playwright)
 * - Log management and streaming to renderer
 */

import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Salesforce configuration
const SF_HOME_URL = 'https://indall.lightning.force.com/lightning/page/home';
const SEARCH_DESCRIPTOR = 'serviceComponent://ui.search.components.forcesearch.assistant.AssistantSuggestionsDataProviderController/ACTION$getSuggestions';

// ============================================================================
// ENVIRONMENT CONFIGURATION (using dotenv)
// ============================================================================

// Load .env file from project root
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

// Try .env first, then .env.example as fallback
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
  console.warn('[env] No .env file found, using .env.example defaults');
}

// Environment config with defaults
const ENV_CONFIG = {
  ENV: process.env.ENV || 'DEV',
  DEBUG_LOGS: process.env.DEBUG_LOGS !== 'false',
  SHOW_DEVTOOLS: process.env.SHOW_DEVTOOLS === 'true',
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
};

// ============================================================================
// LOGGER (Main Process) with Buffer for UI
// ============================================================================

const LOG_LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_LOG_BUFFER_SIZE = 500;

/** In-memory log buffer for UI display */
const logBuffer = [];

/**
 * Check if a log level should be displayed.
 */
function shouldLog(level) {
  // In PROD, only warn and error
  if (ENV_CONFIG.ENV === 'PROD' && (level === 'debug' || level === 'info')) {
    return false;
  }
  // Check DEBUG_LOGS for debug level
  if (level === 'debug' && !ENV_CONFIG.DEBUG_LOGS) {
    return false;
  }
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[ENV_CONFIG.LOG_LEVEL];
}

/**
 * Format timestamp for log output.
 */
function formatTimestamp() {
  return new Date().toISOString().slice(11, 23);
}

/**
 * Add log entry to buffer and send to renderer if window exists.
 */
function addLogEntry(level, scope, message, data) {
  const entry = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    data: data !== undefined ? JSON.stringify(data) : undefined,
  };
  
  logBuffer.push(entry);
  
  // Trim buffer if too large
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_BUFFER_SIZE);
  }
  
  // Send to renderer if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log:entry', entry);
  }
  
  return entry;
}

/**
 * Structured logger for main process.
 */
const log = {
  debug(scope, message, data) {
    if (!shouldLog('debug')) return;
    addLogEntry('debug', scope, message, data);
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.debug(`\x1b[36m${ts} [DEBUG] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.debug(`\x1b[36m${ts} [DEBUG] [${scope}] ${message}\x1b[0m`);
    }
  },
  info(scope, message, data) {
    if (!shouldLog('info')) return;
    addLogEntry('info', scope, message, data);
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.info(`\x1b[32m${ts} [INFO ] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.info(`\x1b[32m${ts} [INFO ] [${scope}] ${message}\x1b[0m`);
    }
  },
  warn(scope, message, data) {
    if (!shouldLog('warn')) return;
    addLogEntry('warn', scope, message, data);
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.warn(`\x1b[33m${ts} [WARN ] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.warn(`\x1b[33m${ts} [WARN ] [${scope}] ${message}\x1b[0m`);
    }
  },
  error(scope, message, error) {
    if (!shouldLog('error')) return;
    addLogEntry('error', scope, message, error);
    const ts = formatTimestamp();
    if (error !== undefined) {
      console.error(`\x1b[31m${ts} [ERROR] [${scope}] ${message}\x1b[0m`, error);
    } else {
      console.error(`\x1b[31m${ts} [ERROR] [${scope}] ${message}\x1b[0m`);
    }
  },
};

// ============================================================================
// AUTH MODULE IMPORTS (Dynamic import for ES modules)
// ============================================================================

// Cache for auth module functions
let authModule = null;

/**
 * Dynamically import the auth module.
 * This is needed because the auth module uses TypeScript and needs to be
 * compiled first. In production, we'll import from the compiled dist.
 */
async function getAuthModule() {
  if (authModule) return authModule;
  
  try {
    // In development, we need to handle the TypeScript module
    // For now, we'll implement the auth logic directly here
    // In production, this would import from compiled code
    
    const { chromium } = await import('playwright');
    const fs = await import('fs');
    
    // Auth paths configuration
    const AUTH_DIR = path.join(app.getPath('userData'), 'auth');
    const BROWSER_PROFILE = path.join(AUTH_DIR, 'browser_profile');
    const COOKIES_FILE = path.join(AUTH_DIR, 'cookies.json');
    const SESSION_STATE_FILE = path.join(AUTH_DIR, 'session_state.json');
    
    // Auth target configuration (INALCO)
    const AUTH_TARGET = {
      id: 'inalco',
      name: 'INALCO',
      homeUrl: 'https://iaa.secureweb.inalco.com/MKMWPN23/home',
      authCookieNames: ['.ASPXAUTH', 'ee-authenticated'],
      authDomains: ['inalco.com'],
    };
    
    // Ensure directories exist
    function ensureAuthDirectories() {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        log.debug('AUTH', `Created auth directory: ${AUTH_DIR}`);
      }
      if (!fs.existsSync(BROWSER_PROFILE)) {
        fs.mkdirSync(BROWSER_PROFILE, { recursive: true });
        log.debug('AUTH', `Created browser profile: ${BROWSER_PROFILE}`);
      }
    }
    
    // Save cookies to file
    async function saveCookies(context) {
      const cookies = await context.cookies();
      const futureExpiry = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
      const now = Math.floor(Date.now() / 1000);
      
      const seen = new Map();
      for (const cookie of cookies) {
        const key = `${cookie.name}|${cookie.domain || ''}|${cookie.path || '/'}`;
        const cookieCopy = { ...cookie, expires: cookie.expires ?? -1 };
        
        if (cookieCopy.expires === -1) {
          cookieCopy.expires = futureExpiry;
        }
        if (cookieCopy.expires <= now) continue;
        
        seen.set(key, cookieCopy);
      }
      
      const persistedCookies = Array.from(seen.values());
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(persistedCookies, null, 2), 'utf-8');
      log.debug('AUTH', `Saved ${persistedCookies.length} cookies`);
    }
    
    // Restore cookies from file
    async function restoreCookies(context) {
      if (!fs.existsSync(COOKIES_FILE)) {
        log.debug('AUTH', 'No cookies file found');
        return 0;
      }
      
      try {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
        const now = Math.floor(Date.now() / 1000);
        const validCookies = cookies.filter(c => (c.expires ?? 0) > now);
        
        if (validCookies.length === 0) {
          log.debug('AUTH', 'All cookies expired');
          return 0;
        }
        
        await context.addCookies(validCookies);
        log.debug('AUTH', `Restored ${validCookies.length} cookies`);
        return validCookies.length;
      } catch (e) {
        log.warn('AUTH', `Could not restore cookies: ${e.message}`);
        return 0;
      }
    }
    
    // Save session state
    async function saveSessionState(context) {
      await saveCookies(context);
      
      const cookies = await context.cookies();
      const authCookies = cookies.filter(c => AUTH_TARGET.authCookieNames.includes(c.name));
      
      const state = {
        lastValidated: new Date().toISOString(),
        authCookiesPresent: authCookies.length > 0,
        cookieCount: cookies.length,
        domains: [...new Set(cookies.map(c => c.domain || ''))],
      };
      
      fs.writeFileSync(SESSION_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      log.debug('AUTH', 'Session state saved');
    }
    
    // Check if auth cookies are present
    async function hasAuthCookies(context) {
      const cookies = await context.cookies();
      const cookieNames = new Set(cookies.map(c => c.name));
      return AUTH_TARGET.authCookieNames.some(name => cookieNames.has(name));
    }
    
    // Get session status without browser
    function getSessionStatus() {
      const result = {
        isConnected: false,
        cookieCount: 0,
        domains: [],
        lastValidated: null,
        profileExists: fs.existsSync(BROWSER_PROFILE),
        cookiesFileExists: fs.existsSync(COOKIES_FILE),
        sessionAgeHours: Infinity,
      };
      
      // Check session state file
      if (fs.existsSync(SESSION_STATE_FILE)) {
        try {
          const state = JSON.parse(fs.readFileSync(SESSION_STATE_FILE, 'utf-8'));
          result.lastValidated = state.lastValidated;
          result.isConnected = state.authCookiesPresent || false;
          
          if (state.lastValidated) {
            const lastValidated = new Date(state.lastValidated).getTime();
            result.sessionAgeHours = (Date.now() - lastValidated) / (1000 * 60 * 60);
          }
        } catch (e) {
          log.warn('AUTH', `Could not load session state: ${e.message}`);
        }
      }
      
      // Check cookies file for more accurate count
      if (fs.existsSync(COOKIES_FILE)) {
        try {
          const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
          const now = Math.floor(Date.now() / 1000);
          const validCookies = cookies.filter(c => (c.expires ?? 0) > now);
          result.cookieCount = validCookies.length;
          result.domains = [...new Set(validCookies.map(c => c.domain || ''))];
          
          // Check if auth cookies are still valid
          const hasValidAuth = validCookies.some(c => AUTH_TARGET.authCookieNames.includes(c.name));
          if (!hasValidAuth) {
            result.isConnected = false;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Mark as disconnected if session is too old (> 24h)
      if (result.sessionAgeHours > 24) {
        result.isConnected = false;
      }
      
      return result;
    }
    
    // Login function - opens browser for authentication
    async function login(forceAuth = false) {
      ensureAuthDirectories();
      
      log.info('AUTH', 'Starting login flow...');
      log.debug('AUTH', `Browser profile: ${BROWSER_PROFILE}`);
      
      let context;
      try {
        context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
          headless: false,
          viewport: { width: 1280, height: 900 },
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
        });
        trackPlaywrightContext(context); // Track for cleanup on app quit
      } catch (e) {
        if (e.message.includes('lock') || e.message.includes('already in use')) {
          log.warn('AUTH', 'Browser profile locked - another instance is open');
          return {
            success: false,
            error: 'BROWSER_PROFILE_LOCKED',
            message: 'Une autre instance du navigateur est déjà ouverte. Fermez-la et réessayez.',
          };
        }
        throw e;
      }
      
      // Restore cookies
      await restoreCookies(context);
      
      const page = context.pages()[0] || await context.newPage();
      
      // Check if we need to authenticate
      const needsAuth = forceAuth || !(await hasAuthCookies(context));
      
      if (!needsAuth) {
        log.info('AUTH', 'Session already authenticated');
        await saveSessionState(context);
        await closeTrackedContext(context);
        return { success: true, message: 'Session déjà authentifiée' };
      }
      
      // Navigate to login page
      log.info('AUTH', 'Authentication required - navigating to login...');
      await page.goto(AUTH_TARGET.homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for authentication (max 3 minutes)
      log.info('AUTH', 'Waiting for authentication (timeout: 180s)...');
      const startTime = Date.now();
      const timeoutMs = 180 * 1000;
      
      while (Date.now() - startTime < timeoutMs) {
        if (await hasAuthCookies(context)) {
          log.info('AUTH', 'Authentication successful!');
          await saveSessionState(context);
          await closeTrackedContext(context);
          return { success: true, message: 'Connexion réussie!' };
        }
        await page.waitForTimeout(2000);
      }
      
      // Timeout
      log.error('AUTH', 'Authentication timeout');
      await closeTrackedContext(context);
      return {
        success: false,
        error: 'AUTH_TIMEOUT',
        message: 'Délai d\'authentification dépassé (180 secondes)',
      };
    }
    
    // Ensure session is valid, trigger login if needed
    async function ensureSession() {
      const status = getSessionStatus();
      
      if (status.isConnected && status.sessionAgeHours < 12) {
        return { success: true, needsLogin: false, status };
      }
      
      // Session expired or not present - trigger login
      const loginResult = await login(false);
      return {
        success: loginResult.success,
        needsLogin: true,
        status: getSessionStatus(),
        loginResult,
      };
    }
    
    /**
     * Logout - clear auth cookies while preserving browser profile (form autofill, etc.)
     * Uses surgical approach: removes only auth-related cookies from specific domains
     * Preserves: form autofill data, local storage preferences, other user data
     * @returns {Promise<void>}
     */
    async function logout() {
      log.info('AUTH', 'Logout initiated - clearing auth cookies (preserving browser profile)');
      
      // Domains that contain authentication cookies - be comprehensive
      const AUTH_DOMAINS = [
        'salesforce.com',
        '.salesforce.com',
        'force.com',
        '.force.com',
        'lightning.force.com',
        '.lightning.force.com',
        'inalco.com',
        '.inalco.com',
        'secureweb.inalco.com',
        '.secureweb.inalco.com',
      ];
      
      try {
        // Step 1: Delete our JSON files (auth state tracking)
        if (fs.existsSync(COOKIES_FILE)) {
          fs.unlinkSync(COOKIES_FILE);
          log.debug('AUTH', 'Deleted cookies.json file');
        }
        
        if (fs.existsSync(SESSION_STATE_FILE)) {
          fs.unlinkSync(SESSION_STATE_FILE);
          log.debug('AUTH', 'Deleted session_state.json file');
        }
        
        // Step 2: If browser profile exists, clear cookies from auth domains
        if (fs.existsSync(BROWSER_PROFILE)) {
          let context;
          try {
            // Launch headless context to manipulate cookies
            context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
              headless: true,
              args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
            });
            trackPlaywrightContext(context); // Track for cleanup
            
            // Get all cookies
            const allCookies = await context.cookies();
            log.debug('AUTH', `Found ${allCookies.length} total cookies in browser profile`);
            
            // Filter to find auth cookies to remove
            const cookiesToRemove = allCookies.filter(cookie => {
              const domain = cookie.domain || '';
              return AUTH_DOMAINS.some(authDomain =>
                domain === authDomain ||
                domain.endsWith(authDomain) ||
                authDomain.endsWith(domain)
              );
            });
            
            if (cookiesToRemove.length > 0) {
              log.debug('AUTH', `Removing ${cookiesToRemove.length} auth cookies from domains: ${[...new Set(cookiesToRemove.map(c => c.domain))].join(', ')}`);
              
              // Clear cookies by setting them with expired date
              // Playwright's clearCookies clears ALL cookies, so we need to be surgical
              for (const cookie of cookiesToRemove) {
                try {
                  // To delete a specific cookie, we need to get the URLs it applies to
                  const protocol = cookie.secure ? 'https' : 'http';
                  const domain = cookie.domain?.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
                  const url = `${protocol}://${domain}${cookie.path || '/'}`;
                  
                  // Clear cookies for this specific URL
                  await context.clearCookies({ domain: cookie.domain });
                } catch (clearErr) {
                  log.warn('AUTH', `Could not clear cookie ${cookie.name}: ${clearErr.message}`);
                }
              }
              
              // Verify removal
              const remainingCookies = await context.cookies();
              const remainingAuthCookies = remainingCookies.filter(cookie => {
                const domain = cookie.domain || '';
                return AUTH_DOMAINS.some(authDomain =>
                  domain === authDomain ||
                  domain.endsWith(authDomain) ||
                  authDomain.endsWith(domain)
                );
              });
              
              log.info('AUTH', `Auth cookies cleared. Remaining: ${remainingAuthCookies.length} auth, ${remainingCookies.length} total`);
            } else {
              log.debug('AUTH', 'No auth cookies found to remove');
            }
            
            await closeTrackedContext(context);
          } catch (browserErr) {
            // If browser profile is locked, we can't clear cookies surgically
            if (browserErr.message.includes('lock') || browserErr.message.includes('already in use')) {
              log.warn('AUTH', 'Browser profile locked - cannot clear cookies surgically. Only JSON files deleted.');
            } else {
              log.warn('AUTH', `Could not open browser profile: ${browserErr.message}`);
            }
            // Don't throw - we still deleted the JSON files which is the minimum logout
          }
        }
        
        log.info('AUTH', 'Logout complete - auth data cleared, browser profile preserved');
      } catch (e) {
        log.error('AUTH', 'Error during logout cleanup', e);
        throw e;
      }
    }
    
    authModule = {
      getSessionStatus,
      login,
      ensureSession,
      logout,
      AUTH_DIR,
      BROWSER_PROFILE,
      // Export for Salesforce module
      chromium,
      restoreCookies,
      saveCookies,
    };
    
    return authModule;
  } catch (e) {
    log.error('AUTH', 'Failed to initialize auth module', e);
    throw e;
  }
}

// ============================================================================
// SALESFORCE MODULE - Account Search via Aura API
// ============================================================================

// Configuration for authentication wait
const AUTH_WAIT_CONFIG = {
  pollIntervalMs: 2000,      // Check every 2 seconds
  maxWaitTimeMs: 180000,     // Max 3 minutes to login
};

// ============================================================================
// BROWSER OPERATION MUTEX - Prevents concurrent browser context operations
// ============================================================================

/**
 * Simple mutex implementation for browser operations.
 * Ensures only one browser operation runs at a time to prevent:
 * - Context destroyed errors during navigation
 * - Race conditions between auth and search operations
 * - Multiple browser instances fighting for the same profile
 */
class BrowserOperationMutex {
  constructor() {
    this.locked = false;
    this.queue = [];
    this.currentOperation = null;
  }

  /**
   * Acquire the lock. If already locked, wait in queue.
   * @param {string} operationName - Name of the operation for logging
   * @param {number} timeoutMs - Maximum time to wait for lock (default 60s)
   * @returns {Promise<boolean>} - True if lock acquired, false if timeout
   */
  async acquire(operationName, timeoutMs = 60000) {
    const startTime = Date.now();
    
    if (!this.locked) {
      this.locked = true;
      this.currentOperation = operationName;
      log.debug('MUTEX', `Lock acquired for: ${operationName}`);
      return true;
    }
    
    log.debug('MUTEX', `Waiting for lock: ${operationName} (blocked by: ${this.currentOperation})`);
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue on timeout
        const idx = this.queue.findIndex(item => item.resolve === resolve);
        if (idx !== -1) this.queue.splice(idx, 1);
        log.warn('MUTEX', `Lock timeout for: ${operationName} after ${timeoutMs}ms`);
        resolve(false);
      }, timeoutMs);
      
      this.queue.push({
        operationName,
        resolve: (acquired) => {
          clearTimeout(timeoutId);
          resolve(acquired);
        }
      });
    });
  }

  /**
   * Release the lock and notify next waiting operation.
   */
  release() {
    const releasedOperation = this.currentOperation;
    log.debug('MUTEX', `Lock released by: ${releasedOperation}`);
    
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.currentOperation = next.operationName;
      log.debug('MUTEX', `Lock transferred to: ${next.operationName}`);
      next.resolve(true);
    } else {
      this.locked = false;
      this.currentOperation = null;
    }
  }

  /**
   * Check if lock is currently held.
   */
  isLocked() {
    return this.locked;
  }

  /**
   * Get current operation name.
   */
  getCurrentOperation() {
    return this.currentOperation;
  }
}

// Global mutex instance for all browser operations
const browserMutex = new BrowserOperationMutex();

// Global tracker for active Playwright contexts (for cleanup on app quit)
const activePlaywrightContexts = new Set();

/**
 * Register a Playwright context for cleanup tracking.
 * Call this immediately after launching a persistent context.
 */
function trackPlaywrightContext(context) {
  activePlaywrightContexts.add(context);
  log.debug('CLEANUP', `Tracking Playwright context (total: ${activePlaywrightContexts.size})`);
}

/**
 * Unregister a Playwright context after it's been closed.
 */
function untrackPlaywrightContext(context) {
  activePlaywrightContexts.delete(context);
  log.debug('CLEANUP', `Untracked Playwright context (remaining: ${activePlaywrightContexts.size})`);
}

/**
 * Close all active Playwright contexts.
 * Called on app before-quit to prevent zombie processes.
 */
async function closeAllPlaywrightContexts() {
  if (activePlaywrightContexts.size === 0) return;
  
  log.info('CLEANUP', `Closing ${activePlaywrightContexts.size} active Playwright context(s)...`);
  
  const closePromises = [];
  for (const context of activePlaywrightContexts) {
    closePromises.push(
      context.close()
        .then(() => log.debug('CLEANUP', 'Context closed successfully'))
        .catch(err => log.warn('CLEANUP', `Error closing context: ${err.message}`))
    );
  }
  
  await Promise.allSettled(closePromises);
  activePlaywrightContexts.clear();
  log.info('CLEANUP', 'All Playwright contexts closed');
}

/**
 * Launch a tracked Playwright persistent context.
 * Automatically registers for cleanup on app quit.
 * @param {object} chromium - Playwright chromium instance
 * @param {string} profilePath - Browser profile path
 * @param {object} options - Launch options
 * @returns {Promise<BrowserContext>} - Tracked browser context
 */
async function launchTrackedContext(chromium, profilePath, options) {
  const context = await chromium.launchPersistentContext(profilePath, options);
  trackPlaywrightContext(context);
  return context;
}

/**
 * Close a tracked context and unregister it.
 * @param {BrowserContext} context - The context to close
 */
async function closeTrackedContext(context) {
  if (!context) return;
  try {
    await context.close();
  } finally {
    untrackPlaywrightContext(context);
  }
}

/**
 * Execute a browser operation with mutex protection.
 * Automatically acquires and releases the lock.
 *
 * @param {string} operationName - Name for logging
 * @param {Function} operation - Async function to execute
 * @param {Object} options - Options
 * @param {number} options.timeoutMs - Lock acquisition timeout
 * @param {number} options.retries - Number of retries on navigation errors
 * @returns {Promise<any>} - Result of the operation
 */
async function withBrowserMutex(operationName, operation, options = {}) {
  const { timeoutMs = 60000, retries = 2 } = options;
  
  const acquired = await browserMutex.acquire(operationName, timeoutMs);
  if (!acquired) {
    return {
      found: false,
      success: false,
      error: 'BROWSER_BUSY',
      message: 'Une autre opération est en cours. Veuillez patienter et réessayer.'
    };
  }
  
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        log.info('MUTEX', `Retry attempt ${attempt}/${retries} for: ${operationName}`);
        // Small delay before retry
        await new Promise(r => setTimeout(r, 1000));
      }
      
      const result = await operation();
      browserMutex.release();
      return result;
      
    } catch (error) {
      lastError = error;
      const isNavigationError =
        error.message?.includes('Execution context was destroyed') ||
        error.message?.includes('Target page, context or browser has been closed') ||
        error.message?.includes('navigation');
      
      if (isNavigationError && attempt < retries) {
        log.warn('MUTEX', `Navigation error in ${operationName}, will retry: ${error.message}`);
        continue;
      }
      
      // Non-retryable error or max retries reached
      break;
    }
  }
  
  browserMutex.release();
  throw lastError;
}

/**
 * Wait for Salesforce page to be fully loaded and stable.
 * Replaces fixed waitForTimeout with proper condition checks.
 *
 * @param {Page} page - Playwright page instance
 * @param {Object} options - Options
 * @param {boolean} options.waitForAura - Whether to wait for Aura framework
 * @param {number} options.timeoutMs - Maximum wait time (default 15s)
 * @returns {Promise<boolean>} - True if page is ready
 */
async function waitForSalesforceReady(page, options = {}) {
  const { waitForAura = true, timeoutMs = 15000 } = options;
  const startTime = Date.now();
  
  try {
    // Wait for network to be mostly idle (no more than 2 connections for 500ms)
    await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {
      log.debug('AURA', 'Network idle timeout, continuing anyway...');
    });
    
    // Wait for DOM to be stable (no major layout shifts)
    await page.waitForFunction(() => {
      return document.readyState === 'complete';
    }, { timeout: Math.max(1000, timeoutMs - (Date.now() - startTime)) }).catch(() => {});
    
    if (waitForAura) {
      // Wait for Aura framework to be available
      const auraReady = await page.waitForFunction(
        "typeof $A !== 'undefined' && typeof $A.getContext === 'function'",
        { timeout: Math.max(1000, timeoutMs - (Date.now() - startTime)) }
      ).then(() => true).catch(() => false);
      
      if (!auraReady) {
        log.debug('AURA', 'Aura framework not ready within timeout');
        return false;
      }
    }
    
    log.debug('AURA', `Salesforce ready after ${Date.now() - startTime}ms`);
    return true;
    
  } catch (error) {
    log.debug('AURA', `waitForSalesforceReady error: ${error.message}`);
    return false;
  }
}

/**
 * Safe page.evaluate wrapper with retry on navigation errors.
 *
 * @param {Page} page - Playwright page instance
 * @param {string|Function} script - Script to evaluate
 * @param {Object} options - Options
 * @param {number} options.retries - Number of retries (default 2)
 * @param {number} options.retryDelayMs - Delay between retries (default 500ms)
 * @returns {Promise<any>} - Result of evaluation
 */
async function safeEvaluate(page, script, options = {}) {
  const { retries = 2, retryDelayMs = 500 } = options;
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await page.evaluate(script);
    } catch (error) {
      lastError = error;
      const isNavigationError =
        error.message?.includes('Execution context was destroyed') ||
        error.message?.includes('navigation');
      
      if (isNavigationError && attempt < retries) {
        log.debug('AURA', `Evaluate failed due to navigation, retry ${attempt + 1}/${retries}`);
        await new Promise(r => setTimeout(r, retryDelayMs));
        // Wait for page to stabilize after navigation
        await waitForSalesforceReady(page, { waitForAura: false, timeoutMs: 5000 });
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Wait for Salesforce Aura framework to become available (user authenticated).
 * Polls the page until $A is defined or timeout is reached.
 *
 * @param {Page} page - Playwright page instance
 * @param {number} maxWaitMs - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - True if Aura became available, false if timeout
 */
async function waitForAuraAuthentication(page, maxWaitMs = AUTH_WAIT_CONFIG.maxWaitTimeMs) {
  const startTime = Date.now();
  const pollInterval = AUTH_WAIT_CONFIG.pollIntervalMs;
  
  log.info('AURA', `Waiting for user to authenticate (timeout: ${maxWaitMs / 1000}s)...`);
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Check current URL - if redirected to login page, wait
      const currentUrl = page.url();
      const isLoginPage = currentUrl.includes('login.salesforce.com') ||
                          currentUrl.includes('/login') ||
                          currentUrl.includes('identity.salesforce.com');
      
      if (isLoginPage) {
        log.debug('AURA', 'User is on login page, waiting...');
        await page.waitForTimeout(pollInterval);
        continue;
      }
      
      // Check if Aura is now available (using safe evaluate)
      const auraAvailable = await safeEvaluate(
        page,
        "typeof $A !== 'undefined' && typeof $A.getContext === 'function'",
        { retries: 1, retryDelayMs: 500 }
      ).catch(() => false);
      
      if (auraAvailable) {
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        log.info('AURA', `Authentication successful after ${elapsedSec}s`);
        return true;
      }
      
      // Wait before next check
      await page.waitForTimeout(pollInterval);
    } catch (error) {
      // Handle page closed errors gracefully
      if (error.message?.includes('Target page, context or browser has been closed')) {
        log.warn('AURA', 'Browser was closed during authentication wait');
        return false;
      }
      // For other errors, continue polling
      log.debug('AURA', `Polling error (continuing): ${error.message}`);
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }
  
  log.warn('AURA', 'Authentication timeout reached');
  return false;
}

/**
 * Search for a Salesforce Account by phone, email, or name.
 * Uses the Aura API via Playwright browser context.
 *
 * If the user is not authenticated, the browser stays open and waits
 * for the user to complete the login process before continuing.
 *
 * Search order: phone → email → name
 * Returns as soon as a match is found.
 *
 * @param {Object} params - Search parameters
 * @param {string} [params.phone] - Phone number (10 digits)
 * @param {string} [params.email] - Email address
 * @param {string} [params.firstName] - First name
 * @param {string} [params.lastName] - Last name
 * @returns {Promise<{ found: boolean, accountId?: string, accountName?: string, matchedBy?: string, error?: string }>}
 */
async function searchAccount({ phone, email, firstName, lastName }) {
  log.info('AURA', 'Starting account search', { phone: phone ? '***' : null, email: email ? '***' : null, name: `${firstName} ${lastName}` });
  
  // Use mutex to prevent concurrent browser operations
  return withBrowserMutex('searchAccount', async () => {
    const auth = await getAuthModule();
    const { chromium, restoreCookies, saveCookies, BROWSER_PROFILE } = auth;
    
    let context;
    try {
      // Launch browser with persistent context
      context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });
      trackPlaywrightContext(context); // Track for cleanup on app quit
      
      // Restore cookies
      await restoreCookies(context);
      
      const page = context.pages()[0] || await context.newPage();
      
      // Navigate to Salesforce Lightning
      log.debug('AURA', 'Navigating to Salesforce...');
      await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for Salesforce to be fully loaded (replaces fixed waitForTimeout)
      await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 10000 });
      
      // Check if Aura is available using safe evaluate
      let auraAvailable = await safeEvaluate(
        page,
        "typeof $A !== 'undefined' && typeof $A.getContext === 'function'"
      ).catch(() => false);
      
      // If Aura not available, wait for user to authenticate
      if (!auraAvailable) {
        log.warn('AURA', 'Aura framework not available - waiting for user authentication...');
        
        // Wait for the user to complete authentication
        const authenticated = await waitForAuraAuthentication(page);
        
        if (!authenticated) {
          log.error('AURA', 'Authentication timeout - user did not complete login');
          await closeTrackedContext(context);
          return {
            found: false,
            error: 'AUTH_TIMEOUT',
            message: 'Délai d\'authentification dépassé. Veuillez réessayer.'
          };
        }
        
        // Re-navigate to Salesforce home after successful auth
        log.debug('AURA', 'Re-navigating to Salesforce after authentication...');
        await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for Salesforce to be fully loaded
        await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 10000 });
        
        // Verify Aura is now available
        auraAvailable = await safeEvaluate(
          page,
          "typeof $A !== 'undefined' && typeof $A.getContext === 'function'"
        ).catch(() => false);
        
        if (!auraAvailable) {
          log.error('AURA', 'Aura still not available after authentication');
          await closeTrackedContext(context);
          return {
            found: false,
            error: 'AURA_NOT_AVAILABLE',
            message: 'Erreur Salesforce: framework Aura non disponible.'
          };
        }
      }
    
    // Capture Aura credentials
    log.debug('AURA', 'Capturing Aura credentials...');
    const credentials = await captureAuraCredentials(page);
    if (!credentials) {
      return { found: false, error: 'CREDENTIALS_CAPTURE_FAILED', message: 'Could not capture Aura credentials' };
    }
    
    log.debug('AURA', 'Credentials captured successfully');
    
    // Search by phone first (most precise)
    // SOLUTION: Use getAnswers (SOSL) which CAN search by Phone!
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
      log.info('AURA', `Phone search: original="${phone}", cleaned="${cleanPhone}", length=${cleanPhone.length}`);
      
      if (cleanPhone.length >= 7) {  // At least 7 digits for phone search
        // PRIMARY METHOD: Use getAnswers (SOSL-based) - this actually works for phone!
        log.info('AURA', 'Using getAnswers (SOSL) for phone search - the working solution!');
        const soslResult = await searchByGetAnswers(page, credentials, cleanPhone);
        if (soslResult.found) {
          soslResult.matchedBy = 'phone';
          if (soslResult.multipleResults) {
            log.info('AURA', `Phone found via SOSL: ${soslResult.candidates.length} accounts (user must select)`);
          } else {
            log.info('AURA', `Phone found via SOSL: ${soslResult.accountName} (${soslResult.accountId})`);
          }
          await saveCookies(context);
          await context.close();
          return soslResult;
        }
        
        // FALLBACK: Try getSuggestions with different formats (works for name in phone)
        log.debug('AURA', 'SOSL search returned no results, trying getSuggestions fallback...');
        const phoneFormats = [
          cleanPhone,                                           // 8193332623
          phone,                                                // (819) 333-2623
        ];
        
        for (const phoneFormat of phoneFormats) {
          log.debug('AURA', `Searching by phone format: "${phoneFormat}"`);
          const result = await searchByTerm(page, credentials, phoneFormat);
          if (result.found) {
            result.matchedBy = 'phone';
            log.info('AURA', `Phone matched with format: "${phoneFormat}"`);
            await saveCookies(context);
            await context.close();
            return result;
          }
        }
        
        log.info('AURA', 'Phone search: no results found via SOSL or getSuggestions.');
      } else {
        log.warn('AURA', `Phone too short (${cleanPhone.length} digits), skipping phone search`);
      }
    }
    
    // Search by email
    if (email) {
      log.info('AURA', `Email search: "${email}"`);
      
      // Try global search with full email
      log.debug('AURA', 'Searching by email (global search)...');
      const result = await searchByTerm(page, credentials, email);
      if (result.found) {
        result.matchedBy = 'email';
        await saveCookies(context);
        await context.close();
        return result;
      }
      
      // Try with email username only (before @)
      const emailUsername = email.split('@')[0];
      if (emailUsername && emailUsername.length >= 3) {
        log.debug('AURA', `Searching by email username: "${emailUsername}"`);
        const result2 = await searchByTerm(page, credentials, emailUsername);
        if (result2.found) {
          result2.matchedBy = 'email_username';
          await saveCookies(context);
          await context.close();
          return result2;
        }
      }
      
      // Try without entityName filter (broader search)
      log.debug('AURA', 'Email search failed, trying without entity filter...');
      const fallbackResult = await searchByTermNoFilter(page, credentials, email);
      if (fallbackResult.found) {
        fallbackResult.matchedBy = 'email_fallback';
        await saveCookies(context);
        await context.close();
        return fallbackResult;
      }
      
      log.info('AURA', 'Email search: no results. Note: Salesforce global search may not index Email/PersonEmail field by default.');
    }
    
    // Search by name
    if (firstName || lastName) {
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();
      if (fullName) {
        log.debug('AURA', 'Searching by name...');
        const result = await searchByTerm(page, credentials, fullName);
        if (result.found) {
          result.matchedBy = 'name';
          await saveCookies(context);
          await context.close();
          return result;
        }
        
        // Fallback: search by name WITHOUT entityName filter (broader search)
        log.debug('AURA', 'Trying fallback search without entity filter...');
        const fallbackResult = await searchByTermNoFilter(page, credentials, fullName);
        if (fallbackResult.found) {
          fallbackResult.matchedBy = 'name';
          await saveCookies(context);
          await context.close();
          return fallbackResult;
        }
      }
    }
    
      // No match found
      log.info('AURA', 'No account found after all search attempts');
      await saveCookies(context);
      await context.close();
      return { found: false };
      
    } catch (e) {
      log.error('AURA', 'Search error', e);
      if (context) await context.close().catch(() => {});
      
      if (e.message.includes('lock') || e.message.includes('already in use')) {
        return { found: false, error: 'BROWSER_PROFILE_LOCKED', message: 'Browser already open' };
      }
      
      return { found: false, error: 'SEARCH_ERROR', message: e.message };
    }
  }, { retries: 2 });  // withBrowserMutex options: retry on navigation errors
}

/**
 * Create a new Account in Salesforce.
 *
 * Creates an FSC Individual account with the provided contact information.
 *
 * @param {Object} params - Account data
 * @param {string} [params.firstName] - First name
 * @param {string} params.lastName - Last name (required)
 * @param {string} [params.phone] - Phone number (10 digits)
 * @param {string} [params.email] - Email address
 * @returns {Promise<{ success: boolean, accountId?: string, accountName?: string, accountUrl?: string, error?: string }>}
 */
async function createAccount({ firstName, lastName, phone, email }) {
  log.info('AURA', 'Starting account creation', { firstName, lastName, hasPhone: !!phone, hasEmail: !!email });
  
  // Validation before acquiring mutex
  if (!lastName) {
    return {
      success: false,
      accountId: null,
      accountName: null,
      accountUrl: null,
      error: 'LastName is required',
    };
  }
  
  // Use mutex to prevent concurrent browser operations
  return withBrowserMutex('createAccount', async () => {
    const result = {
      success: false,
      accountId: null,
      accountName: null,
      accountUrl: null,
      error: null,
    };
    
    const auth = await getAuthModule();
    const { chromium, restoreCookies, BROWSER_PROFILE } = auth;
    
    let context;
    try {
      // Launch browser with persistent context
      context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });
      trackPlaywrightContext(context); // Track for cleanup on app quit
      
      await restoreCookies(context);
      const page = context.pages()[0] || await context.newPage();
      
      // Navigate to Salesforce
      log.debug('AURA', 'Navigating to Salesforce...');
      await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for Salesforce to be fully loaded
      await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 10000 });
      
      // Check if Aura is available using safe evaluate
      let auraAvailable = await safeEvaluate(
        page,
        "typeof $A !== 'undefined' && typeof $A.getContext === 'function'"
      ).catch(() => false);
      
      if (!auraAvailable) {
        log.warn('AURA', 'Aura not available - waiting for authentication...');
        const authenticated = await waitForAuraAuthentication(page);
        
        if (!authenticated) {
          result.error = 'Authentication timeout';
          await context.close();
          return result;
        }
        
        await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 10000 });
      }
    
    // Capture Aura credentials
    log.debug('AURA', 'Capturing Aura credentials...');
    const credentials = await captureAuraCredentials(page);
    if (!credentials) {
      result.error = 'Could not capture Aura credentials';
      await context.close();
      return result;
    }
    
    // Build account fields
    const FSC_INDIVIDUAL_RECORD_TYPE_ID = '0125Y000001zWhpQAE';
    
    const accountFields = {
      LastName: lastName.trim(),
      RecordTypeId: FSC_INDIVIDUAL_RECORD_TYPE_ID,
    };
    
    if (firstName) {
      accountFields.FirstName = firstName.trim();
    }
    
    if (phone) {
      // Clean phone number - keep only digits, take last 10
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        accountFields.Phone = cleanPhone.slice(-10);
        // SF validation rule: Phone requires Primary_Phone_Type__c
        // Valid values: TEL_CEL (Cellulaire), TEL_HOM (Maison), TEL_OFF (Bureau), TEL_OTH (Autre)
        accountFields.Primary_Phone_Type__c = 'TEL_CEL';
      }
    }
    
    if (email) {
      accountFields.Primary_Email__c = email.trim();
      // SF validation rule: Primary_Email__c requires Primary_Email_Type__c
      // Valid values: EMA_PRI (Principal), EMA_OFF (Bureau)
      accountFields.Primary_Email_Type__c = 'EMA_PRI';
    }
    
    log.debug('AURA', 'Account fields to create:', accountFields);
    
    // Create account via Aura API
    const createResult = await page.evaluate(async ({ credentials, fields }) => {
      const descriptor = 'aura://RecordUiController/ACTION$createRecord';
      
      const message = {
        actions: [{
          id: '1;a',
          descriptor,
          callingDescriptor: 'UNKNOWN',
          params: {
            recordInput: {
              allowSaveOnDuplicate: true,
              apiName: 'Account',
              fields: fields,
            },
          },
        }],
      };
      
      const body = new URLSearchParams();
      body.append('message', JSON.stringify(message));
      body.append('aura.context', JSON.stringify(credentials.context));
      body.append('aura.token', credentials.token || 'undefined');
      
      const qp = new URLSearchParams({
        'aura.RecordUi.createRecord': '1',
        r: '1'
      });
      
      try {
        const response = await fetch('/aura?' + qp.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: body.toString(),
          credentials: 'include',
        });
        
        if (!response.ok) {
          return { success: false, error: `HTTP ${response.status}` };
        }
        
        const rawText = await response.text();
        const firstBrace = rawText.indexOf('{');
        if (firstBrace === -1) return { success: false, error: 'No JSON in response' };
        
        // Extract first JSON object
        let depth = 0, inString = false, escape = false, start = -1;
        for (let i = firstBrace; i < rawText.length; i++) {
          const ch = rawText[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') { if (depth === 0) start = i; depth++; }
          else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              const jsonStr = rawText.substring(start, i + 1);
              try {
                const data = JSON.parse(jsonStr);
                const actions = data.actions || [];
                if (actions.length === 0) {
                  return { success: false, error: 'Empty Aura response' };
                }
                const action = actions[0];
                if (action.state === 'SUCCESS') {
                  const returnValue = action.returnValue || {};
                  const recordId = returnValue.id || returnValue.record?.id;
                  return { success: true, recordId };
                } else {
                  const errors = action.error || [];
                  const errorMsg = errors.length > 0
                    ? (errors[0].message || errors[0].exceptionMessage || JSON.stringify(errors[0]))
                    : `Aura state: ${action.state}`;
                  return { success: false, error: errorMsg };
                }
              } catch (e) {
                return { success: false, error: `JSON parse error: ${e.message}` };
              }
            }
          }
        }
        return { success: false, error: 'Invalid JSON response' };
      } catch (e) {
        return { success: false, error: `Fetch error: ${e.message}` };
      }
    }, { credentials, fields: accountFields });
    
    if (createResult.success && createResult.recordId) {
      result.success = true;
      result.accountId = createResult.recordId;
      result.accountName = [firstName, lastName].filter(Boolean).join(' ');
      result.accountUrl = `https://indall.lightning.force.com/lightning/r/Account/${createResult.recordId}/view`;
      
      log.info('AURA', 'Account created successfully', {
        accountId: result.accountId,
        accountName: result.accountName,
      });
    } else {
      result.error = createResult.error || 'Unknown error';
      log.error('AURA', 'Account creation failed', { error: result.error });
    }
    
    await context.close();
    return result;
    
    } catch (e) {
      log.error('AURA', 'Account creation exception', e);
      result.error = e.message;
      if (context) await context.close();
      return result;
    }
  }, { retries: 1 });  // withBrowserMutex for createAccount
}

/**
 * Create a dossier (Opportunity + Case update).
 *
 * This function:
 * 1. Creates an Opportunity linked to the provided Account
 * 2. Waits for Salesforce trigger to auto-create a Case
 * 3. Updates the Case with additional fields
 *
 * @param {Object} params - Dossier parameters
 * @param {string} params.accountId - The Salesforce Account ID
 * @param {Object} params.opportunityData - Opportunity field values
 * @param {Object} params.caseData - Case field values to update
 * @returns {Promise<{ success: boolean, opportunityId?: string, opportunityUrl?: string, caseId?: string, caseUrl?: string, error?: string, warning?: string }>}
 */
async function createDossier({ accountId, opportunityData, caseData }) {
  log.info('AURA', 'Starting dossier creation', { accountId, hasOppData: !!opportunityData, hasCaseData: !!caseData });
  
  // Validation before acquiring mutex
  if (!accountId) {
    return {
      success: false,
      opportunityId: null,
      opportunityUrl: null,
      caseId: null,
      caseUrl: null,
      error: 'Account ID is required',
      warning: null,
    };
  }
  
  // Use mutex to prevent concurrent browser operations
  return withBrowserMutex('createDossier', async () => {
    const result = {
      success: false,
      opportunityId: null,
      opportunityUrl: null,
      caseId: null,
      caseUrl: null,
      error: null,
      warning: null,
    };
    
    const auth = await getAuthModule();
    const { chromium, restoreCookies, saveCookies, BROWSER_PROFILE } = auth;
    
    let context;
    try {
      // Launch browser with persistent context
      context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });
      trackPlaywrightContext(context); // Track for cleanup on app quit
      
      await restoreCookies(context);
      const page = context.pages()[0] || await context.newPage();
      
      // Navigate to Salesforce
      log.debug('AURA', 'Navigating to Salesforce...');
      await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for Salesforce to be fully loaded
      await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 10000 });
      
      // Check if Aura is available using safe evaluate
      let auraAvailable = await safeEvaluate(
        page,
        "typeof $A !== 'undefined' && typeof $A.getContext === 'function'"
      ).catch(() => false);
      
      if (!auraAvailable) {
        log.warn('AURA', 'Aura not available - waiting for authentication...');
        const authenticated = await waitForAuraAuthentication(page);
        
        if (!authenticated) {
          result.error = 'Authentication timeout';
          await context.close();
          return result;
        }
        
        await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 10000 });
      }
    
    // Capture Aura credentials
    log.debug('AURA', 'Capturing Aura credentials...');
    const credentials = await captureAuraCredentials(page);
    if (!credentials) {
      result.error = 'Could not capture Aura credentials';
      await context.close();
      return result;
    }
    
    // ─── Step 1: Create Opportunity ───
    log.info('AURA', 'Creating Opportunity...');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Required fields based on model/scripts/seeds/opportunity.js
    const opportunityFields = {
      // Core required fields
      AccountId: accountId,
      RecordTypeId: '012Am0000004KaZIAU', // Confirmed RecordTypeId from SF
      CloseDate: opportunityData?.closeDate || today,
      StageName: opportunityData?.stageName || 'Closed Won', // API uses English values
      Probability: 100,
      
      // Required custom fields (confirmed from API capture)
      Opportunity_Category__c: opportunityData?.opportunityCategory || 'Gobal Offer', // Note: typo is in SF
      Product_Interest__c: opportunityData?.productInterest || 'Life Insurance',
      Subsidiary__c: opportunityData?.subsidiary || 'iA',
      Proposal_Number__c: opportunityData?.proposalNumber || 'DRAFT',
      Contract_Number__c: opportunityData?.contractNumber || 'DRAFT',
      Transaction_Date__c: opportunityData?.transactionDate || today,
      Annual_Premium__c: opportunityData?.annualPremium || 0,
      
      // Optional fields from form (only if provided)
      ...(opportunityData?.typeActivite && { Type_d_activit__c: opportunityData.typeActivite }),
      ...(opportunityData?.familleInteret && { Famille_d_int_r_t__c: opportunityData.familleInteret }),
      ...(opportunityData?.interetProduit && { Int_r_t_produit__c: opportunityData.interetProduit }),
      ...(opportunityData?.produit && { Produit__c: opportunityData.produit }),
      ...(opportunityData?.provenance && { Provenance__c: opportunityData.provenance }),
      ...(opportunityData?.typeVente && { Type_de_vente__c: opportunityData.typeVente }),
      ...(opportunityData?.description && { Description: opportunityData.description }),
    };
    
    // Log fields being sent
    log.debug('AURA', 'Opportunity fields to create:', opportunityFields);
    
    const createOppResult = await page.evaluate(async ({ credentials, fields }) => {
      const descriptor = 'aura://RecordUiController/ACTION$createRecord';
      
      const message = {
        actions: [{
          id: '1;a',
          descriptor,
          callingDescriptor: 'UNKNOWN',
          params: {
            recordInput: {
              allowSaveOnDuplicate: false,
              apiName: 'Opportunity',
              fields: fields,
            },
          },
        }],
      };
      
      const body = new URLSearchParams();
      body.append('message', JSON.stringify(message));
      body.append('aura.context', JSON.stringify(credentials.context));
      body.append('aura.token', credentials.token || 'undefined');
      
      // Use the same queryParams as the working implementation
      const qp = new URLSearchParams({
        'aura.RecordUi.createRecord': '1',
        r: '1'
      });
      
      try {
        const response = await fetch('/aura?' + qp.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: body.toString(),
          credentials: 'include',
        });
        
        if (!response.ok) {
          return { success: false, error: `HTTP ${response.status}` };
        }
        
        const rawText = await response.text();
        const firstBrace = rawText.indexOf('{');
        if (firstBrace === -1) return { success: false, error: 'No JSON in response' };
        
        // Extract first JSON object
        let depth = 0, inString = false, escape = false, start = -1;
        for (let i = firstBrace; i < rawText.length; i++) {
          const ch = rawText[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') { if (depth === 0) start = i; depth++; }
          else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              const jsonStr = rawText.substring(start, i + 1);
              const data = JSON.parse(jsonStr);
              
              const actions = data.actions || [];
              if (actions.length === 0) return { success: false, error: 'No actions in response', _debug: { data } };
              
              const action = actions[0];
              if (action.state !== 'SUCCESS') {
                // Return full error details for debugging
                // action.error can be an array or object
                const errors = Array.isArray(action.error) ? action.error : [action.error];
                const firstError = errors[0] || {};
                const errorMsg = firstError.message || firstError.exceptionMessage || firstError.errorCode || 'Action failed';
                const fieldErrors = firstError.fieldErrors || firstError.data?.fieldErrors || null;
                const pageErrors = firstError.pageErrors || firstError.data?.pageErrors || null;
                return {
                  success: false,
                  error: errorMsg,
                  _debug: {
                    state: action.state,
                    fullError: JSON.stringify(errors, null, 2),
                    fieldErrors,
                    pageErrors,
                    rawAction: JSON.stringify(action, null, 2).substring(0, 2000),
                  }
                };
              }
              
              const recordId = action.returnValue?.id || action.returnValue?.recordId;
              if (!recordId) return { success: false, error: 'No record ID returned', _debug: { returnValue: action.returnValue } };
              
              return {
                success: true,
                recordId,
                recordUrl: `/lightning/r/Opportunity/${recordId}/view`,
              };
            }
          }
        }
        return { success: false, error: 'Could not parse response' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, { credentials, fields: opportunityFields });
    
    if (!createOppResult.success) {
      log.error('AURA', 'Failed to create Opportunity', {
        error: createOppResult.error,
        debug: createOppResult._debug,
      });
      result.error = `Failed to create Opportunity: ${createOppResult.error}`;
      if (createOppResult._debug?.fieldErrors) {
        result.error += ` | Field errors: ${JSON.stringify(createOppResult._debug.fieldErrors)}`;
      }
      await saveCookies(context);
      await context.close();
      return result;
    }
    
    result.opportunityId = createOppResult.recordId;
    result.opportunityUrl = `https://indall.lightning.force.com${createOppResult.recordUrl}`;
    log.info('AURA', `Opportunity created: ${result.opportunityId}`);
    
    // ─── Step 2: Wait for Salesforce trigger to create Case ───
    log.info('AURA', 'Waiting for Case creation trigger...');
    await page.waitForTimeout(2000);
    
    // ─── Step 3: Get Case ID from Opportunity ───
    log.info('AURA', 'Retrieving Case ID...');
    
    const getCaseResult = await page.evaluate(async ({ credentials, opportunityId }) => {
      // IMPORTANT: Use getRecordWithFields (not getRecord) - see model/auth/salesforce_aura_v2.js line 407
      const descriptor = 'aura://RecordUiController/ACTION$getRecordWithFields';
      
      const message = {
        actions: [{
          id: '1;a',
          descriptor,
          callingDescriptor: 'UNKNOWN',
          params: {
            recordId: opportunityId,
            fields: ['Opportunity.Case__c', 'Opportunity.Case__r.Id'],
          },
        }],
      };
      
      const body = new URLSearchParams();
      body.append('message', JSON.stringify(message));
      body.append('aura.context', JSON.stringify(credentials.context));
      body.append('aura.token', credentials.token || 'undefined');
      
      // IMPORTANT: Use correct query params for getRecordWithFields
      const qp = new URLSearchParams({ 'aura.RecordUi.getRecordWithFields': '1', r: '1' });
      
      try {
        const response = await fetch('/aura?' + qp.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: body.toString(),
          credentials: 'include',
        });
        
        if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
        
        const rawText = await response.text();
        const firstBrace = rawText.indexOf('{');
        if (firstBrace === -1) return { success: false, error: 'No JSON' };
        
        let depth = 0, inString = false, escape = false, start = -1;
        for (let i = firstBrace; i < rawText.length; i++) {
          const ch = rawText[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') { if (depth === 0) start = i; depth++; }
          else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              const jsonStr = rawText.substring(start, i + 1);
              const data = JSON.parse(jsonStr);
              
              const actions = data.actions || [];
              if (actions.length === 0) return { success: false, error: 'No actions' };
              
              const action = actions[0];
              if (action.state !== 'SUCCESS') {
                return { success: false, error: action.error?.message || 'Failed' };
              }
              
              const record = action.returnValue?.record || action.returnValue;
              const caseId = record?.fields?.Case__c?.value;
              
              if (!caseId) return { success: false, error: 'No Case__c field' };
              
              return { success: true, caseId };
            }
          }
        }
        return { success: false, error: 'Parse failed' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, { credentials, opportunityId: result.opportunityId });
    
    log.debug('AURA', 'getCaseResult:', getCaseResult);
    
    if (!getCaseResult.success) {
      log.warn('AURA', 'First attempt to get Case ID failed, retrying in 3 seconds...', { error: getCaseResult.error });
      
      // Retry after more time - trigger may need longer
      await page.waitForTimeout(3000);
      
      const retryResult = await page.evaluate(async ({ credentials, opportunityId }) => {
        const descriptor = 'aura://RecordUiController/ACTION$getRecordWithFields';
        const message = {
          actions: [{
            id: '1;a',
            descriptor,
            callingDescriptor: 'UNKNOWN',
            params: { recordId: opportunityId, fields: ['Opportunity.Case__c', 'Opportunity.Case__r.Id'] },
          }],
        };
        const body = new URLSearchParams();
        body.append('message', JSON.stringify(message));
        body.append('aura.context', JSON.stringify(credentials.context));
        body.append('aura.token', credentials.token || 'undefined');
        const qp = new URLSearchParams({ 'aura.RecordUi.getRecordWithFields': '1', r: '1' });
        try {
          const response = await fetch('/aura?' + qp.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString(),
            credentials: 'include',
          });
          if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
          const rawText = await response.text();
          const firstBrace = rawText.indexOf('{');
          if (firstBrace === -1) return { success: false, error: 'No JSON', rawText: rawText.substring(0, 500) };
          let depth = 0, inString = false, escape = false, start = -1;
          for (let i = firstBrace; i < rawText.length; i++) {
            const ch = rawText[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\' && inString) { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') { if (depth === 0) start = i; depth++; }
            else if (ch === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                const jsonStr = rawText.substring(start, i + 1);
                const data = JSON.parse(jsonStr);
                const actions = data.actions || [];
                if (actions.length === 0) return { success: false, error: 'No actions' };
                const action = actions[0];
                if (action.state !== 'SUCCESS') {
                  return { success: false, error: action.error?.message || 'Failed' };
                }
                const record = action.returnValue?.record || action.returnValue;
                const caseId = record?.fields?.Case__c?.value;
                if (!caseId) return { success: false, error: 'No Case__c field', _debug: { fields: Object.keys(record?.fields || {}) } };
                return { success: true, caseId };
              }
            }
          }
          return { success: false, error: 'Parse failed' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, { credentials, opportunityId: result.opportunityId });
      
      log.debug('AURA', 'Retry getCaseResult:', retryResult);
      
      if (!retryResult.success) {
        result.success = true; // Opportunity was created
        result.warning = `Opportunity created but could not retrieve Case: ${retryResult.error}`;
        if (retryResult._debug) {
          result.warning += ` | Available fields: ${JSON.stringify(retryResult._debug.fields)}`;
        }
        await saveCookies(context);
        await context.close();
        return result;
      }
      
      result.caseId = retryResult.caseId;
    } else {
      result.caseId = getCaseResult.caseId;
    }
    
    result.caseUrl = `https://indall.lightning.force.com/lightning/r/Case/${result.caseId}/view`;
    log.info('AURA', `Case found: ${result.caseId}`);
    
    // ─── Step 4: Update Case with form data ───
    if (caseData && Object.keys(caseData).length > 0) {
      log.info('AURA', 'Updating Case...');
      
      // Check if subsidiary is iA (for conditional signature fields)
      const isIaSubsidiary = opportunityData?.subsidiary === 'iA';
      
      // Build Case fields using correct API names from docs/Case.md
      // Required fields: Product_Family__c, Transaction_Category__c, Transaction_Sub_Category__c
      // Conditional (only if iA): SignatureType__c, CustomersPlaceOfResidence__c, ProductType__c
      const caseFields = {
        Id: result.caseId,
        Subject: 'Nouveau contrat',
        ...(caseData?.productFamily && { Product_Family__c: caseData.productFamily }),
        ...(caseData?.transactionCategory && { Transaction_Category__c: caseData.transactionCategory }),
        ...(caseData?.transactionSubCategory && { Transaction_Sub_Category__c: caseData.transactionSubCategory }),
        // Conditional iA fields
        ...(isIaSubsidiary && caseData?.signatureType && { SignatureType__c: caseData.signatureType }),
        ...(isIaSubsidiary && caseData?.customersPlaceOfResidence && { CustomersPlaceOfResidence__c: caseData.customersPlaceOfResidence }),
        ...(isIaSubsidiary && caseData?.productType && { ProductType__c: caseData.productType }),
      };
      
      log.debug('AURA', 'Case fields to update:', {
        caseId: result.caseId,
        isIaSubsidiary,
        fields: caseFields,
      });
      
      const updateCaseResult = await page.evaluate(async ({ credentials, caseId, fields }) => {
        const descriptor = 'aura://RecordUiController/ACTION$updateRecord';
        
        // Per docs/Case.md lines 337-353: recordId required at params level
        const message = {
          actions: [{
            id: '1;a',
            descriptor,
            callingDescriptor: 'UNKNOWN',
            params: {
              recordId: caseId,
              recordInput: {
                allowSaveOnDuplicate: false,
                fields: fields, // Direct values, not wrapped
              },
            },
          }],
        };
        
        const body = new URLSearchParams();
        body.append('message', JSON.stringify(message));
        body.append('aura.context', JSON.stringify(credentials.context));
        body.append('aura.token', credentials.token || 'undefined');
        
        // Use correct query params for updateRecord
        const qp = new URLSearchParams({
          'aura.RecordUi.updateRecord': '1',
          r: '1',
        });
        
        try {
          const response = await fetch('/aura?' + qp.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString(),
            credentials: 'include',
          });
          
          if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
          
          const rawText = await response.text();
          const firstBrace = rawText.indexOf('{');
          if (firstBrace === -1) return { success: false, error: 'No JSON' };
          
          let depth = 0, inString = false, escape = false, start = -1;
          for (let i = firstBrace; i < rawText.length; i++) {
            const ch = rawText[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\' && inString) { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') { if (depth === 0) start = i; depth++; }
            else if (ch === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                const jsonStr = rawText.substring(start, i + 1);
                const data = JSON.parse(jsonStr);
                
                const actions = data.actions || [];
                if (actions.length === 0) return { success: false, error: 'No actions in response' };
                
                const action = actions[0];
                if (action.state !== 'SUCCESS') {
                  // Extract detailed error info
                  const errorInfo = Array.isArray(action.error) ? action.error : [action.error];
                  const errorMessage = errorInfo.map(e => e?.message || JSON.stringify(e)).join('; ');
                  return {
                    success: false,
                    error: errorMessage || 'Update failed',
                    _debug: {
                      fieldErrors: action.error?.[0]?.fieldErrors,
                      pageErrors: action.error?.[0]?.pageErrors,
                      rawError: JSON.stringify(action.error),
                    },
                  };
                }
                
                return { success: true };
              }
            }
          }
          return { success: false, error: 'Parse failed' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, { credentials, caseId: result.caseId, fields: caseFields });
      
      if (!updateCaseResult.success) {
        log.error('AURA', 'Failed to update Case', {
          error: updateCaseResult.error,
          debug: updateCaseResult._debug,
        });
        result.success = true; // Opportunity and Case exist
        result.warning = `Case found but update failed: ${updateCaseResult.error}`;
        if (updateCaseResult._debug?.fieldErrors) {
          result.warning += ` | Field errors: ${JSON.stringify(updateCaseResult._debug.fieldErrors)}`;
        }
        await saveCookies(context);
        await context.close();
        return result;
      }
      
      log.info('AURA', 'Case updated successfully', { caseId: result.caseId });
    }
    
    result.success = true;
    log.info('AURA', 'Dossier creation complete', {
      opportunityId: result.opportunityId,
      caseId: result.caseId,
    });
    
    await saveCookies(context);
    await context.close();
    return result;
    
    } catch (e) {
      log.error('AURA', 'Dossier creation error', e);
      if (context) await context.close().catch(() => {});
      
      result.error = e.message;
      return result;
    }
  }, { retries: 1 });  // withBrowserMutex for createDossier
}

// ============================================================================
// UPLOAD DOCUMENTS (OpenText xECM)
// ============================================================================

const OPENTEXT_BASE_URL = 'https://otcs.ia.ca/cs/cs';
const OPENTEXT_API_V2 = `${OPENTEXT_BASE_URL}/api/v2`;
const DESCRIPTOR_GET_PERSPECTIVE = 'apex://xecm.CanvasAppController/ACTION$getPerspectiveParameters';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200);
}

function getContentType(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function isExtensionAllowed(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Fetch OTDS token via Aura API.
 */
async function fetchOtdsToken(page, credentials, caseId) {
  log.debug('UPLOAD', 'Fetching OTDS token for case', { caseId });
  
  try {
    const result = await safeEvaluate(page, async ({ credentials, caseId, descriptor }) => {
      const message = {
        actions: [{
          id: '1',
          descriptor: descriptor,
          callingDescriptor: 'UNKNOWN',
          params: {
            recordId: caseId,
            removeCSHeader: false,
            perspectiveType: 'Workspace',
            parameters: '',
          },
        }],
      };
      
      const body = new URLSearchParams();
      body.append('message', JSON.stringify(message));
      body.append('aura.context', JSON.stringify(credentials.context));
      body.append('aura.token', credentials.token || 'undefined');
      
      const response = await fetch('/aura?apex.xecm.CanvasAppController.getPerspectiveParameters=1&r=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString(),
        credentials: 'include',
      });
      
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
      
      const rawText = await response.text();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { success: false, error: 'No JSON in response' };
      
      const data = JSON.parse(jsonMatch[0]);
      const action = data.actions?.[0];
      if (!action || action.state !== 'SUCCESS') {
        return { success: false, error: action?.error?.[0]?.message || 'Aura action failed' };
      }
      
      const params = JSON.parse(action.returnValue);
      if (!params.token) return { success: false, error: 'No token in response - workspace may not exist yet' };
      
      let nodeId = null;
      if (params.perspectiveUrl) {
        const match = params.perspectiveUrl.match(/\/nodes\/(\d+)/);
        if (match) nodeId = match[1];
      }
      
      if (!nodeId) return { success: false, error: 'Workspace node ID not found' };
      
      return { success: true, token: params.token, nodeId };
    }, { retries: 1 });
    
    // Note: page.evaluate doesn't accept complex args directly, so we need a different approach
    // Let's use the browser's fetch directly
    
    return result;
  } catch (e) {
    log.error('UPLOAD', 'Error fetching OTDS token', { error: e.message });
    return { success: false, error: e.message };
  }
}

/**
 * Upload a single document to OpenText Content Server.
 */
async function uploadSingleDocument({ fileName, fileBuffer, parentNodeId, otdsToken }) {
  const sanitizedName = sanitizeFilename(fileName);
  const contentType = getContentType(fileName);
  
  log.debug('UPLOAD', 'Uploading document', { fileName: sanitizedName, size: fileBuffer.length });
  
  const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
  const parts = [];
  
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n144\r\n`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="parent_id"\r\n\r\n${parentNodeId}\r\n`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${sanitizedName}\r\n`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${sanitizedName}"\r\nContent-Type: ${contentType}\r\n\r\n`);
  
  const preamble = Buffer.from(parts.join(''), 'utf8');
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([preamble, fileBuffer, epilogue]);
  
  try {
    const response = await fetch(`${OPENTEXT_API_V2}/nodes`, {
      method: 'POST',
      headers: {
        OTDSTicket: otdsToken,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Accept: 'application/json',
      },
      body: body,
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        const nodeId = result.results?.data?.properties?.id || result.id;
        log.info('UPLOAD', 'Document uploaded successfully', { fileName: sanitizedName, nodeId });
        return { success: true, nodeId, fileName: sanitizedName };
      } catch {
        log.info('UPLOAD', 'Document uploaded (no node ID in response)', { fileName: sanitizedName });
        return { success: true, fileName: sanitizedName };
      }
    } else {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) errorMessage = errorData.error;
      } catch {}
      
      log.error('UPLOAD', 'Document upload failed', { fileName: sanitizedName, error: errorMessage });
      return { success: false, fileName: sanitizedName, error: errorMessage };
    }
  } catch (e) {
    log.error('UPLOAD', 'Document upload error', { fileName: sanitizedName, error: e.message });
    return { success: false, fileName: sanitizedName, error: e.message };
  }
}

/**
 * Upload documents to OpenText Content Server (xECM).
 *
 * @param {Object} params - Upload parameters
 * @param {string} params.caseId - Salesforce Case ID
 * @param {Array<{name: string, type: string, size: number, buffer: number[]}>} params.files - Files to upload
 * @returns {Promise<UploadDocumentsResult>}
 */
async function uploadDocuments({ caseId, files }) {
  log.info('UPLOAD', 'Starting document upload', { caseId, fileCount: files?.length || 0 });
  
  // Basic validation before acquiring mutex
  if (!caseId) {
    return { success: false, uploadedCount: 0, failedCount: files?.length || 0, results: [], error: 'caseId is required' };
  }
  
  if (!files || files.length === 0) {
    return { success: false, uploadedCount: 0, failedCount: 0, results: [], error: 'No files provided' };
  }
  
  // Validate files
  for (const file of files) {
    if (!isExtensionAllowed(file.name)) {
      return { success: false, uploadedCount: 0, failedCount: files.length, results: [], error: `File type not allowed: ${file.name}` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, uploadedCount: 0, failedCount: files.length, results: [], error: `File too large (max 25 MB): ${file.name}` };
    }
  }
  
  // Use mutex to prevent concurrent browser operations
  return withBrowserMutex('uploadDocuments', async () => {
    const result = {
      success: false,
      uploadedCount: 0,
      failedCount: 0,
      results: [],
      error: null,
    };
    
    const auth = await getAuthModule();
    const { chromium, restoreCookies, saveCookies, BROWSER_PROFILE } = auth;
    
    let context;
    try {
      context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });
      trackPlaywrightContext(context); // Track for cleanup on app quit
      
      await restoreCookies(context);
      const page = context.pages()[0] || await context.newPage();
      
      // Navigate to Salesforce
      log.debug('UPLOAD', 'Navigating to Salesforce...');
      await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 10000 });
      
      // Check Aura availability
      let auraAvailable = await safeEvaluate(
        page,
        "typeof $A !== 'undefined' && typeof $A.getContext === 'function'"
      ).catch(() => false);
      
      if (!auraAvailable) {
        log.warn('UPLOAD', 'Aura not available - waiting for authentication...');
        const authenticated = await waitForAuraAuthentication(page);
        
        if (!authenticated) {
          result.error = 'Authentication timeout';
          result.failedCount = files.length;
          await context.close();
          return result;
        }
        
        await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 10000 });
      }
      
      // Capture Aura credentials
      log.debug('UPLOAD', 'Capturing Aura credentials...');
      const credentials = await captureAuraCredentials(page);
      if (!credentials) {
        result.error = 'Could not capture Aura credentials';
        result.failedCount = files.length;
        await context.close();
        return result;
      }
      
      // Fetch OTDS token
      log.info('UPLOAD', 'Fetching OTDS token...');
      
      // Execute token fetch in browser context
      let tokenResult = await page.evaluate(async ({ caseId, credentials, descriptor }) => {
        const message = {
          actions: [{
            id: '1',
            descriptor: descriptor,
            callingDescriptor: 'UNKNOWN',
            params: {
              recordId: caseId,
              removeCSHeader: false,
              perspectiveType: 'Workspace',
              parameters: '',
            },
          }],
        };
        
        const body = new URLSearchParams();
        body.append('message', JSON.stringify(message));
        body.append('aura.context', JSON.stringify(credentials.context));
        body.append('aura.token', credentials.token || 'undefined');
        
        try {
          const response = await fetch('/aura?apex.xecm.CanvasAppController.getPerspectiveParameters=1&r=1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString(),
            credentials: 'include',
          });
          
          if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
          
          const rawText = await response.text();
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) return { success: false, error: 'No JSON in response' };
          
          const data = JSON.parse(jsonMatch[0]);
          const action = data.actions?.[0];
          if (!action || action.state !== 'SUCCESS') {
            return { success: false, error: action?.error?.[0]?.message || 'Aura action failed' };
          }
          
          const params = JSON.parse(action.returnValue);
          if (!params.token) return { success: false, error: 'No token - workspace may not exist yet' };
          
          let nodeId = null;
          if (params.perspectiveUrl) {
            const match = params.perspectiveUrl.match(/\/nodes\/(\d+)/);
            if (match) nodeId = match[1];
          }
          
          if (!nodeId) return { success: false, error: 'Workspace node ID not found' };
          
          return { success: true, token: params.token, nodeId };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, { caseId, credentials, descriptor: DESCRIPTOR_GET_PERSPECTIVE });
      
      // Retry token fetch once if failed
      if (!tokenResult.success) {
        log.warn('UPLOAD', 'Token fetch failed, retrying in 3s...', { error: tokenResult.error });
        await new Promise(r => setTimeout(r, 3000));
        
        tokenResult = await page.evaluate(async ({ caseId, credentials, descriptor }) => {
          // Same code as above...
          const message = {
            actions: [{
              id: '1',
              descriptor: descriptor,
              callingDescriptor: 'UNKNOWN',
              params: {
                recordId: caseId,
                removeCSHeader: false,
                perspectiveType: 'Workspace',
                parameters: '',
              },
            }],
          };
          
          const body = new URLSearchParams();
          body.append('message', JSON.stringify(message));
          body.append('aura.context', JSON.stringify(credentials.context));
          body.append('aura.token', credentials.token || 'undefined');
          
          try {
            const response = await fetch('/aura?apex.xecm.CanvasAppController.getPerspectiveParameters=1&r=1', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
              body: body.toString(),
              credentials: 'include',
            });
            
            if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
            
            const rawText = await response.text();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return { success: false, error: 'No JSON in response' };
            
            const data = JSON.parse(jsonMatch[0]);
            const action = data.actions?.[0];
            if (!action || action.state !== 'SUCCESS') {
              return { success: false, error: action?.error?.[0]?.message || 'Aura action failed' };
            }
            
            const params = JSON.parse(action.returnValue);
            if (!params.token) return { success: false, error: 'No token - workspace may not exist yet' };
            
            let nodeId = null;
            if (params.perspectiveUrl) {
              const match = params.perspectiveUrl.match(/\/nodes\/(\d+)/);
              if (match) nodeId = match[1];
            }
            
            if (!nodeId) return { success: false, error: 'Workspace node ID not found' };
            
            return { success: true, token: params.token, nodeId };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }, { caseId, credentials, descriptor: DESCRIPTOR_GET_PERSPECTIVE });
      }
      
      if (!tokenResult.success) {
        result.error = `Failed to get OTDS token: ${tokenResult.error}`;
        result.failedCount = files.length;
        await saveCookies(context);
        await context.close();
        return result;
      }
      
      const { token: otdsToken, nodeId: workspaceNodeId } = tokenResult;
      result.workspaceNodeId = workspaceNodeId;
      
      // Upload each document sequentially
      log.info('UPLOAD', `Uploading ${files.length} document(s) to workspace ${workspaceNodeId}`);
      
      for (const file of files) {
        const fileBuffer = Buffer.from(file.buffer);
        const uploadResult = await uploadSingleDocument({
          fileName: file.name,
          fileBuffer,
          parentNodeId: workspaceNodeId,
          otdsToken,
        });
        
        result.results.push({
          fileName: file.name,
          success: uploadResult.success,
          nodeId: uploadResult.nodeId,
          error: uploadResult.error,
        });
        
        if (uploadResult.success) {
          result.uploadedCount++;
        } else {
          result.failedCount++;
          
          // If 401, try to refresh token and retry
          if (uploadResult.error && uploadResult.error.includes('401')) {
            log.warn('UPLOAD', 'Token expired, refreshing...');
            const refreshResult = await page.evaluate(async ({ caseId, credentials, descriptor }) => {
              // Token fetch code (same as above)
              const message = {
                actions: [{
                  id: '1',
                  descriptor: descriptor,
                  callingDescriptor: 'UNKNOWN',
                  params: { recordId: caseId, removeCSHeader: false, perspectiveType: 'Workspace', parameters: '' },
                }],
              };
              const body = new URLSearchParams();
              body.append('message', JSON.stringify(message));
              body.append('aura.context', JSON.stringify(credentials.context));
              body.append('aura.token', credentials.token || 'undefined');
              try {
                const response = await fetch('/aura?apex.xecm.CanvasAppController.getPerspectiveParameters=1&r=1', {
                  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                  body: body.toString(), credentials: 'include',
                });
                if (!response.ok) return { success: false };
                const rawText = await response.text();
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) return { success: false };
                const data = JSON.parse(jsonMatch[0]);
                const action = data.actions?.[0];
                if (!action || action.state !== 'SUCCESS') return { success: false };
                const params = JSON.parse(action.returnValue);
                if (!params.token) return { success: false };
                return { success: true, token: params.token };
              } catch { return { success: false }; }
            }, { caseId, credentials, descriptor: DESCRIPTOR_GET_PERSPECTIVE });
            
            if (refreshResult.success) {
              const retryResult = await uploadSingleDocument({
                fileName: file.name,
                fileBuffer,
                parentNodeId: workspaceNodeId,
                otdsToken: refreshResult.token,
              });
              
              const lastIdx = result.results.length - 1;
              result.results[lastIdx] = {
                fileName: file.name,
                success: retryResult.success,
                nodeId: retryResult.nodeId,
                error: retryResult.error,
              };
              
              if (retryResult.success) {
                result.uploadedCount++;
                result.failedCount--;
              }
            }
          }
        }
      }
      
      result.success = result.failedCount === 0;
      if (result.failedCount > 0) {
        result.error = `${result.failedCount} document(s) failed to upload`;
      }
      
      log.info('UPLOAD', 'Document upload complete', {
        uploadedCount: result.uploadedCount,
        failedCount: result.failedCount,
      });
      
      await saveCookies(context);
      await context.close();
      return result;
      
    } catch (e) {
      log.error('UPLOAD', 'Upload documents error', e);
      if (context) await context.close().catch(() => {});
      return {
        success: false,
        uploadedCount: 0,
        failedCount: files.length,
        results: [],
        error: e.message,
      };
    }
  }, { retries: 1 });
}

// ============================================================================
// CREATE NOTE (ContentNote linked to Case)
// ============================================================================

/**
 * API Descriptors for Note creation
 */
const DESCRIPTOR_CREATE_NOTE =
  'serviceComponent://ui.force.components.controllers.recordGlobalValueProvider.RecordGvpController/ACTION$saveRecord';

const DESCRIPTOR_LINK_NOTE =
  'serviceComponent://ui.notes.components.aura.components.editPanel.EditPanelController/ACTION$serverCreateUpdate';

/**
 * Extract current user ID from Salesforce Lightning context.
 * Tries multiple methods to find the user ID.
 *
 * @param {Page} page - Playwright page with Lightning loaded
 * @returns {Promise<string|null>} User ID (18 chars) or null if not found
 */
async function getUserId(page) {
  return await safeEvaluate(page, () => {
    // Method 1: UserContext (most reliable in Lightning)
    if (window.UserContext?.userId) {
      return window.UserContext.userId;
    }
    
    // Method 2: $A.get (Aura GVP)
    if (typeof $A !== 'undefined' && $A.get) {
      const uid = $A.get('$SObjectType.CurrentUser.Id');
      if (uid) return uid;
    }
    
    // Method 3: $User global
    if (window.$User?.id) {
      return window.$User.id;
    }
    
    // Method 4: Script tag parsing (fallback)
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const match = script.textContent?.match(/"userId"\s*:\s*"(005[a-zA-Z0-9]{15})"/);
      if (match) return match[1];
    }
    
    return null;
  }, { retries: 2 });
}

/**
 * Prepare note content: escape HTML and encode to Base64.
 *
 * @param {string} plainText - Plain text content from textarea
 * @returns {string} Base64 encoded HTML content
 */
function prepareNoteContent(plainText) {
  // Escape HTML special characters
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Wrap in paragraphs (convert newlines to paragraph breaks)
  const html = `<p>${escaped.replace(/\n/g, '</p><p>')}</p>`;
  
  // Encode to Base64
  return Buffer.from(html, 'utf-8').toString('base64');
}

/**
 * Create a Note (ContentNote) and link it to a Case in Salesforce.
 *
 * Process:
 * 1. Get current user ID (required for OwnerId)
 * 2. Create ContentNote via RecordGvpController/saveRecord
 * 3. Link to Case via EditPanelController/serverCreateUpdate
 *
 * @param {Object} params - Note parameters
 * @param {string} params.caseId - Salesforce Case ID to link the note to
 * @param {string} params.title - Note title
 * @param {string} params.content - Plain text content (will be converted to HTML/Base64)
 * @returns {Promise<{ success: boolean, noteId?: string, error?: string }>}
 */
async function createNote({ caseId, title, content }) {
  log.info('NOTE', 'Starting note creation', { caseId, titleLength: title?.length, contentLength: content?.length });
  
  // Validation before acquiring mutex
  if (!caseId) {
    return { success: false, noteId: null, error: 'caseId is required' };
  }
  if (!content || content.trim().length === 0) {
    return { success: false, noteId: null, error: 'content is required' };
  }
  
  // Use mutex to prevent concurrent browser operations
  return withBrowserMutex('createNote', async () => {
    const result = {
      success: false,
      noteId: null,
      error: null,
    };
    
    const auth = await getAuthModule();
    const { chromium, restoreCookies, saveCookies, BROWSER_PROFILE } = auth;
    
    let context;
    try {
      // Launch browser with persistent context
      context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
        headless: false,
        viewport: { width: 1280, height: 900 },
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });
      trackPlaywrightContext(context); // Track for cleanup on app quit
      
      await restoreCookies(context);
      const page = context.pages()[0] || await context.newPage();
      
      // Navigate to Case page to ensure Lightning context is loaded
      const caseUrl = `https://indall.lightning.force.com/lightning/r/Case/${caseId}/view`;
      log.debug('NOTE', `Navigating to Case: ${caseUrl}`);
      await page.goto(caseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for Salesforce to be fully loaded
      await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 15000 });
      
      // Check if Aura is available
      let auraAvailable = await safeEvaluate(
        page,
        "typeof $A !== 'undefined' && typeof $A.getContext === 'function'"
      ).catch(() => false);
      
      if (!auraAvailable) {
        log.warn('NOTE', 'Aura not available - waiting for authentication...');
        const authenticated = await waitForAuraAuthentication(page);
        
        if (!authenticated) {
          result.error = 'Authentication timeout';
          await context.close();
          return result;
        }
        
        // Re-navigate to Case page after auth
        await page.goto(caseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForSalesforceReady(page, { waitForAura: true, timeoutMs: 15000 });
      }
      
      // Capture Aura credentials - try network interception first, then fallback to $A context
      log.debug('NOTE', 'Capturing Aura credentials...');
      let credentials = await captureAuraCredentials(page, 8000); // Shorter timeout
      
      if (!credentials) {
        log.debug('NOTE', 'Network interception failed, trying $A context extraction...');
        credentials = await extractAuraCredentialsFromContext(page);
      }
      
      if (!credentials) {
        result.error = 'Could not capture Aura credentials';
        log.error('NOTE', 'All credential extraction methods failed');
        await context.close();
        return result;
      }
      
      log.debug('NOTE', 'Aura credentials obtained successfully');
      
      // Get current user ID (required for OwnerId)
      log.debug('NOTE', 'Getting current user ID...');
      const userId = await getUserId(page);
      if (!userId) {
        result.error = 'Could not get current user ID';
        log.error('NOTE', 'Failed to get user ID from Lightning context');
        await context.close();
        return result;
      }
      log.debug('NOTE', `User ID obtained: ${userId.substring(0, 10)}...`);
      
      // Prepare content
      const noteTitle = title || 'Note';
      const base64Content = prepareNoteContent(content);
      
      // ── Step 1: Create ContentNote ─────────────────────────────────────────
      log.info('NOTE', 'Step 1: Creating ContentNote...');
      
      const createNoteResult = await page.evaluate(async ({ credentials, title, base64Content, userId, descriptor }) => {
        const message = {
          actions: [{
            id: '1;a',
            descriptor: descriptor,
            callingDescriptor: 'UNKNOWN',
            params: {
              recordRep: {
                id: null,
                apiName: 'ContentNote',
                fields: {
                  Id: { value: null },
                  Title: { value: title },
                  Content: { value: base64Content },
                  OwnerId: { value: userId },
                  SharingPrivacy: { value: 'N' }, // N = Normal, P = Private
                },
                recordTypeInfo: null,
              },
              recordSaveParams: {
                bypassAsyncSave: true,
              },
            },
          }],
        };
        
        const body = new URLSearchParams();
        body.append('message', JSON.stringify(message));
        body.append('aura.context', JSON.stringify(credentials.context));
        body.append('aura.token', credentials.token || 'undefined');
        
        const qp = new URLSearchParams({
          'ui.force.components.controllers.recordGlobalValueProvider.RecordGvpController.saveRecord': '1',
          'r': '1',
        });
        
        try {
          const response = await fetch('/aura?' + qp.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString(),
            credentials: 'include',
          });
          
          if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
          }
          
          const rawText = await response.text();
          const firstBrace = rawText.indexOf('{');
          if (firstBrace === -1) return { success: false, error: 'No JSON in response' };
          
          // Parse JSON response
          let depth = 0, inString = false, escape = false, start = -1;
          for (let i = firstBrace; i < rawText.length; i++) {
            const ch = rawText[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\' && inString) { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') { if (depth === 0) start = i; depth++; }
            else if (ch === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                const jsonStr = rawText.substring(start, i + 1);
                const data = JSON.parse(jsonStr);
                
                const actions = data.actions || [];
                if (actions.length === 0) return { success: false, error: 'No actions in response' };
                
                const action = actions[0];
                if (action.state !== 'SUCCESS') {
                  const errors = action.error || [];
                  const errorMsg = errors.length > 0
                    ? (errors[0].message || errors[0].exceptionMessage || JSON.stringify(errors[0]))
                    : `State: ${action.state}`;
                  return { success: false, error: errorMsg };
                }
                
                // Extract note ID from response - multiple possible formats
                let noteId = null;
                const rv = action.returnValue;
                
                // Format 1: { id: "..." }
                if (rv?.id) {
                  noteId = rv.id;
                }
                // Format 2: Direct string ID
                else if (typeof rv === 'string' && rv.startsWith('069')) {
                  noteId = rv;
                }
                // Format 3: { record: { id: "..." } }
                else if (rv?.record?.id) {
                  noteId = rv.record.id;
                }
                // Format 4: { recordId: "..." }
                else if (rv?.recordId) {
                  noteId = rv.recordId;
                }
                // Format 5: Search for any field that looks like a ContentNote ID
                else if (rv) {
                  for (const key of Object.keys(rv)) {
                    const val = rv[key];
                    if (typeof val === 'string' && val.startsWith('069')) {
                      noteId = val;
                      break;
                    }
                  }
                }
                
                if (!noteId) {
                  // Return full response for debugging
                  return {
                    success: false,
                    error: 'Note created but ID not found in response',
                    debug: {
                      state: action.state,
                      returnValueKeys: rv ? Object.keys(rv) : null,
                      returnValueSample: JSON.stringify(rv).substring(0, 200)
                    }
                  };
                }
                
                return { success: true, noteId };
              }
            }
          }
          return { success: false, error: 'Could not parse response' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, {
        credentials,
        title: noteTitle,
        base64Content,
        userId,
        descriptor: DESCRIPTOR_CREATE_NOTE,
      });
      
      if (!createNoteResult.success) {
        log.error('NOTE', 'ContentNote creation failed', {
          error: createNoteResult.error,
          debug: createNoteResult.debug
        });
        result.error = `Failed to create note: ${createNoteResult.error}`;
        await saveCookies(context);
        await context.close();
        return result;
      }
      
      const noteId = createNoteResult.noteId;
      log.info('NOTE', `ContentNote created: ${noteId}`);
      
      // ── Step 2: Link Note to Case ──────────────────────────────────────────
      log.info('NOTE', 'Step 2: Linking note to Case...');
      
      const linkResult = await page.evaluate(async ({ credentials, noteId, caseId, descriptor }) => {
        const message = {
          actions: [{
            id: '1;a',
            descriptor: descriptor,
            callingDescriptor: 'UNKNOWN',
            params: {
              noteId: noteId,
              title: '',
              textContent: '',
              richTextContent: '',
              noteChanged: false,
              relatedIdsChanged: true,
              relatedIds: [caseId],
            },
          }],
        };
        
        const body = new URLSearchParams();
        body.append('message', JSON.stringify(message));
        body.append('aura.context', JSON.stringify(credentials.context));
        body.append('aura.token', credentials.token || 'undefined');
        
        const qp = new URLSearchParams({
          'ui.notes.components.aura.components.editPanel.EditPanelController.serverCreateUpdate': '1',
          'r': '1',
        });
        
        try {
          const response = await fetch('/aura?' + qp.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString(),
            credentials: 'include',
          });
          
          if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
          }
          
          const rawText = await response.text();
          const firstBrace = rawText.indexOf('{');
          if (firstBrace === -1) return { success: false, error: 'No JSON in response' };
          
          // Parse JSON response
          let depth = 0, inString = false, escape = false, start = -1;
          for (let i = firstBrace; i < rawText.length; i++) {
            const ch = rawText[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\' && inString) { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') { if (depth === 0) start = i; depth++; }
            else if (ch === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                const jsonStr = rawText.substring(start, i + 1);
                const data = JSON.parse(jsonStr);
                
                const actions = data.actions || [];
                if (actions.length === 0) return { success: false, error: 'No actions in response' };
                
                const action = actions[0];
                if (action.state !== 'SUCCESS') {
                  const errors = action.error || [];
                  const errorMsg = errors.length > 0
                    ? (errors[0].message || errors[0].exceptionMessage || JSON.stringify(errors[0]))
                    : `State: ${action.state}`;
                  return { success: false, error: errorMsg };
                }
                
                return { success: true };
              }
            }
          }
          return { success: false, error: 'Could not parse response' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, {
        credentials,
        noteId,
        caseId,
        descriptor: DESCRIPTOR_LINK_NOTE,
      });
      
      if (!linkResult.success) {
        log.warn('NOTE', 'Note linking failed - note created but not linked', {
          noteId,
          error: linkResult.error
        });
        // Return partial success - note exists but not linked
        result.success = true; // Partial success
        result.noteId = noteId;
        result.warning = `Note created (${noteId}) but linking failed: ${linkResult.error}`;
        await saveCookies(context);
        await context.close();
        return result;
      }
      
      log.info('NOTE', 'Note created and linked successfully', { noteId, caseId });
      result.success = true;
      result.noteId = noteId;
      
      await saveCookies(context);
      await context.close();
      return result;
      
    } catch (e) {
      log.error('NOTE', 'Note creation error', e);
      if (context) await context.close().catch(() => {});
      result.error = e.message;
      return result;
    }
  }, { retries: 1 });
}

/**
 * Capture Aura credentials from page requests.
 * This requires triggering a UI action to force an Aura request.
 */
async function captureAuraCredentials(page, timeout = 15000) {
  log.debug('AURA', `Starting credential capture (timeout: ${timeout}ms)`);
  
  return new Promise(async (resolve) => {
    let resolved = false;
    let requestCount = 0;
    
    const handler = (request) => {
      if (resolved) return;
      
      // Only log Aura requests
      if (request.url().includes('/aura') && request.method() === 'POST') {
        requestCount++;
        const postData = request.postData();
        
        if (!postData) {
          log.debug('AURA', `Request ${requestCount} has no POST data`);
          return;
        }
        
        try {
          const params = new URLSearchParams(postData);
          const contextStr = params.get('aura.context');
          const token = params.get('aura.token');
          
          if (contextStr) {
            const context = JSON.parse(contextStr);
            if (context.fwuid) {
              log.debug('AURA', `Captured credentials from request ${requestCount}`, {
                fwuid: context.fwuid.substring(0, 25) + '...',
                hasToken: !!(token && token !== 'undefined')
              });
              
              resolved = true;
              page.off('request', handler);
              resolve({
                context,
                token: (token && token !== 'undefined') ? token : null,
              });
            } else {
              log.debug('AURA', `Request ${requestCount}: context found but no fwuid`);
            }
          } else {
            log.debug('AURA', `Request ${requestCount}: no aura.context in body`);
          }
        } catch (e) {
          log.debug('AURA', `Request ${requestCount}: parse error - ${e.message}`);
        }
      }
    };
    
    page.on('request', handler);
    
    // Wait for initial page activity
    log.debug('AURA', 'Waiting 2s for page to stabilize...');
    await page.waitForTimeout(2000);
    
    // Try multiple UI triggers to force Aura requests
    if (!resolved) {
      log.debug('AURA', 'Attempting to trigger Aura request via UI interactions...');
      
      const triggerSelectors = [
        // Global search
        'input[type="search"]',
        'button[title="Search"]',
        '.search-button',
        // Navigation tabs - clicking these often triggers Aura
        'a[data-label="Related"]',
        'a[data-label="Details"]',
        // Any clickable element that might trigger Aura
        '.slds-button',
        '.forceActionsContainer button',
        // Tab headers
        '.tabHeader',
        'lightning-tabset lightning-tab-bar'
      ];
      
      for (const selector of triggerSelectors) {
        if (resolved) break;
        
        try {
          const element = await page.$(selector);
          if (element) {
            log.debug('AURA', `Clicking element: ${selector}`);
            await element.click({ timeout: 1000 }).catch(() => {});
            await page.waitForTimeout(500);
            
            if (resolved) {
              log.debug('AURA', `Credential captured after clicking: ${selector}`);
              break;
            }
          }
        } catch (e) {
          // Ignore click errors
        }
      }
    }
    
    // If still not resolved, try hovering over elements (some trigger on hover)
    if (!resolved) {
      log.debug('AURA', 'Trying hover interactions...');
      try {
        await page.mouse.move(500, 300);
        await page.waitForTimeout(300);
        await page.mouse.move(600, 400);
        await page.waitForTimeout(300);
      } catch (e) {
        // Ignore
      }
    }
    
    // Timeout
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        log.warn('AURA', `Credential capture timeout after ${timeout}ms (${requestCount} requests intercepted)`);
        resolved = true;
        page.off('request', handler);
        resolve(null);
      }
    }, timeout);
    
    // Wait for remaining time if not yet resolved
    if (!resolved) {
      const remainingTime = timeout - 2500; // Already waited 2s + trigger time
      if (remainingTime > 0) {
        await page.waitForTimeout(remainingTime).catch(() => {});
      }
    }
    
    clearTimeout(timeoutId);
  });
}

/**
 * Extract Aura credentials directly from $A context (fallback method).
 * Uses encodeForServer() to get the properly serialized context with fwuid.
 */
async function extractAuraCredentialsFromContext(page) {
  log.debug('AURA', 'Attempting to extract credentials from $A context...');
  
  try {
    const credentials = await safeEvaluate(page, `
      (function() {
        const debug = { methods: [], errors: [] };
        
        if (typeof $A === 'undefined') {
          debug.errors.push('$A is undefined');
          return { success: false, debug };
        }
        
        if (typeof $A.getContext !== 'function') {
          debug.errors.push('$A.getContext is not a function');
          return { success: false, debug };
        }
        
        const ctx = $A.getContext();
        if (!ctx) {
          debug.errors.push('$A.getContext() returned null');
          return { success: false, debug };
        }
        
        debug.methods = Object.getOwnPropertyNames(Object.getPrototypeOf(ctx));
        
        // Method 1: Try encodeForServer() which returns the serialized context
        let encodedContext = null;
        if (typeof ctx.encodeForServer === 'function') {
          try {
            encodedContext = ctx.encodeForServer();
            debug.hasEncodeForServer = true;
            debug.encodedKeys = encodedContext ? Object.keys(encodedContext) : null;
          } catch (e) {
            debug.errors.push('encodeForServer() failed: ' + e.message);
          }
        }
        
        // If encodeForServer gave us the context, use it
        if (encodedContext && encodedContext.fwuid) {
          // Get token
          let token = null;
          try {
            if (window.$A && window.$A.getToken) {
              token = window.$A.getToken();
            }
          } catch (e) {}
          
          return {
            success: true,
            context: encodedContext,
            token: token,
            debug
          };
        }
        
        // Method 2: Try to find fwuid in obfuscated properties
        let fwuid = null;
        const contextKeys = Object.keys(ctx);
        debug.contextKeys = contextKeys;
        
        for (const key of contextKeys) {
          try {
            const val = ctx[key];
            if (typeof val === 'string' && val.length > 30 && val.includes('-')) {
              // Looks like a fwuid (format: xxx-xxx-xxx...)
              fwuid = val;
              debug.fwuidKey = key;
              break;
            }
          } catch (e) {}
        }
        
        if (fwuid) {
          // Build context manually
          const mode = typeof ctx.getMode === 'function' ? ctx.getMode() : 'PROD';
          const app = typeof ctx.getApp === 'function' ? ctx.getApp() : 'one:one';
          
          return {
            success: true,
            context: {
              mode: mode,
              fwuid: fwuid,
              app: app,
              loaded: {},
              dn: [],
              globals: {},
              uad: false
            },
            token: null,
            debug
          };
        }
        
        debug.errors.push('Could not extract fwuid from context');
        return { success: false, debug };
      })()
    `);
    
    if (credentials) {
      log.debug('AURA', 'Context extraction result', {
        success: credentials.success,
        contextKeys: credentials.debug?.contextKeys?.slice(0, 5),
        methods: credentials.debug?.methods?.slice(0, 10),
        errors: credentials.debug?.errors
      });
      
      if (credentials.success && credentials.context && credentials.context.fwuid) {
        log.info('AURA', 'Credentials extracted from $A context', {
          fwuid: credentials.context.fwuid.substring(0, 25) + '...',
          hasToken: !!credentials.token
        });
        return {
          context: credentials.context,
          token: credentials.token
        };
      }
    }
    
    return null;
  } catch (error) {
    log.warn('AURA', 'Failed to extract credentials from context', { error: error.message });
    return null;
  }
}

/**
 * Search for an account by a search term using Aura API.
 * Returns detailed debug info for logging.
 */
async function searchByTerm(page, credentials, term) {
  log.debug('AURA', `Searching for term: "${term}"`);
  
  const result = await page.evaluate(async (argsJson) => {
    const { credentials, term, descriptor } = JSON.parse(argsJson);
    
    const message = {
      actions: [{
        id: '1;a',
        descriptor: descriptor,
        callingDescriptor: 'UNKNOWN',
        params: {
          term: term,
          entityName: 'Account',
          maxRecords: 10,
          maxQueries: 0,
          maxTips: 0,
          maxListViews: 0,
          context: { FILTERS: {} },
          configurationName: 'GLOBAL_SEARCH_BAR',
        },
      }],
    };
    
    const body = new URLSearchParams();
    body.append('message', JSON.stringify(message));
    body.append('aura.context', JSON.stringify(credentials.context));
    body.append('aura.token', credentials.token || 'undefined');
    
    const qp = new URLSearchParams({
      'ui-search-components-forcesearch-assistant.AssistantSuggestionsDataProvider.getSuggestions': '1',
      'r': '1',
    });
    
    try {
      const response = await fetch('/aura?' + qp.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString(),
        credentials: 'include',
      });
      
      if (!response.ok) {
        return { found: false, error: `HTTP ${response.status}`, _debug: { httpStatus: response.status } };
      }
      
      const rawText = await response.text();
      
      // Extract first JSON object
      const firstBrace = rawText.indexOf('{');
      if (firstBrace === -1) {
        return { found: false, error: 'No JSON in response', _debug: { rawLength: rawText.length, rawPreview: rawText.substring(0, 200) } };
      }
      
      let depth = 0, inString = false, escape = false, start = -1;
      for (let i = firstBrace; i < rawText.length; i++) {
        const ch = rawText[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') { if (depth === 0) start = i; depth++; }
        else if (ch === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            const jsonStr = rawText.substring(start, i + 1);
            const data = JSON.parse(jsonStr);
            
            // Parse response
            const actions = data.actions || [];
            if (actions.length === 0) {
              return { found: false, _debug: { reason: 'No actions in response', actionsLength: 0 } };
            }
            
            const actionState = actions[0].state;
            if (actionState !== 'SUCCESS') {
              return {
                found: false,
                _debug: {
                  reason: 'Action not SUCCESS',
                  state: actionState,
                  error: actions[0].error || null
                }
              };
            }
            
            const returnValue = actions[0].returnValue || {};
            
            // Extract records from various response structures
            let records = [];
            let recordSource = 'none';
            
            if (returnValue.records && Array.isArray(returnValue.records)) {
              records = returnValue.records;
              recordSource = 'returnValue.records';
            } else if (returnValue.suggestions?.records) {
              records = returnValue.suggestions.records;
              recordSource = 'returnValue.suggestions.records';
            } else if (returnValue.answers && Array.isArray(returnValue.answers)) {
              recordSource = 'returnValue.answers';
              for (const answer of returnValue.answers) {
                // Handle various answer.data structures
                if (answer.data && Array.isArray(answer.data)) {
                  records.push(...answer.data);
                } else if (answer.data && typeof answer.data === 'object') {
                  // data can be an object with sub-keys containing arrays
                  for (const key of Object.keys(answer.data)) {
                    const val = answer.data[key];
                    if (Array.isArray(val)) {
                      records.push(...val);
                    }
                  }
                } else if (answer.records) {
                  records.push(...answer.records);
                } else if (answer.results) {
                  records.push(...answer.results);
                } else if (answer.items) {
                  records.push(...answer.items);
                }
              }
            } else if (returnValue.recentItems && Array.isArray(returnValue.recentItems)) {
              records = returnValue.recentItems;
              recordSource = 'returnValue.recentItems';
            }
            
            // Debug: capture response structure
            const debugInfo = {
              recordSource,
              totalRecords: records.length,
              returnValueKeys: Object.keys(returnValue),
              answersLength: returnValue.answers?.length || 0,
            };
            
            // Log answers structure when no records found
            if (records.length === 0 && returnValue.answers && Array.isArray(returnValue.answers)) {
              debugInfo.answersStructure = returnValue.answers.map((answer, idx) => {
                const info = {
                  index: idx,
                  type: answer.type || 'NO_TYPE',
                  keys: Object.keys(answer),
                  dataType: Array.isArray(answer.data) ? 'array' : (answer.data ? typeof answer.data : 'none'),
                  dataLength: Array.isArray(answer.data) ? answer.data.length : 'N/A',
                };
                // If data is an object, log its keys
                if (answer.data && typeof answer.data === 'object' && !Array.isArray(answer.data)) {
                  info.dataKeys = Object.keys(answer.data);
                  // Check if any sub-key has array data
                  for (const key of info.dataKeys) {
                    const val = answer.data[key];
                    info[`data.${key}`] = Array.isArray(val) ? `array(${val.length})` : typeof val;
                  }
                }
                return info;
              });
            }
            
            // If we have records, log first one's structure
            if (records.length > 0) {
              const firstRaw = records[0];
              const firstRecord = firstRaw.record || firstRaw;
              debugInfo.firstRecordKeys = Object.keys(firstRecord);
              debugInfo.firstRecordId = firstRecord.Id || firstRecord.id || firstRecord.recordId || 'NO_ID';
              debugInfo.firstRecordName = firstRecord.Name || firstRecord.name || 'NO_NAME';
              debugInfo.firstRecordType = firstRecord.sobjectType || firstRecord.objectType || 'UNKNOWN';
            }
            
            // Find Account records (ID starts with 001)
            const accountRecords = [];
            for (const rawRecord of records) {
              const record = rawRecord.record || rawRecord;
              const id = record.Id || record.id || record.recordId || '';
              if (id.startsWith('001')) {
                accountRecords.push({
                  id,
                  name: record.Name || record.name || `${record.FirstName || ''} ${record.LastName || ''}`.trim(),
                  type: record.sobjectType || record.objectType || 'Account',
                });
              }
            }
            
            debugInfo.accountRecordsFound = accountRecords.length;
            if (accountRecords.length > 0) {
              debugInfo.accounts = accountRecords.slice(0, 5); // First 5 accounts for logging
            }
            
            // Return first account if found
            if (accountRecords.length > 0) {
              return {
                found: true,
                accountId: accountRecords[0].id,
                accountName: accountRecords[0].name,
                _debug: debugInfo,
              };
            }
            
            return { found: false, _debug: debugInfo };
          }
        }
      }
      
      return { found: false, error: 'Could not parse response', _debug: { reason: 'JSON parse loop failed' } };
    } catch (e) {
      return { found: false, error: e.message, _debug: { exception: e.message } };
    }
  }, JSON.stringify({ credentials, term, descriptor: SEARCH_DESCRIPTOR }));
  
  // Log debug information from page.evaluate
  if (result._debug) {
    const debug = result._debug;
    
    if (result.error) {
      log.warn('AURA', `Search error for "${term}": ${result.error}`, debug);
    } else if (result.found) {
      log.info('AURA', `Account found for "${term}": ${result.accountName} (${result.accountId})`, {
        recordSource: debug.recordSource,
        totalRecords: debug.totalRecords,
        accountRecordsFound: debug.accountRecordsFound,
      });
    } else {
      // Not found - log why
      log.debug('AURA', `No account found for "${term}"`, {
        recordSource: debug.recordSource,
        totalRecords: debug.totalRecords,
        accountRecordsFound: debug.accountRecordsFound,
        returnValueKeys: debug.returnValueKeys,
        answersLength: debug.answersLength,
        answersStructure: debug.answersStructure,
        firstRecordKeys: debug.firstRecordKeys,
        firstRecordId: debug.firstRecordId,
        firstRecordName: debug.firstRecordName,
        firstRecordType: debug.firstRecordType,
      });
    }
    
    // Clean up debug info before returning
    delete result._debug;
  }
  
  return result;
}

/**
 * Search for an account by term WITHOUT entityName filter (broader search).
 * This is a fallback when the filtered search returns no results.
 */
async function searchByTermNoFilter(page, credentials, term) {
  log.debug('AURA', `Fallback search (no entity filter) for: "${term}"`);
  
  const result = await page.evaluate(async (argsJson) => {
    const { credentials, term, descriptor } = JSON.parse(argsJson);
    
    const message = {
      actions: [{
        id: '1;a',
        descriptor: descriptor,
        callingDescriptor: 'UNKNOWN',
        params: {
          term: term,
          entityName: null,  // No filter - search all entities
          maxRecords: 20,    // More records since we're not filtering
          maxQueries: 0,
          maxTips: 0,
          maxListViews: 0,
          context: { FILTERS: {} },
          configurationName: 'GLOBAL_SEARCH_BAR',
        },
      }],
    };
    
    const body = new URLSearchParams();
    body.append('message', JSON.stringify(message));
    body.append('aura.context', JSON.stringify(credentials.context));
    body.append('aura.token', credentials.token || 'undefined');
    
    const qp = new URLSearchParams({
      'ui-search-components-forcesearch-assistant.AssistantSuggestionsDataProvider.getSuggestions': '1',
      'r': '1',
    });
    
    try {
      const response = await fetch('/aura?' + qp.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: body.toString(),
        credentials: 'include',
      });
      
      if (!response.ok) {
        return { found: false, error: `HTTP ${response.status}` };
      }
      
      const rawText = await response.text();
      const firstBrace = rawText.indexOf('{');
      if (firstBrace === -1) {
        return { found: false, error: 'No JSON in response' };
      }
      
      let depth = 0, inString = false, escape = false, start = -1;
      for (let i = firstBrace; i < rawText.length; i++) {
        const ch = rawText[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') { if (depth === 0) start = i; depth++; }
        else if (ch === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            const jsonStr = rawText.substring(start, i + 1);
            const data = JSON.parse(jsonStr);
            
            const actions = data.actions || [];
            if (actions.length === 0 || actions[0].state !== 'SUCCESS') {
              return { found: false, _debug: { reason: 'No success action' } };
            }
            
            const returnValue = actions[0].returnValue || {};
            
            // Extract all records from various structures
            let records = [];
            if (returnValue.records && Array.isArray(returnValue.records)) {
              records = returnValue.records;
            } else if (returnValue.suggestions?.records) {
              records = returnValue.suggestions.records;
            } else if (returnValue.answers && Array.isArray(returnValue.answers)) {
              for (const answer of returnValue.answers) {
                if (answer.data && Array.isArray(answer.data)) {
                  records.push(...answer.data);
                } else if (answer.data && typeof answer.data === 'object') {
                  // data can be an object with sub-keys containing arrays
                  for (const key of Object.keys(answer.data)) {
                    const val = answer.data[key];
                    if (Array.isArray(val)) {
                      records.push(...val);
                    }
                  }
                } else if (answer.records) {
                  records.push(...answer.records);
                } else if (answer.results) {
                  records.push(...answer.results);
                } else if (answer.items) {
                  records.push(...answer.items);
                }
              }
            } else if (returnValue.recentItems && Array.isArray(returnValue.recentItems)) {
              records = returnValue.recentItems;
            }
            
            // Debug info
            const debugInfo = {
              totalRecords: records.length,
              allRecordTypes: [],
            };
            
            // Filter for Account records only (ID starts with 001)
            const accountRecords = [];
            for (const rawRecord of records) {
              const record = rawRecord.record || rawRecord;
              const id = record.Id || record.id || record.recordId || '';
              const objType = record.sobjectType || record.objectType || 'UNKNOWN';
              
              if (!debugInfo.allRecordTypes.includes(objType)) {
                debugInfo.allRecordTypes.push(objType);
              }
              
              if (id.startsWith('001')) {
                accountRecords.push({
                  id,
                  name: record.Name || record.name || `${record.FirstName || ''} ${record.LastName || ''}`.trim(),
                });
              }
            }
            
            debugInfo.accountRecordsFound = accountRecords.length;
            
            if (accountRecords.length > 0) {
              return {
                found: true,
                accountId: accountRecords[0].id,
                accountName: accountRecords[0].name,
                _debug: debugInfo,
              };
            }
            
            return { found: false, _debug: debugInfo };
          }
        }
      }
      
      return { found: false, error: 'Parse failed' };
    } catch (e) {
      return { found: false, error: e.message };
    }
  }, JSON.stringify({ credentials, term, descriptor: SEARCH_DESCRIPTOR }));
  
  // Log debug info
  if (result._debug) {
    const debug = result._debug;
    if (result.found) {
      log.info('AURA', `Fallback found account: ${result.accountName} (${result.accountId})`, {
        totalRecords: debug.totalRecords,
        allRecordTypes: debug.allRecordTypes,
      });
    } else {
      log.debug('AURA', 'Fallback search: no account found', {
        totalRecords: debug.totalRecords,
        accountRecordsFound: debug.accountRecordsFound,
        allRecordTypes: debug.allRecordTypes,
      });
    }
    delete result._debug;
  }
  
  return result;
}

// ============================================================================
// SOSL SEARCH VIA getAnswers (Phone Search Solution!)
// ============================================================================

/**
 * SMART_SCOPE configuration captured from Salesforce UI.
 * Defines which objects and fields are searchable via SOSL.
 */
const SMART_SCOPE_PHONE = [
  {
    cacheable: "Y",
    name: "Account",
    labelPlural: "Comptes",
    fields: "Name\nRecordType.Name\ntoLabel(RecordType.Name) Name__l\nType\ntoLabel(Type) Type__l\nPersonBirthdate\nformat(PersonBirthdate) PersonBirthdate__f\nPhone\nPrimary_Email__c\nBillingPostalCode\nOwnerName__c\nAgent_Code__c\nCreatedDate\nformat(CreatedDate) CreatedDate__f\nRecordTypeId\nRecordType.Id\nRecordType.IsPersonType\nIsPersonAccount\nPersonContactId\nLastModifiedDate\nId\nLastModifiedById\nSystemModstamp"
  },
  {
    cacheable: "Y",
    name: "ContactPointPhone",
    labelPlural: "Téléphones du point de contact",
    fields: "TelephoneNumber\nActiveFromDate\nformat(ActiveFromDate) ActiveFromDate__f\nLastModifiedDate\nformat(LastModifiedDate) LastModifiedDate__f\nLastModifiedBy.Alias\nParent.Name\nParentId\nLastModifiedById\nCreatedDate\nId\nName\nSystemModstamp"
  }
];

/**
 * Search for an account by phone using getAnswers endpoint (SOSL-based).
 * This is the solution discovered: pressing ENTER in Salesforce search uses
 * PredictedResultsDataProviderController/getAnswers which uses SOSL and CAN search by Phone!
 *
 * @param {Page} page - Playwright page
 * @param {Object} credentials - Aura credentials (token, fwuid)
 * @param {string} phone - Phone number to search
 * @returns {Promise<{ found: boolean, accountId?: string, accountName?: string }>}
 */
async function searchByGetAnswers(page, credentials, phone) {
  log.info('SOSL', `Searching by phone using getAnswers (SOSL): "${phone}"`);
  
  const searchDialogSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  const result = await page.evaluate(async (argsJson) => {
    const { credentials, phone, smartScope, sessionId } = JSON.parse(argsJson);
    
    const descriptor = 'serviceComponent://ui.search.components.forcesearch.predictedresults.PredictedResultsDataProviderController/ACTION$getAnswers';
    
    const message = {
      actions: [{
        id: '1;a',
        descriptor: descriptor,
        callingDescriptor: 'UNKNOWN',
        params: {
          term: phone,
          pageSize: 50,
          currentPage: 1,
          context: {
            FILTERS: {},
            searchSource: "ASSISTANT_DIALOG",
            disableIntentQuery: false,
            disableSpellCorrection: false,
            searchDialogSessionId: sessionId,
            debugInfo: {
              appName: "cmpDesk",
              appType: "Console",
              appNamespace: "c",
              location: "home:landing"
            }
          },
          sortBy: null,
          topResultsRequestModel: {
            scopeNames: [],
            term: phone,
            pageSize: 5,
            enableRowActions: false,
            withSingleSOSL: true,  // KEY: Uses SOSL search!
            withEntityPrediction: true,
            batchSize: 3,
            batchingTimeout: 2500,
            scopeMap: {
              type: "TOP_RESULTS",
              namespace: "",
              label: "Principaux résultats",
              labelPlural: "Principaux résultats",
              resultsCmp: "forceSearch:predictedResults"
            },
            context: {
              FILTERS: {},
              searchSource: "ASSISTANT_DIALOG",
              disableIntentQuery: false,
              disableSpellCorrection: false,
              searchDialogSessionId: sessionId,
              debugInfo: {
                appName: "cmpDesk",
                appType: "Console",
                appNamespace: "c",
                location: "home:landing"
              },
              scopeSets: {
                SMART_SCOPE: smartScope
              }
            },
            withSpellCorrection: true,
            configurationName: "GLOBAL_SEARCH_BAR"
          },
          remediationOptions: {}
        }
      }]
    };
    
    const qp = new URLSearchParams({
      'aura.context': JSON.stringify({ mode: 'PROD', fwuid: credentials.fwuid, app: 'one:one', loaded: {} }),
      'aura.token': credentials.token,
      'aura.isAction': 'true',
    });
    
    try {
      const response = await fetch('/aura?' + qp.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `message=${encodeURIComponent(JSON.stringify(message))}`
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      const action = data?.actions?.[0];
      
      if (!action || action.state !== 'SUCCESS') {
        return { success: false, error: 'ACTION_FAILED', raw: data };
      }
      
      return { success: true, returnValue: action.returnValue };
    } catch (e) {
      return { success: false, error: 'EXCEPTION', message: e.message };
    }
  }, JSON.stringify({
    credentials,
    phone,
    smartScope: SMART_SCOPE_PHONE,
    sessionId: searchDialogSessionId
  }));
  
  if (!result.success) {
    log.error('SOSL', 'getAnswers search failed', result);
    return { found: false, error: result.error };
  }
  
  // Parse KEYWORD_SEARCH results - collect ALL accounts
  const answers = result.returnValue?.answers || [];
  log.debug('SOSL', `getAnswers returned ${answers.length} answer categories`);
  
  const accountCandidates = [];
  
  for (const answer of answers) {
    if (answer.type === 'KEYWORD_SEARCH' && answer.data?.results) {
      for (const resultGroup of answer.data.results) {
        const results = resultGroup.result || [];
        
        for (const item of results) {
          const record = item.record || {};
          const id = item.recordId || record.Id || '';
          
          // Check if it's an Account (ID prefix 001)
          if (id.startsWith('001')) {
            const accountName = record.Name || '';
            const accountPhone = record.Phone || '';
            const accountEmail = record.Primary_Email__c || record.PersonEmail || '';
            const accountCity = record.BillingCity || record.PersonMailingCity || '';
            
            log.info('SOSL', `Found account via getAnswers: ${accountName} (${id}), Phone: ${accountPhone}`);
            
            accountCandidates.push({
              id: id,
              name: accountName,
              phone: accountPhone,
              email: accountEmail,
              city: accountCity,
            });
            
            // Limit to 5 candidates max
            if (accountCandidates.length >= 5) break;
          }
        }
        if (accountCandidates.length >= 5) break;
      }
    }
    if (accountCandidates.length >= 5) break;
  }
  
  // No accounts found
  if (accountCandidates.length === 0) {
    log.debug('SOSL', 'No accounts found via getAnswers');
    return { found: false };
  }
  
  // Single account found
  if (accountCandidates.length === 1) {
    const account = accountCandidates[0];
    return {
      found: true,
      accountId: account.id,
      accountName: account.name,
      phone: account.phone,
      email: account.email,
      matchedBy: 'phone_sosl'
    };
  }
  
  // Multiple accounts found - return candidates for user selection
  log.info('SOSL', `Multiple accounts found via getAnswers: ${accountCandidates.length}`);
  return {
    found: true,
    multipleResults: true,
    candidates: accountCandidates,
    // Set first one as default (user can change)
    accountId: accountCandidates[0].id,
    accountName: accountCandidates[0].name,
    matchedBy: 'phone_sosl'
  };
}

// ============================================================================
// SOQL SEARCH FOR PHONE/EMAIL (via REST API)
// ============================================================================

/**
 * Search account by SOQL query on a specific field (Phone, PersonEmail, etc.)
 * Uses Salesforce REST API with session ID from Playwright cookies.
 *
 * @param {Page} page - Playwright page
 * @param {Object} credentials - Aura credentials (token, fwuid)
 * @param {string} field - Field to search (Phone, PersonEmail, etc.)
 * @param {string} value - Value to search for
 * @returns {Promise<{ found: boolean, accountId?: string, accountName?: string }>}
 */
async function searchBySOQL(page, credentials, field, value) {
  log.info('SOQL', `Searching Account by ${field}="${value}"`);
  
  // Build SOQL query - escape single quotes
  const escapedValue = value.replace(/'/g, "\\'");
  
  // Build LIKE pattern for partial phone matching
  // Phone "(819) 333-2623" should match "8193332623" or "(819) 333-2623"
  const isPhoneSearch = field === 'Phone';
  let whereClause;
  
  if (isPhoneSearch) {
    // For phone: try exact match OR match with LIKE on digits
    const digitsOnly = value.replace(/\D/g, '');
    // Use LIKE with wildcards to match different formats
    whereClause = `Phone LIKE '%${digitsOnly.slice(-10)}%'`;
    log.debug('SOQL', `Phone search using LIKE pattern: ${whereClause}`);
  } else {
    whereClause = `${field} = '${escapedValue}'`;
  }
  
  const soqlQuery = `SELECT Id, Name, Phone, PersonEmail FROM Account WHERE ${whereClause} LIMIT 5`;
  log.debug('SOQL', `Query: ${soqlQuery}`);
  
  // Extract session ID from Playwright cookies (HttpOnly cookies not accessible via document.cookie)
  const context = page.context();
  const cookies = await context.cookies();
  const sidCookie = cookies.find(c => c.name === 'sid');
  
  if (!sidCookie) {
    // Log available cookie names for debugging
    const cookieNames = cookies.map(c => c.name);
    log.warn('SOQL', 'No sid cookie found', { availableCookies: cookieNames.slice(0, 20) });
    return { found: false, error: 'NO_SESSION_ID' };
  }
  
  const sessionId = sidCookie.value;
  log.debug('SOQL', `Session ID extracted (length: ${sessionId.length})`);
  
  // Execute SOQL via REST API
  const result = await page.evaluate(async ({ query, sessionId }) => {
    try {
      const apiVersion = '58.0';
      const response = await fetch(`/services/data/v${apiVersion}/query?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}`,
          message: errorText,
          statusCode: response.status,
        };
      }
      
      const data = await response.json();
      
      return {
        success: true,
        totalSize: data.totalSize,
        records: data.records || [],
        done: data.done,
      };
    } catch (e) {
      return {
        success: false,
        error: 'EXCEPTION',
        message: e.message,
      };
    }
  }, { query: soqlQuery, sessionId });
  
  log.debug('SOQL', 'Query result', {
    success: result.success,
    totalSize: result.totalSize,
    recordCount: result.records?.length,
    error: result.error,
    message: result.message,
  });
  
  if (!result.success) {
    log.warn('SOQL', `SOQL query failed: ${result.error} - ${result.message}`);
    return { found: false, error: result.error };
  }
  
  if (result.totalSize === 0 || !result.records || result.records.length === 0) {
    log.info('SOQL', `No Account found with ${field}="${value}"`);
    return { found: false };
  }
  
  // Found account(s) - take the first one
  const account = result.records[0];
  log.info('SOQL', `Account found via SOQL: ${account.Name} (${account.Id})`, {
    phone: account.Phone,
    email: account.PersonEmail,
  });
  
  return {
    found: true,
    accountId: account.Id,
    accountName: account.Name,
  };
}

// ============================================================================
// WINDOW CONFIGURATION
// ============================================================================

const WINDOW_CONFIG = {
  width: 1200,
  height: 800,
  resizable: false,
  center: true,
  backgroundColor: '#0B0F14',
  icon: path.join(__dirname, '..', 'assets', 'logo.ico'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
  },
};

let mainWindow = null;

// ============================================================================
// NATIVE MENU — View > Theme
// ============================================================================

/**
 * Apply a theme mode: 'dark' | 'light' | 'system'
 * Sets nativeTheme.themeSource and notifies the renderer via IPC.
 */
function applyTheme(mode) {
  nativeTheme.themeSource = mode; // 'dark' | 'light' | 'system'
  log.info('SYSTEM', `Theme changed to: ${mode}`);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme:changed', {
      mode,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    });
  }
  
  // Rebuild menu to update checkmarks
  buildMenu();
}

/**
 * Build and set the application menu with a View > Theme submenu.
 */
function buildMenu() {
  const currentSource = nativeTheme.themeSource; // 'dark' | 'light' | 'system'
  
  const template = [
    {
      label: 'Vue',
      submenu: [
        {
          label: 'Thème sombre',
          type: 'radio',
          checked: currentSource === 'dark',
          click: () => applyTheme('dark'),
        },
        {
          label: 'Thème clair',
          type: 'radio',
          checked: currentSource === 'light',
          click: () => applyTheme('light'),
        },
        {
          label: 'Thème système',
          type: 'radio',
          checked: currentSource === 'system',
          click: () => applyTheme('system'),
        },
      ],
    },
  ];
  
  // In development also expose DevTools toggle
  if (ENV_CONFIG.ENV !== 'PROD') {
    template.push({
      label: 'Développement',
      submenu: [
        {
          label: 'DevTools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
        { role: 'reload' },
        { role: 'forceReload' },
      ],
    });
  }
  
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  // Use app.isPackaged for reliable production detection
  // process.env.NODE_ENV is not set in packaged apps
  const isDev = !app.isPackaged;

  log.info('SYSTEM', 'Creating window', {
    isDev,
    isPackaged: app.isPackaged,
    dirname: __dirname,
    appPath: app.getAppPath()
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    log.info('SYSTEM', 'Loading production file', { indexPath });
    mainWindow.loadFile(indexPath).catch(err => {
      log.error('SYSTEM', 'Failed to load index.html', err);
      console.error('LOAD ERROR:', err);
    });
  }
  
  // Log any page load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log.error('SYSTEM', 'Page failed to load', { errorCode, errorDescription, validatedURL });
    console.error('DID-FAIL-LOAD:', errorCode, errorDescription, validatedURL);
  });

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    log.info('SYSTEM', 'Page finished loading');
    console.log('DID-FINISH-LOAD: Page loaded successfully');
  });

  // DevTools controlled by SHOW_DEVTOOLS env variable OR always in packaged app for debugging
  if (ENV_CONFIG.SHOW_DEVTOOLS || app.isPackaged) {
    mainWindow.webContents.openDevTools();
    log.debug('SYSTEM', 'DevTools opened');
  }

  // Build the native menu with View > Theme
  buildMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  log.info('SYSTEM', 'Window created', {
    env: ENV_CONFIG.ENV,
    devTools: ENV_CONFIG.SHOW_DEVTOOLS,
    logLevel: ENV_CONFIG.LOG_LEVEL
  });
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

// ─── Theme ───────────────────────────────────────────────────────────────────

// Get the current theme mode and effective dark-colors state
ipcMain.handle('theme:getMode', () => {
  return {
    mode: nativeTheme.themeSource,          // 'dark' | 'light' | 'system'
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
});

// Set theme from renderer (e.g. a toggle button in the UI)
ipcMain.handle('theme:setMode', (event, mode) => {
  if (!['dark', 'light', 'system'].includes(mode)) {
    return { success: false, error: `Invalid theme mode: ${mode}` };
  }
  applyTheme(mode);
  return { success: true, mode };
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Get session status (quick check, no browser)
ipcMain.handle('auth:getStatus', async () => {
  try {
    const auth = await getAuthModule();
    return auth.getSessionStatus();
  } catch (e) {
    log.error('IPC', 'auth:getStatus error', e);
    return {
      isConnected: false,
      error: e.message,
    };
  }
});

// Login - opens browser for authentication
ipcMain.handle('auth:login', async (event, forceAuth = false) => {
  try {
    log.debug('IPC', 'auth:login called', { forceAuth });
    const auth = await getAuthModule();
    return await auth.login(forceAuth);
  } catch (e) {
    log.error('IPC', 'auth:login error', e);
    return {
      success: false,
      error: 'UNKNOWN',
      message: e.message,
    };
  }
});

// Ensure session is valid
ipcMain.handle('auth:ensureSession', async () => {
  try {
    log.debug('IPC', 'auth:ensureSession called');
    const auth = await getAuthModule();
    return await auth.ensureSession();
  } catch (e) {
    log.error('IPC', 'auth:ensureSession error', e);
    return {
      success: false,
      error: 'UNKNOWN',
      message: e.message,
    };
  }
});

// Logout - close session and clear cookies
ipcMain.handle('auth:logout', async () => {
  try {
    log.info('IPC', 'auth:logout called');
    const auth = await getAuthModule();
    await auth.logout();
    return {
      success: true,
      message: 'Session cleared successfully',
    };
  } catch (e) {
    log.error('IPC', 'auth:logout error', e);
    return {
      success: false,
      error: 'UNKNOWN',
      message: e.message,
    };
  }
});

// Get user data path (for debugging)
ipcMain.handle('app:getUserDataPath', () => {
  return app.getPath('userData');
});

// Get environment config (for UI conditional display)
ipcMain.handle('app:getEnvConfig', () => {
  return ENV_CONFIG;
});

// ─── Salesforce ───────────────────────────────────────────────────────────────

// Search for an account by phone, email, or name
ipcMain.handle('salesforce:searchAccount', async (event, params) => {
  try {
    log.debug('IPC', 'salesforce:searchAccount called', {
      hasPhone: !!params.phone,
      hasEmail: !!params.email,
      hasFirstName: !!params.firstName,
      hasLastName: !!params.lastName,
    });
    return await searchAccount(params);
  } catch (e) {
    log.error('IPC', 'salesforce:searchAccount error', e);
    return {
      found: false,
      error: 'UNKNOWN',
      message: e.message,
    };
  }
});

// Create a new account
ipcMain.handle('salesforce:createAccount', async (event, params) => {
  try {
    log.info('IPC', 'salesforce:createAccount called', {
      firstName: params?.firstName,
      lastName: params?.lastName,
      hasPhone: !!params?.phone,
      hasEmail: !!params?.email,
    });
    return await createAccount(params);
  } catch (e) {
    log.error('IPC', 'salesforce:createAccount error', e);
    return {
      success: false,
      error: e.message,
      message: 'Erreur lors de la création du compte',
    };
  }
});

// Create dossier (Opportunity + Case update)
ipcMain.handle('salesforce:createDossier', async (event, params) => {
  try {
    log.info('IPC', 'salesforce:createDossier called', {
      accountId: params?.accountId,
      hasOpportunityData: !!params?.opportunityData,
      hasCaseData: !!params?.caseData,
    });
    return await createDossier(params);
  } catch (e) {
    log.error('IPC', 'salesforce:createDossier error', e);
    return {
      success: false,
      error: e.message,
    };
  }
});

// Upload documents to OpenText (xECM)
ipcMain.handle('salesforce:uploadDocuments', async (event, params) => {
  try {
    log.info('IPC', 'salesforce:uploadDocuments called', {
      caseId: params?.caseId,
      fileCount: params?.files?.length || 0,
    });
    return await uploadDocuments(params);
  } catch (e) {
    log.error('IPC', 'salesforce:uploadDocuments error', e);
    return {
      success: false,
      uploadedCount: 0,
      failedCount: params?.files?.length || 0,
      results: [],
      error: e.message,
    };
  }
});

// Create a note linked to a Case
ipcMain.handle('salesforce:createNote', async (event, params) => {
  try {
    log.info('IPC', 'salesforce:createNote called', {
      caseId: params?.caseId,
      titleLength: params?.title?.length || 0,
      contentLength: params?.content?.length || 0,
    });
    return await createNote(params);
  } catch (e) {
    log.error('IPC', 'salesforce:createNote error', e);
    return {
      success: false,
      noteId: null,
      error: e.message,
    };
  }
});

// ============================================================================
// LOG IPC HANDLERS
// ============================================================================

// Get all buffered logs
ipcMain.handle('logs:getBuffer', () => {
  return logBuffer;
});

// Clear log buffer
ipcMain.handle('logs:clear', () => {
  logBuffer.length = 0;
  log.debug('SYSTEM', 'Log buffer cleared');
  return { success: true };
});

// Add log from renderer process
ipcMain.handle('logs:add', (event, { level, scope, message, data }) => {
  if (log[level]) {
    log[level](scope, message, data);
  }
  return { success: true };
});

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(() => {
  log.info('SYSTEM', 'App ready', {
    version: app.getVersion(),
    userData: app.getPath('userData'),
    env: ENV_CONFIG.ENV
  });
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.debug('SYSTEM', 'All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up Playwright contexts before quitting to prevent zombie processes
app.on('before-quit', async (event) => {
  if (activePlaywrightContexts.size > 0) {
    log.info('SYSTEM', 'before-quit: Cleaning up Playwright contexts...');
    event.preventDefault();
    await closeAllPlaywrightContexts();
    app.quit();
  }
});

// Log when app is about to quit
app.on('will-quit', () => {
  log.info('SYSTEM', 'Application quitting');
});
