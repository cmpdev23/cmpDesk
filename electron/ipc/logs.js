/**
 * Logs IPC Handlers
 * 
 * Handles log-related IPC communication.
 */

const { ipcMain } = require('electron');
const { log, getLogBuffer, clearLogBuffer } = require('../lib/logger');

/**
 * Register log IPC handlers
 */
function register() {
  // Get all buffered logs
  ipcMain.handle('logs:getAll', async () => {
    return {
      success: true,
      logs: getLogBuffer(),
    };
  });

  // Clear log buffer
  ipcMain.handle('logs:clear', async () => {
    clearLogBuffer();
    return { success: true };
  });

  // Log from renderer process
  ipcMain.handle('logs:write', async (_, { level, scope, message, data }) => {
    if (log[level]) {
      log[level](scope || 'RENDERER', message, data);
    }
    return { success: true };
  });

  log.debug('IPC', 'Log handlers registered');
}

module.exports = { register };
