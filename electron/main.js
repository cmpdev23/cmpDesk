import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration de la fenêtre
const WINDOW_CONFIG = {
  width: 1200,
  height: 800,
  resizable: false, // Taille fixe
  center: true,
  backgroundColor: '#1a1a1a',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
  },
};

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  // En développement, charger depuis le serveur Vite
  // En production, charger le fichier build
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Ouvrir les DevTools en développement
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Quand Electron est prêt
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // Sur macOS, recréer la fenêtre si le dock est cliqué
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quitter quand toutes les fenêtres sont fermées (sauf macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
