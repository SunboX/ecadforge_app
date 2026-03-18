# Sheet Zone Separators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add separator strokes between synthesized sheet row and column zone markers on all four sheet edges.

**Architecture:** Keep the parser contract unchanged and extend the existing synthesized sheet chrome path. The renderer will emit gutter-only separator lines at internal `xZones` and `yZones` boundaries, and the viewer stylesheet will apply the existing sheet-frame stroke token to those new lines.

**Tech Stack:** Browser-side ESM modules, string-based SVG renderer, CSS styling, Node test runner.

---

### Task 1: Lock the expected gutter separators in a failing renderer test

**Files:**
- Modify: `tests/ui/renderers/schematic-core.mjs`

**Step 1: Write the failing test**

Extend the existing schematic chrome regression so it also asserts:

- a top gutter separator at `x=55` from `y=0` to `y=10`
- a bottom gutter separator at `x=55` from `y=90` to `y=100`
- a left gutter separator at `y=30` from `x=0` to `x=10`
- a right gutter separator at `y=30` from `x=190` to `x=200`

These values come from a `200x100` sheet with `marginWidth=10`, `xZones=4`, and `yZones=4`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: FAIL because the current renderer emits zone labels but no gutter separator lines.

### Task 2: Implement the synthesized gutter separators

**Files:**
- Modify: `src/ui/SchematicSheetChromeRenderer.mjs`
- Modify: `src/styles/20-viewer.css`

**Step 1: Write the minimal renderer change**

Update `#buildSheetZoneMarkup()` so it emits separator lines for every internal zone boundary:

- vertical lines on the top and bottom gutters for `xZones`
- horizontal lines on the left and right gutters for `yZones`

Do not change frame geometry, title-block layout, or label positions.

**Step 2: Style the separator lines**

Add a dedicated selector so the new separator strokes inherit the same stroke color, width, and no-fill behavior as `.sheet-frame`.

**Step 3: Run the targeted test to verify it passes**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: PASS with the new separator assertions green.

### Task 3: Final verification and version bump

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the package version by one patch release.

**Step 2: Run affected verification**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs tests/ui/renderers/schematic-title-block.mjs`

Expected: PASS for the core schematic renderer checks and the A3 title-block regression.
