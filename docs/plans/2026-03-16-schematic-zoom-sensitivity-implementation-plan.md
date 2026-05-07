# Schematic Zoom Sensitivity Implementation Plan

**Goal:** Make schematic wheel zoom slower per tick while keeping cursor-centered anchoring and drag panning unchanged.

**Architecture:** Reuse the existing `SchematicViewportController` and tune only its fixed wheel sensitivity constant. Lock the new behavior with focused controller and `AppView` tests so the change stays isolated to wheel zoom and does not alter the rest of the interaction lifecycle.

**Tech Stack:** Node.js, native `node:test`, ESM modules, SVG `viewBox` math, `AppView`, `SchematicViewportController`.

---

### Task 1: Lock the slower zoom step in failing UI tests

**Files:**
- Modify: `tests/ui/schematic-viewport-controller.test.mjs`
- Modify: `tests/ui/app-view.test.mjs`

**Step 1: Write the failing test**

Update the wheel-zoom expectations in the focused viewport controller and `AppView` tests so one zoom-in event produces a smaller camera change than the current `10%` step.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/schematic-viewport-controller.test.mjs tests/ui/app-view.test.mjs`

Expected: FAIL because the controller still applies the older, faster zoom factor.

### Task 2: Implement the minimal sensitivity change

**Files:**
- Modify: `src/ui/SchematicViewportController.mjs`

**Step 1: Write minimal implementation**

Reduce the fixed wheel zoom factor constant and leave cursor anchoring, drag pan, clamp logic, and lifecycle behavior unchanged.

**Step 2: Run targeted tests to verify it passes**

Run: `node --test tests/ui/schematic-viewport-controller.test.mjs tests/ui/app-view.test.mjs`

Expected: PASS with the updated slower zoom expectations and unchanged drag/reset behavior.

### Task 3: Verify the full repository state

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once after the zoom-sensitivity tweak is in place.

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS with no regressions.
