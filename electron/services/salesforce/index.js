/**
 * Salesforce Service
 * 
 * Main entry point for all Salesforce operations.
 * Orchestrates authentication, credential capture, and search.
 */

const { log } = require('../../lib/logger');
const authService = require('../auth');
const auraClient = require('./aura-client');
const search = require('./search');

// ============================================================================
// STATE
// ============================================================================

let cachedCredentials = null;

// ============================================================================
// CREDENTIAL MANAGEMENT
// ============================================================================

/**
 * Get Aura credentials, capturing them if needed
 * @returns {Promise<{token: string, fwuid: string, mode: string} | null>}
 */
async function getCredentials() {
  // Return cached if still valid (TODO: add expiry check)
  if (cachedCredentials) {
    return cachedCredentials;
  }
  
  const { page } = await authService.ensureSession();
  
  if (!page) {
    log.error('SALESFORCE', 'No authenticated page available');
    return null;
  }
  
  const credentials = await auraClient.waitForAuthentication(page);
  
  if (credentials) {
    cachedCredentials = credentials;
  }
  
  return credentials;
}

/**
 * Clear cached credentials (use after session change)
 */
function clearCredentials() {
  cachedCredentials = null;
}

// ============================================================================
// ACCOUNT SEARCH
// ============================================================================

/**
 * Search for an account using multiple strategies
 * @param {Object} params - Search parameters
 * @param {string} params.phone - Phone number to search
 * @param {string} params.email - Email to search
 * @param {string} params.firstName - First name
 * @param {string} params.lastName - Last name
 * @returns {Promise<{success: boolean, accountId?: string, accountName?: string, message: string}>}
 */
async function searchAccount({ phone, email, firstName, lastName }) {
  log.info('SALESFORCE', 'Account search initiated', { phone, email, firstName, lastName });
  
  // Ensure we have a session
  const { success, page } = await authService.ensureSession();
  
  if (!success || !page) {
    return {
      success: false,
      message: 'Not authenticated',
    };
  }
  
  // Get Aura credentials
  const credentials = await getCredentials();
  
  if (!credentials) {
    return {
      success: false,
      message: 'Failed to capture Aura credentials',
    };
  }
  
  // Strategy 1: Search by phone with various formats
  if (phone) {
    const phoneFormats = [
      phone,
      phone.replace(/\D/g, ''),
      phone.replace(/\D/g, '').slice(-10),
    ];
    
    for (const format of phoneFormats) {
      if (!format || format.length < 7) continue;
      
      log.debug('SALESFORCE', `Trying phone format: ${format}`);
      
      // Try standard search
      const result = await search.searchByTerm(page, credentials, format);
      
      if (result.found) {
        return {
          success: true,
          accountId: result.accountId,
          accountName: result.accountName,
          message: 'Account found by phone',
          records: result.records,
        };
      }
      
      // Try SOQL search
      const soqlResult = await search.searchBySOQL(page, credentials, 'Phone', format);
      
      if (soqlResult.found) {
        return {
          success: true,
          accountId: soqlResult.account.id,
          accountName: soqlResult.account.name,
          message: 'Account found by phone (SOQL)',
          account: soqlResult.account,
        };
      }
    }
  }
  
  // Strategy 2: Search by email
  if (email) {
    log.debug('SALESFORCE', `Searching by email: ${email}`);
    
    const result = await search.searchByTerm(page, credentials, email);
    
    if (result.found) {
      return {
        success: true,
        accountId: result.accountId,
        accountName: result.accountName,
        message: 'Account found by email',
        records: result.records,
      };
    }
    
    // Try SOQL
    const soqlResult = await search.searchBySOQL(page, credentials, 'PersonEmail', email);
    
    if (soqlResult.found) {
      return {
        success: true,
        accountId: soqlResult.account.id,
        accountName: soqlResult.account.name,
        message: 'Account found by email (SOQL)',
        account: soqlResult.account,
      };
    }
  }
  
  // Strategy 3: Search by name
  if (firstName || lastName) {
    const nameTerm = [firstName, lastName].filter(Boolean).join(' ');
    log.debug('SALESFORCE', `Searching by name: ${nameTerm}`);
    
    const result = await search.searchByTerm(page, credentials, nameTerm);
    
    if (result.found) {
      return {
        success: true,
        accountId: result.accountId,
        accountName: result.accountName,
        message: 'Account found by name',
        records: result.records,
      };
    }
    
    // Try broader search
    const broadResult = await search.searchByTermNoFilter(page, credentials, nameTerm);
    
    if (broadResult.found) {
      return {
        success: true,
        accountId: broadResult.accountId,
        accountName: broadResult.accountName,
        message: 'Account found by name (broad search)',
        records: broadResult.records,
      };
    }
  }
  
  // No account found
  log.info('SALESFORCE', 'No account found');
  return {
    success: false,
    message: 'No account found with the provided criteria',
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Credential management
  getCredentials,
  clearCredentials,
  
  // Account operations
  searchAccount,
  
  // Re-export sub-modules for advanced use
  auraClient,
  search,
};
