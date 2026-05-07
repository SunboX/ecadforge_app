# Multi-File Viewer Sidebar Implementation Plan

**Goal:** Let the browser viewer keep multiple parsed documents open at once and show a conditional left preview rail that switches the main viewer to the clicked file while preserving one global top-tab selection.

**Architecture:** Expand `AppState` into a session-level document store with one global `activeView` and one selected `activeDocumentId`. Update `AppController` to append successful parses instead of replacing the session, then update `AppView` and stylesheet/layout code to render a file-only preview rail that disappears when just one document is loaded.

**Tech Stack:** Browser-side ESM modules, DOM rendering helpers, CSS layout, parser worker, Node test runner.

---

### Task 1: Lock session-based app state in tests

**Files:**
- Modify: `tests/app-state.test.mjs`
- Modify: `src/core/AppState.mjs`

**Step 1: Write the failing test**

Add tests that assert `AppState` can hold multiple session documents, derive the active document from `activeDocumentId`, and preserve the global `activeView`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app-state.test.mjs`

Expected: The test fails because the current state model only supports one `documentModel`.

**Step 3: Write minimal implementation**

Extend `AppState` to store `documents` and `activeDocumentId`, derive `documentModel` and `activeFileName` in `getSnapshot()`, and support updating the new fields through `setValue()` and `patch()`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app-state.test.mjs`

Expected: The state tests pass with the new session model.

### Task 2: Lock multi-file controller behavior in tests

**Files:**
- Create: `tests/app-controller.test.mjs`
- Modify: `src/AppController.mjs`
- Modify: `src/workers/altium-parser.worker.mjs`

**Step 1: Write the failing test**

Add controller tests that verify:

- multiple selected files append into the session
- the newest successful parse becomes active
- parse failures do not clear already-open documents
- document selection through the view updates `activeDocumentId`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app-controller.test.mjs`

Expected: The tests fail because the controller currently loads only the first file and replaces the single active document.

**Step 3: Write minimal implementation**

Update `AppController` to process all accepted files, append successful parsed results with stable ids, preserve existing documents on error, add a document-selection binding to the view, and include request ids in the parser worker contract so worker-based parses can resolve deterministically.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app-controller.test.mjs`

Expected: The controller tests pass with multi-file session behavior.

### Task 3: Lock sidebar rendering and selection behavior in tests

**Files:**
- Modify: `tests/ui/app-view.test.mjs`
- Modify: `src/ui/AppView.mjs`
- Modify: `src/index.html`
- Modify: `src/styles/20-viewer.css`

**Step 1: Write the failing test**

Add view tests that verify:

- no sidebar is rendered for one open document
- the sidebar appears for multiple open documents
- the active preview card is marked selected
- clicking a preview card emits its document id
- compact preview markup and fallback states render for the current global tab

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/app-view.test.mjs`

Expected: The tests fail because the current layout has no sidebar and no document-selection binding.

**Step 3: Write minimal implementation**

Render a conditional preview rail beside the main viewer, keep the existing top tabs global, add `multiple` file selection support in the HTML input, and style the new rail and preview cards to resemble a sheet navigator.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/app-view.test.mjs`

Expected: The view tests pass with the new sidebar interaction.

### Task 4: Bump version and run full verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the package version by one patch release.

**Step 2: Run full verification**

Run: `npm test`

Expected: The full test suite passes with the multi-file sidebar feature.
