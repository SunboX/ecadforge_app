# Explicit Pin-Label Number Clearance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve the original gap between synthetic left/right pin numbers and explicit owner pin-name labels after mirrored owner-label placement corrections.

**Architecture:** Keep the fix inside `SchematicSvgRenderer`. Build one owner/pin-keyed horizontal offset map from explicit owner label placement, use it for both text rendering and left/right pin-number clearance, and leave top/bottom number placement unchanged.

**Tech Stack:** Node.js, ESM modules, native `node:test`, SVG renderer helpers

---

### Task 1: Lock the outward-clearance rule in the mirrored-owner regression

**Files:**
- Modify: `tests/core/altium-parser/schematic-regressions.mjs`

**Step 1: Write the failing test**

Extend the synthetic mirrored-owner symbol regression so it also asserts:

- left pin number `2` moves from `x="187"` to `x="179"`
- right pin number `3` moves from `x="243"` to `x="248"`
- bottom pin number `1` stays unchanged

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser/schematic-regressions.mjs`

Expected: FAIL because the current pin-number coordinates still use the old inner lanes.

### Task 2: Build reusable explicit owner-label offsets

**Files:**
- Modify: `src/ui/SchematicSvgRenderer.mjs`

**Step 1: Add a shared owner/pin key helper**

Add one helper that builds a stable `ownerIndex::pinName` key for both the explicit owner-label set and the new offset map.

**Step 2: Add an offset collector**

Compute a map of horizontal explicit owner-label corrections by:

- finding the matched owner pin for each explicit owner label
- resolving that label's final mirrored placement
- storing `resolvedX - authoredX` by owner/pin key when the delta is non-zero

### Task 3: Apply outward clearance to left/right pin numbers

**Files:**
- Modify: `src/ui/SchematicSvgRenderer.mjs`

**Step 1: Thread the offset map into pin rendering**

Pass the new offset map alongside the existing explicit owner-label set.

**Step 2: Update left/right number placement**

Use the keyed offset only when the synthetic name is suppressed by an explicit owner label:

- left pin numbers subtract the offset from the default `end` lane
- right pin numbers add the offset to the default `start` lane

### Task 4: Run focused verification

**Files:**
- Reference: `tests/core/altium-parser/schematic-regressions.mjs`
- Reference: `tests/core/altium-parser.test.mjs`
- Reference: `tests/ui/renderers.test.mjs`

**Step 1: Run the focused regression**

Run: `node --test tests/core/altium-parser/schematic-regressions.mjs`

Expected: PASS.

**Step 2: Run parser and renderer suites**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: PASS.

### Task 5: Bump version and run the full suite

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the application version after the fix is in place.

**Step 2: Run the repository tests**

Run: `npm test`

Expected: PASS.
