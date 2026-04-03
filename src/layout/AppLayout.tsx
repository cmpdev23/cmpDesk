import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthStatus } from "../components/sidebar/AuthStatus";
import { cn } from "@/lib/utils";
import type { EnvConfig } from "../types/electron";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

/**
 * Layout global de l'application cmpDesk
 *
 * Design System: shadcn/ui (radix-lyra preset)
 * Sidebar: shadcn Sidebar primitives
 *
 * SidebarProvider must fill h-full to match Electron's window.
 * SidebarInset is a <main> — do not nest another <main> inside it.
 */
function AppLayout() {
  const location = useLocation();
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    window.electronAPI.getEnvConfig()
      .then(setEnvConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    window.electronAPI.theme
      ?.getMode()
      .then(({ shouldUseDarkColors }) => setIsDark(shouldUseDarkColors))
      .catch(() => {});

    const unsubscribe = window.electronAPI.theme?.onChange(
      ({ shouldUseDarkColors }) => setIsDark(shouldUseDarkColors)
    );
    return () => unsubscribe?.();
  }, []);

  const isDevMode = envConfig?.ENV === "DEV";

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    // `dark` class on root — drives all shadcn tokens
    <div className={cn("h-full w-full", isDark && "dark")}>
      {/*
        SidebarProvider normally uses min-h-svh but we override with h-full
        so it respects Electron's window bounds instead of viewport units.
      */}
      <SidebarProvider className="h-full min-h-0">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="font-bold text-sidebar-foreground text-base">
                cmpDesk
              </span>
              {isDevMode && (
                <span className="px-1.5 py-0.5 bg-chart-3/20 text-chart-3 text-xs font-medium rounded">
                  DEV
                </span>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/")}>
                      <NavLink to="/">Accueil</NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/dossiers")}>
                      <NavLink to="/dossiers">Dossiers</NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>Paramètres</SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isDevMode && (
              <SidebarGroup>
                <SidebarGroupLabel>Dev Tools</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/logs")}>
                        <NavLink to="/logs">
                          <span>📋</span>
                          <span>Logs</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter>
            <AuthStatus />
          </SidebarFooter>
        </Sidebar>

        {/*
          SidebarInset is a <main> with flex-1 + overflow-auto.
          We make it flex-col so topbar + content stack correctly.
        */}
        <SidebarInset className="flex flex-col h-full overflow-hidden">
          {/* Topbar */}
          <header className="h-14 bg-card border-b border-border flex items-center px-4 shrink-0 gap-2">
            <SidebarTrigger />
            <span className="ml-auto text-muted-foreground text-sm">v0.1.0</span>
          </header>

          {/* Page content — use a div, SidebarInset is already <main> */}
          <div className="flex-1 bg-background overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

export default AppLayout;
