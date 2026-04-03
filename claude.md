# CLAUDE MEMORY

## Rules (from mistakes)

- **Aura credentials = ALWAYS capture from real requests** - Never construct fwuid or token manually
- **`ctx.fwuid` returns `undefined` in production** - SF obfuscates methods; property doesn't exist on minified build
- **`aura.token = "undefined"` causes `invalidSession`** - Must be a real CSRF token from a live request
- **Use `domcontentloaded` not `networkidle` on Lightning** - SF does constant polling, networkidle never settles
- **Browser profile lock = previous browser still open** - Always close navigateur between test runs
- **Validation errors ≠ API errors** - `state: ERROR` with field errors means API works, data is wrong

## Patterns observed

- Salesforce minifies $A methods in production (e.g., `getEncodedFWUID` → `ys`, `Dz`, etc.)
- Every Aura POST contains valid `aura.context` (fwuid) + `aura.token` - intercept to extract
- Two cookie systems: `persisted_cookies.json` (INALCO) vs `salesforce_cookies.json` (SF) - only first exists
- SF validation rules require paired fields: email+email_type, phone+phone_type
- **`Primary_Email_Type__c`** and **`Primary_Phone_Type__c`** are the confirmed API names for type fields (both Picklist, `__c` variant — not `__pc`)
- Lightning fires multiple Aura requests on page load - first request already has valid credentials

## Mistakes (raw)

- Tried `ctx.fwuid` directly → undefined in prod
- Set `aura.token = "undefined"` → invalidSession
- Used `page.reload({ waitUntil: "networkidle" })` → 30s timeout
- Tried to capture fwuid via `getEncodedFWUID()` → method not found in obfuscated build
- Guessed field name `Phone_Type__c` → doesn't exist, need to inspect object manager

## Discoveries

- **Working approach**: `page.on("request")` intercepts Aura POSTs → extract `aura.context` + `aura.token`
- **Account created**: Record `001JQ00001AxkgVYAR` via `aura://RecordUiController/ACTION$createRecord`
- **$A.enqueueAction** is available and is how Lightning makes server calls natively
- **e.force:createRecord** opens modal UI - NOT an API call
- **Account FSC RecordTypeId**: `0125Y000001zWhpQAE`
- **Email field**: `Primary_Email__c` (not `PersonEmail`) + requires paired type field
- **Phone**: must be 10 digits numeric + requires paired type field
- **SSO Redirect Page**: Salesforce sometimes shows a login redirect page even with valid cookies. URL is `indall.my.salesforce.com` with SSO button. Must click "Se connecter avec Single Sign-On" to proceed.
- **Search API descriptor**: `serviceComponent://ui.search.components.forcesearch.assistant.AssistantSuggestionsDataProviderController/ACTION$getSuggestions`
- **Search API response structure**: `{ answers: [{ type: "...", data: [{ record: {...}, scopeMap: {...} }] }] }` - records are nested inside `answers[0].data[i].record`

## System improvements (TODO)

- [x] Deprecate `salesforce_aura.js` → deleted (v1 dead code removed 2026-04-01)
- [x] Deprecate `scripts/create_account_api.js` → deleted (used v1 AuraClient)
- [x] Fix `scripts/seeds/account.js` — added import/export, added `Primary_Email__c`, `Primary_Email_Type__c`, `Phone` fields (2026-04-01)
- [x] Fix `scripts/create_account_api_v2.js` — removed unused `ACCOUNT_RECORD_TYPE_ID` import (2026-04-01)
- [x] Created `inspectors/inspect_account_fields.js` — runs `getObjectInfo(Account)` via Aura to dump all field metadata (2026-04-01)
- [x] Created `scripts/main.js` — orchestrateur principal, Milestone 1 intégré (2026-04-02)
- [ ] Run `inspect_account_fields.js` → confirm exact API names for phone type and email type fields → update seeds/account.js
- [ ] Add re-capture logic when token expires (auto-retry on invalidSession)
- [ ] Create `lib/salesforce.js` as single public API layer wrapping AuraClientV2
- [ ] Document all required fields per RecordType in `docs/`
- [x] Milestone 2: Créer le Case lié à l'Opportunity (lib/create_case.js) — **BLOCKED by validation rule**
- [ ] Milestone 3: Déclencher le Flow `Opportunity_UpdateCaseInformation` via API

## Milestone — inspectors refactor (2026-04-01)

- **inspectors/ reorganized** into two categories:
  - `inspectors/aura/` — 5 files exploring the Aura framework (context, fwuid, token, native events)
  - `inspectors/account/` — 3 files inspecting Account metadata (fields, picklists via API + DOM)
- **All imports updated**: `../auth/` → `../../auth/`, reports path → `join(__dirname, "..", "reports", ...)`
- **reports/ stays flat** at `inspectors/reports/` — all scripts write there regardless of subfolder
- **Rule**: New inspectors must be placed in the correct category subfolder, never in `inspectors/` root

---

## Milestone — v2 cleanup (2026-04-01)

- **Dead code removed**: `auth/salesforce_aura.js` (AuraClient v1) and `scripts/create_account_api.js`
- **Active client**: `auth/salesforce_aura_v2.js` (AuraClientV2) — credential capture via request interception
- **Active script**: `scripts/create_account_api_v2.js` — uses AuraClientV2, auto-capture of fwuid + token
- **Rule**: Never re-introduce manual `$A.getContext()` / `getEncodedFWUID()` — always intercept from live requests

## Anti-patterns

- **Don't construct aura.context manually** - capture from real requests
- **Don't use networkidle on Lightning** - always `domcontentloaded` + explicit waitForTimeout
- **Don't guess field names** - verify via SF Object Manager or DOM inspection
- **Don't run two scripts simultaneously** - browser_profile directory gets locked
- **NEVER use UI interactions for data operations** - Always use API (Aura) for search, create, update, read operations. Playwright is ONLY for: auth, session init, context capture
- **NEVER taskkill chrome.exe** - User may be using Chrome in parallel. Only kill Chromium processes if needed (Playwright uses Chromium, not Chrome)
- **NEVER put seed data in script files** - All test data / seeds must be in `scripts/seeds/` folder (e.g., `scripts/seeds/account.js`, `scripts/seeds/opportunity.js`)

## Experiments / Hypotheses

- **Hypothesis**: Captured credentials can be cached and reused across multiple API calls until expiry
- **Hypothesis**: Token expires with session - re-capture needed ~every 2h
- **Experiment**: Test if $A.enqueueAction can bypass manual context construction entirely

---

## Milestone — Opportunity Inspection (2026-04-02)

### Key Discoveries

- **Opportunity RecordTypeId**: `012Am0000004KaZIAU`
- **Create Descriptor**: `aura://RecordUiController/ACTION$createRecord`
- **Picklist Descriptor**: `aura://RecordUiController/ACTION$getPicklistValuesByRecordType`

### Opportunity recordInput Fields

Fields captured during creation (from `inspectors/reports/opportunity_creation_flow.json`):

**Required fields:**
- `AccountId` - Parent account ID
- `CloseDate` - Close date (format: "YYYY-MM-DD")
- `StageName` - Pipeline stage (e.g., "Closed Won")
- `RecordTypeId` - `012Am0000004KaZIAU`
- `OwnerId` - Owner user ID

**Key custom fields:**
- `Annual_Premium__c` - Number
- `Contract_Number__c` - String
- `Opportunity_Category__c` - Picklist (e.g., "Gobal Offer")
- `Product_Interest__c` - Picklist (e.g., "Life Insurance")
- `Proposal_Number__c` - String
- `Subsidiary__c` - Picklist (e.g., "iA")
- `Probability` - Number (0-100)

**Optional fields:**
- `Amount`
- `Description`
- `LeadSource`
- `Lead_Source_Other__c`
- `Loss_Reason__c`
- `Name` (auto-generated if null)
- `FinServ__ReferredByContact__c`
- `FinServ__ReferredByUser__c`
- `Frequency__c`
- `Initial_Investment_Amount__c`
- `Periodic_Amount__c`
- `Related_Opportunity__c`
- `Transaction_Date__c`
- `Contract_Renewal_Date__c`
- `Actual_Sales_Credit__c`
- `Override_Estimated_Sales_Credit__c`

### Pre-creation API calls

1. `doRecordTypeCheck` - Validates record type before showing form
2. `isEntityUiApiSupported` - Checks UI API support
3. `getPicklistValuesByRecordType` - Fetches picklist values for Opportunity

### New lib functions created

- `lib/search_account.js` - Reusable account search function
  - `searchAccountByName(client, searchName, options)` - Search by name
  - `buildAccountUrl(accountId, baseUrl)` - Build SF account URL
- `lib/form_extractor.js` - Robust form extraction with Shadow DOM support
  - `FormExtractor` class with debugging capabilities
  - `extractFormPicklists(page, options)` - Quick extraction function
- `lib/create_opportunity.js` - Reusable Opportunity creation function (2026-04-02)
  - `createOpportunity(client, fields, options)` - Creates Opportunity via Aura API
  - `buildOpportunityUrl(opportunityId, baseUrl)` - Builds SF Opportunity URL
  - Validates required fields: `AccountId`, `StageName`, `CloseDate`
  - Applies defaults: `RecordTypeId` (012Am0000004KaZIAU), `Probability` (100)
  - Returns: `{ success, recordId, recordUrl, state, error, errors }`

---

## Milestone — UI Form Extraction (2026-04-02)

### Key Discoveries

- **Salesforce Flow forms use Shadow DOM** - Standard `document.querySelector()` can't see inside Lightning Web Components
- **Playwright locators pierce Shadow DOM** - `page.locator("lightning-combobox")` works through shadow roots
- **NEVER use Escape key on Flow modals** - It closes the entire modal, not just the dropdown
- **NEVER use Tab key on Flow modals** - It may trigger the Next button and advance/close the form
- **6 lightning-combobox elements found outside the modal** - When searching globally, you may find header/nav elements
- **Flow modal uses `[role='dialog']`** - But shadow DOM prevents seeing inner elements via evaluate()

### Form Field Types Discovered

| Type | Selector | Count in Opportunity Form |
|------|----------|---------------------------|
| Picklist | `lightning-combobox` | 6 |
| Input | `lightning-input` | 7 |
| Textarea | `lightning-textarea` | 1 |
| Lookup | `lightning-lookup` | 4 |
| Datepicker | `lightning-datepicker` | 3 |

### Shadow DOM Traversal Pattern

```javascript
// Playwright locators pierce shadow DOM automatically
const locator = page.locator(`css=lightning-combobox`);
const count = await locator.count(); // Works!

// page.evaluate() does NOT pierce shadow DOM
const count = await page.evaluate(() =>
  document.querySelectorAll("lightning-combobox").length
); // Returns 0 inside shadow DOM!
```

### Anti-patterns for Flow Forms

- **Don't use Escape to close dropdowns** - Closes the modal
- **Don't use Tab to move focus** - May trigger Next button
- **Don't click outside the form** - May close the modal
- **Don't assume comboboxes on page are in the form** - Header/nav have their own

### Inspector Scripts Created

- `inspectors/opportunity/inspect_opportunity_creation.js` - API flow capture (Aura)
- `inspectors/opportunity/inspect_opportunity_simple.js` - UI form field extraction (DOM)
- `inspectors/opportunity/inspect_opportunity_picklist_ui.js` - Picklist value extraction (WIP)
- `inspectors/opportunity/inspect_opportunity_popup.js` - Post-creation popup inspection (2026-04-02)

---

## Milestone — Opportunity Popup Discovery (2026-04-02)

### Key Discovery: The Popup is a Screen Flow creating a CASE

The popup form that appears after Opportunity creation is **NOT an Opportunity edit form**.
It is a **Salesforce Screen Flow** that creates a **Case** record linked to the Opportunity.

**Flow Details:**
- **Flow API Name**: `Opportunity_UpdateCaseInformation`
- **Descriptor**: `aura://FlowRuntimeConnectController/ACTION$startFlow`
- **Arguments**: `[{"name":"recordId","type":"String","value":"<OpportunityId>"}]`

### Case Object (linked to Opportunity)

The fields previously thought to be "Step 2" and "Step 3" of Opportunity creation are actually **Case fields**:

| Field (UI Label)              | Case Field API Name                | Type     |
| ----------------------------- | ---------------------------------- | -------- |
| Famille de produit            | `Product_Family__c`                | Picklist |
| Catégorie de transaction      | `Transaction_Category__c`          | Picklist |
| Sous-catégorie de transaction | `Transaction_Sub_Category__c`      | Picklist |
| Type de signature             | `SignatureType__c`                 | Picklist |
| Lieu de résidence             | `CustomersPlaceOfResidence__c`     | Picklist |
| Type de produit               | `ProductType__c`                   | Picklist |

### Case RecordTypeId

- **RecordTypeId**: `012Am0000004KaPIAU`
- **Picklist API**: `aura://RecordUiController/ACTION$getPicklistValuesByRecordType`

### Opportunity → Case Relationship

The Opportunity has a lookup field `Case__c` that references the Case record. Formula fields pull data from the Case:

- `Opportunity.Case__r.Product_Family__c`
- `Opportunity.Case__r.Transaction_Category__c`
- `Opportunity.Case__r.Transaction_Sub_Category__c`
- `Opportunity.Case__r.SignatureType__c`
- `Opportunity.Case__r.CustomersPlaceOfResidence__c`
- `Opportunity.CaseProductFamily__c` (formula from Case)
- `Opportunity.CaseTransactionCategory__c` (formula from Case)

### Flow Navigation Structure

The Flow has multiple screens navigated via `navigateFlow` with action `NEXT`:

**Screen 1 Fields (mapped from capture):**
- `_7` = Transaction type label ("Nouveau Contrat")
- `_8` = Product Family ("Insurance")
- `_9` = Transaction Category ("New Contract")
- `_10` = Transaction Sub Category ("Without Replacement")

**Screen 2 Fields (mapped from capture):**
- `ProductFamily.productFamilyPicklist.Insurance.selected` = boolean
- `TransactionCategory.transactionCategoryPicklist.New Contract.selected` = boolean
- `TransactionSubCategory.subCategoryPicklist.Without Replacement.selected` = boolean
- `_4` = Signature Type ("Electronic")
- `_5` = Product Interest ("Life Insurance")
- `_6` = Residence Location ("Quebec")

### API Call Sequence (Post-Opportunity Creation)

1. Navigation to Opportunity record triggers page load
2. `ApexActionController/execute` calls `ORDCVerificationCTRL.getCaseInfo(oppId)` - checks if Case exists
3. `FlowRuntimeConnectController/startFlow` launches `Opportunity_UpdateCaseInformation`
4. `RecordUiController/getPicklistValuesByRecordType` fetches Case picklist values
5. User fills Flow screens → `FlowRuntimeConnectController/navigateFlow` (action: NEXT)
6. Flow completes → `RecordGvpController/saveRecord` saves the Opportunity (with Case link)

### Implications for Automation

To fully automate Opportunity + Case creation:

1. **Option A - Two API Calls:**
   - Create Opportunity via `RecordUiController/createRecord`
   - Create Case via `RecordUiController/createRecord` (with `Opportunity__c` lookup)
   - Update Opportunity with `Case__c` lookup

2. **Option B - Trigger the Flow programmatically:**
   - Use `FlowRuntimeConnectController/startFlow` with `flowDevName: "Opportunity_UpdateCaseInformation"`
   - Navigate screens via `FlowRuntimeConnectController/navigateFlow`

3. **Option C - UI Automation:**
   - Let the Flow open naturally after Opportunity creation
   - Fill forms via Playwright (current approach but slower)

### Report Location

Full capture data: `inspectors/reports/opportunity_popup_inspection.json`

---

## Milestone — Case Creation Discovery (2026-04-02)

### Key Discovery: Case is Auto-Created, Flow is for UPDATE

**Error encountered:** `FIELD_CUSTOM_VALIDATION_EXCEPTION`
**Message:** "Il ne peut y avoir qu'une Requête par Opportunité" (There can only be one Request per Opportunity)

### Real Workflow Discovered

```
1. Create Opportunity via API
   └─→ SF Trigger/Automation AUTOMATICALLY creates an empty Case
   └─→ Case is linked to Opportunity (Opportunity.Case__c populated)

2. Navigate to Opportunity record
   └─→ Screen Flow popup appears
   └─→ Flow is for UPDATING the existing Case (not creating)
   └─→ User fills: Product_Family__c, Transaction_Category__c, etc.
```

### What We Learned

1. **Case is created automatically** by SF automation when Opportunity is created
2. **The Screen Flow updates the Case**, it doesn't create it
3. **Direct Case creation via API fails** because Case already exists (validation rule)
4. **Our `lib/create_case.js` should become `lib/update_case.js`**

### Revised Strategy

**Option A - API UPDATE (Recommended):**
1. Create Opportunity via API ✅
2. Query the auto-created Case ID (via `Opportunity.Case__c` or SOQL)
3. UPDATE the Case with required fields via `RecordUiController/ACTION$updateRecord`

**Option B - Flow API:**
1. Create Opportunity via API ✅
2. Call `FlowRuntimeConnectController/startFlow` with `Opportunity_UpdateCaseInformation`
3. Navigate Flow screens via `FlowRuntimeConnectController/navigateFlow`

**Option C - Hybrid (Playwright):**
1. Create Opportunity via API ✅
2. Navigate to Opportunity (triggers Flow)
3. Fill Flow forms via Playwright UI

### Files Created

- `lib/create_case.js` — Case creation function (blocked by validation rule)
- `lib/update_case.js` — ✅ Case update function (WORKING)
- `scripts/seeds/case.js` — Case test data builders
- `scripts/main.js` — Updated with `milestone_updateCase`
- `scripts/update_opportunity.js` — Test script for existing Opportunities

### API Discovery: updateRecord

The `updateRecord` API requires `recordId` at params level:

```javascript
await client.auraAction({
  descriptor: "aura://RecordUiController/ACTION$updateRecord",
  params: {
    recordId: caseId,  // ← REQUIRED at params level
    recordInput: {
      allowSaveOnDuplicate: false,
      fields: { Id: caseId, ...otherFields },
    },
  },
  queryParams: { "aura.RecordUi.updateRecord": "1" },
});
```

### Completed (2026-04-02)

- [x] Create `lib/update_case.js` — Update existing Case via API
- [x] Query Case ID from Opportunity via `Opportunity.Case__c`
- [x] Refactor `milestone_createCase` → `milestone_updateCase`
- [x] Test full flow: getCaseIdFromOpportunity() → updateCase()
- [x] Add `ProductType__c` to required Case fields (validation rule discovered)

### Test Results

```
Opportunity ID: 006JQ00000qbPmHYAU
Case ID: 500JQ00000xuhTLYAY
Fields updated: Product_Family__c, Transaction_Category__c,
                Transaction_Sub_Category__c, SignatureType__c,
                CustomersPlaceOfResidence__c, ProductType__c
Result: SUCCESS ✅
```

### Case Required Fields (Updated)

| Field | Value | Notes |
|-------|-------|-------|
| `Product_Family__c` | "Insurance" | Picklist |
| `Transaction_Category__c` | "New Contract" | Picklist |
| `Transaction_Sub_Category__c` | "Without Replacement" | Picklist |
| `SignatureType__c` | "Electronic" | Picklist |
| `CustomersPlaceOfResidence__c` | "Quebec" | Picklist |
| `ProductType__c` | "Life Insurance" | **Required** - Validation rule |

---

## Milestone — Note Creation Discovery (2026-04-02)

### Key Discovery: Notes use ContentNote + Two-Step Process

Creating a Note linked to a Case requires **two API calls**:

1. **Create ContentNote** via `RecordGvpController/ACTION$saveRecord`
2. **Link to Case** via `EditPanelController/ACTION$serverCreateUpdate`

### API Details

**Step 1: Create ContentNote**
- **Descriptor**: `serviceComponent://ui.force.components.controllers.recordGlobalValueProvider.RecordGvpController/ACTION$saveRecord`
- **Object API Name**: `ContentNote`
- **Fields**:
  | Field | Type | Description |
  |-------|------|-------------|
  | `Title` | String | Note title |
  | `Content` | Base64 | HTML content encoded in base64 (e.g., `PHA+PC9wPg==` = `<p></p>`) |
  | `OwnerId` | ID | User ID (owner) |
  | `SharingPrivacy` | String | "N" for normal sharing |

**Step 2: Link ContentNote to Case**
- **Descriptor**: `serviceComponent://ui.notes.components.aura.components.editPanel.EditPanelController/ACTION$serverCreateUpdate`
- **Parameters**:
  | Param | Type | Description |
  |-------|------|-------------|
  | `noteId` | ID | ContentNote ID (from step 1) |
  | `title` | String | Empty or note title |
  | `textContent` | String | Plain text content |
  | `richTextContent` | String | Rich text content |
  | `noteChanged` | Boolean | false if only linking |
  | `relatedIdsChanged` | Boolean | true when linking |
  | `relatedIds` | Array | Array of record IDs to link (Case ID) |

### Example Payload Captured

**Step 1 - Create ContentNote:**
```javascript
{
  recordRep: {
    id: null,
    apiName: "ContentNote",
    fields: {
      Id: { value: null },
      Title: { value: "NOTE TEST" },
      Content: { value: "PHA+Q0VDSSBFU1QgVU5FIE5PVEUgVEVTVEUgPC9wPg==" }, // Base64 HTML
      OwnerId: { value: "005JQ000005SQNKYA4" },
      SharingPrivacy: { value: "N" }
    },
    recordTypeInfo: null
  },
  recordSaveParams: { bypassAsyncSave: true }
}
```

**Step 2 - Link to Case:**
```javascript
{
  noteId: "069JQ00000s0UF8YAM",  // ContentNote ID
  title: "",
  textContent: "",
  richTextContent: "",
  noteChanged: false,
  relatedIdsChanged: true,
  relatedIds: ["500JQ00000xut34YAA"]  // Case ID
}
```

### Content Encoding

Note content is HTML encoded in Base64:
- `PHA+PC9wPg==` → `<p></p>` (empty paragraph)
- `PHA+Q0VDSSBFU1QgVU5FIE5PVEUgVEVTVEUgPC9wPg==` → `<p>CECI EST UNE NOTE TESTE </p>`

Use `Buffer.from(htmlContent).toString('base64')` for encoding.

### Inspector Script Created

- `inspectors/case/inspect_note_creation.js` — Captures Note creation API calls
- Report: `inspectors/reports/case/note_creation_inspection.json`

### Next Steps (Milestone 3)

- [ ] Create `lib/create_note.js` — Two-step ContentNote creation + linking
- [ ] Test with real Case ID
- [ ] Integrate into `scripts/main.js` as `milestone_createNote()`

---

## Milestone — Document Upload Discovery (2026-04-02)

### 🚨 Key Discovery: xECM (OpenText Extended ECM)

Document upload in Salesforce **does NOT use** native Salesforce Files API.
The system uses **xECM (OpenText Extended ECM)** integrated via Canvas App.

### 🎯 OpenText Server IDENTIFIED (2026-04-02)

| Component | URL / Value |
|-----------|-------------|
| **OpenText Content Server** | `https://otcs.ia.ca/cs/cs/` |
| **Canvas App Endpoint** | `https://otcs.ia.ca/cs/cs/xecmsf/canvas` |
| **Node API** | `https://otcs.ia.ca/cs/cs/app/nodes/{nodeId}` |
| **OTDS SSO** | `https://otds.ia.ca/` |
| **Workspace Node (Case)** | `147266903` |
| **Auth Token Format** | `*OTDSSSO*{base64_encoded_token}` |

### Problem: iframe Authentication Blocked

When opening document management in a Case:
```
login.microsoftonline.com n'autorise pas la connexion.
```

**Cause:**
- xECM Canvas App runs in an **iframe**
- iframe tries to load Microsoft login page
- Microsoft blocks logins in iframes via `X-Frame-Options: DENY`
- Security measure against clickjacking

### Aura Descriptors Captured

```
apex://xecm.CanvasAppController/ACTION$getCanvasApp
apex://xecm.CanvasAppController/ACTION$getPerspectiveParameters
apex://xecm.CanvasAppController/ACTION$isAutoWorkspaceCreateEnabled
apex://xecm.CanvasAppController/ACTION$isUserLicensed
serviceComponent://ui.force.components.controllers.canvasApp.CanvasAppController/ACTION$getCanvasAppData
```

### Canvas App Flow Discovered

1. `isUserLicensed` → Check user has xECM license
2. `isAutoWorkspaceCreateEnabled` → Check workspace auto-creation
3. `getCanvasApp` + `getPerspectiveParameters` → Get Canvas config with:
   - `perspectiveUrl`: `https://otcs.ia.ca/cs/cs/app/nodes/{workspaceNodeId}`
   - `token`: OTDS SSO token (`*OTDSSSO*...`)
4. `PUT /services/data/v66.0/platformconnect/signedrequest?canvas=OpenTextApp` → Signed request to Canvas
5. Redirect to `https://otcs.ia.ca/cs/cs/xecmsf/canvas` → Canvas App iframe

### Implications for Automation

1. **No access via standard Playwright iframe** — Microsoft login blocked
2. **Token is available via Salesforce API** — Can capture OTDS SSO token
3. **OpenText REST API accessible** — With captured token
4. **Workspace Node ID linked to Case** — Node `147266903` for Case `500JQ00000xut34YAA`

### Investigation Options

| Option | Approach | Complexity | Status |
|--------|----------|------------|--------|
| 1 | Direct xECM REST API | Medium | ✅ Server URL found |
| 2 | Salesforce Connect / External Objects | Low if exists | ❓ To check |
| 3 | Microsoft Graph API | High | ❌ Not needed |
| 4 | Capture OTDS token via SF API | Low | ✅ Token format known |

### Files Created

- `docs/files.md` — Full documentation of xECM discovery
- `inspectors/case/inspect_document_upload.js` — Network capture script
- `inspectors/case/inspect_xecm_responses.js` — xECM response body capture
- `inspectors/reports/case/document_upload_inspection.json` — Capture report
- `inspectors/reports/case/xecm_responses_inspection.json` — xECM responses

### ✅ Upload Test SUCCESS (2026-04-02)

**3 documents uploaded successfully to OpenText Content Server!**

| Document | Node ID | Size |
|----------|---------|------|
| DOCUMENT_1.pdf | 147292342 | 12,618 bytes |
| DOCUMENT_2.pdf | 147329598 | 12,238 bytes |
| DOCUMENT_3.pdf | 147343832 | 12,638 bytes |

### Working API Call

```http
POST https://otcs.ia.ca/cs/cs/api/v2/nodes
Headers:
  OTDSTicket: *OTDSSSO*{captured_token}
  Content-Type: multipart/form-data
Body:
  type=144 (Document)
  parent_id={workspaceNodeId}
  name={filename}
  file={binary_content}
```

### Next Steps (Milestone 4 - Document Upload)

- [x] Identify OpenText/xECM server URL → `https://otcs.ia.ca/cs/cs/`
- [x] Identify OTDS token format → `*OTDSSSO*{base64}`
- [x] Identify Workspace Node ID mapping
- [x] Test OpenText REST API endpoints directly → ✅ SUCCESS
- [x] Capture OTDS token via `getPerspectiveParameters` call → ✅ Automatic capture
- [ ] Create `lib/upload_document.js` stable function for main.js integration

---

## Bugfix — SF Authentication Flow (2026-04-03)

### Problem

When SF session cookies are expired, `main.js` would fail immediately with:
```
❌ Bootstrap échoué: Session SF non authentifiée
```

Instead of allowing the user to authenticate manually via the unified auth flow.

### Root Cause

`bootstrapAuraClient()` was checking `isSfAuthenticated(page)` and returning an error immediately if false, without giving the user a chance to log in manually.

### Solution

Modified `bootstrapAuraClient()` in `scripts/main.js` to:

1. **Handle SSO redirects** via `handleSsoRedirect()` from `auth/salesforce_sso.js`
2. **Wait for manual authentication** with a configurable timeout (default: 180s)
3. **Show progress** while waiting for user to authenticate
4. **Retry Aura detection** up to 3 times after authentication

### New Auth Flow

```
1. Navigate to SF_HOME_URL
2. Wait for page to stabilize (3s)
3. Handle SSO redirect if present
4. If not authenticated:
   └─→ Show message: "Veuillez vous authentifier manuellement..."
   └─→ Wait loop (check every 3s, timeout 180s):
       - Handle any SSO redirects
       - Check isOnLightning() or isSfAuthenticated()
       - Show remaining time
   └─→ If timeout: return error
   └─→ If success: continue
5. Confirm we're on Lightning (navigate if needed)
6. Build Aura client with retry logic
```

### Files Modified

- `scripts/main.js` — Added import for `isOnSsoPage`, `isOnLightning`; rewrote `bootstrapAuraClient()` with manual auth wait loop

### Key Design Decision

**Don't use `handleSsoRedirect()` with its internal timeout** — the MFA flow (Microsoft Authenticator) can take a long time. Instead:
1. Click SSO button once (if on SSO page)
2. Let the main 180s timeout handle the wait
3. Check `isOnLightning()` every 3s until success or timeout

---

## Bugfix — getUserId() fails in main.js (2026-04-03)

### Problem

When running `main.js`, the `createNote` milestone fails with:
```
❌ createNote                     Impossible d'extraire le UserId du context SF
```

Yet the same logic worked in `scripts/create_note_for_case.js`.

### Root Cause

The original `getUserId()` function only used 3 methods that rely on Aura GVP (Global Value Provider) being fully loaded:
1. `$A.get("$SObjectType.CurrentUser.Id")`
2. `window.$User.id`
3. `$A.getContext().getGlobal("$User")`

**In `create_note_for_case.js`**: The script navigates to the Case page first, which triggers Lightning to fully populate the `$SObjectType.CurrentUser.Id` GVP.

**In `main.js`**: The Aura client is created once at bootstrap on the home page. By the time `milestone_createNote` runs, navigation has occurred and the GVP state may not include the CurrentUser.Id (depends on what actions were triggered on the page).

### Solution

Extended `getUserId()` with 6 extraction methods:

1. `$A.get("$SObjectType.CurrentUser.Id")` — Aura GVP (when loaded)
2. `window.UserContext.userId` — **NEW**: Lightning Experience context (always available)
3. `window.$User.id` — Global context
4. `$A.getContext().getGlobal("$User")` — Aura context global
5. **NEW**: Parse `<script>` tags for `"userId":"005..."` pattern
6. **NEW**: Direct GVP access via `$A.getContext().getGlobalValueProviders()`

Method 2 (`UserContext.userId`) is the most reliable fallback because Lightning Experience always sets this global.

### Files Modified

- `lib/create_note.js` — Extended `getUserId()` with 6 extraction methods

---

## Bugfix — getUserId() timing issue in main.js (2026-04-03)

### Problem

`milestone_createNote` in `main.js` fails with:
```
❌ createNote                     Impossible d'extraire le UserId du context SF
```

Yet the same logic works in `scripts/create_note_for_case.js`.

### Root Cause

The 6 extraction methods in `getUserId()` all depend on Lightning context being **fully loaded**.

**Key difference:**
- `scripts/create_note_for_case.js` → Navigates to Case page + waits 5s before calling `getUserId()`
- `scripts/main.js` → Called `getUserId()` immediately without waiting for Lightning context

After `milestone_updateCase` navigates to the Case, the `UserContext` and `$A` globals may not be fully populated yet.

### Solution

Added explicit navigation + wait in `milestone_createNote()`:

```javascript
// Step 0: Navigate to Case page and wait for Lightning context
const caseUrl = `${SF_HOME_URL.replace('/page/home', '')}/r/Case/${caseId}/view`;
await page.goto(caseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(5_000);  // ← Critical: wait for Lightning globals
```

### Rule Added

**Always navigate to a record page AND wait 5s before calling `getUserId()`**. The Lightning context globals (`$A`, `UserContext`, `$User`) are not available immediately after navigation.

### Files Modified

- `scripts/main.js` — Added navigation + 5s wait before `getUserId()` call in `milestone_createNote()`

---

## Milestone — cmpDesk UI Foundation (2026-04-03)

### Overview

Initialized the cmpDesk Electron desktop application with a complete UI foundation.

### Stack Implemented

| Component | Technology | Status |
|-----------|------------|--------|
| Desktop Runtime | Electron 33 | ✅ |
| Frontend | React 18 + Vite 5 | ✅ |
| Styling | Tailwind CSS 3.4 | ✅ |
| UI Components | shadcn/ui (prepared) | ✅ |
| Routing | React Router 6 | ✅ |
| Database | SQLite (folder prepared) | 🔜 |

### Project Structure

```
cmpDesk/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # Secure context bridge
├── src/
│   ├── components/      # UI components (shadcn/ui ready)
│   ├── layout/
│   │   └── AppLayout.tsx  # Global layout (sidebar + topbar + content)
│   ├── lib/
│   │   └── utils.ts     # Utilities (cn() for Tailwind)
│   ├── pages/
│   │   └── Home.tsx     # Home page
│   ├── App.tsx          # Router configuration
│   ├── main.tsx         # React entry point
│   └── index.css        # Tailwind directives
├── database/            # SQLite (prepared, empty)
├── package.json         # Dependencies & scripts
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
├── components.json      # shadcn/ui configuration
└── tsconfig.json        # TypeScript configuration
```

### Layout Structure

```
┌─────────────────────────────────────────────┐
│ Topbar (bg-green-500)          h-14         │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │       Content Area               │
│ (blue)   │       (bg-gray-100)              │
│ w-56     │                                  │
│          │       <Outlet /> ← pages         │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

### Design System — NordVPN Inspired Dark Theme (2026-04-03)

**Stylesheet**: `/src/styles/style.css`

**Color Palette** (defined in `tailwind.config.js`):

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

**Layout Structure**:
- Topbar: `bg-surface border-b border-border`
- Sidebar: `bg-surface border-r border-border`
- Content: `bg-app`

**Rules**:
- No inline hex colors in components
- All colors via Tailwind config tokens
- Hover states use `hover:bg-surface-light`

### Electron Window Config

- **Size**: 1200×800 (fixed)
- **Resizable**: false
- **Centered**: true
- **Background**: #1a1a1a
- **DevTools**: Auto-open in dev mode

### Scripts

```bash
npm run dev         # Start Vite + Electron concurrently
npm run build       # Build for production
npm run electron:start  # Start Electron only (after build)
```

### Next Steps

- [ ] Add shadcn/ui Button component (`npx shadcn@latest add button`)
- [ ] Connect SQLite via better-sqlite3 or sql.js
- [ ] Create IPC handlers for database operations
- [ ] Build first real page (e.g., Dossiers list)

---

## Milestone — Auth Module Migration (2026-04-03)

### Overview

Migrated `model/auth/` exploration code to production-ready `src/lib/auth/` for the desktop app.

### Architecture

```
src/lib/auth/
├── index.ts           # Central exports - import from here
├── session-manager.ts # High-level API (SessionManager class)
├── browser-context.ts # Low-level Playwright management
├── storage.ts         # Path management for Electron
└── types.ts           # TypeScript type definitions
```

### Key Design Decisions

1. **Electron Path Integration**
   - Uses `app.getPath('userData')` for cross-platform compatibility
   - All auth data stored in `userData/auth/`
   - Fallback to `.cmpdesk-data/` for development outside Electron

2. **Session Persistence Strategy**
   - Browser profile (Playwright persistent context): `userData/auth/browser_profile/`
   - Cookies file (explicit persistence): `userData/auth/cookies.json`
   - Session metadata: `userData/auth/session_state.json`
   - **Session cookies (expires=-1) converted to 24h persistent cookies**

3. **Multi-Session Support (Prepared)**
   - Default: `userData/auth/browser_profile/`
   - Named: `userData/auth/{sessionId}/browser_profile/`
   - Not fully implemented, but structure supports it

4. **Separation of Concerns**
   - `storage.ts` → Path management only
   - `browser-context.ts` → Playwright operations
   - `session-manager.ts` → High-level API
   - `types.ts` → All TypeScript types

### Usage Examples

```typescript
// Option 1: SessionManager class (recommended)
import { SessionManager } from '@/lib/auth';

const session = new SessionManager();
try {
    await session.open();
    await session.goto("https://example.com");
    console.log(await session.title());
} finally {
    await session.close();
}

// Option 2: withSession helper
import { withSession } from '@/lib/auth';

const title = await withSession(async (session) => {
    await session.goto("https://example.com");
    return session.title();
});

// Option 3: Quick status check (no browser)
import { quickSessionCheck, getAuthPaths } from '@/lib/auth';

const status = quickSessionCheck();
console.log(status.isValid, status.cookieCount);

const paths = getAuthPaths();
console.log(paths.browserProfile);
```

### Auth Targets Configured

| Target | Cookie Names | Home URL |
|--------|--------------|----------|
| INALCO (default) | `.ASPXAUTH`, `ee-authenticated` | `https://iaa.secureweb.inalco.com/MKMWPN23/home` |
| Salesforce | `sid`, `sfdc_lv2`, `oid` | `https://indall.lightning.force.com/lightning/page/home` |

### Error Handling

Custom error classes with codes:
- `AuthenticationError`: `SESSION_EXPIRED`, `AUTH_TIMEOUT`, `HEADLESS_AUTH_REQUIRED`, `BROWSER_PROFILE_LOCKED`
- `SessionError`: `NOT_OPENED`, `ALREADY_OPENED`, `CONTEXT_CLOSED`

### Migration from model/auth

| Old (model/auth) | New (src/lib/auth) | Notes |
|------------------|-------------------|-------|
| `session_manager.js` | `session-manager.ts` | TypeScript, cleaner API |
| `browser_context.js` | `browser-context.ts` | TypeScript, better error handling |
| `salesforce_session.js` | `types.ts` (AUTH_TARGETS) | Merged into types |
| `salesforce_sso.js` | Not migrated yet | Will be separate module |
| Hardcoded paths | `storage.ts` | Electron-aware paths |

### Rules

- **NEVER hardcode auth paths** — Always use `getAuthPaths()`
- **ALWAYS call session.close()** — Use try/finally pattern
- **Use domcontentloaded** — Not networkidle (SF Lightning)
- **Check isOpen before operations** — Session must be opened first

---

## Milestone — Auth UI Integration (2026-04-03)

### Overview

Implemented complete login system with UI in the cmpDesk desktop application.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS                        │
│  ┌──────────────────┐        ┌──────────────────────────────┐  │
│  │ AuthStatus.tsx   │──IPC──▶│ window.electronAPI.auth      │  │
│  │ (React Component)│        │ (preload.js)                 │  │
│  └──────────────────┘        └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                       │
                                       │ IPC Invoke
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                          MAIN PROCESS                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ipcMain.handle('auth:getStatus')                         │   │
│  │ ipcMain.handle('auth:login')                             │   │
│  │ ipcMain.handle('auth:ensureSession')                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Auth Module (Playwright)                                 │   │
│  │ - Persistent browser context (userData/auth/)            │   │
│  │ - Cookie persistence (session → file → restore)          │   │
│  │ - Session state tracking                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Files Created/Modified

| File | Type | Description |
|------|------|-------------|
| `electron/main.js` | Modified | Added IPC handlers for auth operations |
| `electron/preload.js` | Modified | Exposed auth API to renderer |
| `src/types/electron.d.ts` | Created | TypeScript types for Electron API |
| `src/vite-env.d.ts` | Modified | Updated Window interface |
| `src/components/sidebar/AuthStatus.tsx` | Created | Auth status UI component |
| `src/layout/AppLayout.tsx` | Modified | Integrated AuthStatus in sidebar |

### Auth Flow

1. **On app load**: `AuthStatus.tsx` calls `window.electronAPI.auth.getStatus()` via IPC
2. **Status check**: Main process reads session_state.json + cookies.json (no browser)
3. **If disconnected**: UI shows 🔴 indicator + "Se connecter" button
4. **On login click**: Main process launches Playwright with persistent context
5. **Manual auth**: User completes login (email, password, 2FA) in browser
6. **Detection**: Main process polls for auth cookies (`.ASPXAUTH`, `ee-authenticated`)
7. **On success**: Cookies saved to file, browser closes, UI shows 🟢 indicator
8. **Session reuse**: Future operations load cookies from file automatically

### Session Persistence Strategy

```
userData/
└── auth/
    ├── browser_profile/    ← Playwright persistent context
    ├── cookies.json        ← Explicit cookie persistence (24h expiry)
    └── session_state.json  ← Metadata (lastValidated, authCookiesPresent)
```

**Critical**: Chromium does NOT persist session cookies (expires=-1) even with persistent context.
We explicitly save all cookies to cookies.json with a 24-hour artificial expiration.

### UI States

| State | Indicator | Button | Description |
|-------|-----------|--------|-------------|
| `checking` | 🟡 pulse | None | Initial status check |
| `connected` | 🟢 | None | Session valid |
| `disconnected` | 🔴 | "Se connecter" | No session |
| `expired` | 🟡 | "Reconnecter" | Session > 12h old |
| `logging-in` | 🟡 pulse | Disabled | Browser open, waiting for auth |

### IPC Channels

| Channel | Direction | Parameters | Returns |
|---------|-----------|------------|---------|
| `auth:getStatus` | Renderer→Main | None | `AuthStatus` |
| `auth:login` | Renderer→Main | `forceAuth?: boolean` | `LoginResult` |
| `auth:ensureSession` | Renderer→Main | None | `EnsureSessionResult` |

### Detection Strategy (Simple for now)

Currently detects login via presence of auth cookies:
- `.ASPXAUTH` (INALCO session)
- `ee-authenticated` (INALCO flag)

**TODO**: Enhance detection with:
- API endpoint validation
- Dashboard URL detection
- Session token validation

### Security

- All credentials stay local (never logged, never transmitted)
- Browser profile stored in userData (OS-protected)
- Cookies file readable only by app process
- No tokens hardcoded in source

### Usage from Other Modules

```typescript
// In any automation script
const status = await window.electronAPI.auth.getStatus();
if (!status.isConnected) {
    await window.electronAPI.auth.login();
}
// Now proceed with automation...
```

### Next Steps

- [ ] Add Salesforce session detection (after INALCO login)
- [ ] Implement session refresh mechanism
- [ ] Add "Déconnecter" button for manual logout
- [ ] Show last login time in UI
