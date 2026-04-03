import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthStatus } from "../components/sidebar/AuthStatus";
import type { EnvConfig } from "../types/electron";

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
 * │──────────│                                  │
 * │AuthStatus│                                  │
 * └──────────┴──────────────────────────────────┘
 */
function AppLayout() {
  const location = useLocation();
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);
  
  // Load env config to conditionally show Logs menu
  useEffect(() => {
    const loadEnvConfig = async () => {
      try {
        const config = await window.electronAPI.getEnvConfig();
        setEnvConfig(config);
      } catch (e) {
        console.error('Failed to load env config:', e);
      }
    };
    loadEnvConfig();
  }, []);
  
  const isDevMode = envConfig?.ENV === 'DEV';
  
  // Helper to determine nav item styles
  const getNavLinkClass = (path: string) => {
    const isActive = location.pathname === path || (path === '/' && location.pathname === '/');
    return `block px-3 py-2 rounded transition-colors ${
      isActive
        ? 'text-text-primary bg-primary-soft'
        : 'text-text-secondary hover:bg-surface-light hover:text-text-primary'
    }`;
  };
  
  return (
    <div className="h-full w-full bg-app">
      {/* Layout wrapper - couvre tout l'écran */}
      <div className="flex flex-col h-full w-full">
        {/* Topbar - barre supérieure */}
        <header className="h-14 bg-surface border-b border-border flex items-center px-4 shrink-0">
          <h1 className="text-text-primary font-bold text-lg">cmpDesk</h1>
          {isDevMode && (
            <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
              DEV
            </span>
          )}
          <span className="ml-auto text-text-muted text-sm">v0.1.0</span>
        </header>

        {/* Container horizontal: Sidebar + Content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar - navigation latérale */}
          <aside className="w-56 bg-surface border-r border-border flex flex-col shrink-0">
            {/* Navigation */}
            <nav className="flex-1 p-4">
              <ul className="space-y-1">
                <li>
                  <NavLink to="/" className={getNavLinkClass('/')}>
                    Accueil
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/dossiers" className={getNavLinkClass('/dossiers')}>
                    Dossiers
                  </NavLink>
                </li>
                <li>
                  <span className="block px-3 py-2 text-text-muted cursor-not-allowed rounded hover:bg-surface-light transition-colors">
                    Paramètres
                  </span>
                </li>
                
                {/* DEV-only: Logs */}
                {isDevMode && (
                  <>
                    <li className="pt-4 pb-2">
                      <span className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Dev Tools
                      </span>
                    </li>
                    <li>
                      <NavLink to="/logs" className={getNavLinkClass('/logs')}>
                        <span className="flex items-center gap-2">
                          <span className="text-cyan-400">📋</span>
                          Logs
                        </span>
                      </NavLink>
                    </li>
                  </>
                )}
              </ul>
            </nav>
            
            {/* Auth Status - bottom of sidebar */}
            <AuthStatus />
          </aside>

          {/* Zone de contenu principale */}
          <main className="flex-1 bg-app overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
