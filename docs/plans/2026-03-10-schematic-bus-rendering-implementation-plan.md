# Schematic Bus Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore schematic bus trunks by parsing Altium record-`26` primitives and rendering them as thicker blue routes.

**Architecture:** Extend normalized schematic line segments with an `isBus` flag for record-`26` sources, then let the existing SVG line renderer style those segments differently. Keep synthesized junction logic limited to non-bus lines so the change does not introduce false dots.

**Tech Stack:** Node 20, ESM `.mjs`, Node test runner, native Altium printable-record parser, SVG string renderer.

---

### Task 1: Add parser regression coverage for bus trunks

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`
- Test: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing test**

Add a fixture-backed test that loads `AtlasControl-A1.01.01A.SchDoc` and asserts:

- a line exists from `(300,700)` to `(300,680)`
- a line exists from `(415,550)` to `(415,460)`
- both lines carry `isBus === true`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: FAIL because record-`26` lines are missing from `schematic.lines`.

### Task 2: Add renderer regression coverage for bus styling

**Files:**
- Modify: `tests/ui/renderers.test.mjs`
- Test: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Add a synthetic renderer test with one ordinary line and one bus line, asserting the bus line emits a larger `stroke-width` than the ordinary line.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers.test.mjs`

Expected: FAIL because the renderer ignores `isBus`.

### Task 3: Implement record-`26` bus normalization

**Files:**
- Modify: `src/core/altium/AltiumParser.mjs`
- Modify: `src/core/altium/SchematicPinParser.mjs`

**Step 1: Write minimal implementation**

- Treat record-`26` as a schematic polyline record.
- Add an optional `isBus` flag to normalized line segments.
- Mark segments sourced from record-`26` as buses.

**Step 2: Run focused parser tests**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: PASS for the new bus parser assertions.

### Task 4: Implement thicker bus rendering and safe junction behavior

**Files:**
- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Modify: `src/ui/SchematicJunctionRenderer.mjs`

**Step 1: Write minimal implementation**

- Render bus lines with a thicker stroke than ordinary wires.
- Exclude bus lines from synthesized junction-dot detection.
- Update JSDoc where the normalized line shape changed.

**Step 2: Run focused renderer tests**

Run: `npm test -- tests/ui/renderers.test.mjs`

Expected: PASS for the new bus renderer assertion without breaking existing SVG expectations.

### Task 5: Release hygiene and verification

**Files:**
- Modify: `package.json`

**Step 1: Increment version**

Bump the patch version in `package.json`.

**Step 2: Run full verification**

Run: `npm test`

Expected: PASS.
