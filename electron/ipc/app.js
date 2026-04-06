/**
 * App IPC Handlers
 * 
 * Handles general application IPC communication.
 */

const { ipcMain, app } = require('electron');
const { log } = require('../lib/logger');
const { ENV_CONFIG } = require('../config/env');

/**
 * Register app IPC handlers
 */
function register() {
  // Get app info
  ipcMain.handle('app:info', async () => {
    return {
      success: true,
      version: app.getVersion(),
      name: app.getName(),
      isDev: ENV_CONFIG.isDev,
      platform: process.platform,
    };
  });

  // Get environment config (non-sensitive)
  ipcMain.handle('app:config', async () => {
    return {
      success: true,
      logLevel: ENV_CONFIG.LOG_LEVEL,
      devTools: ENV_CONFIG.DEVTOOLS,
      isDev: ENV_CONFIG.isDev,
    };
  });

  log.debug('IPC', 'App handlers registered');
}

module.exports = { register };
