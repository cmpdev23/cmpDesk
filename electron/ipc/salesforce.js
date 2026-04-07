/**
 * Salesforce IPC Handlers
 *
 * Handles Salesforce operations via IPC.
 */

const { ipcMain } = require('electron');
const { log } = require('../lib/logger');
const salesforceService = require('../services/salesforce');

/**
 * Register Salesforce IPC handlers
 */
function register() {
  // Search for account
  ipcMain.handle('salesforce:searchAccount', async (_, params) => {
    log.debug('IPC', 'salesforce:searchAccount called', {
      phone: params?.phone ? '***' : null,
      email: params?.email ? '***' : null,
      firstName: params?.firstName,
      lastName: params?.lastName,
    });
    
    try {
      const result = await salesforceService.searchAccount(params);
      return result;
    } catch (error) {
      log.error('IPC', 'salesforce:searchAccount error', error);
      return {
        success: false,
        message: error.message,
      };
    }
  });

  // Create account
  ipcMain.handle('salesforce:createAccount', async (_, params) => {
    log.info('IPC', 'salesforce:createAccount called', {
      firstName: params?.firstName,
      lastName: params?.lastName,
      hasPhone: !!params?.phone,
      hasEmail: !!params?.email,
    });
    
    try {
      const result = await salesforceService.createAccount(params);
      return result;
    } catch (error) {
      log.error('IPC', 'salesforce:createAccount error', error);
      return {
        success: false,
        error: error.message,
        message: 'Erreur lors de la création du compte',
      };
    }
  });

  // Create dossier (Opportunity + Case)
  ipcMain.handle('salesforce:createDossier', async (_, params) => {
    log.info('IPC', 'salesforce:createDossier called', {
      accountId: params?.accountId,
      hasOpportunityData: !!params?.opportunityData,
      hasCaseData: !!params?.caseData,
    });
    
    try {
      const result = await salesforceService.createDossier(params);
      return result;
    } catch (error) {
      log.error('IPC', 'salesforce:createDossier error', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  log.debug('IPC', 'Salesforce handlers registered');
}

module.exports = { register };
