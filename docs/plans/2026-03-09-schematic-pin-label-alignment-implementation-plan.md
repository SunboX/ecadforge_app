# Schematic Pin Label Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore correct Altium-style pin number and internal label placement for `U6`, `U29`, and `U31` in `GEWA-G1.01.01E.SchDoc`.

**Architecture:** Fix the root cause in the normalized pin parser so the affected five-pin gate symbols preserve `name-and-number` labeling, then update the schematic SVG renderer to place horizontal pin numbers outside the symbol body and pin names inside the body. Verify the behavior against the real source file and keep the change limited to parser label-mode selection and SVG pin text placement.

**Tech Stack:** Node 20, npm, ESM `.mjs`, Node test runner, Altium schematic parser, SVG string renderer.

---

### Task 1: Lock In The Reported Bug With Failing Tests

**Files:**

- Modify: `tests/ui/renderers.test.mjs`
- Modify: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing test**

Add tests that parse `/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01E.SchDoc` and assert:

- `U29` and `U31` pins are not normalized as `name-only`
- rendered SVG contains numeric pin labels for those symbols
- rendered `U6` horizontal pin numbers are outside the symbol body while names remain inside

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL because `U29` and `U31` currently lose their pin numbers and `U6` horizontal number placement is wrong.

**Step 3: Write minimal implementation**

Do not change production code until the new tests fail for the expected reasons.

**Step 4: Run test to verify it still fails for the right reason**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL with assertions tied to missing gate pin numbers and misplaced `U6` label columns.

**Step 5: Commit**

```bash
git add tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs
git commit -m "test: cover schematic pin label alignment regression"
```

### Task 2: Fix Pin Label Mode Selection In The Parser

**Files:**

- Modify: `src/core/altium/SchematicPinParser.mjs`
- Test: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing test**

Use the parser assertions from Task 1 as the contract.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs`
Expected: FAIL because the affected gate symbols are still normalized as `name-only`.

**Step 3: Write minimal implementation**

Adjust `#normalizeSchematicPinGroup(...)` so the observed five-pin logic gate pattern keeps `name-and-number` rather than dropping the numeric designators.

Keep the change narrow:

- do not change passive hidden-pin behavior
- do not change the existing connector or vertical-pin suppression rules
- preserve the current normalized pin shape

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/altium/SchematicPinParser.mjs tests/core/altium-parser.test.mjs
git commit -m "fix: preserve gate pin numbers in schematic parsing"
```

### Task 3: Fix Horizontal Pin Text Placement In The Renderer

**Files:**

- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Test: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Use the renderer assertions from Task 1 as the contract.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers.test.mjs`
Expected: FAIL because horizontal pin numbers still render in the wrong column.

**Step 3: Write minimal implementation**

Update `#buildSchematicPinMarkup(...)` so horizontal pins follow a stable layout:

- left pins: number outside to the left, name inside to the right
- right pins: name inside to the left, number outside to the right
- preserve vertical pin-number centering behavior
- preserve `hidden`, `number-only`, and `name-only` handling

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ui/SchematicSvgRenderer.mjs tests/ui/renderers.test.mjs
git commit -m "fix: align schematic pin label columns"
```

### Task 4: Final Verification And Repo Requirements

**Files:**

- Modify: `package.json`

**Step 1: Write the failing test**

No new tests are required here beyond the full suite.

**Step 2: Run test to verify the integrated behavior**

Run: `npm test`
Expected: PASS after the parser and renderer changes are complete.

**Step 3: Write minimal implementation**

Increment the app version in `package.json` as required by the repo instructions.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json
git commit -m "chore: bump version for pin label alignment fix"
```
