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
  
  /**
   * Logout - clear all session data (cookies, browser profile).
   * Use when user needs to completely reset authentication state.
   *
   * @returns {Promise<{
   *   success: boolean,
   *   message?: string,
   *   error?: string
   * }>}
   */
  logout: () => ipcRenderer.invoke('auth:logout'),
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
   * Get the app version from main process.
   * @returns {Promise<string>}
   */
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  /**
   * Get user data path (for debugging).
   */
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  
  /**
   * Get environment configuration.
   * @returns {Promise<{ ENV: string, DEBUG_LOGS: boolean, SHOW_DEVTOOLS: boolean, LOG_LEVEL: string }>}
   */
  getEnvConfig: () => ipcRenderer.invoke('app:getEnvConfig'),
  
  // ─── Auto-Update API ───
  
  /**
   * Check for updates.
   * Returns immediately with no update in dev mode.
   * @returns {Promise<{ updateAvailable: boolean, info?: UpdateInfo, error?: string }>}
   */
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  
  /**
   * Install the downloaded update and restart the app.
   * Only works if an update has been downloaded.
   * @returns {Promise<void>}
   */
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  
  /**
   * Get current update state.
   * @returns {Promise<{ updateDownloaded: boolean, updateInfo: UpdateInfo | null }>}
   */
  getUpdateState: () => ipcRenderer.invoke('app:getUpdateState'),
  
  /**
   * Subscribe to update-downloaded events.
   * Called when an update has been downloaded and is ready to install.
   * @param {(info: UpdateInfo) => void} callback - Handler for update info
   * @returns {() => void} Unsubscribe function
   */
  onUpdateDownloaded: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('app:update-downloaded', handler);
    return () => ipcRenderer.removeListener('app:update-downloaded', handler);
  },
};

// ============================================================================
// THEME API
// ============================================================================

const themeAPI = {
  /**
   * Get current theme mode and effective dark-color state.
   * @returns {Promise<{ mode: 'dark'|'light'|'system', shouldUseDarkColors: boolean }>}
   */
  getMode: () => ipcRenderer.invoke('theme:getMode'),

  /**
   * Set theme from renderer.
   * @param {'dark'|'light'|'system'} mode
   * @returns {Promise<{ success: boolean, mode?: string, error?: string }>}
   */
  setMode: (mode) => ipcRenderer.invoke('theme:setMode', mode),

  /**
   * Subscribe to theme changes triggered from the native menu.
   * @param {Function} callback - Called with { mode, shouldUseDarkColors }
   * @returns {Function} Unsubscribe function
   */
  onChange: (callback) => {
    const handler = (event, payload) => callback(payload);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.removeListener('theme:changed', handler);
  },
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
// SALESFORCE API
// ============================================================================

const salesforceAPI = {
  /**
   * Search for an account by phone, email, or name.
   *
   * Search order: phone → email → name (returns on first match)
   *
   * @param {Object} params
   * @param {string} [params.phone] - Phone number (10 digits)
   * @param {string} [params.email] - Email address
   * @param {string} [params.firstName] - First name
   * @param {string} [params.lastName] - Last name
   * @returns {Promise<{
   *   found: boolean,
   *   accountId?: string,
   *   accountName?: string,
   *   matchedBy?: 'phone' | 'email' | 'name',
   *   error?: string,
   *   message?: string
   * }>}
   */
  searchAccount: (params) => ipcRenderer.invoke('salesforce:searchAccount', params),
  
  /**
   * Create a new Account in Salesforce.
   *
   * Uses the data provided during search step.
   * RecordTypeId is automatically set to FSC Individual.
   *
   * @param {Object} params
   * @param {string} params.firstName - First name
   * @param {string} params.lastName - Last name (required)
   * @param {string} [params.phone] - Phone number (10 digits)
   * @param {string} [params.email] - Email address
   * @returns {Promise<{
   *   success: boolean,
   *   accountId?: string,
   *   accountName?: string,
   *   accountUrl?: string,
   *   error?: string,
   *   message?: string
   * }>}
   */
  createAccount: (params) => ipcRenderer.invoke('salesforce:createAccount', params),
  
  /**
   * Create a complete dossier (Opportunity + Case).
   *
   * Workflow:
   * 1. Create Opportunity linked to Account
   * 2. SF auto-creates Case linked to Opportunity
   * 3. Update Case with additional fields
   *
   * @param {Object} params
   * @param {string} params.accountId - Salesforce Account ID (required)
   * @param {Object} params.opportunityData - Opportunity fields
   * @param {Object} params.caseData - Case fields
   * @returns {Promise<{
   *   success: boolean,
   *   opportunityId?: string,
   *   opportunityUrl?: string,
   *   caseId?: string,
   *   caseUrl?: string,
   *   error?: string,
   *   warning?: string
   * }>}
   */
  createDossier: (params) => ipcRenderer.invoke('salesforce:createDossier', params),
  
  /**
   * Upload documents to OpenText Content Server (xECM).
   *
   * Documents are uploaded to the workspace associated with the Case.
   * Files are uploaded sequentially to avoid rate limiting.
   *
   * @param {Object} params
   * @param {string} params.caseId - Salesforce Case ID (required)
   * @param {Array<{name: string, type: string, size: number, buffer: number[]}>} params.files - Files to upload
   * @returns {Promise<{
   *   success: boolean,
   *   uploadedCount: number,
   *   failedCount: number,
   *   workspaceNodeId?: string,
   *   results: Array<{fileName: string, success: boolean, nodeId?: string, error?: string}>,
   *   error?: string
   * }>}
   */
  uploadDocuments: (params) => ipcRenderer.invoke('salesforce:uploadDocuments', params),
  
  /**
   * Create a Note (ContentNote) linked to a Case.
   *
   * Notes are created as ContentNote objects and linked via ContentDocumentLink.
   * This is optional - if content is empty, should not be called.
   *
   * @param {Object} params
   * @param {string} params.caseId - Salesforce Case ID (required)
   * @param {string} params.title - Note title (optional, defaults to "Note")
   * @param {string} params.content - Plain text content (will be converted to HTML/Base64)
   * @returns {Promise<{
   *   success: boolean,
   *   noteId?: string,
   *   error?: string,
   *   warning?: string
   * }>}
   */
  createNote: (params) => ipcRenderer.invoke('salesforce:createNote', params),
};

// ============================================================================
// EXPOSE TO RENDERER
// ============================================================================

contextBridge.exposeInMainWorld('electronAPI', {
  // Legacy: keep platform and basic methods at root level for backward compat
  platform: appAPI.platform,
  getVersion: () => appAPI.getVersion(),
  getUserDataPath: () => appAPI.getUserDataPath(),
  getEnvConfig: () => appAPI.getEnvConfig(),
  // New: nest all app methods under 'app' for consistent API
  app: appAPI,
  auth: authAPI,
  logs: logsAPI,
  theme: themeAPI,
  salesforce: salesforceAPI,
});

console.log('🚀 cmpDesk preload script loaded');
console.log('   Available APIs: electronAPI.auth.{getStatus, login, ensureSession}');
console.log('   Available APIs: electronAPI.logs.{getBuffer, clear, add, onEntry}');
console.log('   Available APIs: electronAPI.salesforce.{searchAccount, createAccount, createDossier, uploadDocuments, createNote}');
console.log('   Available APIs: electronAPI.theme.{getMode, setMode, onChange}');
console.log('   Available APIs: electronAPI.app.{getVersion, checkForUpdates, installUpdate, getUpdateState, onUpdateDownloaded}');
