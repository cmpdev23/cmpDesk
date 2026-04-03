import { contextBridge, ipcRenderer } from 'electron';

// Expose des APIs sécurisées au renderer process
// Pour l'instant, on expose juste la version de l'app
contextBridge.exposeInMainWorld('electronAPI', {
  // Plateforme
  platform: process.platform,
  
  // Version de l'app (sera utilisée plus tard)
  getVersion: () => '0.1.0',
  
  // Placeholder pour les futures fonctions IPC
  // invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  // on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),
});

console.log('🚀 cmpDesk preload script loaded');
