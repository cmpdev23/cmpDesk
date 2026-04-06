/**
 * cmpDesk - Main Process Entry Point
 * 
 * This is the refactored main.js file.
 * All logic has been extracted into dedicated modules:
 * 
 * - config/env.js       → Environment configuration
 * - lib/logger.js       → Logging utilities
 * - lib/window.js       → Window & menu management
 * - services/auth/      → Authentication (Playwright)
 * - services/salesforce → Salesforce Aura API operations
 * - ipc/                → IPC handlers
 * 
 * This file now only handles:
 * 1. App lifecycle (ready, activate, window-all-closed)
 * 2. Module initialization
 * 
 * ~100 lines vs 1779 lines before refactoring
 */

const { app } = require('electron');
const { log } = require('./lib/logger');
const { createWindow, buildMenu, focusOrCreateWindow } = require('./lib/window');
const ipc = require('./ipc');
const authService = require('./services/auth');

// ============================================================================
// APP LIFECYCLE
// ============================================================================

/**
 * Initialize the application
 */
async function initialize() {
  log.info('SYSTEM', 'Initializing cmpDesk...', {
    version: app.getVersion(),
    platform: process.platform,
    node: process.versions.node,
    electron: process.versions.electron,
  });

  // Register all IPC handlers
  ipc.registerAll();

  // Create main window
  createWindow();
  buildMenu();

  log.info('SYSTEM', 'cmpDesk initialized successfully');
}

/**
 * Cleanup before exit
 */
async function cleanup() {
  log.info('SYSTEM', 'Cleaning up...');
  
  try {
    await authService.closeSession();
  } catch (error) {
    log.error('SYSTEM', 'Error during cleanup', error);
  }
  
  log.info('SYSTEM', 'Cleanup complete');
}

// ============================================================================
// APP EVENTS
// ============================================================================

// App ready
app.whenReady().then(initialize);

// macOS: Re-create window when dock icon is clicked
app.on('activate', () => {
  focusOrCreateWindow();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await cleanup();
    app.quit();
  }
});

// Handle app quit
app.on('before-quit', async (event) => {
  // Prevent immediate quit to allow cleanup
  event.preventDefault();
  await cleanup();
  app.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('SYSTEM', 'Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('SYSTEM', 'Unhandled rejection', reason);
});
