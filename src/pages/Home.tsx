/**
 * Page d'accueil de cmpDesk
 * 
 * Design System: shadcn/ui + NordVPN Inspired Dark Theme
 */

import { Button } from '@/components/ui/button';

function Home() {
  return (
    <div className="max-w-2xl p-6">
      {/* Titre principal */}
      <h1 className="text-3xl font-bold text-foreground mb-2">
        cmpDesk
      </h1>
      
      {/* Description */}
      <p className="text-muted-foreground mb-8">
        Application desktop pour automatiser le montage de dossiers en assurance.
      </p>

      {/* Status card */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 bg-chart-2 rounded-full"></span>
          <h2 className="text-lg font-semibold text-foreground">
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
      <div className="mt-6 flex gap-3">
        <Button>
          Nouveau dossier
        </Button>
        <Button variant="outline">
          Paramètres
        </Button>
      </div>

      {/* Version info */}
      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-muted-foreground text-xs">
          Version 0.1.0 • Base UI Foundation
        </p>
      </div>
    </div>
  )
}

export default Home
