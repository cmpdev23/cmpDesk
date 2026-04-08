/**
 * Auto-Update Service Module
 * 
 * Handles automatic updates for cmpDesk using electron-updater.
 * 
 * Features:
 * - Check for updates on startup and periodically (every 4 hours)
 * - Download updates in background
 * - Notify renderer when update is ready
 * - Install update on quit or on-demand
 * 
 * Security:
 * - Only works in packaged app (not in dev mode)
 * - Uses HTTPS via GitHub Releases
 * - Verifies file integrity via .blockmap
 */

import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

// ============================================================================
// LOGGER (inline since we use ESM)
// ============================================================================

const LOG_LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };

function formatTimestamp() {
  return new Date().toISOString().slice(11, 23);
}

const log = {
  debug(scope, message, data) {
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.debug(`\x1b[36m${ts} [DEBUG] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.debug(`\x1b[36m${ts} [DEBUG] [${scope}] ${message}\x1b[0m`);
    }
  },
  info(scope, message, data) {
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.info(`\x1b[32m${ts} [INFO ] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.info(`\x1b[32m${ts} [INFO ] [${scope}] ${message}\x1b[0m`);
    }
  },
  warn(scope, message, data) {
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.warn(`\x1b[33m${ts} [WARN ] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.warn(`\x1b[33m${ts} [WARN ] [${scope}] ${message}\x1b[0m`);
    }
  },
  error(scope, message, error) {
    const ts = formatTimestamp();
    if (error !== undefined) {
      console.error(`\x1b[31m${ts} [ERROR] [${scope}] ${message}\x1b[0m`, error);
    } else {
      console.error(`\x1b[31m${ts} [ERROR] [${scope}] ${message}\x1b[0m`);
    }
  },
};

// ============================================================================
// CONFIGURATION
// ============================================================================

// Configure autoUpdater
autoUpdater.autoDownload = true;           // Download automatically when found
autoUpdater.autoInstallOnAppQuit = true;   // Install when user quits app
autoUpdater.allowDowngrade = false;        // Don't allow downgrade
autoUpdater.allowPrerelease = false;       // Ignore pre-releases

// Reference to main window for IPC
let mainWindowRef = null;

// Periodic check interval ID
let periodicCheckInterval = null;

// Update state
let updateDownloaded = false;
let downloadedUpdateInfo = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the updater service.
 * Must be called after app is ready and main window is created.
 * 
 * @param {BrowserWindow} mainWindow - Reference to main window for IPC
 */
export function initializeUpdater(mainWindow) {
  // Skip in dev mode - autoUpdater doesn't work without packaged app
  if (!app.isPackaged) {
    log.debug('UPDATER', 'Skipped - not in packaged app (dev mode)');
    return;
  }
  
  mainWindowRef = mainWindow;
  
  log.info('UPDATER', 'Initializing auto-updater...');
  
  // ─── Event Handlers ───
  
  autoUpdater.on('checking-for-update', () => {
    log.info('UPDATER', 'Checking for updates...');
  });
  
  autoUpdater.on('update-available', (info) => {
    log.info('UPDATER', `Update available: v${info.version}`, {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });
  
  autoUpdater.on('update-not-available', (info) => {
    log.debug('UPDATER', 'App is up to date', {
      currentVersion: app.getVersion(),
      latestVersion: info.version,
    });
  });
  
  autoUpdater.on('download-progress', (progress) => {
    log.debug('UPDATER', `Download progress: ${Math.round(progress.percent)}%`, {
      bytesPerSecond: progress.bytesPerSecond,
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    downloadedUpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || null,
    };
    
    log.info('UPDATER', `Update downloaded: v${info.version}`);
    
    // Notify renderer
    sendUpdateNotification(downloadedUpdateInfo);
  });
  
  autoUpdater.on('error', (error) => {
    log.error('UPDATER', 'Update error', error);
    // Don't show error to user - just log it
    // The next check will retry automatically
  });
  
  log.info('UPDATER', 'Auto-updater initialized');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check for updates.
 * In dev mode, returns immediately with no update.
 * 
 * @returns {Promise<{ updateAvailable: boolean, info?: object }>}
 */
export async function checkForUpdates() {
  // Skip in dev mode
  if (!app.isPackaged) {
    log.debug('UPDATER', 'Skipped check - not in packaged app');
    return { updateAvailable: false };
  }
  
  try {
    log.info('UPDATER', 'Checking for updates...');
    const result = await autoUpdater.checkForUpdates();
    
    if (result?.updateInfo) {
      const currentVersion = app.getVersion();
      const latestVersion = result.updateInfo.version;
      
      // Compare versions to determine if update is available
      const updateAvailable = latestVersion !== currentVersion;
      
      return {
        updateAvailable,
        info: updateAvailable ? {
          version: result.updateInfo.version,
          releaseDate: result.updateInfo.releaseDate,
          releaseNotes: result.updateInfo.releaseNotes || null,
        } : null,
      };
    }
    
    return { updateAvailable: false };
  } catch (error) {
    log.error('UPDATER', 'Check for updates failed', error);
    // Don't throw - just return no update
    return { updateAvailable: false, error: error.message };
  }
}

/**
 * Install the downloaded update.
 * This will quit the app and install the update.
 */
export function installUpdate() {
  if (!updateDownloaded) {
    log.warn('UPDATER', 'No update downloaded - cannot install');
    return;
  }
  
  log.info('UPDATER', 'Installing update and restarting...');
  
  // quitAndInstall will:
  // 1. Close all windows
  // 2. Install the update
  // 3. Restart the app
  autoUpdater.quitAndInstall(
    true,  // isSilent - don't show installer UI
    true   // isForceRunAfter - restart app after install
  );
}

/**
 * Start periodic update checks.
 * Default interval is 4 hours.
 * 
 * @param {number} intervalMs - Check interval in milliseconds (default: 4 hours)
 */
export function startPeriodicCheck(intervalMs = 4 * 60 * 60 * 1000) {
  // Skip in dev mode
  if (!app.isPackaged) {
    log.debug('UPDATER', 'Skipped periodic check setup - not in packaged app');
    return;
  }
  
  // Clear any existing interval
  if (periodicCheckInterval) {
    clearInterval(periodicCheckInterval);
  }
  
  log.info('UPDATER', `Starting periodic update checks every ${intervalMs / (60 * 60 * 1000)} hours`);
  
  periodicCheckInterval = setInterval(() => {
    log.debug('UPDATER', 'Periodic update check triggered');
    checkForUpdates().catch((err) => {
      log.error('UPDATER', 'Periodic check failed', err);
    });
  }, intervalMs);
  
  // Clean up on app quit
  app.on('before-quit', () => {
    if (periodicCheckInterval) {
      clearInterval(periodicCheckInterval);
      periodicCheckInterval = null;
    }
  });
}

/**
 * Get current update state.
 * Useful for renderer to check if an update is pending.
 * 
 * @returns {{ updateDownloaded: boolean, updateInfo: object | null }}
 */
export function getUpdateState() {
  return {
    updateDownloaded,
    updateInfo: downloadedUpdateInfo,
  };
}

/**
 * Get the current app version.
 * 
 * @returns {string}
 */
export function getVersion() {
  return app.getVersion();
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Send update notification to renderer via IPC.
 * 
 * @param {object} info - Update info
 */
function sendUpdateNotification(info) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    log.debug('UPDATER', 'Sending update notification to renderer');
    mainWindowRef.webContents.send('app:update-downloaded', info);
  } else {
    log.warn('UPDATER', 'Cannot notify renderer - main window not available');
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  initializeUpdater,
  checkForUpdates,
  installUpdate,
  startPeriodicCheck,
  getUpdateState,
  getVersion,
};
