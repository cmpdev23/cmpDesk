/**
 * Browser Management for Authentication
 * 
 * Handles Playwright browser context lifecycle:
 * - Persistent context management
 * - Cookie and session persistence
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { AUTH_DIR, BROWSER_PROFILE, COOKIES_FILE, SESSION_FILE } = require('../../config/env');
const { log } = require('../../lib/logger');

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
 * Launch a persistent browser context
 * @param {Object} options - Browser launch options
 * @returns {Promise<BrowserContext>}
 */
async function launchPersistentContext(options = {}) {
  ensureAuthDirectories();
  
  const defaultOptions = {
    headless: false,
    viewport: { width: 1280, height: 720 },
  };
  
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
    ...defaultOptions,
    ...options,
  });
  
  log.debug('AUTH', 'Browser context launched');
  return context;
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
