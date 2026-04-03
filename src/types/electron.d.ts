/**
 * TypeScript declarations for the Electron API exposed via preload.
 *
 * This file provides type safety for window.electronAPI.
 */

/* eslint-disable @typescript-eslint/no-empty-interface */

export interface AuthStatus {
  isConnected: boolean;
  cookieCount: number;
  domains: string[];
  lastValidated: string | null;
  profileExists: boolean;
  cookiesFileExists: boolean;
  sessionAgeHours: number;
  error?: string;
}

export interface LoginResult {
  success: boolean;
  error?: 'BROWSER_PROFILE_LOCKED' | 'AUTH_TIMEOUT' | 'UNKNOWN';
  message?: string;
}

export interface EnsureSessionResult {
  success: boolean;
  needsLogin: boolean;
  status: AuthStatus;
  loginResult?: LoginResult;
}

export interface AuthAPI {
  getStatus: () => Promise<AuthStatus>;
  login: (forceAuth?: boolean) => Promise<LoginResult>;
  ensureSession: () => Promise<EnsureSessionResult>;
}

export interface ElectronAPI {
  platform: 'win32' | 'darwin' | 'linux';
  getVersion: () => string;
  getUserDataPath: () => Promise<string>;
  auth: AuthAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
