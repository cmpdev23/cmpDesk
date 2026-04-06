/**
 * Salesforce Opportunity Service
 * 
 * Handles Opportunity creation via Aura API.
 * 
 * API: aura://RecordUiController/ACTION$createRecord
 * 
 * @see model/lib/create_opportunity.js - Reference implementation
 */

const { log } = require('../../lib/logger');
const auraClient = require('./aura-client');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Opportunity RecordTypeId (from claude.md)
 */
const OPPORTUNITY_RECORD_TYPE_ID = '012Am0000004KaZIAU';

/**
 * Salesforce base URL
 */
const SF_BASE_URL = 'https://indall.lightning.force.com';

// ============================================================================
// OPPORTUNITY CREATION
// ============================================================================

/**
 * Create an Opportunity in Salesforce via Aura API
 * 
 * @param {Page} page - Playwright page
 * @param {Object} credentials - Aura credentials
 * @param {Object} fields - Opportunity fields
 * @param {string} fields.AccountId - Parent Account ID (required)
 * @param {string} fields.StageName - Pipeline stage (required, e.g., "Closed Won")
 * @param {string} fields.CloseDate - Close date YYYY-MM-DD (required)
 * @param {string} [fields.RecordTypeId] - RecordType ID
 * @param {string} [fields.Opportunity_Category__c] - Category
 * @param {string} [fields.Product_Interest__c] - Product interest
 * @param {string} [fields.Subsidiary__c] - Subsidiary
 * @param {string} [fields.Proposal_Number__c] - Proposal number
 * @param {string} [fields.Contract_Number__c] - Contract number
 * @param {string} [fields.Transaction_Date__c] - Transaction date
 * @param {number} [fields.Annual_Premium__c] - Annual premium
 * @returns {Promise<{success: boolean, recordId?: string, recordUrl?: string, error?: string}>}
 */
async function createOpportunity(page, credentials, fields) {
  log.info('OPPORTUNITY', 'Creating opportunity...', { accountId: fields.AccountId });
  
  // Validate required fields
  if (!fields.AccountId) {
    return { success: false, error: 'AccountId is required' };
  }
  if (!fields.StageName) {
    return { success: false, error: 'StageName is required' };
  }
  if (!fields.CloseDate) {
    return { success: false, error: 'CloseDate is required' };
  }
  
  // Build fields with defaults
  const opportunityFields = {
    RecordTypeId: OPPORTUNITY_RECORD_TYPE_ID,
    Probability: 100,
    ...fields,
  };
  
  // Build Aura message for createRecord
  const message = {
    actions: [{
      id: '1;a',
      descriptor: 'aura://RecordUiController/ACTION$createRecord',
      callingDescriptor: 'UNKNOWN',
      params: {
        recordInput: {
          apiName: 'Opportunity',
          fields: opportunityFields,
        },
      },
    }],
  };
  
  try {
    const response = await auraClient.call(page, credentials, message);
    
    if (!response || !response.actions || !response.actions[0]) {
      log.error('OPPORTUNITY', 'Invalid Aura response');
      return { success: false, error: 'Invalid Aura response' };
    }
    
    const action = response.actions[0];
    
    if (action.state !== 'SUCCESS') {
      const errorMsg = extractErrorMessage(action);
      log.error('OPPORTUNITY', 'Creation failed', { state: action.state, error: errorMsg });
      return { 
        success: false, 
        error: errorMsg,
        errors: action.error?.data?.output?.errors || [],
      };
    }
    
    // Extract record ID from response
    const recordId = action.returnValue?.record?.id || action.returnValue?.id;
    
    if (!recordId) {
      log.error('OPPORTUNITY', 'No record ID in response');
      return { success: false, error: 'No record ID returned' };
    }
    
    const recordUrl = buildOpportunityUrl(recordId);
    
    log.info('OPPORTUNITY', 'Opportunity created', { recordId, recordUrl });
    
    return {
      success: true,
      recordId,
      recordUrl,
    };
  } catch (error) {
    log.error('OPPORTUNITY', 'createOpportunity error', error);
    return { success: false, error: error.message };
  }
}

/**
 * Build Opportunity URL
 * @param {string} opportunityId 
 * @returns {string}
 */
function buildOpportunityUrl(opportunityId) {
  return `${SF_BASE_URL}/lightning/r/Opportunity/${opportunityId}/view`;
}

/**
 * Extract error message from Aura action response
 * @param {Object} action 
 * @returns {string}
 */
function extractErrorMessage(action) {
  if (action.error?.data?.output?.errors?.length > 0) {
    return action.error.data.output.errors.map(e => e.message).join('; ');
  }
  if (action.error?.message) {
    return action.error.message;
  }
  if (action.error?.data?.message) {
    return action.error.data.message;
  }
  return `Action failed with state: ${action.state}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string}
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createOpportunity,
  buildOpportunityUrl,
  getTodayDate,
  OPPORTUNITY_RECORD_TYPE_ID,
};
