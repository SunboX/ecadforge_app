# Schematic Content Scaling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scale schematic primitives into the normalized page frame while keeping border chrome and footer layout fixed.

**Architecture:** Compute one uniform SVG transform from the original inner-frame size to the normalized inner-frame size. Apply it to one wrapper group around drawable schematic content only, leaving page chrome outside that group.

**Tech Stack:** Browser-side ESM modules, Node test runner, string-based SVG renderer.

---

### Task 1: Add the failing renderer regression

**Files:**
- Modify: `tests/ui/renderers/schematic-core.mjs`

**Step 1: Write the failing test**

Add a regression that renders a normalized A3 sheet with `sourceWidth: 1500`, `sourceHeight: 950`, `width: 1654`, `height: 1169`, `marginWidth: 20`, and asserts the SVG contains a content wrapper transform anchored at the bottom-left inner frame.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: The new assertion fails because the renderer does not yet emit a scaling wrapper.

### Task 2: Implement content-group scaling

**Files:**
- Modify: `src/ui/SchematicSvgRenderer.mjs`

**Step 1: Add a content-transform resolver**

Compute a uniform scale from the source and target inner-frame sizes. Return an empty string when there is no larger normalized sheet.

**Step 2: Wrap drawable content groups**

Add one `<g class="schematic-content" ...>` wrapper around polygons, rectangles, lines, arcs, junctions, pins, ports, crosses, components, and texts. Keep `frameMarkup` outside the wrapper.

**Step 3: Re-run the renderer test**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: The new regression passes.

### Task 3: Final verification and version bump

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the package version from `1.1.107` to `1.1.108`.

**Step 2: Run the full suite**

Run: `npm test`

Expected: All tests pass.
