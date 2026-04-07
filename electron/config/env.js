/**
 * Environment Configuration
 * 
 * Centralized environment variables and configuration constants.
 * This module should be the ONLY place where environment variables are read.
 */

const path = require('path');
const { app } = require('electron');

// ============================================================================
// PATHS
// ============================================================================

const AUTH_DIR = path.join(__dirname, '..', '..', 'auth');
const ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'logo.png');
const BROWSER_PROFILE = path.join(AUTH_DIR, 'browser_profile');
const COOKIES_FILE = path.join(AUTH_DIR, 'cookies.json');
const SESSION_FILE = path.join(AUTH_DIR, 'session.json');

// ============================================================================
// ENVIRONMENT
// ============================================================================

const ENV_CONFIG = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  DEVTOOLS: process.env.DEVTOOLS === 'true',
  isProd: app?.isPackaged ?? false,
  isDev: !app?.isPackaged ?? true,
};

// ============================================================================
// AUTH CONFIGURATION
// ============================================================================

const AUTH_TARGET = {
  loginUrl: 'https://cmplan.my.salesforce.com/',
  waitForUrl: 'https://cmplan.lightning.force.com/',
  timeout: 120000,
};

const AUTH_WAIT_CONFIG = {
  checkInterval: 500,
  maxWaitTimeMs: 30000,
  minFwuid: 10,
};

// ============================================================================
// WINDOW CONFIGURATION
// ============================================================================

const WINDOW_CONFIG = {
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  icon: ICON_PATH,
  webPreferences: {
    preload: path.join(__dirname, '..', 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
};

// ============================================================================
// LOG LEVELS
// ============================================================================

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Paths
  AUTH_DIR,
  BROWSER_PROFILE,
  COOKIES_FILE,
  SESSION_FILE,
  ICON_PATH,
  
  // Environment
  ENV_CONFIG,
  
  // Auth
  AUTH_TARGET,
  AUTH_WAIT_CONFIG,
  
  // Window
  WINDOW_CONFIG,
  
  // Logging
  LOG_LEVELS,
};
