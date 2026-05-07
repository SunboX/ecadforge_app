# Title Block Alignment Implementation Plan

**Goal:** Correct the synthesized A3 title-block layout so footer text sits inside the same cells as the reference rendering.

**Architecture:** Keep the parser output unchanged and make the footer renderer honor an Altium-style A3 chrome layout when standard footer hints are present. Continue using the recovered footer-hint coordinates for the value fields while relocating the synthesized labels and grid lines to the matching cells.

**Tech Stack:** Browser-side ESM modules, Node test runner, string-based SVG renderer.

---

### Task 1: Lock the expected footer layout in tests

**Files:**
- Modify: `tests/ui/renderers/schematic-core.mjs`

**Step 1: Write the failing test**

Add assertions for the expected A3 title-block divider lines, header labels, and footer cell labels so the regression captures the intended alignment rather than only the value texts.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: The new assertions fail because the current renderer still emits the generic footer grid and label positions.

### Task 2: Implement the renderer fix

**Files:**
- Modify: `src/ui/SchematicSheetChromeRenderer.mjs`

**Step 1: Replace the generic A3 footer ratios**

Add one title-block layout path for standard footer hints that emits the corrected row and column boundaries.

**Step 2: Reposition synthesized footer labels**

Move `Title`, `Number`, `Revision`, `Size`, `Sheet`, `Date:`, `File:`, and `Drawn By:` into the correct cells and render them with footer-serif typography.

**Step 3: Preserve value hints**

Keep the recovered footer-hint coordinates and typography for value fields so the title, document number, revision, and sheet numbering still follow the source page.

**Step 4: Re-run the renderer test**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: The new alignment assertions pass.

### Task 3: Final verification and version bump

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the package version by one patch release.

**Step 2: Run targeted verification**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: The affected renderer suite passes.
