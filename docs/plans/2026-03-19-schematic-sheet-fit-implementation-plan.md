# Schematic Sheet Fit Implementation Plan

**Goal:** Make normalized schematic content render closer to the Altium reference by restoring normalized promoted-sheet scale and anchoring against the dominant drawing box while keeping the sheet chrome fixed.

**Architecture:** Keep the renderer's existing content-only transform pipeline and change only the normalized-sheet fit math inside `SchematicContentLayout`. Detect large rendered rectangles/regions as dominant drawing boxes, use their top edge to bias the normalized vertical anchor, restore the normalized page scale limit, and verify that sparse custom-sheet behavior stays unchanged.

**Tech Stack:** Browser-side ESM modules, Node.js `node:test`, string-based SVG rendering.

---

### Task 1: Lock the promoted-sheet placement with failing regressions

**Files:**

- Modify: `tests/ui/renderers/schematic-sheet-scaling.mjs`

**Step 1: Write the failing test**

Update the simple normalized-sheet regression so it expects the promoted A3 content wrapper to use the normalized page scale again:

```js
assert.match(
    markup,
    /<defs><clipPath id="schematic-content-clip-[^"]+"><rect x="20" y="20" width="1614" height="1129" \/><\/clipPath><\/defs><g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(130 25\.10\) scale\(1\.11\) translate\(-130 -152\)">/
)
```

Add a second regression with one large rectangle and one small top text outlier so the transform locks to the dominant drawing box:

```js
assert.match(
    markup,
    /<defs><clipPath id="schematic-content-clip-[^"]+"><rect x="20" y="20" width="1614" height="1129" \/><\/clipPath><\/defs><g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(130 5\.20\) scale\(1\.11\) translate\(-130 -152\)">/
)
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ui/renderers/schematic-sheet-scaling.mjs`

Expected: FAIL because the current transform still anchors both cases to `bounds.minY`.

### Task 2: Update normalized-sheet fit math

**Files:**

- Modify: `src/ui/SchematicContentLayout.mjs`

**Step 1: Write minimal implementation**

Adjust `#buildNormalizedSheetTransform()` so it:

- computes `topLimit = margin + contentPadding * 0.2`
- resolves one dominant rendered rectangle/region when its size meaningfully matches the main content envelope
- restores the normalized page scale limit for promoted sheets
- fits width against the overall content bounds
- computes the vertical bottom-fit limit from the dominant anchor top to the overall content bottom
- sets `targetMinY` from the dominant-anchor delta instead of always pinning `bounds.minY` to `topLimit`

Leave sparse custom-sheet behavior unchanged.

**Step 2: Run the focused test to verify it passes**

Run: `npm test -- tests/ui/renderers/schematic-sheet-scaling.mjs`

Expected: PASS for the updated normalized-sheet placement and existing sparse custom-sheet regression.

### Task 3: Final verification and version bump

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Bump the app version**

Increment the package version from `1.2.6` to `1.2.7`.

**Step 2: Run the full suite**

Run: `npm test`

Expected: PASS across the full test suite.
