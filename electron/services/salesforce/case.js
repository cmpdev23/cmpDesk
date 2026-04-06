/**
 * Salesforce Case Service
 * 
 * Handles Case retrieval and update via Aura API.
 * Case is auto-created by Salesforce when Opportunity is created.
 * 
 * API: aura://RecordUiController/ACTION$updateRecord
 * 
 * @see model/lib/update_case.js - Reference implementation
 */

const { log } = require('../../lib/logger');
const auraClient = require('./aura-client');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Case RecordTypeId (from docs/Case.md)
 */
const CASE_RECORD_TYPE_ID = '012Am0000004KaPIAU';

/**
 * Salesforce base URL
 */
const SF_BASE_URL = 'https://indall.lightning.force.com';

// ============================================================================
// GET CASE FROM OPPORTUNITY
// ============================================================================

/**
 * Get the Case ID linked to an Opportunity
 * Case is auto-created by SF when Opportunity is created
 * 
 * @param {Page} page - Playwright page
 * @param {Object} credentials - Aura credentials
 * @param {string} opportunityId - Opportunity ID
 * @returns {Promise<{success: boolean, caseId?: string, error?: string}>}
 */
async function getCaseIdFromOpportunity(page, credentials, opportunityId) {
  log.debug('CASE', `Getting Case ID for Opportunity: ${opportunityId}`);
  
  if (!opportunityId) {
    return { success: false, error: 'opportunityId is required' };
  }
  
  // Build Aura message to get record with fields
  const message = {
    actions: [{
      id: '1;a',
      descriptor: 'aura://RecordUiController/ACTION$getRecordWithFields',
      callingDescriptor: 'UNKNOWN',
      params: {
        recordId: opportunityId,
        fields: ['Opportunity.Case__c'],
      },
    }],
  };
  
  try {
    const response = await auraClient.call(page, credentials, message);
    
    if (!response || !response.actions || !response.actions[0]) {
      return { success: false, error: 'Invalid Aura response' };
    }
    
    const action = response.actions[0];
    
    if (action.state !== 'SUCCESS') {
      const errorMsg = action.error?.message || `Failed with state: ${action.state}`;
      log.error('CASE', 'Failed to get Opportunity', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
    
    // Extract Case ID from response
    const fields = action.returnValue?.record?.fields || action.returnValue?.fields || {};
    const caseId = fields.Case__c?.value || null;
    
    if (!caseId) {
      log.warn('CASE', 'No Case linked to Opportunity');
      return { success: false, error: 'No Case linked to this Opportunity (Case__c is null)' };
    }
    
    log.info('CASE', `Case found: ${caseId}`);
    return { success: true, caseId };
  } catch (error) {
    log.error('CASE', 'getCaseIdFromOpportunity error', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// UPDATE CASE
// ============================================================================

/**
 * Update a Case in Salesforce via Aura API
 * 
 * @param {Page} page - Playwright page
 * @param {Object} credentials - Aura credentials
 * @param {string} caseId - Case ID to update
 * @param {Object} fields - Case fields to update
 * @param {string} [fields.Product_Family__c] - Product family
 * @param {string} [fields.Transaction_Category__c] - Transaction category
 * @param {string} [fields.Transaction_Sub_Category__c] - Transaction sub-category
 * @param {string} [fields.SignatureType__c] - Signature type
 * @param {string} [fields.CustomersPlaceOfResidence__c] - Customer residence
 * @param {string} [fields.ProductType__c] - Product type
 * @returns {Promise<{success: boolean, recordId?: string, recordUrl?: string, error?: string}>}
 */
async function updateCase(page, credentials, caseId, fields) {
  log.info('CASE', `Updating Case: ${caseId}`);
  
  if (!caseId) {
    return { success: false, error: 'caseId is required' };
  }
  
  // Build fields with Id
  const updateFields = {
    Id: caseId,
    ...fields,
  };
  
  // Build Aura message for updateRecord
  const message = {
    actions: [{
      id: '1;a',
      descriptor: 'aura://RecordUiController/ACTION$updateRecord',
      callingDescriptor: 'UNKNOWN',
      params: {
        recordId: caseId,
        recordInput: {
          allowSaveOnDuplicate: false,
          fields: updateFields,
        },
      },
    }],
  };
  
  try {
    const response = await auraClient.call(page, credentials, message);
    
    if (!response || !response.actions || !response.actions[0]) {
      return { success: false, error: 'Invalid Aura response' };
    }
    
    const action = response.actions[0];
    
    if (action.state !== 'SUCCESS') {
      const errorMsg = extractErrorMessage(action);
      log.error('CASE', 'Update failed', { state: action.state, error: errorMsg });
      return { 
        success: false, 
        error: errorMsg,
        errors: action.error?.data?.output?.errors || [],
      };
    }
    
    const recordUrl = buildCaseUrl(caseId);
    
    log.info('CASE', 'Case updated', { recordId: caseId, recordUrl });
    
    return {
      success: true,
      recordId: caseId,
      recordUrl,
    };
  } catch (error) {
    log.error('CASE', 'updateCase error', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get Case from Opportunity and update it in one call
 * 
 * @param {Page} page - Playwright page
 * @param {Object} credentials - Aura credentials
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} fields - Case fields to update
 * @returns {Promise<{success: boolean, recordId?: string, recordUrl?: string, error?: string}>}
 */
async function updateCaseFromOpportunity(page, credentials, opportunityId, fields) {
  // Step 1: Get Case ID
  const getCaseResult = await getCaseIdFromOpportunity(page, credentials, opportunityId);
  
  if (!getCaseResult.success) {
    return getCaseResult;
  }
  
  // Step 2: Update Case
  return updateCase(page, credentials, getCaseResult.caseId, fields);
}

/**
 * Build Case URL
 * @param {string} caseId 
 * @returns {string}
 */
function buildCaseUrl(caseId) {
  return `${SF_BASE_URL}/lightning/r/Case/${caseId}/view`;
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

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getCaseIdFromOpportunity,
  updateCase,
  updateCaseFromOpportunity,
  buildCaseUrl,
  CASE_RECORD_TYPE_ID,
};
