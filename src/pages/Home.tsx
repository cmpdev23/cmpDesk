/**
 * Page d'accueil de cmpDesk
 * 
 * Design System: NordVPN Inspired Dark Theme
 */
function Home() {
  return (
    <div className="max-w-2xl">
      {/* Titre principal */}
      <h1 className="text-3xl font-bold text-text-primary mb-2">
        cmpDesk
      </h1>
      
      {/* Description */}
      <p className="text-text-secondary mb-8">
        Application desktop pour automatiser le montage de dossiers en assurance.
      </p>

      {/* Status card */}
      <div className="bg-surface rounded-lg p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 bg-success rounded-full"></span>
          <h2 className="text-lg font-semibold text-text-primary">
            Structure initialisée
          </h2>
        </div>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="text-success">✓</span>
            Electron configuré
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success">✓</span>
            React + Vite opérationnel
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success">✓</span>
            Tailwind CSS actif
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success">✓</span>
            Layout global en place
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success">✓</span>
            React Router configuré
          </li>
          <li className="flex items-center gap-2">
            <span className="text-success">✓</span>
            Design System NordVPN
          </li>
        </ul>
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex gap-3">
        <button className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded transition-colors font-medium">
          Nouveau dossier
        </button>
        <button className="px-4 py-2 bg-surface hover:bg-surface-light text-text-secondary border border-border rounded transition-colors">
          Paramètres
        </button>
      </div>

      {/* Version info */}
      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-text-muted text-xs">
          Version 0.1.0 • Base UI Foundation
        </p>
      </div>
    </div>
  )
}

export default Home
