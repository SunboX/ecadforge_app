# Schematic Vivid Palette Implementation Plan

**Goal:** Retune the schematic theme so the dominant baseline linework becomes noticeably more vivid without sacrificing text readability or semantic separation.

**Architecture:** Keep the existing schematic token model and resolver unchanged. Express the change entirely through more saturated cyan-teal baseline values in the viewer stylesheet, lock those values in a focused regression test first, and then bump the app version.

**Tech Stack:** Browser-side ESM modules, CSS custom properties, Node test runner.

---

### Task 1: Lock the vivid linework in tests

**Files:**
- Modify: `tests/ui/renderers/output-renderers.mjs`

**Step 1: Write the failing test**

Replace the current schematic token expectations with a more vivid baseline cyan-teal palette while keeping dark text and distinct warm marker assertions.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: The test fails because the stylesheet still uses the previous, more restrained teal values.

### Task 2: Update the schematic token values

**Files:**
- Modify: `src/styles/20-viewer.css`

**Step 1: Increase baseline cool vibrance**

Set `--schematic-default-ink-color` to a more saturated cyan-teal and `--schematic-accent-ink-color` to an even brighter cyan.

**Step 2: Preserve legibility and semantics**

Keep `--schematic-text-color` dark, preserve the warm `power` and `port` split, and keep `--schematic-alert-color` as a distinct signal color.

**Step 3: Re-run the focused test**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: The stylesheet regression passes with the new vivid linework values.

### Task 3: Bump version and run full verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the package version by one patch release.

**Step 2: Run full verification**

Run: `npm test`

Expected: The full test suite passes with the vivid schematic palette.
