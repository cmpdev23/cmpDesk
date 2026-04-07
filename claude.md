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

## 🚫 Anti-patterns

- **Don't construct aura.context manually** — capture from real requests
- **Don't use networkidle on Lightning** — always `domcontentloaded` + explicit wait
- **Don't guess field names** — verify via SF Object Manager
- **Don't run two scripts simultaneously** — browser_profile gets locked
- **Don't use Escape/Tab on Flow modals** — Escape closes modal, Tab may trigger Next button
- **IPC handlers in main.js, NOT modular** — `electron/ipc/` folder exists but main.js uses inline handlers. Add new IPC handlers directly in `main.js` after `salesforce:searchAccount`
- **Don't delete browser_profile/ entirely for logout** — use surgical cookie removal to preserve form autofill
