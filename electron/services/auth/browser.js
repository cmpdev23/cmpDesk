/**
 * Browser Management for Authentication
 *
 * Handles Playwright browser context lifecycle:
 * - Persistent context management
 * - Cookie and session persistence
 *
 * IMPORTANT: Uses system browser (Edge/Chrome) instead of bundled Chromium
 * to avoid "Executable doesn't exist" errors in packaged apps.
 * Edge is preferred as it's pre-installed on Windows 10/11.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { AUTH_DIR, BROWSER_PROFILE, COOKIES_FILE, SESSION_FILE } = require('../../config/env');
const { log } = require('../../lib/logger');

// ============================================================================
// BROWSER DETECTION
// ============================================================================

/**
 * Supported browser channels in order of preference
 * - msedge: Pre-installed on Windows 10/11, most reliable
 * - chrome: Common alternative
 * - chromium: Fallback (requires npx playwright install)
 */
const BROWSER_CHANNELS = ['msedge', 'chrome', 'chromium'];

/**
 * Common installation paths for browsers on Windows
 */
const BROWSER_PATHS = {
  msedge: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
  chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
};

/**
 * Detect which browser is available on the system
 * @returns {{channel: string, executablePath?: string} | null}
 */
function detectAvailableBrowser() {
  // First, check for system browsers via known paths
  for (const channel of ['msedge', 'chrome']) {
    const paths = BROWSER_PATHS[channel] || [];
    for (const browserPath of paths) {
      if (browserPath && fs.existsSync(browserPath)) {
        log.info('AUTH', `Found system browser: ${channel} at ${browserPath}`);
        return { channel, executablePath: browserPath };
      }
    }
  }
  
  // If no system browser found, let Playwright try its bundled chromium
  // This might work in dev mode but will fail in packaged app
  log.warn('AUTH', 'No system browser found (Edge/Chrome), will try Playwright bundled Chromium');
  return null;
}

// Cache the detected browser to avoid repeated filesystem checks
let cachedBrowser = null;
let browserDetected = false;

/**
 * Get the browser to use for Playwright operations
 * @returns {{channel: string, executablePath?: string} | null}
 */
function getBrowser() {
  if (!browserDetected) {
    cachedBrowser = detectAvailableBrowser();
    browserDetected = true;
  }
  return cachedBrowser;
}

// ============================================================================
// DIRECTORY MANAGEMENT
// ============================================================================

/**
 * Ensure auth directories exist
 */
function ensureAuthDirectories() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    log.debug('AUTH', 'Created auth directory');
  }
}

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

/**
 * Launch a persistent browser context using system browser
 * @param {Object} options - Browser launch options
 * @returns {Promise<BrowserContext>}
 * @throws {Error} If no browser is available
 */
async function launchPersistentContext(options = {}) {
  ensureAuthDirectories();
  
  const browser = getBrowser();
  
  const defaultOptions = {
    headless: false,
    viewport: { width: 1280, height: 720 },
  };
  
  // Build launch options based on detected browser
  const launchOptions = {
    ...defaultOptions,
    ...options,
  };
  
  // Use system browser if detected
  if (browser) {
    if (browser.executablePath) {
      launchOptions.executablePath = browser.executablePath;
      log.info('AUTH', `Launching browser with executablePath: ${browser.executablePath}`);
    } else if (browser.channel) {
      launchOptions.channel = browser.channel;
      log.info('AUTH', `Launching browser with channel: ${browser.channel}`);
    }
  } else {
    // No system browser detected - this will likely fail in packaged app
    log.warn('AUTH', 'No system browser detected, attempting Playwright default (may fail in packaged app)');
  }
  
  try {
    const context = await chromium.launchPersistentContext(BROWSER_PROFILE, launchOptions);
    log.debug('AUTH', 'Browser context launched successfully');
    return context;
  } catch (error) {
    // Provide helpful error message if browser launch fails
    if (error.message.includes("Executable doesn't exist") || error.message.includes('browserType.launchPersistentContext')) {
      const errorMsg = `
Impossible de lancer le navigateur.

Cause probable: Aucun navigateur compatible trouvé.

Solutions:
1. Vérifiez que Microsoft Edge ou Google Chrome est installé sur votre système
2. Edge est normalement pré-installé sur Windows 10/11

Si le problème persiste, contactez le support avec ce message d'erreur:
${error.message}
      `.trim();
      
      log.error('AUTH', 'Browser launch failed - no compatible browser found', {
        originalError: error.message,
        detectedBrowser: browser
      });
      
      throw new Error(errorMsg);
    }
    
    // Re-throw other errors as-is
    throw error;
  }
}

// ============================================================================
// COOKIE MANAGEMENT
// ============================================================================

/**
 * Save cookies from context to file
 * @param {BrowserContext} context 
 */
async function saveCookies(context) {
  try {
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    log.debug('AUTH', `Saved ${cookies.length} cookies`);
  } catch (error) {
    log.error('AUTH', 'Failed to save cookies', error);
  }
}

/**
 * Restore cookies from file to context
 * @param {BrowserContext} context 
 * @returns {Promise<boolean>} Whether cookies were restored
 */
async function restoreCookies(context) {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      log.debug('AUTH', 'No cookies file found');
      return false;
    }
    
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
    
    if (cookies && cookies.length > 0) {
      await context.addCookies(cookies);
      log.debug('AUTH', `Restored ${cookies.length} cookies`);
      return true;
    }
    
    return false;
  } catch (error) {
    log.error('AUTH', 'Failed to restore cookies', error);
    return false;
  }
}

/**
 * Check if context has auth cookies
 * @param {BrowserContext} context 
 * @returns {Promise<boolean>}
 */
async function hasAuthCookies(context) {
  const cookies = await context.cookies();
  return cookies.some(c => c.name === 'sid' || c.name.startsWith('sfdc'));
}

// ============================================================================
// SESSION STATE
// ============================================================================

/**
 * Save session state to file
 * @param {BrowserContext} context 
 */
async function saveSessionState(context) {
  try {
    const state = {
      timestamp: new Date().toISOString(),
      hasAuth: await hasAuthCookies(context),
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));
    log.debug('AUTH', 'Session state saved');
  } catch (error) {
    log.error('AUTH', 'Failed to save session state', error);
  }
}

/**
 * Get session status from file
 * @returns {{exists: boolean, valid: boolean, timestamp: string|null}}
 */
function getSessionStatus() {
  const result = {
    exists: false,
    valid: false,
    timestamp: null,
    hasCookies: false,
    hasBrowserProfile: false,
  };
  
  // Check session file
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      result.exists = true;
      result.timestamp = session.timestamp;
      result.valid = session.hasAuth === true;
    } catch {
      // Invalid session file
    }
  }
  
  // Check cookies file
  if (fs.existsSync(COOKIES_FILE)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
      result.hasCookies = cookies && cookies.length > 0;
    } catch {
      // Invalid cookies file
    }
  }
  
  // Check browser profile
  result.hasBrowserProfile = fs.existsSync(BROWSER_PROFILE);
  
  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  ensureAuthDirectories,
  launchPersistentContext,
  saveCookies,
  restoreCookies,
  hasAuthCookies,
  saveSessionState,
  getSessionStatus,
};
