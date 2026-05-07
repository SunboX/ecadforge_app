# PCB Rounded Outline Implementation Plan

**Goal:** Preserve smooth authored rounded PCB corners when the source board-route contour already contains direct arc geometry.

**Architecture:** Keep `PcbOutlineRecovery` as the single decision point for board outline selection, but short-circuit its board-route silhouette pass for simple closed arc-based contours. Lock that behavior with a focused recovery regression test, then patch the recovery guard, run focused tests, bump the app version, and finish with the full suite.

**Tech Stack:** Node.js, ESM modules, native `node:test`, Altium PCB normalization.

---

### Task 1: Lock the rounded authored-outline behavior in a recovery test

**Files:**
- Modify: `tests/core/pcb-outline-recovery.test.mjs`

**Step 1: Write the failing test**

Add a recovery test with a simple rectangular board route that uses four rounded corner arcs. Assert that `recoverOutline` returns the authored contour as `board-route`, preserves the arc segments, and does not expand the outline into a large staircase of line segments.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/pcb-outline-recovery.test.mjs`

Expected: FAIL because the current recovery path rasterizes the contour and returns a line-only stepped outline.

### Task 2: Prefer directly renderable authored board routes

**Files:**
- Modify: `src/core/altium/PcbOutlineRecovery.mjs`

**Step 1: Write minimal implementation**

Add a small authored-contour eligibility check inside the board-route recovery path. When the fallback contour is already a closed, low-complexity outline with authored arc segments, return it directly. Leave the existing silhouette-closing logic in place for complex contours that still need scallop cleanup.

**Step 2: Run focused tests to verify it passes**

Run: `node --test tests/core/pcb-outline-recovery.test.mjs`

Expected: PASS for the new rounded-outline regression and the existing scallop-closure coverage.

### Task 3: Verify the renderer-facing contract and version the change

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once the recovery change is complete.

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS with no PCB parser or renderer regressions.
