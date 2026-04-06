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
// SALESFORCE API
// ============================================================================

export interface AccountSearchParams {
  /** Phone number (10 digits) */
  phone?: string;
  /** Email address */
  email?: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
}

/** Single account candidate from search */
export interface AccountCandidate {
  /** Salesforce Account ID (001...) */
  id: string;
  /** Account name (FirstName + LastName) */
  name: string;
  /** Phone number if available */
  phone?: string;
  /** Email if available */
  email?: string;
  /** City if available */
  city?: string;
  /** Match score (for sorting) */
  score?: number;
}

export interface AccountSearchResult {
  /** Whether an account was found */
  found: boolean;
  /** Salesforce Account ID (001...) - first/best match */
  accountId?: string;
  /** Account name (FirstName + LastName) - first/best match */
  accountName?: string;
  /** Search method that found the account */
  matchedBy?: 'phone' | 'email' | 'name';
  /** Multiple candidates when more than one match found (max 5) */
  candidates?: AccountCandidate[];
  /** True if multiple accounts found and user should select */
  multipleResults?: boolean;
  /** Error code if search failed */
  error?: 'SESSION_REQUIRED' | 'CREDENTIALS_CAPTURE_FAILED' | 'BROWSER_PROFILE_LOCKED' | 'SEARCH_ERROR' | 'UNKNOWN';
  /** Human-readable error message */
  message?: string;
}

// ============================================================================
// DOSSIER CREATION
// ============================================================================

export interface CreateDossierOpportunityData {
  /** Opportunity_Category__c - e.g., "Gobal Offer" */
  opportunityCategory?: string;
  /** Product_Interest__c - e.g., "Life Insurance" */
  productInterest?: string;
  /** Subsidiary__c - e.g., "iA" */
  subsidiary?: string;
  /** Proposal_Number__c */
  proposalNumber?: string;
  /** Contract_Number__c */
  contractNumber?: string;
  /** Transaction_Date__c (YYYY-MM-DD) */
  transactionDate?: string;
  /** Annual_Premium__c */
  annualPremium?: string;
}

export interface CreateDossierCaseData {
  /** Product_Family__c - e.g., "Insurance" */
  productFamily?: string;
  /** Transaction_Category__c - e.g., "New Contract" */
  transactionCategory?: string;
  /** Transaction_Sub_Category__c - e.g., "Without Replacement" */
  transactionSubCategory?: string;
  /** SignatureType__c - e.g., "Electronic" */
  signatureType?: string;
  /** CustomersPlaceOfResidence__c - e.g., "Quebec" */
  customersPlaceOfResidence?: string;
  /** ProductType__c - e.g., "Life Insurance" */
  productType?: string;
}

export interface CreateDossierParams {
  /** Salesforce Account ID (001...) - required */
  accountId: string;
  /** Opportunity fields */
  opportunityData: CreateDossierOpportunityData;
  /** Case fields */
  caseData: CreateDossierCaseData;
}

export interface CreateDossierResult {
  /** Whether dossier creation was fully successful */
  success: boolean;
  /** Salesforce Opportunity ID (006...) */
  opportunityId?: string;
  /** URL to the Opportunity in Salesforce */
  opportunityUrl?: string;
  /** Salesforce Case ID (500...) */
  caseId?: string;
  /** URL to the Case in Salesforce */
  caseUrl?: string;
  /** Error message if failed */
  error?: string;
  /** Warning message if partially successful */
  warning?: string;
}

export interface SalesforceAPI {
  /** Search for an account by phone, email, or name */
  searchAccount: (params: AccountSearchParams) => Promise<AccountSearchResult>;
  /** Create a complete dossier (Opportunity + Case) */
  createDossier: (params: CreateDossierParams) => Promise<CreateDossierResult>;
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
  salesforce: SalesforceAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
