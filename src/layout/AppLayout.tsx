import { Outlet } from "react-router-dom";

/**
 * Layout global de l'application cmpDesk
 *
 * Design System: NordVPN Inspired Dark Theme
 *
 * Structure:
 * ┌─────────────────────────────────────────────┐
 * │ Topbar (bg-surface + border-b)              │
 * ├──────────┬──────────────────────────────────┤
 * │          │                                  │
 * │ Sidebar  │       Content Area               │
 * │ (surface)│       (bg-app)                   │
 * │          │                                  │
 * │          │       <Outlet /> ← pages         │
 * │          │                                  │
 * └──────────┴──────────────────────────────────┘
 */
function AppLayout() {
  return (
    <div className="h-full w-full bg-app">
      {/* Layout wrapper - couvre tout l'écran */}
      <div className="flex flex-col h-full w-full">
        {/* Topbar - barre supérieure */}
        <header className="h-14 bg-surface border-b border-border flex items-center px-4 shrink-0">
          <h1 className="text-text-primary font-bold text-lg">cmpDesk</h1>
          <span className="ml-auto text-text-muted text-sm">v0.1.0</span>
        </header>

        {/* Container horizontal: Sidebar + Content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar - navigation latérale */}
          <aside className="w-56 bg-surface border-r border-border flex flex-col shrink-0">
            <nav className="flex-1 p-4">
              <ul className="space-y-1">
                <li>
                  <a
                    href="/"
                    className="block px-3 py-2 text-text-primary bg-primary-soft rounded transition-colors hover:bg-surface-light"
                  >
                    Accueil
                  </a>
                </li>
                <li>
                  <span className="block px-3 py-2 text-text-muted cursor-not-allowed rounded hover:bg-surface-light transition-colors">
                    Dossiers
                  </span>
                </li>
                <li>
                  <span className="block px-3 py-2 text-text-muted cursor-not-allowed rounded hover:bg-surface-light transition-colors">
                    Paramètres
                  </span>
                </li>
              </ul>
            </nav>
            <div className="p-4 text-text-muted text-xs border-t border-border">
              cmpDesk Desktop
            </div>
          </aside>

          {/* Zone de contenu principale */}
          <main className="flex-1 bg-app overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
