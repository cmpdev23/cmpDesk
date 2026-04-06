/**
 * Window Management Module
 * 
 * Handles:
 * - Main window creation
 * - Theme management
 * - Native menu building
 */

const { BrowserWindow, Menu, nativeTheme, app } = require('electron');
const path = require('path');
const { WINDOW_CONFIG, ENV_CONFIG } = require('../config/env');
const { log, setMainWindow } = require('./logger');

// ============================================================================
// STATE
// ============================================================================

let mainWindow = null;

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Apply theme to the application
 * @param {'light'|'dark'|'system'} mode 
 */
function applyTheme(mode) {
  nativeTheme.themeSource = mode;
  log.info('THEME', `Theme applied: ${mode}`);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme:changed', {
      theme: mode,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    });
  }
}

/**
 * Get current theme info
 * @returns {{theme: string, shouldUseDarkColors: boolean}}
 */
function getThemeInfo() {
  return {
    theme: nativeTheme.themeSource,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
}

// ============================================================================
// MENU
// ============================================================================

/**
 * Build the native application menu
 */
function buildMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    {
      label: 'Theme',
      submenu: [
        {
          label: 'Light',
          type: 'radio',
          checked: nativeTheme.themeSource === 'light',
          click: () => applyTheme('light'),
        },
        {
          label: 'Dark',
          type: 'radio',
          checked: nativeTheme.themeSource === 'dark',
          click: () => applyTheme('dark'),
        },
        {
          label: 'System',
          type: 'radio',
          checked: nativeTheme.themeSource === 'system',
          click: () => applyTheme('system'),
        },
      ],
    },
  ];

  // Add Dev menu in development
  if (ENV_CONFIG.isDev || ENV_CONFIG.DEVTOOLS) {
    template.push({
      label: 'Dev',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: isMac ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          },
        },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  log.debug('MENU', 'Application menu built');
}

// ============================================================================
// WINDOW CREATION
// ============================================================================

/**
 * Create the main application window
 * @returns {BrowserWindow}
 */
function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);
  
  // Set window reference in logger
  setMainWindow(mainWindow);
  
  // Load the app
  if (ENV_CONFIG.isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  // Open DevTools in development
  if (ENV_CONFIG.DEVTOOLS || (ENV_CONFIG.isDev && process.env.DEVTOOLS !== 'false')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log.info('SYSTEM', 'Window created', {
    width: WINDOW_CONFIG.width,
    height: WINDOW_CONFIG.height,
    devTools: ENV_CONFIG.DEVTOOLS,
  });

  return mainWindow;
}

/**
 * Get the main window instance
 * @returns {BrowserWindow|null}
 */
function getMainWindow() {
  return mainWindow;
}

/**
 * Focus the main window or create it if it doesn't exist
 */
function focusOrCreateWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  } else {
    createWindow();
    buildMenu();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createWindow,
  getMainWindow,
  focusOrCreateWindow,
  buildMenu,
  applyTheme,
  getThemeInfo,
};
