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
        await context.close();
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
          await context.close();
          return { success: true, message: 'Connexion réussie!' };
        }
        await page.waitForTimeout(2000);
      }
      
      // Timeout
      log.error('AUTH', 'Authentication timeout');
      await context.close();
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
    
    authModule = {
      getSessionStatus,
      login,
      ensureSession,
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
    
    // Check if Aura is now available
    const auraAvailable = await page.evaluate("typeof $A !== 'undefined' && typeof $A.getContext === 'function'").catch(() => false);
    
    if (auraAvailable) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      log.info('AURA', `Authentication successful after ${elapsedSec}s`);
      return true;
    }
    
    // Wait before next check
    await page.waitForTimeout(pollInterval);
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
    
    // Restore cookies
    await restoreCookies(context);
    
    const page = context.pages()[0] || await context.newPage();
    
    // Navigate to Salesforce Lightning
    log.debug('AURA', 'Navigating to Salesforce...');
    await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Check if Aura is available
    let auraAvailable = await page.evaluate("typeof $A !== 'undefined' && typeof $A.getContext === 'function'");
    
    // If Aura not available, wait for user to authenticate
    if (!auraAvailable) {
      log.warn('AURA', 'Aura framework not available - waiting for user authentication...');
      
      // Wait for the user to complete authentication
      const authenticated = await waitForAuraAuthentication(page);
      
      if (!authenticated) {
        log.error('AURA', 'Authentication timeout - user did not complete login');
        await context.close();
        return {
          found: false,
          error: 'AUTH_TIMEOUT',
          message: 'Délai d\'authentification dépassé. Veuillez réessayer.'
        };
      }
      
      // Re-navigate to Salesforce home after successful auth
      log.debug('AURA', 'Re-navigating to Salesforce after authentication...');
      await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Verify Aura is now available
      auraAvailable = await page.evaluate("typeof $A !== 'undefined' && typeof $A.getContext === 'function'");
      if (!auraAvailable) {
        log.error('AURA', 'Aura still not available after authentication');
        await context.close();
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
          soslResult.matchedBy = 'phone_sosl';
          log.info('AURA', `Phone found via SOSL: ${soslResult.accountName} (${soslResult.accountId})`);
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
  
  const result = {
    success: false,
    opportunityId: null,
    opportunityUrl: null,
    caseId: null,
    caseUrl: null,
    error: null,
    warning: null,
  };
  
  if (!accountId) {
    result.error = 'Account ID is required';
    return result;
  }
  
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
    
    await restoreCookies(context);
    const page = context.pages()[0] || await context.newPage();
    
    // Navigate to Salesforce
    log.debug('AURA', 'Navigating to Salesforce...');
    await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Check if Aura is available
    let auraAvailable = await page.evaluate("typeof $A !== 'undefined' && typeof $A.getContext === 'function'");
    
    if (!auraAvailable) {
      log.warn('AURA', 'Aura not available - waiting for authentication...');
      const authenticated = await waitForAuraAuthentication(page);
      
      if (!authenticated) {
        result.error = 'Authentication timeout';
        await context.close();
        return result;
      }
      
      await page.goto(SF_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
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
}

/**
 * Capture Aura credentials from page requests.
 */
async function captureAuraCredentials(page, timeout = 15000) {
  return new Promise(async (resolve) => {
    let resolved = false;
    
    const handler = (request) => {
      if (resolved) return;
      if (request.url().includes('/aura') && request.method() === 'POST') {
        const postData = request.postData();
        if (!postData) return;
        
        try {
          const params = new URLSearchParams(postData);
          const contextStr = params.get('aura.context');
          const token = params.get('aura.token');
          
          if (contextStr) {
            const context = JSON.parse(contextStr);
            if (context.fwuid) {
              resolved = true;
              page.off('request', handler);
              resolve({
                context,
                token: (token && token !== 'undefined') ? token : null,
              });
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    };
    
    page.on('request', handler);
    
    // Trigger an action to force Aura request
    await page.waitForTimeout(2000);
    if (!resolved) {
      try {
        const searchBar = await page.$('input[type="search"], button[title="Search"], .search-button');
        if (searchBar) {
          await searchBar.click({ timeout: 2000 }).catch(() => {});
        }
      } catch (e) {
        // Ignore
      }
    }
    
    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        page.off('request', handler);
        resolve(null);
      }
    }, timeout);
  });
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
  
  // Parse KEYWORD_SEARCH results
  const answers = result.returnValue?.answers || [];
  log.debug('SOSL', `getAnswers returned ${answers.length} answer categories`);
  
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
            log.info('SOSL', `Found account via getAnswers: ${accountName} (${id}), Phone: ${accountPhone}`);
            
            return {
              found: true,
              accountId: id,
              accountName: accountName,
              phone: accountPhone,
              email: record.Primary_Email__c || record.PersonEmail || '',
              matchedBy: 'phone_sosl'
            };
          }
        }
      }
    }
  }
  
  log.debug('SOSL', 'No accounts found via getAnswers');
  return { found: false };
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

  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // DevTools controlled by SHOW_DEVTOOLS env variable
  if (ENV_CONFIG.SHOW_DEVTOOLS) {
    mainWindow.webContents.openDevTools();
    log.debug('SYSTEM', 'DevTools opened (SHOW_DEVTOOLS=true)');
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
