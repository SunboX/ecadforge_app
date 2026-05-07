# Schematic Contrast Palette Implementation Plan

**Goal:** Retune the schematic theme so it regains strong semantic contrast while staying aligned with the app and PCB palette family.

**Architecture:** Keep the schematic token model unchanged and express the fix entirely through a higher-contrast token set in the viewer stylesheet. Lock the revised palette in a stylesheet regression first, then update the `.schematic-svg` custom properties and bump the app version.

**Tech Stack:** Browser-side ESM modules, CSS custom properties, Node test runner.

---

### Task 1: Lock the stronger contrast in tests

**Files:**
- Modify: `tests/ui/renderers/output-renderers.mjs`

**Step 1: Write the failing test**

Replace the first-pass schematic palette expectations with a higher-contrast set that separates default geometry, accent geometry, text, power, ports, and alerts more strongly.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: The test fails because the stylesheet still uses the lower-contrast first-pass values.

### Task 2: Update the schematic token values

**Files:**
- Modify: `src/styles/20-viewer.css`

**Step 1: Darken and cool the baseline linework**

Set `--schematic-default-ink-color` to a darker teal and `--schematic-accent-ink-color` to a brighter cyan-leaning teal.

**Step 2: Increase text and warm-marker separation**

Set `--schematic-text-color` to a darker graphite, `--schematic-power-color` to a deeper brown-copper, and `--schematic-port-color` to a brighter orange-copper.

**Step 3: Make alerts stand apart**

Set `--schematic-alert-color` to a signal-like alert color that clearly breaks out of the warm copper family.

**Step 4: Re-run the focused test**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: The stylesheet regression passes with the revised contrast levels.

### Task 3: Bump version and run full verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the package version by one patch release.

**Step 2: Run full verification**

Run: `npm test`

Expected: The full test suite passes with the revised schematic palette.
