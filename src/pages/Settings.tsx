/**
 * Settings page for cmpDesk
 *
 * Shows:
 * - Application version
 * - Update status and controls
 * - Future: other settings
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppUpdate } from "@/hooks/use-app-update";

function Settings() {
  const [appVersion, setAppVersion] = useState<string>("...");
  const {
    updateAvailable,
    updateInfo,
    isChecking,
    error,
    checkForUpdates,
    installUpdate,
  } = useAppUpdate();

  // Get current version on mount
  useEffect(() => {
    if (window.electronAPI?.app) {
      window.electronAPI.app
        .getVersion()
        .then((version) => setAppVersion(version))
        .catch(() => setAppVersion("Inconnu"));
    } else {
      setAppVersion("DEV (non-packaged)");
    }
  }, []);

  return (
    <div className="max-w-2xl p-6 mx-auto">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Paramètres</h1>

      {/* Version & Update Card */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          À propos de cmpDesk
        </h2>

        {/* Current Version */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="font-medium text-foreground">Version actuelle</p>
            <p className="text-sm text-muted-foreground">
              Version installée de l'application
            </p>
          </div>
          <span className="px-3 py-1 font-mono text-sm rounded-md bg-muted text-foreground">
            v{appVersion}
          </span>
        </div>

        {/* Update Status */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-foreground">Mises à jour</p>
              {updateAvailable && updateInfo ? (
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✓ Version {updateInfo.version} disponible et prête à installer
                </p>
              ) : isChecking ? (
                <p className="text-sm text-muted-foreground">
                  Vérification en cours...
                </p>
              ) : error ? (
                <p className="text-sm text-destructive">Erreur: {error}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune mise à jour disponible
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {updateAvailable && updateInfo ? (
              <>
                <Button onClick={installUpdate} variant="default">
                  Installer v{updateInfo.version} et redémarrer
                </Button>
              </>
            ) : (
              <Button
                onClick={checkForUpdates}
                disabled={isChecking}
                variant="secondary"
              >
                {isChecking ? "Vérification..." : "Vérifier les mises à jour"}
              </Button>
            )}
          </div>

          {/* Update Info Details */}
          {updateAvailable && updateInfo && (
            <div className="p-3 mt-4 rounded-md bg-muted">
              <p className="text-sm font-medium text-foreground">
                Nouvelle version: {updateInfo.version}
              </p>
              {updateInfo.releaseDate && (
                <p className="text-xs text-muted-foreground">
                  Date de sortie:{" "}
                  {new Date(updateInfo.releaseDate).toLocaleDateString("fr-CA")}
                </p>
              )}
              {updateInfo.releaseNotes && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Notes de version:
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {updateInfo.releaseNotes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dev Mode Warning */}
        {appVersion === "DEV (non-packaged)" && (
          <div className="p-3 mt-4 border rounded-md border-amber-500/50 bg-amber-500/10">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Mode développement détecté. Les mises à jour automatiques ne
              fonctionnent que dans l'application packagée.
            </p>
          </div>
        )}
      </Card>

      {/* Future Settings Sections */}
      <Card className="p-6 mt-6 opacity-50">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          Autres paramètres
        </h2>
        <p className="text-sm text-muted-foreground">
          Bientôt disponible : préférences utilisateur, configuration Salesforce,
          etc.
        </p>
      </Card>
    </div>
  );
}

export default Settings;
