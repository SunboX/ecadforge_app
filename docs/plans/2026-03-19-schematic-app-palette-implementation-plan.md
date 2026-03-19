# Schematic App Palette Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Re-theme the schematic view so it uses the same app and PCB palette family while preserving the current semantic color buckets.

**Architecture:** Keep the schematic resolver and SVG renderers unchanged because they already emit semantic CSS variables. Lock the intended palette in a focused stylesheet regression, then update the `.schematic-svg` custom properties to app-aligned teal, copper, sand, and neutral values, and finally bump the app version.

**Tech Stack:** Browser-side ESM modules, CSS custom properties, Node test runner.

---

### Task 1: Lock the new palette in a failing test

**Files:**
- Modify: `tests/ui/renderers/output-renderers.mjs`

**Step 1: Write the failing test**

Add a stylesheet regression that loads `src/styles/20-viewer.css`, extracts the `.schematic-svg` block, and asserts the key schematic token values match the app/PCB palette.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: The new test fails because the stylesheet still contains the older navy, red, and yellow schematic values.

### Task 2: Update the schematic theme tokens

**Files:**
- Modify: `src/styles/20-viewer.css`

**Step 1: Retune cool ink tokens**

Set `--schematic-default-ink-color` and `--schematic-accent-ink-color` to app-aligned teal values.

**Step 2: Retune warm semantic tokens**

Set `--schematic-power-color`, `--schematic-port-color`, and `--schematic-alert-color` to distinct copper and rust values aligned with the PCB palette.

**Step 3: Retune fills and neutrals**

Set the fill, note, text, and sheet-neutral tokens to softer sand and app-neutral values so the schematic surface matches the rest of the product.

**Step 4: Re-run the focused test**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: The new stylesheet regression passes.

### Task 3: Bump version and run final verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the package version by one patch release.

**Step 2: Run full verification**

Run: `npm test`

Expected: All tests pass with the new schematic palette values.
