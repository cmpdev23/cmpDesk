/**
 * Page d'accueil de cmpDesk
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { Button } from "@/components/ui/button";

function Home() {
  return (
    <div className="max-w-2xl p-6">
      {/* Titre principal */}
      <h1 className="mb-2 text-3xl font-bold text-foreground">cmpDesk</h1>

      {/* Description */}
      <p className="mb-8 text-muted-foreground">
        Application desktop pour automatiser le montage de dossiers en
        assurance.
      </p>

      {/* Status card */}
      <div className="p-6 border rounded-lg bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-chart-2"></span>
          <h2 className="text-lg font-semibold text-card-foreground">
            Structure initialisée
          </h2>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="text-chart-2">✓</span>
            Electron configuré
          </li>
          <li className="flex items-center gap-2">
            <span className="text-chart-2">✓</span>
            React + Vite opérationnel
          </li>
          <li className="flex items-center gap-2">
            <span className="text-chart-2">✓</span>
            Tailwind CSS actif
          </li>
          <li className="flex items-center gap-2">
            <span className="text-chart-2">✓</span>
            Layout global en place
          </li>
          <li className="flex items-center gap-2">
            <span className="text-chart-2">✓</span>
            React Router configuré
          </li>
          <li className="flex items-center gap-2">
            <span className="text-chart-2">✓</span>
            Design System shadcn/ui
          </li>
        </ul>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mt-6">
        <Button variant="default">Nouveau dossier</Button>
        <Button variant="secondary">Paramètres</Button>
      </div>

      {/* Version info */}
      <div className="pt-6 mt-8 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Version 0.1.0 • Base UI Foundation
        </p>
      </div>
    </div>
  );
}

export default Home;
