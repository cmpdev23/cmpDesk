/**
 * Salesforce Search Module
 * 
 * Account search strategies:
 * 1. searchByTerm - Standard search with Account filter
 * 2. searchByTermNoFilter - Broader search without object filter
 * 3. searchByGetAnswers - Smart search using Einstein
 * 4. searchBySOQL - Direct SOQL query
 */

const { log } = require('../../lib/logger');
const auraClient = require('./aura-client');

// ============================================================================
// SEARCH CONFIGURATION
// ============================================================================

const SMART_SCOPE_PHONE = [
  {
    type: 'TOP_RESULTS',
    limit: 5,
    groupKey: null,
  },
  {
    type: 'Account',
    limit: 10,
    groupKey: 'Account',
  },
];

// ============================================================================
// SEARCH STRATEGIES
// ============================================================================

/**
 * Search using standard Aura search with Account filter
 * @param {Page} page 
 * @param {Object} credentials 
 * @param {string} term 
 * @returns {Promise<{found: boolean, accountId?: string, accountName?: string, records?: Array}>}
 */
async function searchByTerm(page, credentials, term) {
  log.debug('SEARCH', `searchByTerm: "${term}"`);
  
  const message = {
    actions: [{
      id: '1;a',
      descriptor: 'serviceComponent://ui.search.SearchResultsProviderController/ACTION$getSearchResults',
      callingDescriptor: 'UNKNOWN',
      params: {
        term: term,
        searchConfiguration: null,
        objectInfoMap: null,
        additionalContextData: null,
        promotedResultsLimit: null,
        entities: ['Account'],
        groupKey: 'Account',
      },
    }],
  };
  
  try {
    const response = await auraClient.call(page, credentials, message);
    
    if (!response || !response.actions || !response.actions[0]) {
      log.warn('SEARCH', 'Invalid Aura response');
      return { found: false };
    }
    
    const action = response.actions[0];
    
    if (action.state !== 'SUCCESS') {
      log.warn('SEARCH', 'Search action failed', { state: action.state });
      return { found: false };
    }
    
    const returnValue = action.returnValue;
    
    if (!returnValue || !returnValue.searchTerm) {
      log.debug('SEARCH', 'No results in response');
      return { found: false };
    }
    
    // Parse results
    const records = [];
    const resultGroups = returnValue.result?.searchResultsData?.resultGroups || [];
    
    for (const group of resultGroups) {
      const groupResults = group.searchResults || [];
      
      for (const result of groupResults) {
        const info = {
          id: result.recordId,
          name: result.primaryField?.value || result.title,
          type: result.sobjectType || 'Account',
          subtitle: result.secondaryFields?.map(f => f.value).join(' | '),
        };
        records.push(info);
      }
    }
    
    if (records.length > 0) {
      const firstRecord = records[0];
      log.info('SEARCH', `Account found: ${firstRecord.name} (${firstRecord.id})`);
      
      return {
        found: true,
        accountId: firstRecord.id,
        accountName: firstRecord.name,
        records,
      };
    }
    
    return { found: false, records: [] };
  } catch (error) {
    log.error('SEARCH', 'searchByTerm error', error);
    return { found: false, error: error.message };
  }
}

/**
 * Search without object filter (broader results)
 * @param {Page} page 
 * @param {Object} credentials 
 * @param {string} term 
 * @returns {Promise<{found: boolean, accountId?: string, accountName?: string, records?: Array}>}
 */
async function searchByTermNoFilter(page, credentials, term) {
  log.debug('SEARCH', `searchByTermNoFilter: "${term}"`);
  
  const message = {
    actions: [{
      id: '1;a',
      descriptor: 'serviceComponent://ui.search.SearchResultsProviderController/ACTION$getSearchResults',
      callingDescriptor: 'UNKNOWN',
      params: {
        term: term,
        searchConfiguration: null,
        objectInfoMap: null,
        additionalContextData: null,
        promotedResultsLimit: null,
        entities: null,
        groupKey: null,
      },
    }],
  };
  
  try {
    const response = await auraClient.call(page, credentials, message);
    
    if (!response || !response.actions || !response.actions[0]) {
      return { found: false };
    }
    
    const action = response.actions[0];
    
    if (action.state !== 'SUCCESS') {
      return { found: false };
    }
    
    const returnValue = action.returnValue;
    
    if (!returnValue) {
      return { found: false };
    }
    
    // Parse results - look for Account records
    const records = [];
    const resultGroups = returnValue.result?.searchResultsData?.resultGroups || [];
    
    for (const group of resultGroups) {
      const groupResults = group.searchResults || [];
      
      for (const result of groupResults) {
        if (result.sobjectType === 'Account' || group.sobjectType === 'Account') {
          records.push({
            id: result.recordId,
            name: result.primaryField?.value || result.title,
            type: 'Account',
            subtitle: result.secondaryFields?.map(f => f.value).join(' | '),
          });
        }
      }
    }
    
    if (records.length > 0) {
      const firstRecord = records[0];
      log.info('SEARCH', `Account found (no filter): ${firstRecord.name}`);
      
      return {
        found: true,
        accountId: firstRecord.id,
        accountName: firstRecord.name,
        records,
      };
    }
    
    return { found: false, records: [] };
  } catch (error) {
    log.error('SEARCH', 'searchByTermNoFilter error', error);
    return { found: false, error: error.message };
  }
}

/**
 * Search using Einstein Smart Search (getAnswers)
 * @param {Page} page 
 * @param {Object} credentials 
 * @param {string} phone 
 * @returns {Promise<{found: boolean, accountId?: string, accountName?: string}>}
 */
async function searchByGetAnswers(page, credentials, phone) {
  log.debug('SEARCH', `searchByGetAnswers: "${phone}"`);
  
  const message = {
    actions: [{
      id: '1;a',
      descriptor: 'serviceComponent://ui.search.SmartSearchResultsController/ACTION$getAnswers',
      callingDescriptor: 'UNKNOWN',
      params: {
        searchTerm: phone,
        limit: 10,
        context: {
          searchScopes: ['TOP_RESULTS', 'Account'],
          entities: ['Account'],
          groupKey: null,
          debugInfo: {
            enableSmartSearchLogging: true,
            enableTokenization: true,
            enablePersonAccountLogging: false,
          },
        },
        topResultsRequestModel: {
          searchTerm: phone,
          pageNumber: 1,
          pageSize: 5,
          isSpellCorrected: false,
          scopeMap: {
            type: 'TOP_RESULTS',
            limit: 5,
            groupKey: null,
          },
          context: {
            searchScopes: ['TOP_RESULTS', 'Account'],
            entities: ['Account'],
            groupKey: null,
            debugInfo: {
              enableSmartSearchLogging: true,
              enableTokenization: true,
              enablePersonAccountLogging: false,
            },
          },
        },
      },
    }],
  };
  
  try {
    const response = await auraClient.call(page, credentials, message);
    
    if (!response || !response.actions || !response.actions[0]) {
      return { found: false };
    }
    
    const action = response.actions[0];
    
    if (action.state !== 'SUCCESS') {
      return { found: false };
    }
    
    const returnValue = action.returnValue;
    
    // Parse smart search results
    const topResults = returnValue?.topResultsResponse?.searchResults || [];
    
    for (const result of topResults) {
      if (result.sobjectType === 'Account') {
        log.info('SEARCH', `Account found (smart): ${result.title}`);
        
        return {
          found: true,
          accountId: result.recordId,
          accountName: result.primaryField?.value || result.title,
        };
      }
    }
    
    return { found: false };
  } catch (error) {
    log.error('SEARCH', 'searchByGetAnswers error', error);
    return { found: false, error: error.message };
  }
}

/**
 * Search using SOQL query
 * @param {Page} page 
 * @param {Object} credentials 
 * @param {string} field - Field to search (e.g., 'Phone', 'PersonEmail')
 * @param {string} value - Value to search for
 * @returns {Promise<{found: boolean, account?: Object}>}
 */
async function searchBySOQL(page, credentials, field, value) {
  log.debug('SEARCH', `searchBySOQL: ${field}="${value}"`);
  
  // Build SOQL query
  const query = `SELECT Id, Name, Phone, PersonEmail, BillingCity, BillingStreet 
                 FROM Account 
                 WHERE ${field} = '${value.replace(/'/g, "\\'")}' 
                 LIMIT 5`;
  
  try {
    const response = await auraClient.restCall(page, `/query?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      log.warn('SEARCH', 'SOQL query failed', { status: response.status });
      return {
        found: false,
        error: `SOQL query failed: ${response.status}`,
      };
    }
    
    const records = response.data?.records || [];
    
    if (records.length === 0) {
      return { found: false };
    }
    
    const account = records[0];
    log.info('SEARCH', `Account found via SOQL: ${account.Name} (${account.Id})`);
    
    return {
      found: true,
      account: {
        id: account.Id,
        name: account.Name,
        phone: account.Phone,
        email: account.PersonEmail,
        city: account.BillingCity,
        street: account.BillingStreet,
      },
    };
  } catch (error) {
    log.error('SEARCH', 'searchBySOQL error', error);
    return { found: false, error: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  searchByTerm,
  searchByTermNoFilter,
  searchByGetAnswers,
  searchBySOQL,
  SMART_SCOPE_PHONE,
};
