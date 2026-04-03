/**
 * electron/main.js
 * ================
 * Main process for cmpDesk Electron application.
 *
 * Responsibilities:
 * - Window management
 * - IPC handlers for auth operations
 * - Bridge between renderer and Node.js modules (Playwright)
 * - Log management and streaming to renderer
 */

import { app, BrowserWindow, ipcMain, Menu, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// ENVIRONMENT CONFIGURATION (using dotenv)
// ============================================================================

// Load .env file from project root
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

// Try .env first, then .env.example as fallback
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
  console.warn('[env] No .env file found, using .env.example defaults');
}

// Environment config with defaults
const ENV_CONFIG = {
  ENV: process.env.ENV || 'DEV',
  DEBUG_LOGS: process.env.DEBUG_LOGS !== 'false',
  SHOW_DEVTOOLS: process.env.SHOW_DEVTOOLS === 'true',
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
};

// ============================================================================
// LOGGER (Main Process) with Buffer for UI
// ============================================================================

const LOG_LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_LOG_BUFFER_SIZE = 500;

/** In-memory log buffer for UI display */
const logBuffer = [];

/**
 * Check if a log level should be displayed.
 */
function shouldLog(level) {
  // In PROD, only warn and error
  if (ENV_CONFIG.ENV === 'PROD' && (level === 'debug' || level === 'info')) {
    return false;
  }
  // Check DEBUG_LOGS for debug level
  if (level === 'debug' && !ENV_CONFIG.DEBUG_LOGS) {
    return false;
  }
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[ENV_CONFIG.LOG_LEVEL];
}

/**
 * Format timestamp for log output.
 */
function formatTimestamp() {
  return new Date().toISOString().slice(11, 23);
}

/**
 * Add log entry to buffer and send to renderer if window exists.
 */
function addLogEntry(level, scope, message, data) {
  const entry = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    data: data !== undefined ? JSON.stringify(data) : undefined,
  };
  
  logBuffer.push(entry);
  
  // Trim buffer if too large
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_BUFFER_SIZE);
  }
  
  // Send to renderer if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log:entry', entry);
  }
  
  return entry;
}

/**
 * Structured logger for main process.
 */
const log = {
  debug(scope, message, data) {
    if (!shouldLog('debug')) return;
    addLogEntry('debug', scope, message, data);
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.debug(`\x1b[36m${ts} [DEBUG] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.debug(`\x1b[36m${ts} [DEBUG] [${scope}] ${message}\x1b[0m`);
    }
  },
  info(scope, message, data) {
    if (!shouldLog('info')) return;
    addLogEntry('info', scope, message, data);
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.info(`\x1b[32m${ts} [INFO ] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.info(`\x1b[32m${ts} [INFO ] [${scope}] ${message}\x1b[0m`);
    }
  },
  warn(scope, message, data) {
    if (!shouldLog('warn')) return;
    addLogEntry('warn', scope, message, data);
    const ts = formatTimestamp();
    if (data !== undefined) {
      console.warn(`\x1b[33m${ts} [WARN ] [${scope}] ${message}\x1b[0m`, data);
    } else {
      console.warn(`\x1b[33m${ts} [WARN ] [${scope}] ${message}\x1b[0m`);
    }
  },
  error(scope, message, error) {
    if (!shouldLog('error')) return;
    addLogEntry('error', scope, message, error);
    const ts = formatTimestamp();
    if (error !== undefined) {
      console.error(`\x1b[31m${ts} [ERROR] [${scope}] ${message}\x1b[0m`, error);
    } else {
      console.error(`\x1b[31m${ts} [ERROR] [${scope}] ${message}\x1b[0m`);
    }
  },
};

// ============================================================================
// AUTH MODULE IMPORTS (Dynamic import for ES modules)
// ============================================================================

// Cache for auth module functions
let authModule = null;

/**
 * Dynamically import the auth module.
 * This is needed because the auth module uses TypeScript and needs to be
 * compiled first. In production, we'll import from the compiled dist.
 */
async function getAuthModule() {
  if (authModule) return authModule;
  
  try {
    // In development, we need to handle the TypeScript module
    // For now, we'll implement the auth logic directly here
    // In production, this would import from compiled code
    
    const { chromium } = await import('playwright');
    const fs = await import('fs');
    
    // Auth paths configuration
    const AUTH_DIR = path.join(app.getPath('userData'), 'auth');
    const BROWSER_PROFILE = path.join(AUTH_DIR, 'browser_profile');
    const COOKIES_FILE = path.join(AUTH_DIR, 'cookies.json');
    const SESSION_STATE_FILE = path.join(AUTH_DIR, 'session_state.json');
    
    // Auth target configuration (INALCO)
    const AUTH_TARGET = {
      id: 'inalco',
      name: 'INALCO',
      homeUrl: 'https://iaa.secureweb.inalco.com/MKMWPN23/home',
      authCookieNames: ['.ASPXAUTH', 'ee-authenticated'],
      authDomains: ['inalco.com'],
    };
    
    // Ensure directories exist
    function ensureAuthDirectories() {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        log.debug('AUTH', `Created auth directory: ${AUTH_DIR}`);
      }
      if (!fs.existsSync(BROWSER_PROFILE)) {
        fs.mkdirSync(BROWSER_PROFILE, { recursive: true });
        log.debug('AUTH', `Created browser profile: ${BROWSER_PROFILE}`);
      }
    }
    
    // Save cookies to file
    async function saveCookies(context) {
      const cookies = await context.cookies();
      const futureExpiry = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
      const now = Math.floor(Date.now() / 1000);
      
      const seen = new Map();
      for (const cookie of cookies) {
        const key = `${cookie.name}|${cookie.domain || ''}|${cookie.path || '/'}`;
        const cookieCopy = { ...cookie, expires: cookie.expires ?? -1 };
        
        if (cookieCopy.expires === -1) {
          cookieCopy.expires = futureExpiry;
        }
        if (cookieCopy.expires <= now) continue;
        
        seen.set(key, cookieCopy);
      }
      
      const persistedCookies = Array.from(seen.values());
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(persistedCookies, null, 2), 'utf-8');
      log.debug('AUTH', `Saved ${persistedCookies.length} cookies`);
    }
    
    // Restore cookies from file
    async function restoreCookies(context) {
      if (!fs.existsSync(COOKIES_FILE)) {
        log.debug('AUTH', 'No cookies file found');
        return 0;
      }
      
      try {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
        const now = Math.floor(Date.now() / 1000);
        const validCookies = cookies.filter(c => (c.expires ?? 0) > now);
        
        if (validCookies.length === 0) {
          log.debug('AUTH', 'All cookies expired');
          return 0;
        }
        
        await context.addCookies(validCookies);
        log.debug('AUTH', `Restored ${validCookies.length} cookies`);
        return validCookies.length;
      } catch (e) {
        log.warn('AUTH', `Could not restore cookies: ${e.message}`);
        return 0;
      }
    }
    
    // Save session state
    async function saveSessionState(context) {
      await saveCookies(context);
      
      const cookies = await context.cookies();
      const authCookies = cookies.filter(c => AUTH_TARGET.authCookieNames.includes(c.name));
      
      const state = {
        lastValidated: new Date().toISOString(),
        authCookiesPresent: authCookies.length > 0,
        cookieCount: cookies.length,
        domains: [...new Set(cookies.map(c => c.domain || ''))],
      };
      
      fs.writeFileSync(SESSION_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      log.debug('AUTH', 'Session state saved');
    }
    
    // Check if auth cookies are present
    async function hasAuthCookies(context) {
      const cookies = await context.cookies();
      const cookieNames = new Set(cookies.map(c => c.name));
      return AUTH_TARGET.authCookieNames.some(name => cookieNames.has(name));
    }
    
    // Get session status without browser
    function getSessionStatus() {
      const result = {
        isConnected: false,
        cookieCount: 0,
        domains: [],
        lastValidated: null,
        profileExists: fs.existsSync(BROWSER_PROFILE),
        cookiesFileExists: fs.existsSync(COOKIES_FILE),
        sessionAgeHours: Infinity,
      };
      
      // Check session state file
      if (fs.existsSync(SESSION_STATE_FILE)) {
        try {
          const state = JSON.parse(fs.readFileSync(SESSION_STATE_FILE, 'utf-8'));
          result.lastValidated = state.lastValidated;
          result.isConnected = state.authCookiesPresent || false;
          
          if (state.lastValidated) {
            const lastValidated = new Date(state.lastValidated).getTime();
            result.sessionAgeHours = (Date.now() - lastValidated) / (1000 * 60 * 60);
          }
        } catch (e) {
          log.warn('AUTH', `Could not load session state: ${e.message}`);
        }
      }
      
      // Check cookies file for more accurate count
      if (fs.existsSync(COOKIES_FILE)) {
        try {
          const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
          const now = Math.floor(Date.now() / 1000);
          const validCookies = cookies.filter(c => (c.expires ?? 0) > now);
          result.cookieCount = validCookies.length;
          result.domains = [...new Set(validCookies.map(c => c.domain || ''))];
          
          // Check if auth cookies are still valid
          const hasValidAuth = validCookies.some(c => AUTH_TARGET.authCookieNames.includes(c.name));
          if (!hasValidAuth) {
            result.isConnected = false;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Mark as disconnected if session is too old (> 24h)
      if (result.sessionAgeHours > 24) {
        result.isConnected = false;
      }
      
      return result;
    }
    
    // Login function - opens browser for authentication
    async function login(forceAuth = false) {
      ensureAuthDirectories();
      
      log.info('AUTH', 'Starting login flow...');
      log.debug('AUTH', `Browser profile: ${BROWSER_PROFILE}`);
      
      let context;
      try {
        context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
          headless: false,
          viewport: { width: 1280, height: 900 },
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
        });
      } catch (e) {
        if (e.message.includes('lock') || e.message.includes('already in use')) {
          log.warn('AUTH', 'Browser profile locked - another instance is open');
          return {
            success: false,
            error: 'BROWSER_PROFILE_LOCKED',
            message: 'Une autre instance du navigateur est déjà ouverte. Fermez-la et réessayez.',
          };
        }
        throw e;
      }
      
      // Restore cookies
      await restoreCookies(context);
      
      const page = context.pages()[0] || await context.newPage();
      
      // Check if we need to authenticate
      const needsAuth = forceAuth || !(await hasAuthCookies(context));
      
      if (!needsAuth) {
        log.info('AUTH', 'Session already authenticated');
        await saveSessionState(context);
        await context.close();
        return { success: true, message: 'Session déjà authentifiée' };
      }
      
      // Navigate to login page
      log.info('AUTH', 'Authentication required - navigating to login...');
      await page.goto(AUTH_TARGET.homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for authentication (max 3 minutes)
      log.info('AUTH', 'Waiting for authentication (timeout: 180s)...');
      const startTime = Date.now();
      const timeoutMs = 180 * 1000;
      
      while (Date.now() - startTime < timeoutMs) {
        if (await hasAuthCookies(context)) {
          log.info('AUTH', 'Authentication successful!');
          await saveSessionState(context);
          await context.close();
          return { success: true, message: 'Connexion réussie!' };
        }
        await page.waitForTimeout(2000);
      }
      
      // Timeout
      log.error('AUTH', 'Authentication timeout');
      await context.close();
      return {
        success: false,
        error: 'AUTH_TIMEOUT',
        message: 'Délai d\'authentification dépassé (180 secondes)',
      };
    }
    
    // Ensure session is valid, trigger login if needed
    async function ensureSession() {
      const status = getSessionStatus();
      
      if (status.isConnected && status.sessionAgeHours < 12) {
        return { success: true, needsLogin: false, status };
      }
      
      // Session expired or not present - trigger login
      const loginResult = await login(false);
      return {
        success: loginResult.success,
        needsLogin: true,
        status: getSessionStatus(),
        loginResult,
      };
    }
    
    authModule = {
      getSessionStatus,
      login,
      ensureSession,
      AUTH_DIR,
      BROWSER_PROFILE,
    };
    
    return authModule;
  } catch (e) {
    log.error('AUTH', 'Failed to initialize auth module', e);
    throw e;
  }
}

// ============================================================================
// WINDOW CONFIGURATION
// ============================================================================

const WINDOW_CONFIG = {
  width: 1200,
  height: 800,
  resizable: false,
  center: true,
  backgroundColor: '#0B0F14',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
  },
};

let mainWindow = null;

// ============================================================================
// NATIVE MENU — View > Theme
// ============================================================================

/**
 * Apply a theme mode: 'dark' | 'light' | 'system'
 * Sets nativeTheme.themeSource and notifies the renderer via IPC.
 */
function applyTheme(mode) {
  nativeTheme.themeSource = mode; // 'dark' | 'light' | 'system'
  log.info('SYSTEM', `Theme changed to: ${mode}`);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme:changed', {
      mode,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    });
  }
  
  // Rebuild menu to update checkmarks
  buildMenu();
}

/**
 * Build and set the application menu with a View > Theme submenu.
 */
function buildMenu() {
  const currentSource = nativeTheme.themeSource; // 'dark' | 'light' | 'system'
  
  const template = [
    {
      label: 'Vue',
      submenu: [
        {
          label: 'Thème sombre',
          type: 'radio',
          checked: currentSource === 'dark',
          click: () => applyTheme('dark'),
        },
        {
          label: 'Thème clair',
          type: 'radio',
          checked: currentSource === 'light',
          click: () => applyTheme('light'),
        },
        {
          label: 'Thème système',
          type: 'radio',
          checked: currentSource === 'system',
          click: () => applyTheme('system'),
        },
      ],
    },
  ];
  
  // In development also expose DevTools toggle
  if (ENV_CONFIG.ENV !== 'PROD') {
    template.push({
      label: 'Développement',
      submenu: [
        {
          label: 'DevTools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
        { role: 'reload' },
        { role: 'forceReload' },
      ],
    });
  }
  
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // DevTools controlled by SHOW_DEVTOOLS env variable
  if (ENV_CONFIG.SHOW_DEVTOOLS) {
    mainWindow.webContents.openDevTools();
    log.debug('SYSTEM', 'DevTools opened (SHOW_DEVTOOLS=true)');
  }

  // Build the native menu with View > Theme
  buildMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  log.info('SYSTEM', 'Window created', {
    env: ENV_CONFIG.ENV,
    devTools: ENV_CONFIG.SHOW_DEVTOOLS,
    logLevel: ENV_CONFIG.LOG_LEVEL
  });
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

// ─── Theme ───────────────────────────────────────────────────────────────────

// Get the current theme mode and effective dark-colors state
ipcMain.handle('theme:getMode', () => {
  return {
    mode: nativeTheme.themeSource,          // 'dark' | 'light' | 'system'
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
});

// Set theme from renderer (e.g. a toggle button in the UI)
ipcMain.handle('theme:setMode', (event, mode) => {
  if (!['dark', 'light', 'system'].includes(mode)) {
    return { success: false, error: `Invalid theme mode: ${mode}` };
  }
  applyTheme(mode);
  return { success: true, mode };
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Get session status (quick check, no browser)
ipcMain.handle('auth:getStatus', async () => {
  try {
    const auth = await getAuthModule();
    return auth.getSessionStatus();
  } catch (e) {
    log.error('IPC', 'auth:getStatus error', e);
    return {
      isConnected: false,
      error: e.message,
    };
  }
});

// Login - opens browser for authentication
ipcMain.handle('auth:login', async (event, forceAuth = false) => {
  try {
    log.debug('IPC', 'auth:login called', { forceAuth });
    const auth = await getAuthModule();
    return await auth.login(forceAuth);
  } catch (e) {
    log.error('IPC', 'auth:login error', e);
    return {
      success: false,
      error: 'UNKNOWN',
      message: e.message,
    };
  }
});

// Ensure session is valid
ipcMain.handle('auth:ensureSession', async () => {
  try {
    log.debug('IPC', 'auth:ensureSession called');
    const auth = await getAuthModule();
    return await auth.ensureSession();
  } catch (e) {
    log.error('IPC', 'auth:ensureSession error', e);
    return {
      success: false,
      error: 'UNKNOWN',
      message: e.message,
    };
  }
});

// Get user data path (for debugging)
ipcMain.handle('app:getUserDataPath', () => {
  return app.getPath('userData');
});

// Get environment config (for UI conditional display)
ipcMain.handle('app:getEnvConfig', () => {
  return ENV_CONFIG;
});

// ============================================================================
// LOG IPC HANDLERS
// ============================================================================

// Get all buffered logs
ipcMain.handle('logs:getBuffer', () => {
  return logBuffer;
});

// Clear log buffer
ipcMain.handle('logs:clear', () => {
  logBuffer.length = 0;
  log.debug('SYSTEM', 'Log buffer cleared');
  return { success: true };
});

// Add log from renderer process
ipcMain.handle('logs:add', (event, { level, scope, message, data }) => {
  if (log[level]) {
    log[level](scope, message, data);
  }
  return { success: true };
});

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(() => {
  log.info('SYSTEM', 'App ready', {
    version: app.getVersion(),
    userData: app.getPath('userData'),
    env: ENV_CONFIG.ENV
  });
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.debug('SYSTEM', 'All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
