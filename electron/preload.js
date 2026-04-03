/**
 * electron/preload.js
 * ===================
 * Preload script for cmpDesk Electron application.
 * 
 * Exposes secure APIs to the renderer process via contextBridge.
 * This is the ONLY way renderer can communicate with main process.
 * 
 * NOTE: Preload scripts MUST use CommonJS (require), not ESM (import).
 * Electron preload context does not support ESM modules.
 */

const { contextBridge, ipcRenderer } = require('electron');

// ============================================================================
// AUTH API
// ============================================================================

const authAPI = {
  /**
   * Get current session status (quick check, no browser).
   * 
   * @returns {Promise<{
   *   isConnected: boolean,
   *   cookieCount: number,
   *   domains: string[],
   *   lastValidated: string | null,
   *   profileExists: boolean,
   *   cookiesFileExists: boolean,
   *   sessionAgeHours: number,
   *   error?: string
   * }>}
   */
  getStatus: () => ipcRenderer.invoke('auth:getStatus'),
  
  /**
   * Start login flow - opens browser for authentication.
   * 
   * @param {boolean} forceAuth - Force re-authentication even if session seems valid
   * @returns {Promise<{
   *   success: boolean,
   *   error?: string,
   *   message?: string
   * }>}
   */
  login: (forceAuth = false) => ipcRenderer.invoke('auth:login', forceAuth),
  
  /**
   * Ensure session is valid, trigger login if needed.
   * 
   * @returns {Promise<{
   *   success: boolean,
   *   needsLogin: boolean,
   *   status: object,
   *   loginResult?: object
   * }>}
   */
  ensureSession: () => ipcRenderer.invoke('auth:ensureSession'),
};

// ============================================================================
// APP API
// ============================================================================

const appAPI = {
  /**
   * Get the platform (win32, darwin, linux).
   */
  platform: process.platform,
  
  /**
   * Get the app version.
   */
  getVersion: () => '0.1.0',
  
  /**
   * Get user data path (for debugging).
   */
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  
  /**
   * Get environment configuration.
   * @returns {Promise<{ ENV: string, DEBUG_LOGS: boolean, SHOW_DEVTOOLS: boolean, LOG_LEVEL: string }>}
   */
  getEnvConfig: () => ipcRenderer.invoke('app:getEnvConfig'),
};

// ============================================================================
// LOGS API
// ============================================================================

const logsAPI = {
  /**
   * Get all buffered log entries from main process.
   * @returns {Promise<Array<{ id: string, timestamp: string, level: string, scope: string, message: string, data?: string }>>}
   */
  getBuffer: () => ipcRenderer.invoke('logs:getBuffer'),
  
  /**
   * Clear the log buffer.
   * @returns {Promise<{ success: boolean }>}
   */
  clear: () => ipcRenderer.invoke('logs:clear'),
  
  /**
   * Add a log entry from renderer to main process.
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} scope - Log scope (AUTH, API, etc.)
   * @param {string} message - Log message
   * @param {any} data - Optional data
   * @returns {Promise<{ success: boolean }>}
   */
  add: (level, scope, message, data) =>
    ipcRenderer.invoke('logs:add', { level, scope, message, data }),
  
  /**
   * Subscribe to new log entries from main process.
   * @param {Function} callback - Called with each new log entry
   * @returns {Function} Unsubscribe function
   */
  onEntry: (callback) => {
    const handler = (event, entry) => callback(entry);
    ipcRenderer.on('log:entry', handler);
    return () => ipcRenderer.removeListener('log:entry', handler);
  },
};

// ============================================================================
// EXPOSE TO RENDERER
// ============================================================================

contextBridge.exposeInMainWorld('electronAPI', {
  ...appAPI,
  auth: authAPI,
  logs: logsAPI,
});

console.log('🚀 cmpDesk preload script loaded');
console.log('   Available APIs: electronAPI.auth.{getStatus, login, ensureSession}');
console.log('   Available APIs: electronAPI.logs.{getBuffer, clear, add, onEntry}');
