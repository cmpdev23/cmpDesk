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

---

## 🔍 Salesforce API Reference

### Search

| API | Use Case | Descriptor |
|-----|----------|------------|
| `getSuggestions` | Name search (typeahead) | `AssistantSuggestionsDataProviderController/ACTION$getSuggestions` |
| `getAnswers` | Phone/Email search (SOSL) | `PredictedResultsDataProviderController/ACTION$getAnswers` |

**Key**: `getSuggestions` does NOT search Phone field. Use `getAnswers` with `withSingleSOSL: true` for phone search.

**Response structure**: `returnValue.answers[].data.results[].result[].record`

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

## 📋 Active TODOs

- [ ] Create `lib/upload_document.js` stable function for main.js integration
- [ ] Create `lib/create_note.js` integration into main.js
- [ ] Test refactored Electron structure (`main.refactored.js` → `main.js`)

---

## 🚫 Anti-patterns

- **Don't construct aura.context manually** — capture from real requests
- **Don't use networkidle on Lightning** — always `domcontentloaded` + explicit wait
- **Don't guess field names** — verify via SF Object Manager
- **Don't run two scripts simultaneously** — browser_profile gets locked
- **Don't use Escape/Tab on Flow modals** — Escape closes modal, Tab may trigger Next button
