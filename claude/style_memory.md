# STYLE MEMORY — cmpDesk UI Design System

> Single source of truth for all visual/design decisions.
> Owned by the cmpDesk-Agent. Keep short, actionable, up-to-date.

---

## Design System — NordVPN Inspired Dark Theme (2026-04-03)

**Source file**: [`src/index.css`](src/index.css)
**Config file**: [`tailwind.config.js`](tailwind.config.js)

### Color Palette (defined in `tailwind.config.js`)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-app` | #0B0F14 | Background global |
| `bg-surface` | #121821 | Cards, panels, sidebar, topbar |
| `bg-surface-light` | #1A2230 | Hover states |
| `border-border` | #1F2A3A | All borders |
| `text-text-primary` | #E6EDF3 | Primary text |
| `text-text-secondary` | #9FB0C3 | Secondary text |
| `text-text-muted` | #6B7C93 | Muted/disabled text |
| `bg-primary` | #3B82F6 | Primary buttons |
| `bg-primary-hover` | #2563EB | Primary button hover |
| `bg-primary-soft` | #1E293B | Active nav item background |
| `text-success` | #22C55E | Success indicators |
| `text-warning` | #F59E0B | Warning indicators |
| `text-danger` | #EF4444 | Error indicators |

> ⚠️ These tokens have since been **replaced by shadcn/ui oklch tokens** (see below).
> The hex palette above is historical. Use shadcn tokens in all new components.

### Layout Structure

```
┌─────────────────────────────────────────────┐
│ Topbar (bg-surface border-b border-border)  │  h-14
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │       Content Area               │
│ bg-surface│      (bg-app / bg-background)   │
│ w-56     │                                  │
│          │       <Outlet /> ← pages         │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

**Rules (original theme):**
- No inline hex colors in components
- All colors via Tailwind config tokens
- Hover states use `hover:bg-surface-light`

---

## Milestone — shadcn/ui Integration (2026-04-03)

### Installation

```bash
npx shadcn@latest init --preset b38TxqOZv --template vite
```

### Design System Configuration

| Setting | Value |
|---------|-------|
| Style | `radix-lyra` |
| Color Format | `oklch` |
| Base Color | `neutral` |
| CSS Variables | `true` |
| Icon Library | `lucide` |
| Font | `Manrope Variable` |

### CSS Variables (oklch format)

**Light Theme:**
- `--background: oklch(1 0 0)`
- `--foreground: oklch(0.145 0 0)`
- `--primary: oklch(0.457 0.24 277.023)`
- `--card: oklch(1 0 0)`
- `--muted: oklch(0.97 0 0)`

**Dark Theme:**
- `--background: oklch(0.145 0 0)`
- `--foreground: oklch(0.985 0 0)`
- `--primary: oklch(0.398 0.195 277.366)`
- `--card: oklch(0.205 0 0)`
- `--muted: oklch(0.269 0 0)`

### Sidebar-Specific Tokens

- `--sidebar` / `--sidebar-foreground`
- `--sidebar-primary` / `--sidebar-primary-foreground`
- `--sidebar-accent` / `--sidebar-accent-foreground`
- `--sidebar-border` / `--sidebar-ring`

### Tailwind Configuration

[`tailwind.config.js`](tailwind.config.js) uses CSS variables directly (no hsl wrapping needed with oklch):

```javascript
colors: {
  background: "var(--background)",
  foreground: "var(--foreground)",
  primary: {
    DEFAULT: "var(--primary)",
    foreground: "var(--primary-foreground)",
  },
  // ...
}
```

### Token Migration Table

| Old Token | New shadcn Token |
|-----------|-----------|
| `bg-app` | `bg-background` |
| `bg-surface` | `bg-card` |
| `text-text-primary` | `text-foreground` |
| `text-text-secondary` | `text-muted-foreground` |
| `border-border` | `border-border` (unchanged) |
| `bg-primary` | `bg-primary` (unchanged) |
| `text-success` | `text-chart-2` |
| `text-warning` | `text-chart-3` |
| `text-danger` | `text-destructive` |

### Files Structure

```
src/
├── index.css                 # Main CSS with shadcn variables (oklch)
├── components/
│   └── ui/
│       ├── button.tsx        # shadcn Button component
│       └── stepper.tsx       # Custom Stepper component
├── lib/
│   └── utils.ts              # cn() utility for class merging
```

### Components Available

- `Button` — shadcn button with variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
- `Stepper` — Custom stepper for multi-step forms
- `FormField`, `InputField`, `SelectField` — Generic wrappers styled with shadcn tokens
- `Sidebar`, `SidebarProvider`, `SidebarInset`, `SidebarMenu`, `SidebarMenuButton`, etc. — shadcn Sidebar primitives (installed 2026-04-03)

### Sidebar Migration (2026-04-03)

- Old `<aside>` hand-rolled sidebar in `AppLayout.tsx` **replaced** by shadcn `<Sidebar>` primitives
- `TooltipProvider` added to `App.tsx` wrapping all routes (required by shadcn Sidebar)
- `SidebarProvider` lives inside `AppLayout.tsx` wrapping the full layout
- `SidebarTrigger` placed in the topbar for collapse/expand
- `SidebarMenuButton asChild isActive` drives active state — no manual `getNavLinkClass()` helper needed
- `AuthStatus` component moved into `<SidebarFooter>`

### Rules

- **ALWAYS use shadcn tokens** — Never use raw color values or hex codes
- **Use `cn()` for class merging** — Import from [`@/lib/utils`](src/lib/utils.ts)
- **Follow oklch format** — When adding custom colors, use oklch
- **Sidebar-specific tokens exist** — Use `sidebar-*` for sidebar components
- **Import styles from `src/index.css`** — Not from `src/styles/`

---

## Milestone — Native Theme Toggle (2026-04-03)

### Architecture

```
native menu "Vue > Thème sombre/clair/système"
        │  click
        ▼
applyTheme(mode)           ← electron/main.js
  nativeTheme.themeSource = mode
  mainWindow.webContents.send('theme:changed', { mode, shouldUseDarkColors })
        │
        ▼
ipcRenderer.on('theme:changed')  ← electron/preload.js → themeAPI.onChange
        │
        ▼
AppLayout.tsx setIsDark(shouldUseDarkColors)
  → root div className: cn("…bg-background", isDark && "dark")
```

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `theme:getMode` | renderer → main | Get current mode + shouldUseDarkColors |
| `theme:setMode` | renderer → main | Set mode from renderer (UI toggle) |
| `theme:changed` | main → renderer | Push update on native menu change |

### Dark Mode in AppLayout

```tsx
const [isDark, setIsDark] = useState<boolean>(true);
// ...
<div className={cn("h-full w-full bg-background", isDark && "dark")}>
```

### Files Involved

| File | Role |
|------|------|
| [`electron/main.js`](electron/main.js) | `applyTheme()`, `buildMenu()`, IPC handlers, `nativeTheme` |
| [`electron/preload.js`](electron/preload.js) | Exposes `electronAPI.theme` → `getMode`, `setMode`, `onChange` |
| [`src/types/electron.d.ts`](src/types/electron.d.ts) | `ThemeAPI`, `ThemeMode`, `ThemeModeResult`, `ThemeSetResult` types |
| [`src/layout/AppLayout.tsx`](src/layout/AppLayout.tsx) | Subscribes to theme changes, applies `dark` class |

### Rules

- **NEVER hardcode `dark` class** — Always derive from `isDark` state (via IPC)
- **Native menu is source of truth** — `nativeTheme.themeSource` drives everything
- **`system` mode** defers to OS preference — `shouldUseDarkColors` reflects the actual OS result
- **`themeAPI` is optional-chained** (`?.`) in renderer to avoid errors outside Electron context
