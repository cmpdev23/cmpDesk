/**
 * Page d'accueil de cmpDesk
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AutomationGraphic } from "@/components/home/AutomationGraphic";

function Home() {
  const navigate = useNavigate();
  const [appVersion, setAppVersion] = useState<string>("...");

  useEffect(() => {
    window.electronAPI?.app
      ?.getVersion()
      .then((version) => setAppVersion(version))
      .catch(() => setAppVersion("0.1.0"));
  }, []);
  return (
    <div className="max-w-4xl p-6 mx-auto">
      {/* Hero Section */}
      <div className="flex flex-col items-center mt-4 mb-12 text-center">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-foreground">
          Bienvenue sur cmpDesk
        </h1>
        <p className="max-w-xl mx-auto mb-8 text-lg text-muted-foreground">
          L'application desktop local-first qui orchestre et automatise le
          montage de vos dossiers d'assurance.
        </p>

        {/* SVG Graphic Component */}
        <div className="w-full mb-8">
          <AutomationGraphic />
        </div>

        <div className="flex gap-4">
          <Button
            variant="default"
            size="lg"
            onClick={() => navigate("/dossiers")}
          >
            Nouveau dossier
          </Button>
          <Button variant="secondary" size="lg">
            Voir les workflows
          </Button>
        </div>
      </div>

      {/* Version info */}
      <div className="pt-6 mt-8 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Version {appVersion} • Base UI Foundation
        </p>
      </div>
    </div>
  );
}

export default Home;
