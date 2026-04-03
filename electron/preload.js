/**
 * electron/preload.js
 * ===================
 * Preload script for cmpDesk Electron application.
 * 
 * Exposes secure APIs to the renderer process via contextBridge.
 * This is the ONLY way renderer can communicate with main process.
 */

import { contextBridge, ipcRenderer } from 'electron';

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
};

// ============================================================================
// EXPOSE TO RENDERER
// ============================================================================

contextBridge.exposeInMainWorld('electronAPI', {
  ...appAPI,
  auth: authAPI,
});

console.log('🚀 cmpDesk preload script loaded');
console.log('   Available APIs: electronAPI.auth.{getStatus, login, ensureSession}');
