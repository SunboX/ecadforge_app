# Vertical Port Junction Dots Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render connection dots where vertical style-4 off-sheet ports attach to wire tees, including the neutral `GLYPH_0` case.

**Architecture:** Keep junction-dot ownership in the shared junction renderer. Extend the junction pass so port connection points can contribute branch directions at the same candidate point as ordinary wires, but limit the new behavior to explicit vertical `up`/`down` ports to avoid changing horizontal port behavior without evidence.

**Tech Stack:** Node.js, ESM modules, native `node:test`, SVG schematic renderer.

---

### Task 1: Lock the missing vertical-port dot in a renderer test

**Files:**
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Add an assertion to the existing style-4 off-sheet port renderer test that expects one junction circle at the `GLYPH_0` attachment point.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: FAIL because the current junction renderer does not emit a dot for the vertical port connection.

### Task 2: Teach the junction renderer about vertical port branches

**Files:**
- Modify: `src/ui/SchematicJunctionRenderer.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`

**Step 1: Write minimal implementation**

Pass normalized ports into the junction renderer, collect candidate junction points from both wire endpoints and vertical-port connection points, and let vertical ports contribute one cardinal direction (`north` for `up`, `south` for `down`) when they touch the candidate point.

**Step 2: Run focused tests to verify it passes**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: PASS for the new `GLYPH_0` dot assertion and the existing junction/port renderer coverage.

### Task 3: Verify and version the change

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once the junction-dot fix is complete.

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS with no regressions.
