/**
 * @file src/hooks/use-app-update.ts
 * @description Hook to manage app update state from Electron main process.
 * 
 * Provides reactive update state for React components:
 * - updateAvailable: true when an update is downloaded and ready
 * - updateInfo: version, release date, notes
 * - isChecking: true while checking for updates
 * - checkForUpdates: manually trigger update check
 * - installUpdate: install and restart the app
 * - dismissUpdate: hide banner (update installs on next quit)
 * 
 * Usage:
 *   const { updateAvailable, updateInfo, installUpdate, dismissUpdate } = useAppUpdate();
 *   if (updateAvailable) return <UpdateBanner />;
 */

import { useState, useEffect, useCallback } from 'react';
import type { UpdateInfo } from '@/types/electron';

export interface UseAppUpdateReturn {
  /** True when an update is downloaded and ready to install */
  updateAvailable: boolean;
  /** Information about the available update */
  updateInfo: UpdateInfo | null;
  /** True while checking for updates */
  isChecking: boolean;
  /** Error message if check failed */
  error: string | null;
  /** Manually check for updates */
  checkForUpdates: () => Promise<void>;
  /** Install the update and restart the app */
  installUpdate: () => Promise<void>;
  /** Dismiss the update banner (update will install on next quit) */
  dismissUpdate: () => void;
}

/**
 * Hook to manage app update notifications.
 * 
 * Listens for the `update-downloaded` event from Electron and provides
 * methods to check for updates, install them, or dismiss the notification.
 * 
 * @returns Update state and control methods
 * 
 * @example
 *   const { updateAvailable, updateInfo, installUpdate, dismissUpdate } = useAppUpdate();
 *   
 *   if (updateAvailable && updateInfo) {
 *     return (
 *       <div>
 *         Version {updateInfo.version} is ready!
 *         <button onClick={installUpdate}>Restart now</button>
 *         <button onClick={dismissUpdate}>Later</button>
 *       </div>
 *     );
 *   }
 */
export function useAppUpdate(): UseAppUpdateReturn {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if running in Electron with app API
  const hasAppAPI = typeof window !== 'undefined' && window.electronAPI?.app;

  // Set up listener for update-downloaded event
  useEffect(() => {
    if (!hasAppAPI) {
      return;
    }

    // Check if there's already a downloaded update on mount
    window.electronAPI.app.getUpdateState()
      .then((state) => {
        if (state.updateDownloaded && state.updateInfo) {
          setUpdateAvailable(true);
          setUpdateInfo(state.updateInfo);
        }
      })
      .catch(() => {
        // Ignore errors - update state check is non-critical
      });

    // Subscribe to update-downloaded events
    const unsubscribe = window.electronAPI.app.onUpdateDownloaded((info) => {
      setUpdateAvailable(true);
      setUpdateInfo(info);
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, [hasAppAPI]);

  // Manually check for updates
  const checkForUpdates = useCallback(async () => {
    if (!hasAppAPI) {
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const result = await window.electronAPI.app.checkForUpdates();
      
      // Log result for debugging
      console.log('[UPDATER] checkForUpdates result:', result);
      
      // Check if service returned an error
      if (result.error) {
        setError(result.error);
        return;
      }
      
      if (result.updateAvailable && result.info) {
        // Update is available - download will happen automatically
        // The onUpdateDownloaded listener will set updateAvailable when ready
        console.log('[UPDATER] Update available:', result.info.version);
      } else {
        console.log('[UPDATER] No update available');
      }
    } catch (e) {
      const err = e as Error;
      console.error('[UPDATER] Exception:', err);
      setError(err.message || 'Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  }, [hasAppAPI]);

  // Install the update and restart
  const installUpdate = useCallback(async () => {
    if (!hasAppAPI) {
      return;
    }

    try {
      await window.electronAPI.app.installUpdate();
      // App will quit and restart - this line may not execute
    } catch (e) {
      const err = e as Error;
      setError(err.message || 'Failed to install update');
    }
  }, [hasAppAPI]);

  // Dismiss the update banner
  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
    // Note: updateInfo is kept in case user wants to restore banner later
  }, []);

  return {
    updateAvailable,
    updateInfo,
    isChecking,
    error,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
  };
}

export default useAppUpdate;
