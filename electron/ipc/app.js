/**
 * App IPC Handlers
 * 
 * Handles general application IPC communication including:
 * - App info and configuration
 * - Auto-update operations
 */

const { ipcMain, app } = require('electron');
const { log } = require('../lib/logger');
const { ENV_CONFIG } = require('../config/env');

// Lazy-loaded updater service reference
let updaterService = null;

/**
 * Get the updater service (lazy load ESM module)
 * @returns {Promise<object>}
 */
async function getUpdaterService() {
  if (!updaterService) {
    try {
      updaterService = await import('../services/updater/index.js');
    } catch (err) {
      log.error('IPC', 'Failed to load updater service', err);
      throw err;
    }
  }
  return updaterService;
}

/**
 * Register app IPC handlers
 */
function register() {
  // ─── App Info ───
  
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
  
  // ─── Auto-Update Handlers ───
  
  /**
   * Get the current app version.
   * @returns {Promise<string>}
   */
  ipcMain.handle('app:getVersion', async () => {
    log.debug('IPC', 'app:getVersion called');
    try {
      const service = await getUpdaterService();
      return service.getVersion();
    } catch (err) {
      // Fallback to app.getVersion() if updater service fails
      return app.getVersion();
    }
  });
  
  /**
   * Check for updates.
   * In dev mode, returns immediately with no update.
   * @returns {Promise<{ updateAvailable: boolean, info?: object, error?: string }>}
   */
  ipcMain.handle('app:checkForUpdates', async () => {
    log.debug('IPC', 'app:checkForUpdates called');
    try {
      const service = await getUpdaterService();
      const result = await service.checkForUpdates();
      return result;
    } catch (error) {
      log.error('IPC', 'app:checkForUpdates error', error);
      return {
        updateAvailable: false,
        error: error.message,
      };
    }
  });
  
  /**
   * Install the downloaded update and restart.
   * This will quit the app and install the update.
   * @returns {Promise<void>}
   */
  ipcMain.handle('app:installUpdate', async () => {
    log.info('IPC', 'app:installUpdate called - installing update and restarting');
    try {
      const service = await getUpdaterService();
      service.installUpdate();
      // Note: This won't return if successful - app will quit
    } catch (error) {
      log.error('IPC', 'app:installUpdate error', error);
      throw error;
    }
  });
  
  /**
   * Get current update state.
   * Useful for checking if an update is downloaded and pending.
   * @returns {Promise<{ updateDownloaded: boolean, updateInfo: object | null }>}
   */
  ipcMain.handle('app:getUpdateState', async () => {
    log.debug('IPC', 'app:getUpdateState called');
    try {
      const service = await getUpdaterService();
      return service.getUpdateState();
    } catch (err) {
      return {
        updateDownloaded: false,
        updateInfo: null,
      };
    }
  });

  log.debug('IPC', 'App handlers registered (including auto-update)');
}

module.exports = { register };
