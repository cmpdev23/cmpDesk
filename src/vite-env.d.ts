/// <reference types="vite/client" />

// Import electron types from the centralized definition
import type { ElectronAPI } from './types/electron';

// Extend Window interface with electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
