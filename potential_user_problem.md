# Potential User Problems - cmpDesk

This document tracks known issues, their root causes, and solutions implemented.

---

## 1. Browser Context Race Conditions (Fixed: 2026-04-07)

### Symptoms
Users may see these errors in logs:
```
[ERROR] [AURA] Search error page.waitForTimeout: Target page, context or browser has been closed
[ERROR] [AURA] Search error page.evaluate: Execution context was destroyed, most likely because of a navigation
```

### User Experience
- Search operations fail randomly
- Application appears unresponsive
- Operations need to be retried multiple times

### Root Cause Analysis

**Two distinct issues were identified:**

1. **Concurrent browser operations** - Multiple IPC handlers (`auth:login`, `salesforce:searchAccount`, etc.) could trigger browser operations simultaneously. When `auth:login` with `forceAuth: true` was called while a search was in progress, it would close/hijack the browser context, killing the ongoing operation.

2. **Fixed timeouts instead of proper wait conditions** - Code used `await page.waitForTimeout(3000)` which doesn't guarantee page stability. Salesforce performs internal SPA redirections that can destroy the execution context during `page.evaluate()` calls.

### Solution Implemented

1. **Browser Operation Mutex (`BrowserOperationMutex` class)**
   - Added a mutex/lock mechanism to serialize browser operations
   - Only one browser operation can run at a time
   - Waiting operations are queued and executed in order
   - Timeout mechanism prevents infinite waits

2. **`waitForSalesforceReady()` function**
   - Replaces fixed `waitForTimeout()` calls
   - Waits for `networkidle` state
   - Waits for `document.readyState === 'complete'`
   - Optionally waits for Aura framework availability

3. **`safeEvaluate()` wrapper**
   - Wraps `page.evaluate()` with retry logic
   - Automatically retries on navigation-related errors
   - Waits for page stability before retry

4. **`withBrowserMutex()` helper**
   - Wraps entire browser operations with mutex protection
   - Automatically acquires and releases locks
   - Built-in retry on navigation errors (configurable)

### Code Changes

Modified functions in `electron/main.js`:
- `searchAccount()` - wrapped with `withBrowserMutex('searchAccount', ...)`
- `createAccount()` - wrapped with `withBrowserMutex('createAccount', ...)`
- `createDossier()` - wrapped with `withBrowserMutex('createDossier', ...)`

### User Message on Lock Timeout
If a user tries to trigger multiple operations rapidly, they may see:
> "Une autre opération est en cours. Veuillez patienter et réessayer."

This is expected behavior - the system is protecting against the race condition.

### Prevention
- Always use `withBrowserMutex()` for any new function that launches a browser
- Never use fixed `waitForTimeout()` - use `waitForSalesforceReady()` instead
- Wrap `page.evaluate()` calls with `safeEvaluate()` when navigation may occur

---

## Template for Future Issues

```markdown
## [Issue Number]. [Issue Title] (Status: Open/Fixed, Date)

### Symptoms
- What the user sees

### User Experience
- How it affects workflow

### Root Cause Analysis
- Technical explanation

### Solution Implemented
- What was done to fix it

### Prevention
- How to avoid in future development
```
