import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthStatus } from "../components/sidebar/AuthStatus";
import { cn } from "@/lib/utils";
import type { EnvConfig } from "../types/electron";

/**
 * Layout global de l'application cmpDesk
 *
 * Design System: shadcn/ui (radix-lyra preset)
 *
 * Structure:
 * ┌─────────────────────────────────────────────┐
 * │ Topbar (bg-card + border-b)                 │
 * ├──────────┬──────────────────────────────────┤
 * │          │                                  │
 * │ Sidebar  │       Content Area               │
 * │ (sidebar)│       (bg-background)            │
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
  // true = dark mode, false = light mode
  const [isDark, setIsDark] = useState<boolean>(true);
  
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

  // ── Theme: load initial value + subscribe to native menu changes ──────────
  useEffect(() => {
    // 1. Load initial theme from main process
    window.electronAPI.theme?.getMode().then(({ shouldUseDarkColors }) => {
      setIsDark(shouldUseDarkColors);
    }).catch(() => {
      // Fallback: keep default dark
    });

    // 2. Listen for theme changes triggered by the native "Vue" menu
    const unsubscribe = window.electronAPI.theme?.onChange(({ shouldUseDarkColors }) => {
      setIsDark(shouldUseDarkColors);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);
  
  const isDevMode = envConfig?.ENV === 'DEV';
  
  // Helper to determine nav item styles
  const getNavLinkClass = (path: string) => {
    const isActive = location.pathname === path || (path === '/' && location.pathname === '/');
    return cn(
      "block px-3 py-2 rounded-md transition-colors",
      isActive
        ? "text-sidebar-primary-foreground bg-sidebar-primary"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );
  };
  
  return (
    <div className={cn("h-full w-full bg-background", isDark && "dark")}>
      {/* Layout wrapper - couvre tout l'écran */}
      <div className="flex flex-col h-full w-full">
        {/* Topbar - barre supérieure */}
        <header className="h-14 bg-card border-b border-border flex items-center px-4 shrink-0">
          <h1 className="text-foreground font-bold text-lg">cmpDesk</h1>
          {isDevMode && (
            <span className="ml-2 px-2 py-0.5 bg-chart-3/20 text-chart-3 text-xs font-medium rounded">
              DEV
            </span>
          )}
          <span className="ml-auto text-muted-foreground text-sm">v0.1.0</span>
        </header>

        {/* Container horizontal: Sidebar + Content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar - navigation latérale */}
          <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
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
                  <span className="block px-3 py-2 text-muted-foreground/50 cursor-not-allowed rounded-md hover:bg-sidebar-accent transition-colors">
                    Paramètres
                  </span>
                </li>
                
                {/* DEV-only: Logs */}
                {isDevMode && (
                  <>
                    <li className="pt-4 pb-2">
                      <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Dev Tools
                      </span>
                    </li>
                    <li>
                      <NavLink to="/logs" className={getNavLinkClass('/logs')}>
                        <span className="flex items-center gap-2">
                          <span className="text-chart-1">📋</span>
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
          <main className="flex-1 bg-background overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
