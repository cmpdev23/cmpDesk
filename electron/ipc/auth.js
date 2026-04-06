/**
 * Auth IPC Handlers
 * 
 * Handles authentication-related IPC communication
 * between renderer and main process.
 */

const { ipcMain } = require('electron');
const { log } = require('../lib/logger');
const authService = require('../services/auth');

/**
 * Register auth IPC handlers
 */
function register() {
  // Get auth status
  ipcMain.handle('auth:status', async () => {
    log.debug('IPC', 'auth:status called');
    const status = authService.getStatus();
    return {
      success: true,
      ...status,
    };
  });

  // Perform login
  ipcMain.handle('auth:login', async (_, { force = false } = {}) => {
    log.debug('IPC', 'auth:login called', { force });
    try {
      const result = await authService.login(force);
      return result;
    } catch (error) {
      log.error('IPC', 'auth:login error', error);
      return {
        success: false,
        message: error.message,
      };
    }
  });

  // Ensure session exists
  ipcMain.handle('auth:ensureSession', async () => {
    log.debug('IPC', 'auth:ensureSession called');
    try {
      const result = await authService.ensureSession();
      return {
        success: result.success,
        message: result.success ? 'Session ready' : 'Session failed',
      };
    } catch (error) {
      log.error('IPC', 'auth:ensureSession error', error);
      return {
        success: false,
        message: error.message,
      };
    }
  });

  // Logout / close session
  ipcMain.handle('auth:logout', async () => {
    log.debug('IPC', 'auth:logout called');
    try {
      await authService.closeSession();
      return {
        success: true,
        message: 'Session closed',
      };
    } catch (error) {
      log.error('IPC', 'auth:logout error', error);
      return {
        success: false,
        message: error.message,
      };
    }
  });

  log.debug('IPC', 'Auth handlers registered');
}

module.exports = { register };
