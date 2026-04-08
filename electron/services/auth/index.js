/**
 * Authentication Service
 * 
 * Main entry point for authentication operations.
 * Uses lazy initialization to avoid loading Playwright until needed.
 */

const { AUTH_TARGET, AUTH_WAIT_CONFIG } = require('../../config/env');
const { log } = require('../../lib/logger');
const browser = require('./browser');

// ============================================================================
// STATE
// ============================================================================

let authContext = null;
let authPage = null;

// ============================================================================
// LOGIN FLOW
// ============================================================================

/**
 * Perform login to Salesforce
 * @param {boolean} forceAuth - Force new authentication even if session exists
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function login(forceAuth = false) {
  log.info('AUTH', `Login initiated (force: ${forceAuth})`);
  
  try {
    // Launch browser context
    authContext = await browser.launchPersistentContext({
      headless: false,
    });
    
    const page = await authContext.newPage();
    authPage = page;
    
    // Navigate to login
    await page.goto(AUTH_TARGET.loginUrl);
    log.info('AUTH', 'Navigated to login page');
    
    // Wait for user to complete login
    await page.waitForURL(url => url.href.startsWith(AUTH_TARGET.waitForUrl), {
      timeout: AUTH_TARGET.timeout,
    });
    
    log.info('AUTH', 'Login successful - reached Lightning');
    
    // Save session
    await browser.saveCookies(authContext);
    await browser.saveSessionState(authContext);
    
    return {
      success: true,
      message: 'Authentication successful',
    };
  } catch (error) {
    log.error('AUTH', 'Login failed', error);
    
    // Cleanup on failure
    if (authContext) {
      try {
        await authContext.close();
      } catch {}
      authContext = null;
      authPage = null;
    }
    
    return {
      success: false,
      message: error.message || 'Login failed',
    };
  }
}

/**
 * Ensure we have a valid session, login if needed
 * @returns {Promise<{success: boolean, context: BrowserContext|null, page: Page|null}>}
 */
async function ensureSession() {
  // If we have an active context, verify it's still valid
  if (authContext && authPage) {
    try {
      // Simple check - try to get current URL
      await authPage.url();
      return {
        success: true,
        context: authContext,
        page: authPage,
      };
    } catch {
      // Context is dead, need to re-auth
      authContext = null;
      authPage = null;
    }
  }
  
  // Check if we have saved session
  const status = browser.getSessionStatus();
  
  if (status.valid && status.hasBrowserProfile) {
    log.info('AUTH', 'Attempting to restore session');
    
    try {
      authContext = await browser.launchPersistentContext({
        headless: false,
      });
      
      const page = await authContext.newPage();
      authPage = page;
      
      // Navigate to Lightning and check if we're authenticated
      await page.goto(AUTH_TARGET.waitForUrl);
      
      // Wait a bit for redirect
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      
      if (currentUrl.startsWith(AUTH_TARGET.waitForUrl)) {
        log.info('AUTH', 'Session restored successfully');
        return {
          success: true,
          context: authContext,
          page: authPage,
        };
      }
      
      // Session expired, need manual login
      log.info('AUTH', 'Session expired, waiting for manual login');
      
      await page.waitForURL(url => url.href.startsWith(AUTH_TARGET.waitForUrl), {
        timeout: AUTH_TARGET.timeout,
      });
      
      await browser.saveCookies(authContext);
      await browser.saveSessionState(authContext);
      
      return {
        success: true,
        context: authContext,
        page: authPage,
      };
    } catch (error) {
      log.error('AUTH', 'Session restore failed', error);
      
      if (authContext) {
        try {
          await authContext.close();
        } catch {}
      }
      authContext = null;
      authPage = null;
    }
  }
  
  // No valid session, perform fresh login
  const loginResult = await login(true);
  
  if (loginResult.success) {
    return {
      success: true,
      context: authContext,
      page: authPage,
    };
  }
  
  return {
    success: false,
    context: null,
    page: null,
  };
}

/**
 * Get current session status
 * @returns {{authenticated: boolean, hasContext: boolean, sessionInfo: Object}}
 */
function getStatus() {
  const sessionInfo = browser.getSessionStatus();
  
  return {
    authenticated: authContext !== null && authPage !== null,
    hasContext: authContext !== null,
    sessionInfo,
  };
}

/**
 * Get the current browser page (for Salesforce operations)
 * @returns {Page|null}
 */
function getPage() {
  return authPage;
}

/**
 * Get the current browser context
 * @returns {BrowserContext|null}
 */
function getContext() {
  return authContext;
}

/**
 * Close the authentication session
 */
async function closeSession() {
  if (authContext) {
    try {
      await browser.saveCookies(authContext);
      await browser.saveSessionState(authContext);
      await authContext.close();
      log.info('AUTH', 'Session closed');
    } catch (error) {
      log.error('AUTH', 'Error closing session', error);
    }
    authContext = null;
    authPage = null;
  }
}

// ============================================================================
// TEST CONNECTION
// ============================================================================

/**
 * Open Salesforce home page for manual verification.
 *
 * This allows the user to:
 * 1. Verify the session is working correctly
 * 2. Complete any additional authentication steps (MFA, consent, etc.)
 * 3. Visually confirm they are connected
 *
 * The browser stays open for manual interaction.
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testConnection() {
  log.info('AUTH', 'Test connection initiated');
  
  try {
    // Launch browser with persistent profile
    authContext = await browser.launchPersistentContext({
      headless: false,
    });
    
    const page = await authContext.newPage();
    authPage = page;
    
    // Navigate to Salesforce home
    log.info('AUTH', 'Navigating to Salesforce home');
    await page.goto(AUTH_TARGET.waitForUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    // Wait a bit for any redirects
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    log.info('AUTH', `Current URL: ${currentUrl}`);
    
    // Check if we landed on Lightning (connected) or login page (need auth)
    if (currentUrl.startsWith(AUTH_TARGET.waitForUrl)) {
      log.info('AUTH', 'Session is valid - user is connected');
      
      // Update session state
      await browser.saveCookies(authContext);
      await browser.saveSessionState(authContext);
      
      return {
        success: true,
        message: 'Connecté - Session valide',
        needsAction: false,
      };
    }
    
    // User needs to complete authentication manually
    log.info('AUTH', 'Session expired or invalid - user needs to authenticate');
    
    return {
      success: true,
      message: 'Veuillez compléter l\'authentification dans le navigateur',
      needsAction: true,
    };
    
  } catch (error) {
    log.error('AUTH', 'Test connection failed', error);
    
    // Check if browser profile is locked
    if (error.message?.includes('lock') || error.message?.includes('LOCK')) {
      return {
        success: false,
        message: 'Un navigateur est déjà ouvert. Fermez-le et réessayez.',
        error: 'BROWSER_PROFILE_LOCKED',
      };
    }
    
    return {
      success: false,
      message: error.message || 'Erreur lors du test de connexion',
      error: 'UNKNOWN',
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  login,
  ensureSession,
  getStatus,
  getPage,
  getContext,
  closeSession,
  testConnection,
  // Re-export browser utilities for advanced use
  browser,
};
