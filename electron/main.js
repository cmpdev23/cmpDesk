/**
 * electron/main.js
 * ================
 * Main process for cmpDesk Electron application.
 * 
 * Responsibilities:
 * - Window management
 * - IPC handlers for auth operations
 * - Bridge between renderer and Node.js modules (Playwright)
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        console.log(`[auth] Created auth directory: ${AUTH_DIR}`);
      }
      if (!fs.existsSync(BROWSER_PROFILE)) {
        fs.mkdirSync(BROWSER_PROFILE, { recursive: true });
        console.log(`[auth] Created browser profile: ${BROWSER_PROFILE}`);
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
      console.log(`[auth] Saved ${persistedCookies.length} cookies`);
    }
    
    // Restore cookies from file
    async function restoreCookies(context) {
      if (!fs.existsSync(COOKIES_FILE)) {
        console.log('[auth] No cookies file found');
        return 0;
      }
      
      try {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
        const now = Math.floor(Date.now() / 1000);
        const validCookies = cookies.filter(c => (c.expires ?? 0) > now);
        
        if (validCookies.length === 0) {
          console.log('[auth] All cookies expired');
          return 0;
        }
        
        await context.addCookies(validCookies);
        console.log(`[auth] Restored ${validCookies.length} cookies`);
        return validCookies.length;
      } catch (e) {
        console.warn(`[auth] Could not restore cookies: ${e.message}`);
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
      console.log('[auth] Session state saved');
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
          console.warn(`[auth] Could not load session state: ${e.message}`);
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
      
      console.log('[auth] Starting login flow...');
      console.log(`[auth] Browser profile: ${BROWSER_PROFILE}`);
      
      let context;
      try {
        context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
          headless: false,
          viewport: { width: 1280, height: 900 },
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
        });
      } catch (e) {
        if (e.message.includes('lock') || e.message.includes('already in use')) {
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
        console.log('[auth] Session already authenticated');
        await saveSessionState(context);
        await context.close();
        return { success: true, message: 'Session déjà authentifiée' };
      }
      
      // Navigate to login page
      console.log('[auth] Authentication required - navigating to login...');
      await page.goto(AUTH_TARGET.homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for authentication (max 3 minutes)
      console.log('[auth] Waiting for authentication (timeout: 180s)...');
      const startTime = Date.now();
      const timeoutMs = 180 * 1000;
      
      while (Date.now() - startTime < timeoutMs) {
        if (await hasAuthCookies(context)) {
          console.log('[auth] Authentication successful!');
          await saveSessionState(context);
          await context.close();
          return { success: true, message: 'Connexion réussie!' };
        }
        await page.waitForTimeout(2000);
      }
      
      // Timeout
      console.error('[auth] Authentication timeout');
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
    console.error('[auth] Failed to initialize auth module:', e);
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

function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

// Get session status (quick check, no browser)
ipcMain.handle('auth:getStatus', async () => {
  try {
    const auth = await getAuthModule();
    return auth.getSessionStatus();
  } catch (e) {
    console.error('[IPC] auth:getStatus error:', e);
    return {
      isConnected: false,
      error: e.message,
    };
  }
});

// Login - opens browser for authentication
ipcMain.handle('auth:login', async (event, forceAuth = false) => {
  try {
    const auth = await getAuthModule();
    return await auth.login(forceAuth);
  } catch (e) {
    console.error('[IPC] auth:login error:', e);
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
    const auth = await getAuthModule();
    return await auth.ensureSession();
  } catch (e) {
    console.error('[IPC] auth:ensureSession error:', e);
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

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
