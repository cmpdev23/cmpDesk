```bash
npm run dev           # Launch app (Vite + Electron)
npm run build         # Production build
npm run electron:start # Electron only
```

**React App:**

- [`src/main.tsx`](vscode-webview://17djd1ei0dhchj65kg9ub23fo08f5mlhk3cmr7hh522rs0fnhh59/src/main.tsx:1) — React entry point with Router
- [`src/App.tsx`](vscode-webview://17djd1ei0dhchj65kg9ub23fo08f5mlhk3cmr7hh522rs0fnhh59/src/App.tsx:1) — Routes configuration
- [`src/index.css`](vscode-webview://17djd1ei0dhchj65kg9ub23fo08f5mlhk3cmr7hh522rs0fnhh59/src/index.css:1) — Tailwind directives
- [`src/layout/AppLayout.tsx`](vscode-webview://17djd1ei0dhchj65kg9ub23fo08f5mlhk3cmr7hh522rs0fnhh59/src/layout/AppLayout.tsx:1) — Global layout (sidebar + topbar + content)
- [`src/pages/Home.tsx`](vscode-webview://17djd1ei0dhchj65kg9ub23fo08f5mlhk3cmr7hh522rs0fnhh59/src/pages/Home.tsx:1) — Home page
- [`src/lib/utils.ts`](vscode-webview://17djd1ei0dhchj65kg9ub23fo08f5mlhk3cmr7hh522rs0fnhh59/src/lib/utils.ts:1) — Utility functions (cn)

pour faire des release :

# 1. S'assurer d'être sur main et à jour

git checkout main
git pull

# 2. Commit tes changements (si nécessaire)

git add .
git commit -m "feat: description des changements"

# 3. Créer la nouvelle version + push

npm version patch # 0.1.3 → 0.1.4 (bugfix)
npm version minor # 0.1.4 → 0.2.0 (nouvelle feature)
npm version major # 0.2.0 → 1.0.0 (breaking change)

git push origin main --tags
