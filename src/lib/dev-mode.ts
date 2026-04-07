/**
 * @file src/lib/dev-mode.ts
 * @description Centralized DEV mode utilities for cmpDesk
 *
 * This module provides a single source of truth for DEV mode checks.
 * DEV mode is determined by the ENV variable in .env file (not Vite's import.meta.env.DEV).
 *
 * DEV mode features:
 * - Form validation bypass: Can navigate through form steps without filling fields
 * - Debug panels: Extra debugging information visible
 * - API mocking: (future) Mock API responses
 *
 * @see .env.example for environment configuration
 */

import type { EnvConfig } from '@/types/electron';

// ─── Cache ────────────────────────────────────────────────────────────────────

let cachedEnvConfig: EnvConfig | null = null;
let configPromise: Promise<EnvConfig> | null = null;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Fetch environment config from Electron main process.
 * Results are cached to avoid repeated IPC calls.
 *
 * @returns Promise<EnvConfig> - The environment configuration
 */
export async function getEnvConfig(): Promise<EnvConfig> {
  // Return cached value if available
  if (cachedEnvConfig) {
    return cachedEnvConfig;
  }

  // Reuse existing promise if fetch is in progress
  if (configPromise) {
    return configPromise;
  }

  // Fetch from Electron
  configPromise = window.electronAPI
    .getEnvConfig()
    .then((config) => {
      cachedEnvConfig = config;
      return config;
    })
    .catch((error) => {
      console.warn('[dev-mode] Failed to fetch env config, defaulting to PROD:', error);
      // Default to PROD for safety if fetch fails
      const defaultConfig: EnvConfig = {
        ENV: 'PROD',
        DEBUG_LOGS: false,
        SHOW_DEVTOOLS: false,
        LOG_LEVEL: 'info',
      };
      cachedEnvConfig = defaultConfig;
      return defaultConfig;
    })
    .finally(() => {
      configPromise = null;
    });

  return configPromise;
}

/**
 * Check if DEV mode is enabled (async).
 * Uses the ENV variable from .env file.
 *
 * @returns Promise<boolean> - True if ENV=DEV
 */
export async function isDevMode(): Promise<boolean> {
  const config = await getEnvConfig();
  return config.ENV === 'DEV';
}

/**
 * Get cached DEV mode status (sync).
 * Returns false if config hasn't been fetched yet.
 * Use this only after initial config has been loaded.
 *
 * @returns boolean - True if ENV=DEV (or false if not yet loaded)
 */
export function isDevModeSync(): boolean {
  return cachedEnvConfig?.ENV === 'DEV' || false;
}

/**
 * Get cached ENV config (sync).
 * Returns null if config hasn't been fetched yet.
 *
 * @returns EnvConfig | null
 */
export function getEnvConfigSync(): EnvConfig | null {
  return cachedEnvConfig;
}

// ─── DEV Mode Validation Helpers ──────────────────────────────────────────────

/**
 * Form data type - any object with string-like values (form fields)
 * Using a generic constraint that works with specific interfaces
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormDataLike = { [key: string]: any };

/**
 * Check if a form data object is completely empty (all values are empty/falsy strings).
 *
 * @param data - Form data object to check
 * @returns boolean - True if all fields are empty
 */
export function isFormDataEmpty<T extends FormDataLike>(data: T): boolean {
  return Object.values(data).every((value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return !value.trim();
    if (typeof value === 'number') return false; // Numbers are considered filled
    if (typeof value === 'boolean') return false; // Booleans are considered filled
    return true;
  });
}

/**
 * Determine if form validation should be bypassed.
 *
 * DEV mode bypass rules:
 * - If ENV=DEV AND the form is completely empty → bypass validation
 * - If ENV=DEV AND some fields are filled → enforce validation (partial data = user intent)
 * - If ENV=PROD → always enforce validation
 *
 * This allows developers to click "Next" through empty forms for debugging,
 * while still validating when they actually enter data.
 *
 * @param data - Form data object to check
 * @returns boolean - True if validation should be skipped
 */
export function shouldBypassValidation<T extends FormDataLike>(data: T): boolean {
  // Must be in DEV mode
  if (!isDevModeSync()) {
    return false;
  }

  // Bypass only if form is completely empty
  return isFormDataEmpty(data);
}

/**
 * Check if the "Next" button should be enabled.
 *
 * In PROD mode: Button enabled only when required fields are complete.
 * In DEV mode: Button always enabled (can navigate freely).
 *
 * @param isStepComplete - Whether the step's required fields are filled
 * @returns boolean - True if button should be enabled
 */
export function shouldEnableNextButton(isStepComplete: boolean): boolean {
  // In DEV mode, always enable navigation
  if (isDevModeSync()) {
    return true;
  }

  // In PROD mode, respect the step completion status
  return isStepComplete;
}

// ─── Pre-fetch on Module Load ─────────────────────────────────────────────────

// Start fetching config immediately when this module is imported.
// This ensures the config is available quickly for sync checks.
if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getEnvConfig === 'function') {
  getEnvConfig().catch(() => {
    // Silently ignore - getEnvConfig already handles errors
  });
}
