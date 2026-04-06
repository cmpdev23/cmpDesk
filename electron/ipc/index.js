/**
 * IPC Handlers Index
 * 
 * Central registration point for all IPC handlers.
 * Import this module and call registerAll() in main.js.
 */

const { log } = require('../lib/logger');

const authHandlers = require('./auth');
const salesforceHandlers = require('./salesforce');
const logsHandlers = require('./logs');
const themeHandlers = require('./theme');
const appHandlers = require('./app');

/**
 * Register all IPC handlers
 */
function registerAll() {
  log.info('IPC', 'Registering IPC handlers...');
  
  authHandlers.register();
  salesforceHandlers.register();
  logsHandlers.register();
  themeHandlers.register();
  appHandlers.register();
  
  log.info('IPC', 'All IPC handlers registered');
}

module.exports = {
  registerAll,
  // Export individual modules for selective registration
  auth: authHandlers,
  salesforce: salesforceHandlers,
  logs: logsHandlers,
  theme: themeHandlers,
  app: appHandlers,
};
