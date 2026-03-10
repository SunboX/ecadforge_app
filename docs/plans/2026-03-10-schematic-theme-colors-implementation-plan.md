# Schematic Theme Colors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert schematic SVG color output to CSS variables so themes can override both built-in fallback colors and explicit imported Altium colors.

**Architecture:** Keep raw parser colors unchanged, add a shared renderer-side schematic color resolver, and have every schematic renderer emit semantic `var(--schematic-...)` values. Define the default palette in the schematic stylesheet so future themes can override one variable set instead of patching renderer code.

**Tech Stack:** Node.js test runner, browser SVG rendering, CSS custom properties, ES modules

---

### Task 1: Add the regression test for themed SVG colors

**Files:**
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Add a focused test that renders a small schematic with imported blue, red, neutral, and fill colors and asserts the SVG contains `var(--schematic-...)` tokens instead of those raw hex values.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers.test.mjs --test-name-pattern "maps imported schematic colors to theme variables"`

Expected: FAIL because the renderer still emits literal hex values.

**Step 3: Write minimal implementation**

No implementation in this task.

**Step 4: Run test to verify it still fails for the right reason**

Run the same command and confirm the mismatch is still the literal color output.

### Task 2: Add a shared schematic color resolver

**Files:**
- Create: `src/ui/SchematicColorResolver.mjs`

**Step 1: Write the minimal resolver**

Add a class with static helpers that:

- normalize raw color strings
- pass through `none` and `transparent`
- map known schematic color families onto stable CSS variable tokens
- fall back to a caller-provided variable for unknown imported colors

**Step 2: Run the focused test**

Run: `node --test tests/ui/renderers.test.mjs --test-name-pattern "maps imported schematic colors to theme variables"`

Expected: still FAIL because renderers are not using the resolver yet.

### Task 3: Route schematic renderers through the resolver

**Files:**
- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Modify: `src/ui/SchematicPortRenderer.mjs`
- Modify: `src/ui/SchematicPowerPortRenderer.mjs`
- Modify: `src/ui/SchematicJunctionRenderer.mjs`
- Modify: `src/ui/SchematicNoteRenderer.mjs`
- Modify: `src/ui/SchematicShapeRenderer.mjs`

**Step 1: Update renderer color writes**

Replace every literal SVG color emission in schematic renderers with resolved CSS variable values. Remove the remaining hard-coded synthetic renderer colors by routing title block text, component markers, and other generated elements to semantic variables too.

**Step 2: Run the focused test**

Run: `node --test tests/ui/renderers.test.mjs --test-name-pattern "maps imported schematic colors to theme variables"`

Expected: PASS.

### Task 4: Move schematic stylesheet colors to variables

**Files:**
- Modify: `src/styles/20-viewer.css`

**Step 1: Define the default palette**

Add scoped schematic theme variables on `.schematic-svg` and update schematic CSS rules to consume them instead of literal rgba and hex values.

**Step 2: Run the focused test**

Run: `node --test tests/ui/renderers.test.mjs --test-name-pattern "maps imported schematic colors to theme variables"`

Expected: PASS.

### Task 5: Update renderer expectations and versioning

**Files:**
- Modify: `tests/ui/renderers.test.mjs`
- Modify: `package.json`
