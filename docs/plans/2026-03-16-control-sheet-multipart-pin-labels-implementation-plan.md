# Control-Sheet Multipart Pin Labels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the visible `R92` pin numbers on the bastion sheet and align all `R92A/B/C/D` designators like the source reference without changing `J4`.

**Architecture:** Keep the fix in schematic normalization. Update passive two-pin pin-label normalization so the active multipart `R92` pairs stay visible, then narrow the owner-text anchor heuristic so near-row left-side multipart labels still flow through the side-anchor logic.

**Tech Stack:** Node.js, ESM modules, native `node:test`, parser-backed Altium fixtures, SVG renderer tests

---

### Task 1: Add parser regressions for the control-sheet `R92` pin labels

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing tests**

Extend the existing control-sheet multipart tests so they also assert:

- owners `4010`, `4050`, `4088`, and `4126` still expose only their active pin pairs
- those pins render with `labelMode === 'number-only'`
- all four `R92A/B/C/D` designator texts resolve to `anchor === 'end'`

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: FAIL because the current parser hides the `R92` pin numbers and preserves `R92B` as `anchor: 'start'`.

### Task 2: Add a renderer regression for the visible control-sheet output

**Files:**
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Extend the existing control-sheet multipart renderer regression so it also asserts:

- the rendered output contains `R92A`, `R92B`, `R92C`, `R92D`, and `J4`
- the rendered output does not contain `J4A`
- the rendered output contains the expected visible `R92` pin numbers for at least one upper and one lower section
- the rendered `R92B` label uses `text-anchor="end"`

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: FAIL because the current renderer no longer emits those `R92` pin numbers and keeps `R92B` left-aligned.

### Task 3: Implement the minimal parser fix for passive multipart two-pin labels

**Files:**
- Modify: `src/core/altium/SchematicPinParser.mjs`

**Step 1: Write minimal implementation**

Adjust `#normalizeSchematicPinGroup()` so passive two-pin groups with non-canonical numbering do not fall through to `labelMode = 'hidden'`. Keep ordinary `1/2` passive pairs hidden.

**Step 2: Run focused parser test**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: The pin-label assertions pass, with the anchor assertion still isolated if needed.

### Task 4: Implement the minimal owner-text anchor fix

**Files:**
- Modify: `src/core/altium/SchematicTextPostProcessor.mjs`

**Step 1: Write minimal implementation**

Narrow the "above owner" preservation so a left-side designator that is only marginally above a compact horizontal owner can still flow through the left-side anchor logic and resolve to `anchor: 'end'`.

**Step 2: Run focused parser and renderer tests**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: PASS for the new control-sheet parser and renderer assertions.

### Task 5: Bump version and verify

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once the focused tests are green.

**Step 2: Run focused verification**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: PASS.

### Task 6: Run the full repository test suite

**Files:**
- Reference: `package.json`

**Step 1: Run the repository tests**

Run: `npm test`

Expected: PASS, or the same pre-existing unrelated baseline failure if nothing else changed outside this bugfix.

**Step 2: Report residual failures honestly**

If unrelated failures remain, document the exact test name before claiming completion.
