# Rounded Schematic Strokes Implementation Plan

**Goal:** Add rounded stroke caps to schematic symbol and wire primitives without changing page chrome or boxed shapes.

**Architecture:** Keep the existing primitive emitters intact and opt into rounded caps at the SVG group level for open electrical primitives. Use one focused renderer test to lock the scope, then patch the relevant group wrappers and bump the app version.

**Tech Stack:** Node.js, ESM modules, native `node:test`, SVG schematic renderer.

---

### Task 1: Lock the rounded-cap scope in a renderer test

**Files:**
- Modify: `tests/ui/renderers/schematic-core.mjs`

**Step 1: Write the failing test**

Add a schematic renderer test that expects rounded stroke caps on wire, arc, pin, cross, and power-port groups, while confirming the root SVG does not receive a global `stroke-linecap`.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: FAIL because the current renderer does not add rounded stroke caps to those groups.

### Task 2: Add rounded caps to open schematic primitive groups

**Files:**
- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Modify: `src/ui/SchematicPowerPortRenderer.mjs`

**Step 1: Write minimal implementation**

Add `stroke-linecap="round"` to the schematic line, arc, pin, and cross group wrappers in `SchematicSvgRenderer`. Add the same attribute to the ground and rail power-port groups in `SchematicPowerPortRenderer`.

**Step 2: Run focused tests to verify it passes**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: PASS for the new rounded-cap assertions and the existing renderer coverage.

### Task 3: Verify and version the change

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once the rounded-cap renderer change is complete.

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS with no renderer regressions.
