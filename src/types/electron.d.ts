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

// ============================================================================
// ENV CONFIG
// ============================================================================

export interface EnvConfig {
  ENV: 'DEV' | 'PROD';
  DEBUG_LOGS: boolean;
  SHOW_DEVTOOLS: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// LOGS API
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: string;
}

export interface LogsAPI {
  /** Get all buffered log entries from main process */
  getBuffer: () => Promise<LogEntry[]>;
  
  /** Clear the log buffer */
  clear: () => Promise<{ success: boolean }>;
  
  /** Add a log entry from renderer to main process */
  add: (level: LogLevel, scope: string, message: string, data?: unknown) => Promise<{ success: boolean }>;
  
  /** Subscribe to new log entries from main process */
  onEntry: (callback: (entry: LogEntry) => void) => () => void;
}

// ============================================================================
// THEME API
// ============================================================================

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeModeResult {
  mode: ThemeMode;
  shouldUseDarkColors: boolean;
}

export interface ThemeSetResult {
  success: boolean;
  mode?: ThemeMode;
  error?: string;
}

export interface ThemeAPI {
  /** Get the current theme mode and effective dark-color state */
  getMode: () => Promise<ThemeModeResult>;

  /** Set the theme mode programmatically */
  setMode: (mode: ThemeMode) => Promise<ThemeSetResult>;

  /** Subscribe to theme changes triggered from the native menu */
  onChange: (callback: (payload: ThemeModeResult) => void) => () => void;
}

// ============================================================================
// ELECTRON API
// ============================================================================

export interface ElectronAPI {
  platform: 'win32' | 'darwin' | 'linux';
  getVersion: () => string;
  getUserDataPath: () => Promise<string>;
  getEnvConfig: () => Promise<EnvConfig>;
  auth: AuthAPI;
  logs: LogsAPI;
  theme: ThemeAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
