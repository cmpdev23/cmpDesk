# CLAUDE MEMORY

## 🚨 Critical Rules

- **Aura credentials = ALWAYS capture from real requests** — Never construct fwuid or token manually
- **Use `domcontentloaded` not `networkidle` on Lightning** — SF does constant polling, networkidle never settles
- **Browser profile lock = previous browser still open** — Always close browser between runs
- **Validation errors ≠ API errors** — `state: ERROR` with field errors means API works, data is wrong
- **NEVER use UI interactions for data operations** — Always use API (Aura). Playwright is ONLY for: auth, session init, context capture
- **NEVER taskkill chrome.exe** — User may be using Chrome. Only kill Chromium if needed
- **NEVER put seed data in script files** — All test data in `scripts/seeds/` folder
- **Always wait 5s after navigation before getUserId()** — Lightning globals not available immediately
- **ALWAYS use `withBrowserMutex()` for browser operations** — Prevents race conditions between concurrent IPC calls (2026-04-07)
- **NEVER use fixed `waitForTimeout()` after navigation** — Use `waitForSalesforceReady()` instead (2026-04-07)
- **ALWAYS use `safeEvaluate()` for `page.evaluate()` during navigation** — Handles "Execution context was destroyed" errors (2026-04-07)
- **ALWAYS register IPC handlers in `electron/main.js`** — If preload.js exposes an API, main.js MUST have the handler. Error "No handler registered for '...'" = missing `ipcMain.handle()` (2026-04-07)

---

## 🔍 Salesforce API Reference

### Search

| API | Use Case | Descriptor |
|-----|----------|------------|
| `getSuggestions` | Name search (typeahead) | `AssistantSuggestionsDataProviderController/ACTION$getSuggestions` |
| `getAnswers` | Phone/Email search (SOSL) | `PredictedResultsDataProviderController/ACTION$getAnswers` |

**Key**: `getSuggestions` does NOT search Phone field. Use `getAnswers` with `withSingleSOSL: true` for phone search.

**Response structure**: `returnValue.answers[].data.results[].result[].record`

### Account Creation (FSC Individual)

**Required fields**:
- `LastName` (required)
- `RecordTypeId`: `0125Y000001zWhpQAE` (FSC Individual - auto-set)

**Optional fields**:
- `FirstName`
- `Phone` (10 digits, cleaned automatically)
- `Primary_Email__c`

**⚠️ CRITICAL: SF Validation Rules require paired fields**:
- When `Phone` is set → MUST also set `Primary_Phone_Type__c` = `'TEL_CEL'` (Cellulaire)
- When `Primary_Email__c` is set → MUST also set `Primary_Email_Type__c` = `'EMA_PRI'` (Principal)
- **Error message**: "Vous devez remplir les deux champs..."

**Valid Picklist Values (discovered 2026-04-06)**:
- `Primary_Email_Type__c`: `EMA_PRI` (Principal), `EMA_OFF` (Bureau)
- `Primary_Phone_Type__c`: `TEL_CEL` (Cellulaire), `TEL_HOM` (Maison), `TEL_OFF` (Bureau), `TEL_FAX` (Fax), `TEL_FREE` (Sans frais), `TEL_OTH` (Autre)

**API**: `aura://RecordUiController/ACTION$createRecord` with `queryParams: { 'aura.RecordUi.createRecord': '1' }`

### Record Types

| Object | RecordTypeId |
|--------|--------------|
| Account FSC | `0125Y000001zWhpQAE` |
| Opportunity | `012Am0000004KaZIAU` |
| Case | `012Am0000004KaPIAU` |

### Opportunity Required Fields

- `AccountId`, `CloseDate` (YYYY-MM-DD), `StageName`, `RecordTypeId`, `OwnerId`
- Key custom: `Annual_Premium__c`, `Contract_Number__c`, `Opportunity_Category__c`, `Product_Interest__c`, `Subsidiary__c`

### Case Required Fields (for update)

| Field | Example Value |
|-------|---------------|
| `Product_Family__c` | "Insurance" |
| `Transaction_Category__c` | "New Contract" |
| `Transaction_Sub_Category__c` | "Without Replacement" |
| `SignatureType__c` | "Electronic" |
| `CustomersPlaceOfResidence__c` | "Quebec" |
| `ProductType__c` | "Life Insurance" |

> **Note**: SignatureType, CustomersPlaceOfResidence, ProductType only required if `Subsidiary__c = "iA"`

### Case Update API Format (CRITICAL)
```javascript
params: {
  recordId: caseId,  // ← REQUIRED at params level
  recordInput: {
    allowSaveOnDuplicate: false,
    fields: {
      Id: caseId,
      Subject: "Nouveau contrat",
      Product_Family__c: "Insurance",
      // ... direct values, NOT wrapped in { value: X }
    },
  },
}
queryParams: { 'aura.RecordUi.updateRecord': '1', r: '1' }
```

### Get Record API Format (CRITICAL)
Use `getRecordWithFields` (NOT `getRecord`):
```javascript
descriptor: 'aura://RecordUiController/ACTION$getRecordWithFields'
params: { recordId, fields: ['Opportunity.Case__c', 'Opportunity.Case__r.Id'] }
queryParams: { 'aura.RecordUi.getRecordWithFields': '1', r: '1' }
```

### Account Fields

- **Email**: `Primary_Email__c` + `Primary_Email_Type__c` (paired)
- **Phone**: 10 digits + `Primary_Phone_Type__c` (paired)

---

## ⚡ Lightning/Aura Patterns

### Credential Capture
```javascript
// Method 1: Network interception (requires pending Aura request)
page.on("request", req => {
  if (req.method() === "POST" && req.url().includes("/aura")) {
    // Extract aura.context + aura.token from POST body
  }
});

// Method 2: Direct extraction from $A context (fallback, more reliable)
const credentials = await page.evaluate(() => {
  const ctx = $A.getContext();
  return {
    context: { fwuid: ctx.fwuid, mode: ctx.getMode(), app: ctx.getApp() },
    token: ctx.getToken?.() || null
  };
});
```

**IMPORTANT**: Network interception can fail if no Aura requests are pending. Always use `extractAuraCredentialsFromContext()` as fallback (2026-04-07).

### Key Discoveries

- SF minifies `$A` methods in production (`getEncodedFWUID` → `ys`, `Dz`, etc.) — don't call directly
- Every Aura POST contains valid `aura.context` (fwuid) + `aura.token` — intercept first request
- `$A.enqueueAction` is how Lightning makes server calls natively
- `e.force:createRecord` opens modal UI — NOT an API call

### Workflows

| Workflow | Key Insight |
|----------|-------------|
| **Case creation** | Auto-created by SF trigger when Opportunity is created. Flow is for UPDATE, not create. |
| **Note creation** | Two-step: 1) Create ContentNote via `RecordGvpController/saveRecord`, 2) Link via `EditPanelController/serverCreateUpdate` |
| **Document upload** | Uses xECM (OpenText), not native SF Files |

---

## 📁 xECM Document Upload

| Component | Value |
|-----------|-------|
| OpenText Server | `https://otcs.ia.ca/cs/cs/` |
| API Endpoint | `POST https://otcs.ia.ca/cs/cs/api/v2/nodes` |
| Token Format | `OTDSTicket: *OTDSSSO*{base64}` |
| Document Type | `type=144` |

**Token capture**: Via `xecm.CanvasAppController/ACTION$getPerspectiveParameters`

---

## 🏗️ Architecture Decisions

### Electron Structure
```
electron/
├── main.js              # Entry point (~100 lines)
├── config/env.js        # Environment variables
├── lib/                 # Logger, window management
├── services/
│   ├── auth/            # Playwright browser, session
│   └── salesforce/      # Aura client, search
└── ipc/                 # IPC handlers by domain
```

### React Structure
```
src/
├── components/ui/       # Primitives (shadcn + custom wrappers)
├── modules/{domain}/    # Domain-specific (components, types, lib)
├── lib/                 # Cross-app utilities only
└── pages/               # Import from modules barrel
```

**Rules**:
- `modules/` = domain-specific, self-contained
- `components/ui/` = zero domain knowledge, reusable
- Pages import from `@/modules/{module}`, never internal paths

### Auth Strategy

- Browser profile: `userData/auth/browser_profile/`
- Cookies: `userData/auth/cookies.json` (session cookies converted to 24h expiry)
- Session state: `userData/auth/session_state.json`

**Auth wait pattern**: When session expired, keep browser open, poll every 2s for Aura availability, timeout 3min.

---

## 🌐 Environment Variables Strategy (2026-04-09)

### Overview

| Context | Source | Priority |
|---------|--------|----------|
| **Local development** | `.env` file | Highest |
| **Local fallback** | `.env.example` | If `.env` missing |
| **GitHub CI/CD** | Repository Variables | Injected at build time |

### Local Development

Variables loaded via `dotenv` in [`electron/main.js`](electron/main.js:30-39):

```javascript
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
}
```

**Setup**: Copy `.env.example` to `.env` and customize values.

### GitHub CI/CD

Variables defined in **GitHub Repository → Settings → Secrets and Variables → Actions → Variables**.

Workflows (`.github/workflows/build.yml` and `release.yml`) inject these at build time:

```yaml
- name: Create .env from repository variables
  run: |
    echo "ENV=${{ vars.ENV || 'PROD' }}" >> .env
    echo "DEBUG_LOGS=${{ vars.DEBUG_LOGS || 'false' }}" >> .env
    echo "SHOW_DEVTOOLS=${{ vars.SHOW_DEVTOOLS || 'false' }}" >> .env
    echo "LOG_LEVEL=${{ vars.LOG_LEVEL || 'warn' }}" >> .env
```

### Available Variables

| Variable | Default (CI) | Description |
|----------|--------------|-------------|
| `ENV` | `PROD` | `DEV` or `PROD` - controls debug features |
| `DEBUG_LOGS` | `false` | Enable debug-level logging |
| `SHOW_DEVTOOLS` | `false` | Auto-open DevTools on start |
| `LOG_LEVEL` | `warn` | `debug`, `info`, `warn`, `error` |

### Key Points

1. **`.env` is gitignored** — never committed, local secrets stay local
2. **GitHub Variables (not Secrets)** — because these are non-sensitive config, not credentials
3. **Fallback defaults** — if vars not set in GitHub, sensible PROD defaults apply
4. **Packaged app** — `.env` is created during build, bundled with the executable

---

## 🧪 DEV Mode Form Bypass

**Purpose**: Navigate freely through form steps without triggering automations (for UI inspection/debugging).

**How it works**:
- When `ENV=DEV` in `.env` AND form fields are completely empty → bypass validation AND skip automations
- When `ENV=DEV` AND some fields are filled → normal validation (user intent detected)
- When `ENV=PROD` → always enforce validation and automations

**Implementation**:
- `src/lib/dev-mode.ts` — centralized DEV mode utilities
- `src/hooks/use-dev-mode.ts` — React hook for components
- Key function: `shouldBypassValidation(formData)` returns `true` if DEV mode + empty form

**Affected flows**:
- Account step → Next button skips search step if form empty in DEV mode
- All validation functions check `shouldBypassValidation()` before enforcing rules
- "Next" button always enabled in DEV mode (no disabled state)

**Visual indicator**: Yellow banner "Mode DEV — Navigation libre" at top of Dossiers page.

---

## 📤 Document Upload Implementation

### Architecture (implemented 2026-04-07)

```
Renderer (Dossiers.tsx)
    │
    ├─ handleSubmit() creates Opportunity + Case
    │
    └─ If caseId + files exist:
         │
         ├─ Wait 2s for OpenText workspace
         │
         └─ uploadDocuments(caseId, files)
               │
               ▼ IPC
Main Process (electron/)
    │
    ├─ ipc/salesforce.js → salesforce:uploadDocuments handler
    │
    └─ services/salesforce/upload.js
         │
         ├─ fetchOtdsToken() via Aura API
         │
         └─ uploadSingleDocument() → OpenText REST API
```

### Key Files

| File | Purpose |
|------|---------|
| `electron/services/salesforce/upload.js` | Core upload logic |
| `electron/services/salesforce/index.js` | Exports `uploadDocuments` |
| `electron/ipc/salesforce.js` | IPC handler |
| `electron/preload.js` | Exposes `uploadDocuments` to renderer |
| `src/types/electron.d.ts` | TypeScript types |
| `src/pages/Dossiers.tsx` | UI integration |

### API Usage

```typescript
// Renderer: convert File to serializable format
const filesForUpload = await Promise.all(
  documentData.files.map(async (f) => ({
    name: f.name,
    type: f.type,
    size: f.size,
    buffer: Array.from(new Uint8Array(await f.file.arrayBuffer())),
  }))
);

// Call IPC
const result = await window.electronAPI.salesforce.uploadDocuments({
  caseId: '500JQ00000...',
  files: filesForUpload,
});
```

### Constraints

- **Max file size**: 25 MB per file
- **Allowed extensions**: PDF, Word, Excel, Images, Text
- **Sequential upload**: One file at a time to avoid rate limiting
- **Token refresh**: Auto-retry on 401 (expired token)
- **Workspace delay**: 2s wait after Case creation before upload

---

## 📋 Active TODOs

- [x] ~~Create `lib/upload_document.js` stable function for main.js integration~~ (Done: `electron/services/salesforce/upload.js`)
- [x] ~~Create `lib/create_note.js` integration into main.js~~ (Done: 2026-04-07)
- [ ] Test refactored Electron structure (`main.refactored.js` → `main.js`)
- [x] ~~Add note creation step to Dossiers workflow~~ (Done: 2026-04-07)
- [x] ~~Add document upload step to Dossiers workflow~~ (Done: integrated in handleSubmit)

---

## 🔧 Bugfix — Aura Credential Capture (2026-04-07)

### Problem

When calling `captureAuraCredentials()` on an already-loaded Lightning page, network interception would timeout because no new Aura requests were being made.

### Root Cause

The function relied on intercepting POST requests to `/aura` endpoint. However:
- If the page was already fully loaded and stable
- And no UI interactions triggered new Aura requests
- The timeout would expire with `null` result

### Solution

Implemented a **two-stage credential capture** approach:

1. **Primary Method**: Network interception with multiple UI triggers
   - Wait 2s for page to stabilize
   - Try clicking search bar, Related/Details tabs, buttons
   - Try mouse hover movements
   - Timeout after 8s (reduced from 15s)

2. **Fallback Method**: Direct extraction from `$A.getContext()`
   - Use `ctx.encodeForServer()` to get properly serialized context
   - Search for fwuid patterns in obfuscated properties
   - Return structured context object

### Implementation

```javascript
// Primary: Network interception with triggers
let credentials = await captureAuraCredentials(page, 8000);

// Fallback: Direct extraction
if (!credentials) {
  credentials = await extractAuraCredentialsFromContext(page);
}

if (!credentials) {
  // Both methods failed
  return { error: 'Could not capture Aura credentials' };
}
```

### Key Insight

**Network interception is unreliable on stable pages.** Always have a fallback that extracts from the `$A` context, even though it's obfuscated in production. The `encodeForServer()` method is the proper way to serialize the context.

### Files Modified

- `electron/main.js` — Added `extractAuraCredentialsFromContext()`, improved `captureAuraCredentials()` with better logging

---

## 🔧 Bugfix — ContentNote ID Extraction (2026-04-07)

### Problem

After creating a ContentNote via `RecordGvpController/saveRecord`, the response parsing failed with:
```
Note created but ID not returned
```

Yet the API call succeeded (state: SUCCESS).

### Root Cause

The response format from Salesforce Aura API can vary:
- Sometimes: `{ id: "069..." }`
- Sometimes: Direct string ID
- Sometimes: `{ record: { id: "..." } }`
- Sometimes: `{ recordId: "..." }`
- Sometimes: ID buried in other fields

The original code only checked `action.returnValue?.id` and `action.returnValue?.record?.id`.

### Solution

Implemented **multi-format ID extraction**:

```javascript
let noteId = null;
const rv = action.returnValue;

// Format 1: { id: "..." }
if (rv?.id) noteId = rv.id;
// Format 2: Direct string ID
else if (typeof rv === 'string' && rv.startsWith('069')) noteId = rv;
// Format 3: { record: { id: "..." } }
else if (rv?.record?.id) noteId = rv.record.id;
// Format 4: { recordId: "..." }
else if (rv?.recordId) noteId = rv.recordId;
// Format 5: Search all fields for ContentNote ID pattern
else if (rv) {
  for (const key of Object.keys(rv)) {
    const val = rv[key];
    if (typeof val === 'string' && val.startsWith('069')) {
      noteId = val;
      break;
    }
  }
}

// If still not found, return debug info
if (!noteId) {
  return {
    success: false,
    error: 'Note created but ID not found in response',
    debug: {
      state: action.state,
      returnValueKeys: rv ? Object.keys(rv) : null,
      returnValueSample: JSON.stringify(rv).substring(0, 200)
    }
  };
}
```

### Key Insight

**Salesforce API responses are inconsistent.** Always:
1. Check multiple possible formats
2. Log the actual response structure for debugging
3. Return debug info when parsing fails

### Files Modified

- `electron/main.js` — Enhanced ID extraction logic in `createNote()` function

---

## 📚 Note Creation Workflow (2026-04-07)

### Complete Flow

```
User fills Dossiers form
    ↓
Step 1: Create Opportunity (via API)
    ↓
Step 2: Upload Documents (via OpenText xECM)
    ↓
Step 3: Create Note (NEW - 2026-04-07)
    ├─ Navigate to Case page
    ├─ Wait 5s for Lightning context
    ├─ Get current user ID (6 fallback methods)
    ├─ Prepare note content (HTML escape + Base64)
    ├─ Create ContentNote (RecordGvpController)
    ├─ Extract ContentNote ID (multi-format parsing)
    ├─ Link to Case (EditPanelController)
    └─ Return success/error
    ↓
Display results to user
```

### Critical Timing

- **After navigation**: Wait 5s before calling `getUserId()` — Lightning globals not available immediately
- **Before credential capture**: Wait 2s for page to stabilize
- **Between API calls**: No explicit wait needed (sequential execution)

### Non-Blocking Failures

Note creation is **non-blocking**:
- If note creation fails, the dossier is still created
- Error is logged as warning, not error
- User sees the dossier was created, with note creation status

### Files Modified

- `electron/main.js` — Added `createNote()`, `getUserId()`, `prepareNoteContent()` functions
- `electron/preload.js` — Exposed `createNote` API
- `src/types/electron.d.ts` — Added TypeScript types
- `src/pages/Dossiers.tsx` — Integrated note creation into workflow
- `docs/sf_discovery/notes.md` — Documented implementation

---

## 🔐 Logout Chirurgical (2026-04-07)

### Problème
La suppression complète du `browser_profile/` effaçait les données de form autofill de l'utilisateur.

### Solution
Logout chirurgical qui :
1. Supprime `cookies.json` et `session_state.json` (nos fichiers de tracking)
2. Ouvre le profil en headless et supprime uniquement les cookies des domaines auth :
   - `salesforce.com`, `force.com`, `lightning.force.com`
   - `inalco.com`, `secureweb.inalco.com`
3. Préserve : form autofill, local storage, cache, historique

### Domaines Auth
```javascript
const AUTH_DOMAINS = [
  'salesforce.com', '.salesforce.com',
  'force.com', '.force.com',
  'lightning.force.com', '.lightning.force.com',
  'inalco.com', '.inalco.com',
  'secureweb.inalco.com', '.secureweb.inalco.com',
];
```

### Comportement si profil locked
Si le navigateur est déjà ouvert, seuls les fichiers JSON sont supprimés. Les cookies restent jusqu'à fermeture du navigateur.

---

## 🔧 Bugfix — Packaged App Blank Window & Zombie Processes (2026-04-08)

### Problem 1: Blank Window

**Symptom**: Packaged app (.exe) shows blank white window, no React UI renders. DevTools show "DID-FINISH-LOAD" success but nothing renders.

**Root Cause**: `BrowserRouter` from react-router-dom uses HTML5 History API which requires a web server. In packaged Electron apps using `file://` protocol, BrowserRouter cannot resolve routes.

**Solution**: Changed from `BrowserRouter` to `HashRouter` in `src/main.tsx`:
```tsx
// Before (broken in packaged app)
import { BrowserRouter } from 'react-router-dom'
<BrowserRouter><App /></BrowserRouter>

// After (works with file:// protocol)
import { HashRouter } from 'react-router-dom'
<HashRouter><App /></HashRouter>
```

**Why HashRouter works**: Routes appear as `file:///.../index.html#/search` instead of `file:///.../search` (which would fail to resolve).

**Additional fix**: Also removed HTML CSP header (`'self'` directive) as a precaution since it can cause issues with `file://` protocol in asar archives.

### Problem 2: Zombie Processes

**Symptom**: After closing app, 3-4 `cmpDesk.exe` processes remain in Task Manager.

**Root Cause**: Playwright browser contexts launched for auth/search operations weren't tracked or closed when the app quit.

**Solution**: Implemented global context tracking:
```javascript
// Track all Playwright contexts
const activePlaywrightContexts = new Set();

function trackPlaywrightContext(context) {
  activePlaywrightContexts.add(context);
}

function closeTrackedContext(context) {
  await context.close();
  activePlaywrightContexts.delete(context);
}

// Clean up on app quit
app.on('before-quit', async (event) => {
  if (activePlaywrightContexts.size > 0) {
    event.preventDefault();
    await closeAllPlaywrightContexts();
    app.quit();
  }
});
```

### Key Insights

1. **BrowserRouter doesn't work with file:// protocol**: Use `HashRouter` in Electron packaged apps. BrowserRouter requires a server to handle routes.
2. **CSP 'self' breaks in asar**: Don't use HTML CSP in Electron packaged apps. Use `webPreferences` instead.
3. **Track all browser contexts**: Every `launchPersistentContext()` call must be tracked for cleanup.
4. **`before-quit` is async-friendly**: Use `event.preventDefault()` to delay quit, clean up, then call `app.quit()`.
5. **Test packaged builds early**: Dev mode (localhost:5173) works differently than packaged builds (file://). Test `.exe` locally before CI/CD.

### Files Modified

- `src/main.tsx` — Changed `BrowserRouter` to `HashRouter`
- `index.html` — Removed CSP meta tag
- `electron/main.js` — Added context tracking, `before-quit` handler, `trackPlaywrightContext()`, `closeTrackedContext()`, `closeAllPlaywrightContexts()`
- `vite.config.ts` — Added `modulePreload.polyfill: false` to avoid crossorigin attribute issues

---

## 🚫 Anti-patterns

- **Don't construct aura.context manually** — capture from real requests
- **Don't use networkidle on Lightning** — always `domcontentloaded` + explicit wait
- **Don't guess field names** — verify via SF Object Manager
- **Don't run two scripts simultaneously** — browser_profile gets locked
- **Don't use Escape/Tab on Flow modals** — Escape closes modal, Tab may trigger Next button
- **IPC handlers in main.js, NOT modular** — `electron/ipc/` folder exists but main.js uses inline handlers. Add new IPC handlers directly in `main.js` after `salesforce:searchAccount`
- **Don't delete browser_profile/ entirely for logout** — use surgical cookie removal to preserve form autofill
- **Don't use BrowserRouter in Electron apps** — Use `HashRouter` instead. BrowserRouter requires HTML5 History API (server-side). file:// protocol doesn't support it. (2026-04-08)
- **Don't use HTML CSP in Electron packaged apps** — `'self'` doesn't work with `file://` protocol in asar archives. Use `webPreferences` instead. (2026-04-08)
- **Don't forget to track Playwright contexts** — Every `launchPersistentContext()` must be tracked for cleanup on app quit. (2026-04-08)
- **Don't hardcode GitHub org in electron-builder publish config** — Owner must match actual repo (`cmpdev23` not `CMPlan`). Error 404 from GitHub API = wrong owner/repo or bad permissions. (2026-04-08)

---

## 🔄 Auto-Update Implementation (2026-04-08)

### Architecture

```
electron/
├── main.js                      # Initializes updater on app.whenReady()
├── preload.js                   # Exposes app update API to renderer
├── ipc/app.js                   # IPC handlers for update operations
└── services/updater/index.js    # Core updater service (ESM module)
```

### Key Files

| File | Purpose |
|------|---------|
| `electron/services/updater/index.js` | Core auto-update logic using electron-updater |
| `electron/ipc/app.js` | IPC handlers: `app:getVersion`, `app:checkForUpdates`, `app:installUpdate`, `app:getUpdateState` |
| `electron/preload.js` | Exposes: `getVersion`, `checkForUpdates`, `installUpdate`, `getUpdateState`, `onUpdateDownloaded` |

### API Usage (Renderer)

```typescript
// Check for updates
const result = await window.electronAPI.checkForUpdates();
// { updateAvailable: boolean, info?: { version, releaseDate, releaseNotes } }

// Install downloaded update (restarts app)
await window.electronAPI.installUpdate();

// Get current update state
const state = await window.electronAPI.getUpdateState();
// { updateDownloaded: boolean, updateInfo: object | null }

// Listen for update-downloaded events
const unsubscribe = window.electronAPI.onUpdateDownloaded((info) => {
  console.log(`Update ready: v${info.version}`);
});
```

### Important Notes

1. **Dev Mode Behavior**: All updater functions return early with `{ updateAvailable: false }` when `!app.isPackaged`. No errors, just silent skip.

2. **ESM/CommonJS Compatibility**:
   - `main.js` uses ESM imports
   - `ipc/app.js` uses CommonJS (require)
   - `services/updater/index.js` uses ESM (export)
   - Solution: Lazy-load ESM module with `await import()` in CommonJS handlers

3. **Periodic Checks**: Default interval is 4 hours. Can be customized via `startPeriodicCheck(intervalMs)`.

4. **Error Handling**: Update errors are logged but don't crash the app. Next check will retry automatically.

5. **Install Behavior**: `installUpdate()` calls `autoUpdater.quitAndInstall(true, true)` which:
   - Silently installs (no NSIS UI)
   - Auto-restarts app after install

### React UI Components (Task 2 - 2026-04-08)

#### Files Created

- `src/hooks/use-app-update.ts` — Custom hook for update state management
- `src/components/ui/update-banner.tsx` — Notification banner component

#### Files Modified

- `src/types/electron.d.ts` — Added `UpdateInfo`, `AppAPI` types
- `src/layout/AppLayout.tsx` — Integrated UpdateBanner, dynamic version display

#### Hook API (`useAppUpdate`)

```typescript
const {
  updateAvailable,    // boolean - true when update downloaded
  updateInfo,         // { version, releaseDate?, releaseNotes? } | null
  isChecking,         // boolean - true during manual check
  error,              // string | null
  checkForUpdates,    // () => Promise<void> - manual trigger
  installUpdate,      // () => Promise<void> - install and restart
  dismissUpdate,      // () => void - hide banner
} = useAppUpdate();
```

#### Banner Behavior

- Auto-shows when update is downloaded (via IPC listener)
- "Restart now" → calls `installUpdate()` → app quits and restarts
- "Later" → calls `dismissUpdate()` → banner hides, update installs on next quit
- Dev mode: banner never appears (no updates in dev)

#### TypeScript Types Added

```typescript
interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

interface AppAPI {
  getVersion: () => Promise<string>;
  checkForUpdates: () => Promise<CheckUpdateResult>;
  installUpdate: () => Promise<void>;
  getUpdateState: () => Promise<UpdateState>;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
}
```

---

## 🧪 Test Connection Feature (2026-04-08)

### Purpose

Allows users to manually verify their Salesforce session by opening the SF home page in a browser.

**Use cases**:
1. Verify session is working correctly after login
2. Complete additional authentication steps (MFA, consent, security checks)
3. Visually confirm connection before running automations
4. Resolve missing cookies or session issues

### Architecture

```
src/components/sidebar/AuthStatus.tsx   # "Tester la connexion" button
        │
        ▼ IPC
electron/preload.js                     # Exposes auth.testConnection()
        │
        ▼ IPC Handler
electron/ipc/auth.js                    # auth:testConnection handler
        │
        ▼
electron/services/auth/index.js         # testConnection() function
        │
        ▼
Playwright Browser                      # Opens SF home page
```

### API Usage (Renderer)

```typescript
// Test connection - opens browser for manual verification
const result = await window.electronAPI.auth.testConnection();
// {
//   success: boolean,
//   message: string,
//   needsAction?: boolean,  // true if user needs to complete auth manually
//   error?: 'BROWSER_PROFILE_LOCKED' | 'UNKNOWN'
// }
```

### Key Files

| File | Purpose |
|------|---------|
| `electron/services/auth/index.js` | `testConnection()` function |
| `electron/ipc/auth.js` | IPC handler `auth:testConnection` |
| `electron/preload.js` | Exposes `auth.testConnection` to renderer |
| `src/types/electron.d.ts` | `TestConnectionResult` type |
| `src/components/sidebar/AuthStatus.tsx` | UI button + handler |

### Behavior

1. **User clicks "Tester la connexion"** → UI shows "Test en cours..."
2. **Browser launches** with persistent profile (reuses cookies)
3. **Navigates to SF home page** (`AUTH_TARGET.waitForUrl`)
4. **If session valid** → User sees Lightning, session is refreshed
5. **If session expired** → User sees login page, can complete auth manually
6. **Browser stays open** for user interaction (manual MFA, etc.)
7. **On success** → Session state saved, UI refreshes to show "Connecté"

### Error Handling

- **BROWSER_PROFILE_LOCKED**: Another browser instance is using the profile. User must close it first.
- **Navigation timeout**: 30s timeout for initial page load
- **Auth check**: Compares current URL against expected Lightning URL pattern

### Key Insights

- **Browser stays open**: Unlike automated operations, the browser remains open so user can interact
- **Session refresh**: On success, cookies and session state are saved automatically
- **Non-blocking**: UI remains responsive during test (async operation)
- **Uses existing profile**: Shares cookies/session with login flow

---

## 🔄 Auto-Update for Private Repo (2026-04-10)

### Problem

Auto-update was returning 404 error because the GitHub repo is **private**:
```
404 "method: GET url: https://github.com/cmpdev23/cmpDesk/releases.atom
Please double check that your authentication token is correct..."
```

### Root Cause

- electron-updater cannot access private repos without authentication
- GitHub returns 404 (not 403) for security reasons - doesn't reveal if repo exists

### Solution

Use a **Fine-grained Personal Access Token (PAT)** with minimal permissions:
1. Repository access: Only `cmpdev23/cmpDesk`
2. Permissions: `Contents: Read-only` (just enough to read releases)

### Implementation

**1. GitHub Secret**: `GH_RELEASE_TOKEN` added in repo settings

**2. Workflow injection** (`.github/workflows/release.yml`):
```yaml
- name: Create .env from repository variables
  run: |
    echo "GH_RELEASE_TOKEN=${{ secrets.GH_RELEASE_TOKEN }}" >> .env
```

**3. Updater configuration** (`electron/services/updater/index.js`):
```javascript
const ghReleaseToken = process.env.GH_RELEASE_TOKEN;
if (ghReleaseToken) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'cmpdev23',
    repo: 'cmpDesk',
    private: true,
    token: ghReleaseToken,
  });
}
```

### Tokens Distinction

| Token | Purpose | Source |
|-------|---------|--------|
| `GH_TOKEN` | Publish releases (CI/CD) | Auto-generated by GitHub Actions |
| `GH_RELEASE_TOKEN` | Read releases (app runtime) | Fine-grained PAT in secrets |

### Security Notes

- Token is **embedded in the built app** (via .env during CI)
- Risk is minimal: token can only **read** from this specific repo
- Worst case if extracted: attacker can read public release info (equivalent to public repo)
- Code remains private ✅

### Files Modified

| File | Change |
|------|--------|
| `.github/workflows/release.yml` | Inject `GH_RELEASE_TOKEN` into .env |
| `.github/workflows/build.yml` | Same injection for consistency |
| `electron/services/updater/index.js` | Configure `setFeedURL` with private token |
| `.env.example` | Document `GH_RELEASE_TOKEN` variable |
