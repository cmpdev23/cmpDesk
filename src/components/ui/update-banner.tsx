/**
 * @file src/components/ui/update-banner.tsx
 * @description Banner component to notify users when an app update is ready.
 * 
 * Displays a non-blocking banner at the top of the viewport when an update
 * has been downloaded. Offers "Restart now" and "Later" actions.
 * 
 * Design:
 * - Fixed position below header
 * - Blue accent background (bg-blue-600)
 * - White text showing version number
 * - Two buttons: Restart now (primary), Later (ghost)
 * - Smooth transitions for enter/exit
 * 
 * Usage:
 *   // Place at top of layout - self-manages visibility
 *   <UpdateBanner />
 */

import { useAppUpdate } from '@/hooks/use-app-update';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Update notification banner component.
 * 
 * Self-contained: uses useAppUpdate hook internally to manage state.
 * Renders nothing when no update is available.
 */
export function UpdateBanner() {
  const { updateAvailable, updateInfo, installUpdate, dismissUpdate } = useAppUpdate();

  // Don't render if no update available
  if (!updateAvailable || !updateInfo) {
    return null;
  }

  return (
    <div
      className={cn(
        // Layout
        'flex items-center justify-center gap-4 px-4',
        // Sizing
        'w-full h-12 shrink-0',
        // Colors
        'bg-blue-600 text-white',
        // Animation
        'animate-in slide-in-from-top-2 duration-300',
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Message */}
      <span className="text-sm font-medium">
        Version {updateInfo.version} is ready to install
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={installUpdate}
          className="bg-white/20 hover:bg-white/30 text-white border-0 h-7 px-3 text-xs font-medium"
        >
          Restart now
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismissUpdate}
          className="text-white/80 hover:text-white hover:bg-white/10 h-7 px-3 text-xs"
        >
          Later
        </Button>
      </div>
    </div>
  );
}

export default UpdateBanner;
