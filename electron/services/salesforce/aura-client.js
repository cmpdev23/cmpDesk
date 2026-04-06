/**
 * Aura Client
 * 
 * Low-level Salesforce Aura API communication.
 * Handles:
 * - Credential capture from page
 * - Aura request building
 * - API calls
 */

const { AUTH_WAIT_CONFIG } = require('../../config/env');
const { log } = require('../../lib/logger');

// ============================================================================
// CREDENTIAL CAPTURE
// ============================================================================

/**
 * Capture Aura credentials from page network requests
 * @param {Page} page - Playwright page
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<{token: string, fwuid: string, mode: string} | null>}
 */
async function captureCredentials(page, timeout = 15000) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      page.off('request', handler);
      resolve(null);
    }, timeout);

    const handler = (request) => {
      if (request.url().includes('/aura') && request.method() === 'POST') {
        try {
          const postData = request.postData();
          if (postData) {
            const params = new URLSearchParams(postData);
            const token = params.get('aura.token');
            const context = params.get('aura.context');
            
            if (token && context) {
              const ctx = JSON.parse(context);
              clearTimeout(timeoutId);
              page.off('request', handler);
              
              log.debug('AURA', 'Credentials captured');
              resolve({
                token,
                fwuid: ctx.fwuid,
                mode: ctx.mode || 'PROD',
              });
            }
          }
        } catch (error) {
          log.error('AURA', 'Error parsing Aura request', error);
        }
      }
    };

    page.on('request', handler);
  });
}

/**
 * Wait for Aura authentication to complete
 * @param {Page} page 
 * @param {number} maxWaitMs 
 * @returns {Promise<{token: string, fwuid: string, mode: string} | null>}
 */
async function waitForAuthentication(page, maxWaitMs = AUTH_WAIT_CONFIG.maxWaitTimeMs) {
  log.info('AURA', 'Waiting for Aura authentication...');
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const credentials = await captureCredentials(page, AUTH_WAIT_CONFIG.checkInterval * 2);
    
    if (credentials && credentials.fwuid && credentials.fwuid.length >= AUTH_WAIT_CONFIG.minFwuid) {
      log.info('AURA', 'Aura authentication complete');
      return credentials;
    }
    
    // Trigger a page interaction to generate Aura requests
    try {
      await page.evaluate(() => {
        // Trigger any pending Aura requests
        if (window.$A && window.$A.run) {
          window.$A.run(() => {});
        }
      });
    } catch {
      // Page might not have $A yet
    }
    
    await page.waitForTimeout(AUTH_WAIT_CONFIG.checkInterval);
  }
  
  log.warn('AURA', 'Aura authentication timeout');
  return null;
}

// ============================================================================
// AURA API CALLS
// ============================================================================

/**
 * Build Aura context object
 * @param {Object} credentials 
 * @returns {Object}
 */
function buildAuraContext(credentials) {
  return {
    mode: credentials.mode || 'PROD',
    fwuid: credentials.fwuid,
    app: 'one:one',
    loaded: {},
    dn: [],
    globals: {},
    uad: true,
  };
}

/**
 * Make an Aura API call
 * @param {Page} page - Playwright page (for fetch context)
 * @param {Object} credentials - Aura credentials
 * @param {Object} message - Aura message payload
 * @returns {Promise<Object>} API response
 */
async function call(page, credentials, message) {
  const context = buildAuraContext(credentials);
  
  const params = new URLSearchParams({
    r: Math.floor(Math.random() * 100),
    'aura.context': JSON.stringify(context),
    'aura.token': credentials.token,
  });
  
  const response = await page.evaluate(async ({ url, message }) => {
    const response = await fetch('/aura?' + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'message=' + encodeURIComponent(JSON.stringify(message)),
    });
    return response.json();
  }, { url: params.toString(), message });
  
  return response;
}

/**
 * Make a REST API call using the page's session
 * @param {Page} page 
 * @param {string} endpoint 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function restCall(page, endpoint, options = {}) {
  const { method = 'GET', body = null, apiVersion = '62.0' } = options;
  
  const response = await page.evaluate(async ({ endpoint, method, body, apiVersion }) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    const fetchOptions = {
      method,
      headers,
    };
    
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }
    
    // Handle full URLs vs relative endpoints
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `/services/data/v${apiVersion}${endpoint}`;
    
    const response = await fetch(url, fetchOptions);
    return {
      ok: response.ok,
      status: response.status,
      data: await response.json(),
    };
  }, { endpoint, method, body, apiVersion });
  
  return response;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  captureCredentials,
  waitForAuthentication,
  buildAuraContext,
  call,
  restCall,
};
