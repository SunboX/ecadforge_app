# Schematic Arc Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add first-class schematic arc support so Altium record-`12` primitives render as proper SVG arcs and restore missing inductor bodies.

**Architecture:** Extend the normalized schematic model with an `arcs` collection, parse record-`12` primitives through the same owner/display-mode filtering used for other symbol geometry, and render them as SVG path arcs with proper coordinate projection. Cover both normalization and rendering with focused regressions before updating the app version and running the full suite.

**Tech Stack:** Node 20, npm, ESM `.mjs`, Node test runner, printable-record Altium parser, SVG string renderers.

---

### Task 1: Add Parser Coverage For Record-12 Arcs

**Files:**

- Modify: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing test**

Add a fixture-backed test that loads `tests/fixtures/altium/AtlasControl-A1.01.01F.SchDoc` and asserts one inductor owner exposes three normalized arc primitives with the expected centers, radius, and start/end angles.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs`
Expected: FAIL because `documentModel.schematic.arcs` does not exist yet or the expected arc entries are missing.

**Step 3: Write minimal implementation**

Do not change production behavior yet beyond what is required to satisfy the parser test.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/core/altium-parser.test.mjs src/core/altium/AltiumParser.mjs
git commit -m "fix: parse schematic record-12 arc primitives"
```

### Task 2: Add SVG Arc Rendering Coverage

**Files:**

- Modify: `tests/ui/renderers.test.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`

**Step 1: Write the failing test**

Add:

- one synthetic renderer test that passes a normalized `arcs` collection and asserts SVG arc-path output
- one fixture-backed renderer test that confirms the sheet-F inductors produce visible arc paths

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers.test.mjs`
Expected: FAIL because the renderer ignores `schematic.arcs`.

**Step 3: Write minimal implementation**

Render normalized arcs as SVG `<path>` elements, including large-arc/sweep handling and full-circle fallback.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/ui/renderers.test.mjs src/ui/SchematicSvgRenderer.mjs
git commit -m "fix: render schematic arc primitives"
```

### Task 3: Integrate Model Shape And Version Bump

**Files:**

- Modify: `src/core/altium/AltiumParser.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Write the failing test**

No new standalone test is required beyond the parser and renderer regressions added above.

**Step 2: Run test to verify integrated behavior**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS once parser and renderer arc support align.

**Step 3: Write minimal implementation**

Update JSDoc model signatures for `schematic.arcs` and increment the app version in `package.json`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/altium/AltiumParser.mjs package.json package-lock.json
git commit -m "chore: bump version for schematic arc rendering"
```

### Task 4: Final Verification

**Files:**

- Modify: `docs/plans/2026-03-10-schematic-arc-rendering-design.md`
- Modify: `docs/plans/2026-03-10-schematic-arc-rendering-implementation-plan.md`

**Step 1: Write the failing test**

No new test file is required here.

**Step 2: Run final verification**

Run: `npm test`
Expected: PASS

**Step 3: Write minimal implementation**

Only adjust documentation if verification reveals the implementation diverged from the approved design.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-03-10-schematic-arc-rendering-design.md docs/plans/2026-03-10-schematic-arc-rendering-implementation-plan.md
git commit -m "docs: record schematic arc rendering plan"
```
