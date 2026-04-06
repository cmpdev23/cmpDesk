/**
 * Theme IPC Handlers
 * 
 * Handles theme-related IPC communication.
 */

const { ipcMain } = require('electron');
const { log } = require('../lib/logger');
const { applyTheme, getThemeInfo } = require('../lib/window');

/**
 * Register theme IPC handlers
 */
function register() {
  // Get current theme
  ipcMain.handle('theme:get', async () => {
    return {
      success: true,
      ...getThemeInfo(),
    };
  });

  // Set theme
  ipcMain.handle('theme:set', async (_, { mode }) => {
    if (!['light', 'dark', 'system'].includes(mode)) {
      return {
        success: false,
        message: 'Invalid theme mode',
      };
    }
    
    applyTheme(mode);
    return {
      success: true,
      ...getThemeInfo(),
    };
  });

  log.debug('IPC', 'Theme handlers registered');
}

module.exports = { register };
