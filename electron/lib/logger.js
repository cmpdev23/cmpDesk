/**
 * Logger Module
 * 
 * Centralized logging with:
 * - Level filtering (debug, info, warn, error)
 * - Scoped messages
 * - UI buffer for renderer process
 * - Sensitive data protection
 */

const { ENV_CONFIG, LOG_LEVELS } = require('../config/env');

// ============================================================================
// LOG BUFFER (for UI)
// ============================================================================

const LOG_BUFFER_MAX = 500;
let logBuffer = [];
let mainWindow = null;

/**
 * Set the main window reference for sending logs to renderer
 * @param {BrowserWindow} window 
 */
function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Get all buffered log entries
 * @returns {Array} Log entries
 */
function getLogBuffer() {
  return [...logBuffer];
}

/**
 * Clear the log buffer
 */
function clearLogBuffer() {
  logBuffer = [];
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Check if a log level should be displayed
 * @param {string} level 
 * @returns {boolean}
 */
function shouldLog(level) {
  const configLevel = ENV_CONFIG.LOG_LEVEL.toLowerCase();
  return LOG_LEVELS[level] >= LOG_LEVELS[configLevel];
}

/**
 * Sanitize data to remove sensitive information
 * @param {*} data 
 * @returns {*}
 */
function sanitizeData(data) {
  if (!data) return data;
  
  const sensitiveKeys = ['token', 'cookie', 'password', 'secret', 'fwuid', 'sid'];
  
  if (typeof data === 'object') {
    const sanitized = Array.isArray(data) ? [...data] : { ...data };
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeData(sanitized[key]);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Add a log entry to buffer and send to UI
 * @param {string} level 
 * @param {string} scope 
 * @param {string} message 
 * @param {*} data 
 */
function addLogEntry(level, scope, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    data: sanitizeData(data),
  };
  
  logBuffer.push(entry);
  
  // Keep buffer size manageable
  if (logBuffer.length > LOG_BUFFER_MAX) {
    logBuffer = logBuffer.slice(-LOG_BUFFER_MAX);
  }
  
  // Send to renderer if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('log:entry', entry);
    } catch {
      // Window might be closing, ignore
    }
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

const log = {
  /**
   * Debug level log
   * @param {string} scope - Module/component name
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  debug(scope, message, data) {
    if (shouldLog('debug')) {
      console.log(`[DEBUG][${scope}] ${message}`, data || '');
      addLogEntry('debug', scope, message, data);
    }
  },

  /**
   * Info level log
   * @param {string} scope - Module/component name
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  info(scope, message, data) {
    if (shouldLog('info')) {
      console.log(`[INFO][${scope}] ${message}`, data || '');
      addLogEntry('info', scope, message, data);
    }
  },

  /**
   * Warning level log
   * @param {string} scope - Module/component name
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  warn(scope, message, data) {
    if (shouldLog('warn')) {
      console.warn(`[WARN][${scope}] ${message}`, data || '');
      addLogEntry('warn', scope, message, data);
    }
  },

  /**
   * Error level log
   * @param {string} scope - Module/component name
   * @param {string} message - Log message
   * @param {Error|*} error - Error object or data
   */
  error(scope, message, error) {
    if (shouldLog('error')) {
      console.error(`[ERROR][${scope}] ${message}`, error || '');
      addLogEntry('error', scope, message, error?.message || error);
    }
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  log,
  setMainWindow,
  getLogBuffer,
  clearLogBuffer,
};
