/**
 * @file src/lib/salesforce/types.ts
 * @description TypeScript types for Salesforce operations
 */

// ─── Account Search Types ──────────────────────────────────────────────────────

export interface AccountSearchParams {
  /** Phone number to search (10 digits) */
  phone?: string;
  /** Email address to search */
  email?: string;
  /** Full name to search (firstName + lastName) */
  name?: string;
}

export interface AccountSearchResult {
  /** Whether an account was found */
  found: boolean;
  /** Salesforce Account ID (001...) */
  accountId?: string;
  /** Account name (FirstName + LastName) */
  accountName?: string;
  /** Search method that found the account */
  matchedBy?: 'phone' | 'email' | 'name';
  /** Error message if search failed */
  error?: string;
}

// ─── Aura Client Types ─────────────────────────────────────────────────────────

export interface AuraCredentials {
  context: {
    fwuid: string;
    [key: string]: unknown;
  };
  token: string | null;
}

export interface AuraActionResult {
  success: boolean;
  state?: string;
  recordId?: string;
  returnValue?: unknown;
  error?: string;
  errors?: unknown[];
  httpStatus?: number;
  raw?: unknown;
}
