# Schematic Multipart Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore correct multipart schematic rendering for `GEWA-G1.01.01F.SchDoc` by selecting the active part geometry, parsing missing outline polylines, and verifying the recovered page size and SVG output.

**Architecture:** Extend schematic normalization to understand active multipart component parts from the component records, then feed only the selected part primitives into the existing line, pin, text, and layout pipelines. Keep the change centered in the parser so the SVG renderer benefits from corrected normalized data rather than sheet-specific heuristics.

**Tech Stack:** Node 20, npm, ESM `.mjs`, Node test runner, Altium ASCII record parser, SVG string renderer.

---

### Task 1: Add Sheet F Regression Tests

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing parser test**

Add a test that parses `/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01F.SchDoc` and asserts the sheet resolves to `A3`, the active `U2` parts expose `USB port`, `Power`, and `System / MIDI` text exactly once, and the visible `U2` pin count stays in the expected narrowed range.

**Step 2: Run the parser test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: FAIL because sheet F still resolves to a custom page and/or merged multipart content.

**Step 3: Write the failing renderer test**

Add a renderer test for the same file that asserts the body-outline lines from record `6` appear in the SVG and that `USB port`, `Power`, and `System / MIDI` each render once.

**Step 4: Run the renderer test to verify it fails**

Run: `npm test -- tests/ui/renderers.test.mjs`

Expected: FAIL because record `6` geometry is missing and multipart content is duplicated.

### Task 2: Filter Multipart Owner Primitives

**Files:**
- Modify: `src/core/altium/AltiumParser.mjs`
- Modify: `src/core/altium/ParserUtils.mjs`

**Step 1: Add the minimal parser support**

Parse `CurrentPartId` from component records, build active multipart owner matches from owner-part bounds near each component placement, and filter schematic drawable records so only the selected `OwnerPartId` plus owner-wide records remain drawable.

**Step 2: Run the focused parser test**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: the new sheet F parser assertions pass or fail only on missing outline/page-size details.

### Task 3: Parse Record 6 Outline Geometry

**Files:**
- Modify: `src/core/altium/AltiumParser.mjs`
- Modify: `src/core/altium/SchematicPinParser.mjs`

**Step 1: Extend the line pipeline**

Treat record `6` as a schematic polyline source so multipart body boxes and dividers become drawable line segments.

**Step 2: Run the focused renderer test**

Run: `npm test -- tests/ui/renderers.test.mjs`

Expected: the new sheet F renderer assertions pass.

### Task 4: Verify Layout and Release Metadata

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the version from `1.1.43` to the next patch release.

**Step 2: Run targeted verification**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: PASS.

**Step 3: Run the full suite**

Run: `npm test`

Expected: PASS.
