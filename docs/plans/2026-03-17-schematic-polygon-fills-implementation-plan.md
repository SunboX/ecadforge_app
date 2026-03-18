# Schematic Polygon Fills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve solid record-7 schematic polygons and render them with their source `AreaColor` so filled symbol bodies appear in the schematic viewer.

**Architecture:** Add a normalized `schematic.polygons` collection alongside the existing polygon-derived outline lines. Parse record-7 polygons into structured polygon primitives in the primitive parser, render them in a dedicated SVG group before linework, and use fill color resolution that maps known source colors to theme tokens while preserving unknown source hex fills.

**Tech Stack:** Node.js, ESM modules, native `node:test`, SVG schematic renderer.

---

### Task 1: Lock polygon parsing in a failing parser regression

**Files:**
- Modify: `tests/core/altium-parser/schematic-regressions.mjs`

**Step 1: Write the failing test**

Add a synthetic schematic record set with one solid record-7 polygon. Assert that parsing returns:

- one `schematic.polygons` entry with points, fill, `isSolid`, and `ownerIndex`
- the existing closed outline line segments for the same owner

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser/schematic-regressions.mjs`

Expected: FAIL because the parser does not expose `schematic.polygons` yet.

### Task 2: Lock polygon fill rendering in a failing renderer regression

**Files:**
- Modify: `tests/ui/renderers/schematic-core.mjs`

**Step 1: Write the failing test**

Add a renderer test with:

- one solid polygon whose fill matches a known schematic color token
- one solid polygon whose fill does not match any existing token

Assert that the rendered SVG uses a CSS variable for the known fill and preserves the raw normalized hex value for the unknown fill.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: FAIL because the renderer does not emit polygon markup yet.

### Task 3: Add normalized schematic polygon support

**Files:**
- Modify: `src/core/altium/SchematicPrimitiveParser.mjs`
- Modify: `src/core/altium/AltiumParser.mjs`

**Step 1: Write minimal implementation**

Add a parser for record-7 polygons that preserves:

- ordered point coordinates
- stroke color
- `AreaColor`
- `IsSolid`
- `Transparent`
- line width
- `ownerIndex`

Thread the new polygon array into the normalized schematic model without removing the existing outline lines.

**Step 2: Run focused parser tests**

Run: `node --test tests/core/altium-parser/schematic-regressions.mjs`

Expected: PASS for the new polygon parsing regression.

### Task 4: Render filled schematic polygons

**Files:**
- Modify: `src/ui/SchematicShapeRenderer.mjs`
- Modify: `src/ui/SchematicColorResolver.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`

**Step 1: Write minimal implementation**

Add SVG polygon rendering for normalized schematic polygons, render them in a dedicated group before linework, and allow polygon fills to preserve unknown normalized hex values when no CSS token mapping exists.

**Step 2: Run focused renderer tests**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: PASS for the new polygon fill renderer regression and existing renderer coverage.

### Task 5: Verify and version the change

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once polygon fill support is complete.

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS with no parser or renderer regressions.
