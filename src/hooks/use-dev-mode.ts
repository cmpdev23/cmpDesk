/**
 * @file src/hooks/use-dev-mode.ts
 * @description React hook for DEV mode state management
 *
 * Provides reactive access to DEV mode configuration from Electron.
 * The hook fetches the config on mount and caches it for subsequent renders.
 *
 * Usage:
 * ```tsx
 * const { isDevMode, isLoading, shouldBypassValidation } = useDevMode();
 *
 * // In validation
 * if (shouldBypassValidation(formData)) {
 *   // Skip validation in DEV mode with empty form
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import type { EnvConfig } from '@/types/electron';
import {
  getEnvConfig,
  isFormDataEmpty,
} from '@/lib/dev-mode';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Form data type - any object with string-like values (form fields)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormDataLike = { [key: string]: any };

export interface UseDevModeResult {
  /** Whether DEV mode is enabled (ENV=DEV in .env) */
  isDevMode: boolean;
  /** Whether the config is still being fetched */
  isLoading: boolean;
  /** Full environment config */
  envConfig: EnvConfig | null;
  /** Check if validation should be bypassed for given form data */
  shouldBypassValidation: <T extends FormDataLike>(data: T) => boolean;
  /** Check if the "Next" button should be enabled */
  shouldEnableNextButton: (isStepComplete: boolean) => boolean;
  /** Check if form data is completely empty */
  isFormDataEmpty: <T extends FormDataLike>(data: T) => boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * React hook for DEV mode state management.
 *
 * Features:
 * - Fetches ENV config from Electron on mount
 * - Provides sync helpers for validation bypass
 * - Caches config to avoid repeated IPC calls
 *
 * @returns UseDevModeResult - DEV mode state and helpers
 */
export function useDevMode(): UseDevModeResult {
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch config on mount
  useEffect(() => {
    let mounted = true;

    getEnvConfig()
      .then((config) => {
        if (mounted) {
          setEnvConfig(config);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Derived state
  const isDevMode = envConfig?.ENV === 'DEV';

  // Memoized helpers
  const shouldBypassValidation = useCallback(
    <T extends FormDataLike>(data: T): boolean => {
      if (!isDevMode) return false;
      return isFormDataEmpty(data);
    },
    [isDevMode]
  );

  const shouldEnableNextButton = useCallback(
    (isStepComplete: boolean): boolean => {
      if (isDevMode) return true;
      return isStepComplete;
    },
    [isDevMode]
  );

  return {
    isDevMode,
    isLoading,
    envConfig,
    shouldBypassValidation,
    shouldEnableNextButton,
    isFormDataEmpty,
  };
}

export default useDevMode;
