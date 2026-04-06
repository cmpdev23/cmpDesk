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
 * Convert raw search records to candidate format
 * @param {Array} records - Raw search records
 * @param {number} limit - Max candidates to return
 * @returns {Array<{id: string, name: string, phone?: string, email?: string, city?: string}>}
 */
function recordsToCandidates(records, limit = 5) {
  if (!records || !Array.isArray(records)) return [];
  
  return records.slice(0, limit).map(record => ({
    id: record.id || record.recordId,
    name: record.name || record.primaryField?.value || record.title,
    phone: record.phone || null,
    email: record.email || null,
    city: record.city || null,
  }));
}

/**
 * Search for an account using cascading strategies:
 * 1. Phone (if provided)
 * 2. Email fallback (if phone found nothing)
 * 3. Name fallback (if email found nothing)
 *
 * When multiple results found, returns up to 5 candidates for user selection.
 *
 * @param {Object} params - Search parameters
 * @param {string} params.phone - Phone number to search
 * @param {string} params.email - Email to search
 * @param {string} params.firstName - First name
 * @param {string} params.lastName - Last name
 * @returns {Promise<{found: boolean, accountId?: string, accountName?: string, matchedBy?: string, candidates?: Array, multipleResults?: boolean, message?: string}>}
 */
async function searchAccount({ phone, email, firstName, lastName }) {
  log.info('SALESFORCE', 'Account search initiated', { phone, email, firstName, lastName });
  
  // Ensure we have a session
  const { success, page } = await authService.ensureSession();
  
  if (!success || !page) {
    return {
      found: false,
      error: 'SESSION_REQUIRED',
      message: 'Not authenticated',
    };
  }
  
  // Get Aura credentials
  const credentials = await getCredentials();
  
  if (!credentials) {
    return {
      found: false,
      error: 'CREDENTIALS_CAPTURE_FAILED',
      message: 'Failed to capture Aura credentials',
    };
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Strategy 1: Search by phone (primary)
  // ══════════════════════════════════════════════════════════════════════════
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
      
      if (result.found && result.records && result.records.length > 0) {
        const candidates = recordsToCandidates(result.records, 5);
        
        // Multiple results → let user choose
        if (candidates.length > 1) {
          log.info('SALESFORCE', `Multiple accounts found by phone: ${candidates.length}`);
          return {
            found: true,
            multipleResults: true,
            matchedBy: 'phone',
            candidates,
            message: `${candidates.length} comptes trouvés par téléphone`,
          };
        }
        
        // Single result
        return {
          found: true,
          accountId: result.accountId,
          accountName: result.accountName,
          matchedBy: 'phone',
          message: 'Compte trouvé par téléphone',
        };
      }
      
      // Try SOQL search for exact phone match
      const soqlResult = await search.searchBySOQL(page, credentials, 'Phone', format);
      
      if (soqlResult.found && soqlResult.account) {
        return {
          found: true,
          accountId: soqlResult.account.id,
          accountName: soqlResult.account.name,
          matchedBy: 'phone',
          message: 'Compte trouvé par téléphone (exact)',
        };
      }
    }
    
    log.debug('SALESFORCE', 'Phone search found nothing, trying email fallback...');
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Strategy 2: Search by email (fallback if phone found nothing)
  // ══════════════════════════════════════════════════════════════════════════
  if (email) {
    log.debug('SALESFORCE', `Searching by email: ${email}`);
    
    const result = await search.searchByTerm(page, credentials, email);
    
    if (result.found && result.records && result.records.length > 0) {
      const candidates = recordsToCandidates(result.records, 5);
      
      // Multiple results → let user choose
      if (candidates.length > 1) {
        log.info('SALESFORCE', `Multiple accounts found by email: ${candidates.length}`);
        return {
          found: true,
          multipleResults: true,
          matchedBy: 'email',
          candidates,
          message: `${candidates.length} comptes trouvés par email`,
        };
      }
      
      // Single result
      return {
        found: true,
        accountId: result.accountId,
        accountName: result.accountName,
        matchedBy: 'email',
        message: 'Compte trouvé par email',
      };
    }
    
    // Try SOQL for exact email match
    const soqlResult = await search.searchBySOQL(page, credentials, 'PersonEmail', email);
    
    if (soqlResult.found && soqlResult.account) {
      return {
        found: true,
        accountId: soqlResult.account.id,
        accountName: soqlResult.account.name,
        matchedBy: 'email',
        message: 'Compte trouvé par email (exact)',
      };
    }
    
    log.debug('SALESFORCE', 'Email search found nothing, trying name fallback...');
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Strategy 3: Search by name (fallback if phone & email found nothing)
  // ══════════════════════════════════════════════════════════════════════════
  if (firstName || lastName) {
    const nameTerm = [firstName, lastName].filter(Boolean).join(' ');
    log.debug('SALESFORCE', `Searching by name: ${nameTerm}`);
    
    const result = await search.searchByTerm(page, credentials, nameTerm);
    
    if (result.found && result.records && result.records.length > 0) {
      const candidates = recordsToCandidates(result.records, 5);
      
      // Multiple results → let user choose
      if (candidates.length > 1) {
        log.info('SALESFORCE', `Multiple accounts found by name: ${candidates.length}`);
        return {
          found: true,
          multipleResults: true,
          matchedBy: 'name',
          candidates,
          message: `${candidates.length} comptes trouvés par nom`,
        };
      }
      
      // Single result
      return {
        found: true,
        accountId: result.accountId,
        accountName: result.accountName,
        matchedBy: 'name',
        message: 'Compte trouvé par nom',
      };
    }
    
    // Try broader search without filter
    const broadResult = await search.searchByTermNoFilter(page, credentials, nameTerm);
    
    if (broadResult.found && broadResult.records && broadResult.records.length > 0) {
      const candidates = recordsToCandidates(broadResult.records, 5);
      
      // Multiple results → let user choose
      if (candidates.length > 1) {
        log.info('SALESFORCE', `Multiple accounts found by name (broad): ${candidates.length}`);
        return {
          found: true,
          multipleResults: true,
          matchedBy: 'name',
          candidates,
          message: `${candidates.length} comptes trouvés par nom`,
        };
      }
      
      // Single result
      return {
        found: true,
        accountId: broadResult.accountId,
        accountName: broadResult.accountName,
        matchedBy: 'name',
        message: 'Compte trouvé par nom',
      };
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // No results found with any strategy
  // ══════════════════════════════════════════════════════════════════════════
  log.info('SALESFORCE', 'No account found with any search strategy');
  return {
    found: false,
    message: 'Aucun compte trouvé avec les critères fournis',
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
