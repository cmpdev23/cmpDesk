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
// EXPORTS
// ============================================================================

module.exports = {
  login,
  ensureSession,
  getStatus,
  getPage,
  getContext,
  closeSession,
  // Re-export browser utilities for advanced use
  browser,
};
