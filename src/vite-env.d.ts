/// <reference types="vite/client" />

// Types pour l'API Electron exposée via preload
interface Window {
  electronAPI: {
    platform: string;
    getVersion: () => string;
  };
}
