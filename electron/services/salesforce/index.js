/**
 * Salesforce Service
 *
 * Main entry point for all Salesforce operations.
 * Orchestrates authentication, credential capture, search, and record creation.
 */

const { log } = require('../../lib/logger');
const authService = require('../auth');
const auraClient = require('./aura-client');
const search = require('./search');
const opportunity = require('./opportunity');
const caseService = require('./case');

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
// DOSSIER CREATION (Opportunity + Case)
// ============================================================================

/**
 * Create a complete dossier (Opportunity + Case update)
 *
 * Workflow:
 * 1. Create Opportunity with account reference
 * 2. SF auto-creates a Case linked to the Opportunity
 * 3. Update the Case with additional fields
 *
 * @param {Object} params - Dossier creation parameters
 * @param {string} params.accountId - Salesforce Account ID (required)
 * @param {Object} params.opportunity - Opportunity fields
 * @param {Object} params.caseData - Case fields to update
 * @returns {Promise<CreateDossierResult>}
 */
async function createDossier({ accountId, opportunityData, caseData }) {
  log.info('SALESFORCE', 'Dossier creation initiated', { accountId });
  
  const result = {
    success: false,
    opportunityId: null,
    opportunityUrl: null,
    caseId: null,
    caseUrl: null,
    error: null,
  };
  
  // Ensure we have a session
  const { success, page } = await authService.ensureSession();
  
  if (!success || !page) {
    result.error = 'Not authenticated';
    return result;
  }
  
  // Get Aura credentials
  const credentials = await getCredentials();
  
  if (!credentials) {
    result.error = 'Failed to capture Aura credentials';
    return result;
  }
  
  // Validate required fields
  if (!accountId) {
    result.error = 'accountId is required';
    return result;
  }
  
  // ── Step 1: Create Opportunity ──────────────────────────────────────────────
  log.info('SALESFORCE', 'Step 1: Creating Opportunity...');
  
  const today = opportunity.getTodayDate();
  
  const opportunityFields = {
    AccountId: accountId,
    RecordTypeId: opportunity.OPPORTUNITY_RECORD_TYPE_ID,
    CloseDate: today,
    StageName: 'Closed Won',
    Probability: 100,
    // Custom fields from form
    Opportunity_Category__c: opportunityData?.opportunityCategory || 'Gobal Offer',
    Product_Interest__c: opportunityData?.productInterest || 'Life Insurance',
    Subsidiary__c: opportunityData?.subsidiary || 'iA',
    Proposal_Number__c: opportunityData?.proposalNumber || '',
    Contract_Number__c: opportunityData?.contractNumber || '',
    Transaction_Date__c: opportunityData?.transactionDate || today,
    Annual_Premium__c: parseFloat(opportunityData?.annualPremium) || 0,
  };
  
  const oppResult = await opportunity.createOpportunity(page, credentials, opportunityFields);
  
  if (!oppResult.success) {
    result.error = `Opportunity creation failed: ${oppResult.error}`;
    return result;
  }
  
  result.opportunityId = oppResult.recordId;
  result.opportunityUrl = oppResult.recordUrl;
  
  log.info('SALESFORCE', `Opportunity created: ${oppResult.recordId}`);
  
  // ── Step 2: Update Case ─────────────────────────────────────────────────────
  // Note: Case is auto-created by SF trigger when Opportunity is created
  // We need to wait a bit for the trigger to complete
  log.info('SALESFORCE', 'Step 2: Waiting for Case creation...');
  await page.waitForTimeout(2000); // Give SF time to create the Case
  
  log.info('SALESFORCE', 'Step 2: Updating Case...');
  
  const caseFields = {
    Product_Family__c: caseData?.productFamily || 'Insurance',
    Transaction_Category__c: caseData?.transactionCategory || 'New Contract',
    Transaction_Sub_Category__c: caseData?.transactionSubCategory || 'Without Replacement',
    SignatureType__c: caseData?.signatureType || 'Electronic',
    CustomersPlaceOfResidence__c: caseData?.customersPlaceOfResidence || 'Quebec',
    ProductType__c: caseData?.productType || 'Life Insurance',
  };
  
  const caseResult = await caseService.updateCaseFromOpportunity(
    page,
    credentials,
    oppResult.recordId,
    caseFields
  );
  
  if (!caseResult.success) {
    // Opportunity was created but Case update failed
    // Still return partial success with warning
    log.warn('SALESFORCE', `Case update failed: ${caseResult.error}`);
    result.success = true; // Partial success
    result.warning = `Opportunity created but Case update failed: ${caseResult.error}`;
    return result;
  }
  
  result.caseId = caseResult.recordId;
  result.caseUrl = caseResult.recordUrl;
  result.success = true;
  
  log.info('SALESFORCE', 'Dossier creation complete', {
    opportunityId: result.opportunityId,
    caseId: result.caseId,
  });
  
  return result;
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
  
  // Dossier operations
  createDossier,
  
  // Re-export sub-modules for advanced use
  auraClient,
  search,
  opportunity,
  caseService,
};
