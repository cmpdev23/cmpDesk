/**
 * Account Service
 *
 * Handles Salesforce Account creation via Aura API.
 * 
 * @see docs/account.md - Account field documentation
 * @see model/scripts/create_account_api_v2.js - Reference implementation
 */

const { log } = require('../../lib/logger');
const auraClient = require('./aura-client');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * RecordTypeId for FSC Individual accounts
 * Source: inspectors/inspect_account_fields.js
 */
const FSC_INDIVIDUAL_RECORD_TYPE_ID = '0125Y000001zWhpQAE';

/**
 * Salesforce Lightning base URL
 */
const SF_LIGHTNING_BASE = 'https://indall.lightning.force.com';

// ============================================================================
// ACCOUNT CREATION
// ============================================================================

/**
 * Create a new Account in Salesforce via Aura API.
 *
 * Required fields:
 * - LastName (required by SF)
 * - RecordTypeId (FSC Individual)
 *
 * Optional fields:
 * - FirstName
 * - Phone (10 digits)
 * - Primary_Email__c
 *
 * @param {Page} page - Playwright page with active session
 * @param {Object} credentials - Aura credentials {token, fwuid, mode}
 * @param {Object} accountData - Account fields
 * @param {string} accountData.firstName - First name
 * @param {string} accountData.lastName - Last name (required)
 * @param {string} [accountData.phone] - Phone number (10 digits)
 * @param {string} [accountData.email] - Email address
 * @returns {Promise<CreateAccountResult>}
 */
async function createAccount(page, credentials, accountData) {
  const result = {
    success: false,
    accountId: null,
    accountName: null,
    accountUrl: null,
    error: null,
  };

  // Validate required fields
  if (!accountData.lastName) {
    result.error = 'LastName is required';
    return result;
  }

  // Build account fields for Aura API
  const fields = {
    LastName: accountData.lastName.trim(),
    RecordTypeId: FSC_INDIVIDUAL_RECORD_TYPE_ID,
  };

  // Add optional fields
  if (accountData.firstName) {
    fields.FirstName = accountData.firstName.trim();
  }

  if (accountData.phone) {
    // Clean phone number - keep only digits
    const cleanPhone = accountData.phone.replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      // Take last 10 digits
      fields.Phone = cleanPhone.slice(-10);
    }
  }

  if (accountData.email) {
    fields.Primary_Email__c = accountData.email.trim();
  }

  log.info('ACCOUNT', 'Creating account', {
    lastName: fields.LastName,
    firstName: fields.FirstName || '(none)',
    hasPhone: !!fields.Phone,
    hasEmail: !!fields.Primary_Email__c,
  });

  // Build Aura context
  const auraContext = auraClient.buildAuraContext(credentials);

  // Execute createRecord via Aura API
  try {
    const response = await page.evaluate(async ({ fields, auraContext, auraToken }) => {
      // Build the Aura message
      const message = {
        actions: [{
          id: '1;a',
          descriptor: 'aura://RecordUiController/ACTION$createRecord',
          callingDescriptor: 'UNKNOWN',
          params: {
            recordInput: {
              allowSaveOnDuplicate: true, // Allow creation even if duplicate warning
              apiName: 'Account',
              fields: fields,
            }
          }
        }]
      };

      // Build request body
      const body = new URLSearchParams();
      body.append('message', JSON.stringify(message));
      body.append('aura.context', JSON.stringify(auraContext));
      body.append('aura.token', auraToken || 'undefined');

      // Build URL with query params
      const queryParams = new URLSearchParams({
        r: '1',
        'aura.RecordUi.createRecord': '1',
      });

      const url = '/aura?' + queryParams.toString();

      // Make the request
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          body: body.toString(),
          credentials: 'include',
        });
      } catch (e) {
        return { success: false, error: `Fetch error: ${e.message}` };
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Parse response
      let rawText;
      try {
        rawText = await response.text();
      } catch (e) {
        return { success: false, error: `Response read error: ${e.message}` };
      }

      // Extract first JSON object from response
      // (Aura responses sometimes have prefix text)
      function extractFirstJson(text, startPos) {
        let depth = 0, inString = false, escape = false, start = -1;
        for (let i = startPos; i < text.length; i++) {
          const ch = text[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') { if (depth === 0) start = i; depth++; }
          else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
              return text.substring(start, i + 1);
            }
          }
        }
        return null;
      }

      const firstBrace = rawText.indexOf('{');
      const jsonStr = firstBrace !== -1 ? extractFirstJson(rawText, firstBrace) : null;

      if (!jsonStr) {
        return {
          success: false,
          error: `No JSON in response: ${rawText.substring(0, 100)}`,
        };
      }

      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (e) {
        return { success: false, error: `JSON parse error: ${e.message}` };
      }

      // Check for Aura-specific errors
      if (data.event?.descriptor?.includes('clientOutOfSync')) {
        return {
          success: false,
          error: 'Session expired - please refresh',
          needsRefresh: true,
        };
      }

      if (data.event?.descriptor?.includes('invalidSession')) {
        return {
          success: false,
          error: 'Invalid session - please login again',
          needsRefresh: true,
        };
      }

      // Parse normal response
      const actions = data.actions || [];
      if (actions.length === 0) {
        return {
          success: false,
          error: 'Empty Aura response',
          raw: data,
        };
      }

      const action = actions[0];
      const state = action.state;

      if (state === 'SUCCESS') {
        const returnValue = action.returnValue || {};
        const recordId = returnValue.id
          || returnValue.record?.id
          || (returnValue.records || [])[0]?.id
          || null;

        return {
          success: true,
          state: state,
          recordId: recordId,
          returnValue: returnValue,
        };
      } else {
        // Handle errors
        const errors = action.error || [];
        let errorMsg = `Aura state: ${state}`;

        if (errors.length > 0) {
          const err = errors[0];
          errorMsg = err.message || err.exceptionMessage || JSON.stringify(err);
        }

        return {
          success: false,
          state: state,
          error: errorMsg,
          errors: errors,
        };
      }
    }, { fields, auraContext, auraToken: credentials.token });

    // Process response
    if (response.success && response.recordId) {
      result.success = true;
      result.accountId = response.recordId;
      result.accountName = [accountData.firstName, accountData.lastName].filter(Boolean).join(' ');
      result.accountUrl = `${SF_LIGHTNING_BASE}/lightning/r/Account/${response.recordId}/view`;

      log.info('ACCOUNT', 'Account created successfully', {
        accountId: result.accountId,
        accountName: result.accountName,
      });
    } else {
      result.error = response.error || 'Unknown error during account creation';
      log.error('ACCOUNT', 'Account creation failed', {
        error: result.error,
        state: response.state,
      });
    }
  } catch (error) {
    result.error = `Exception: ${error.message}`;
    log.error('ACCOUNT', 'Account creation exception', error);
  }

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createAccount,
  FSC_INDIVIDUAL_RECORD_TYPE_ID,
};
