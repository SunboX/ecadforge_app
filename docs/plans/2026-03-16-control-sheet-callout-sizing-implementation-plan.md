# control-sheet Callout Sizing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shrink the control-sheet standalone dashed callout so it matches the reference layout and no longer extends below the intended resistor cluster.

**Architecture:** Keep the existing standalone callout normalizer, but tighten its content-bounds heuristic. The fix should stop counting owner/value text below the original dashed frame and slightly reduce the bottom padding so the generated frame hugs the intended cluster without special-casing control-sheet.

**Tech Stack:** Node.js, native `node:test`, ESM modules, parser-backed schematic normalization and SVG rendering.

---

### Task 1: Lock the desired control-sheet bounds in tests

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Update the control-sheet parser and renderer assertions so the dashed callout bottom matches the reference-sized frame instead of the current oversized one.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: FAIL on the control-sheet dashed-callout bounds or SVG line coordinates.

### Task 2: Implement the minimal normalizer fix

**Files:**
- Modify: `src/core/altium/SchematicStandaloneCalloutNormalizer.mjs`

**Step 1: Write minimal implementation**

Restrict standalone callout content text to items that sit within or above the original dashed frame bottom, and reduce the synthesized bottom padding slightly so the generated frame stops above the resistor value row.

**Step 2: Run targeted tests to verify it passes**

Run: `node --test tests/core/standalone-callout-normalizer.test.mjs tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: PASS for the standalone callout, control-sheet parser, and control-sheet renderer checks.

### Task 3: Verify the full repo state

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once the fix is in place.

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS with no new failures.
