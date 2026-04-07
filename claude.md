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
page.on("request", req => {
  if (req.method() === "POST" && req.url().includes("/aura")) {
    // Extract aura.context + aura.token from POST body
  }
});
```

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
- [ ] Create `lib/create_note.js` integration into main.js
- [ ] Test refactored Electron structure (`main.refactored.js` → `main.js`)
- [ ] Add note creation step to Dossiers workflow
- [x] ~~Add document upload step to Dossiers workflow~~ (Done: integrated in handleSubmit)

---

## 🚫 Anti-patterns

- **Don't construct aura.context manually** — capture from real requests
- **Don't use networkidle on Lightning** — always `domcontentloaded` + explicit wait
- **Don't guess field names** — verify via SF Object Manager
- **Don't run two scripts simultaneously** — browser_profile gets locked
- **Don't use Escape/Tab on Flow modals** — Escape closes modal, Tab may trigger Next button
- **IPC handlers in main.js, NOT modular** — `electron/ipc/` folder exists but main.js uses inline handlers. Add new IPC handlers directly in `main.js` after `salesforce:searchAccount`
