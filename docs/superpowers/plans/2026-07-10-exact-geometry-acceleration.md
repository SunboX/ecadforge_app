# Exact Geometry Acceleration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dominant repeated polygon scans in `pcb-scene3d-viewer` with exact request-scoped spatial queries while preserving rendered geometry and source order.

**Architecture:** Add an immutable AABB hierarchy, prepared polygons, and prepared polygon sets in the owning viewer library. Use them only as candidate-complete broad phases; retain current narrow-phase predicates, recursion order, epsilon, and point-array inputs. Measure every integration against an unoptimized baseline and exercise the patched package through ECAD Forge.

**Tech Stack:** JavaScript ES modules, Node.js test runner through `npm test`, Three.js buffer geometry, local `pcb-scene3d-viewer`, and ECAD Forge integration tests.

## Global Constraints

- Implementation root: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer`.
- Integration root: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app`.
- Preserve the `0.001` epsilon and every current inclusive/strict predicate meaning.
- Indexed queries may return false positives but may never omit a brute-force candidate.
- Preserve triangle traversal, recursive child order, retained vertex values, output order, and first-source-wins duplicate behavior.
- Do not reduce mesh detail, simplify polygons, omit holes, widen tolerances, or add source-specific behavior.
- Use generated, generic, source-obfuscated tests; never commit supplied traces or source identifiers.
- Keep every source/test file below 1,000 lines and add JSDoc to every function/method.
- Use repo-owned commands: `npm test`, `npm run check:format`, and the benchmark command added below.
- Do not publish packages, push branches, or change ECAD Forge production dependency ranges.

---

### Task 1: Establish the trace-shaped baseline harness

**Files:**

- Create: `../pcb-scene3d-viewer/scripts/benchmark-exact-geometry.mjs`
- Modify: `../pcb-scene3d-viewer/package.json`

**Interfaces:**

- Consumes: current copper clipper, drill filter, and cutout filter public methods.
- Produces: `npm run benchmark:exact-geometry`, printing one JSON object with `copperFillMs`, `drillCutoutMs`, `cutoutGeometryMs`, `smallGeometryMs`, and stable output counts.

- [ ] **Step 1: Add the benchmark command**

Insert after the `test` script:

```json
"benchmark:exact-geometry": "node scripts/benchmark-exact-geometry.mjs"
```

- [ ] **Step 2: Add deterministic benchmark helpers**

The script imports Three.js and the three hot classes. It defines and uses these helpers:

```js
function buildLoop(pointCount, radius, offsetX = 0, offsetY = 0) {
    return Array.from({ length: pointCount }, (_, index) => {
        const angle = (index / pointCount) * Math.PI * 2
        return {
            x: offsetX + Math.cos(angle) * radius,
            y: offsetY + Math.sin(angle) * radius
        }
    })
}

function median(values) {
    const sorted = [...values].sort((left, right) => left - right)
    return sorted[Math.floor(sorted.length / 2)]
}

function measure(operation, iterations = 5) {
    operation()
    const elapsed = []
    let result
    for (let index = 0; index < iterations; index += 1) {
        const startedAt = performance.now()
        result = operation()
        elapsed.push(performance.now() - startedAt)
    }
    return { milliseconds: median(elapsed), result }
}
```

Generate a 10,000-point fill, 800 copper triangles, 200 drill cutouts, 240 cutout-filter triangles, and small four-point controls. Recreate each mutable mesh inside its timed operation. Print only `JSON.stringify(results)`.

- [ ] **Step 3: Record the baseline before runtime edits**

Run: `npm run benchmark:exact-geometry`

Expected: exit 0, finite positive timings, and stable counts on two runs. Store both JSON lines outside Git at `/tmp/pcb-scene3d-exact-geometry-baseline.jsonl`.

- [ ] **Step 4: Verify and commit**

Run: `npm run check:format`

Expected: PASS.

```bash
git add package.json scripts/benchmark-exact-geometry.mjs
git commit -m "test: add exact geometry performance baseline"
```

---

### Task 2: Add a candidate-complete AABB index

**Files:**

- Create: `../pcb-scene3d-viewer/src/PcbScene3dAabbIndex.mjs`
- Create: `../pcb-scene3d-viewer/tests/pcb-scene3d-aabb-index.test.mjs`

**Interfaces:**

- Consumes: items with `{ minX, maxX, minY, maxY }` bounds.
- Produces:

```js
new PcbScene3dAabbIndex(items, {
    resolveBounds: (item) => item.bounds,
    resolveSourceIndex: (_item, index) => index,
    leafSize: 12
})

index.queryInto(bounds, target, { epsilon: 0.001, stable: false })
index.query(bounds, { epsilon: 0.001, stable: true })
```

- [ ] **Step 1: Write failing completeness tests**

Test empty input, inclusive touching, epsilon overlap, non-finite overflow items, stable order, and at least 2,000 seeded boxes. Compare every query with:

```js
function overlaps(first, second, epsilon = 0) {
    return !(
        first.maxX < second.minX - epsilon ||
        first.minX > second.maxX + epsilon ||
        first.maxY < second.minY - epsilon ||
        first.minY > second.maxY + epsilon
    )
}
```

Assert every brute-force candidate appears and no object identity is duplicated.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/pcb-scene3d-aabb-index.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the immutable index**

Create private entry, overflow, root, and leaf-size fields. Entries store `{ item, bounds, sourceIndex }`. Build median splits on the widest axis using in-place quickselect, not recursive slice sorting. `queryInto` performs inclusive epsilon overlap, always checks overflow entries, returns all items for a non-finite query, and returns the caller-owned target. Stable queries sort collected entry records by source index before appending.

The exported `PcbScene3dAabbIndex` class has a
`constructor(items, options = {})`, a `query(bounds, options = {})` method that
allocates one result array, and a
`queryInto(bounds, target, options = {})` method that reuses the supplied
target. Every method and private quickselect/tree helper receives complete
JSDoc in production.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- tests/pcb-scene3d-aabb-index.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: PASS.

```bash
git add src/PcbScene3dAabbIndex.mjs tests/pcb-scene3d-aabb-index.test.mjs
git commit -m "feature: add exact polygon bounds index"
```

---

### Task 3: Add prepared polygons and prepared sets

**Files:**

- Create: `../pcb-scene3d-viewer/src/PcbScene3dPreparedPolygon.mjs`
- Create: `../pcb-scene3d-viewer/src/PcbScene3dPreparedPolygonSet.mjs`
- Create: `../pcb-scene3d-viewer/tests/pcb-scene3d-prepared-polygon.test.mjs`
- Create: `../pcb-scene3d-viewer/tests/pcb-scene3d-prepared-polygon-set.test.mjs`

**Interfaces:**

- Consumes: caller-prepared numeric points plus optional original source identity.
- Produces:

```js
new PcbScene3dPreparedPolygon(points, {
    source: points,
    sourceIndex: 0,
    epsilon: 0.001,
    detectCircle: true
})

polygon.containsPointStrict(point)
polygon.containsPointOrBoundary(point)
polygon.isPointOnBoundary(point)
polygon.querySegments(bounds, target)
polygon.queryVertices(bounds, target)

new PcbScene3dPreparedPolygonSet(polygons)
set.query(bounds, { epsilon: 0.001, stable: true })
set.resolveSource(source)
```

- [ ] **Step 1: Write failing differential tests**

Implement independent linear ray-cast and point-on-segment references in tests. Compare convex, concave, mirrored, collinear, epsilon-boundary, 10,000-point, and sampled-circle polygons. Assert segment/vertex candidate completeness. For sets, assert source identity, stable order, earliest duplicate resolution, empty behavior, and overlap completeness.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/pcb-scene3d-prepared-polygon.test.mjs tests/pcb-scene3d-prepared-polygon-set.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement prepared polygons**

Build segments once with `start`, `end`, `dx`, `dy`, `lengthSquared`, and bounds. Build segment and vertex AABB indexes. Preserve source-order centroid and signed-area arithmetic. Resolve circle metadata once in the constructor.

Strict containment uses the current horizontal ray expression after querying only segments whose bounds can cross from `point.x` to `bounds.maxX` at `point.y`. Boundary checks retain current cross, dot, and length comparisons. Expose getters for source, sourceIndex, points, segments, bounds, centroid, signedArea, area, circle, isCircular, centerX, centerY, and radius.

- [ ] **Step 4: Implement prepared sets**

Store supplied prepared objects unchanged, build one top-level AABB index, and
map sources to their earliest prepared object. Stable set queries use each
polygon's position in that set, not a cached polygon's earlier `sourceIndex`.
`query` delegates to the index; `resolveSource` returns `null` when absent.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/pcb-scene3d-prepared-polygon.test.mjs tests/pcb-scene3d-prepared-polygon-set.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: PASS.

```bash
git add src/PcbScene3dPreparedPolygon.mjs src/PcbScene3dPreparedPolygonSet.mjs tests/pcb-scene3d-prepared-polygon.test.mjs tests/pcb-scene3d-prepared-polygon-set.test.mjs
git commit -m "feature: prepare exact polygon queries once"
```

---

### Task 4: Accelerate drill cutout containment

**Files:**

- Modify: `../pcb-scene3d-viewer/src/PcbScene3dDrillCutoutFilter.mjs`
- Modify: `../pcb-scene3d-viewer/tests/pcb-scene3d-drill-cutout-filter.test.mjs`

**Interfaces:**

- Consumes: prepared polygons and sets from Task 3.
- Produces: unchanged `removeNestedCutouts`, `removeCoveredCutouts`, and
  `partitionFillHoles` results with indexed container candidates. Each method
  accepts an optional final `{ preparedPolygonCache?: Map }` argument for
  internal request-scoped reuse while remaining backward compatible.

- [ ] **Step 1: Add observable and differential tests**

Add equal-area duplicates, overlapping non-containers, a concave container,
invalid/short polygons, authored holes, empty early returns, and a generated
high-vertex container. Assert returned values are original array identities in
original order. Add a test-only brute-force reference using the current bounds,
centroid, every-vertex, area, and source-index rules.

Pass a fresh `preparedPolygonCache` through the new optional argument and
assert that every valid source polygon is represented after the call. This is
the required RED assertion: the current implementation ignores the argument.

- [ ] **Step 2: Establish the pre-change result**

Run: `npm test -- tests/pcb-scene3d-drill-cutout-filter.test.mjs`

Expected: existing semantic cases PASS and the cache-contract assertion FAILS
because the current implementation leaves the map empty.

- [ ] **Step 3: Integrate prepared candidates**

Keep current point coercion in `#buildPolygonInfo`, create one prepared polygon
from those numeric points, and build one prepared set per public operation.
When a supplied cache already contains an entry keyed by the same source array,
reuse it; otherwise create and cache the prepared polygon. Query stable
bounds-overlap candidates before applying unchanged bounds containment,
centroid, every-vertex, area, and source-index rules.

Replace the repeated raw polygon predicate with:

```js
static #isPointInsideOrOnPolygon(point, polygonInfo) {
    return polygonInfo.prepared.containsPointOrBoundary(point)
}
```

Do not mutate or replace source arrays.

- [ ] **Step 4: Verify semantics and speed**

Run: `npm test -- tests/pcb-scene3d-drill-cutout-filter.test.mjs`

Expected: PASS.

Run: `npm run benchmark:exact-geometry`

Expected: identical drill output count and at least 5x lower `drillCutoutMs` than Task 1.

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

Expected: PASS.

```bash
git add src/PcbScene3dDrillCutoutFilter.mjs tests/pcb-scene3d-drill-cutout-filter.test.mjs
git commit -m "fix: accelerate exact drill cutout containment"
```

---

### Task 5: Accelerate recursive cutout filtering

**Files:**

- Modify: `../pcb-scene3d-viewer/src/PcbScene3dCutoutGeometryFilter.mjs`
- Modify: `../pcb-scene3d-viewer/tests/pcb-scene3d-cutout-geometry-filter.test.mjs`
- Create: `../pcb-scene3d-viewer/tests/pcb-scene3d-cutout-geometry-equivalence.test.mjs`

**Interfaces:**

- Consumes: prepared polygon/set queries and structurally compatible circle getters.
- Produces: unchanged `filter(THREE, geometry, cutouts, options)` plus internal `options.preparedPolygonCache` for request-scoped reuse.

- [ ] **Step 1: Add differential output tests**

Generate circular, concave, collinear, fully covered, terminal-overlap, and
recursively subdivided cases. Cover invalid/no cutouts, empty geometry, total
bounds misses, unchanged indexed-geometry identity, and changed non-indexed
output. Capture current flattened position arrays and assert exact equality
after indexing. Include a 10,000-point cutout overlapping only a small triangle
subset.

Pass a fresh `preparedPolygonCache` in the filter options and assert it contains
the valid source cutouts after filtering. This cache-contract assertion is the
required RED behavior before production integration.

- [ ] **Step 2: Establish baseline outputs**

Run: `npm test -- tests/pcb-scene3d-cutout-geometry-filter.test.mjs tests/pcb-scene3d-cutout-geometry-equivalence.test.mjs`

Expected: deterministic baseline buffers remain correct and the cache-contract
assertion FAILS because the current filter ignores the supplied map.

- [ ] **Step 3: Replace local preparation and grid indexing**

Delete the file-local grid and segment construction. Prepare each valid cutout, optionally reusing a prepared object from `options.preparedPolygonCache`, then build a prepared set for top-level triangle bounds. Recursive children keep using the already-prepared `overlappingCutouts` array.

Use `cutout.queryVertices(triangleBounds, candidates)` before the current point-in-triangle predicate and `cutout.querySegments(edgeBounds, candidates)` before the current file-local segment-intersection predicate. Do not substitute the copper clipper's different orientation-product rule. Delegate non-circular strict/inclusive point queries to prepared methods and preserve circular radius arithmetic.

- [ ] **Step 4: Verify exact output and file size**

Run: `npm test -- tests/pcb-scene3d-cutout-geometry-filter.test.mjs tests/pcb-scene3d-cutout-geometry-equivalence.test.mjs`

Expected: PASS with exact position-array equality.

Run: `wc -l src/PcbScene3dCutoutGeometryFilter.mjs`

Expected: fewer than 1,000 lines.

Run: `npm run benchmark:exact-geometry`

Expected: identical cutout output count and at least 5x lower `cutoutGeometryMs` than Task 1.

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

Expected: PASS.

```bash
git add src/PcbScene3dCutoutGeometryFilter.mjs tests/pcb-scene3d-cutout-geometry-filter.test.mjs tests/pcb-scene3d-cutout-geometry-equivalence.test.mjs
git commit -m "fix: index exact cutout geometry queries"
```

---

### Task 6: Reuse cutout metadata across one silkscreen side build

**Files:**

- Modify: `../pcb-scene3d-viewer/src/PcbScene3dCutoutCircleDetector.mjs`
- Create: `../pcb-scene3d-viewer/src/PcbScene3dSilkscreenCutoutContext.mjs`
- Modify: `../pcb-scene3d-viewer/src/PcbScene3dSilkscreenFactory.mjs`
- Modify: `../pcb-scene3d-viewer/src/PcbScene3dSilkscreenFillSeamBuilder.mjs`
- Modify: `../pcb-scene3d-viewer/src/PcbScene3dCopperTextFactory.mjs`
- Modify: `../pcb-scene3d-viewer/src/PcbScene3dBoardEdgeCutoutBuilder.mjs`
- Create: `../pcb-scene3d-viewer/tests/pcb-scene3d-cutout-circle-detector.test.mjs`
- Create: `../pcb-scene3d-viewer/tests/pcb-scene3d-silkscreen-cutout-context.test.mjs`
- Modify: `../pcb-scene3d-viewer/tests/pcb-scene3d-silkscreen-shape-region.test.mjs`
- Modify: `../pcb-scene3d-viewer/tests/pcb-scene3d-silkscreen-drill-cutouts.test.mjs`

**Interfaces:**

- Consumes: normalized side-level cutout arrays and prepared polygons from Task 3.
- Produces one fresh context per side with:

```js
const context = new PcbScene3dSilkscreenCutoutContext()
context.resolve(cutout)
context.resolveCircle(cutout)
context.preparedPolygonCache
context.applyCircularEdgeCutouts(contour, cutouts)
context.isHoleInsideContour(hole, contour)
```

- [ ] **Step 1: Add exact detector and context tests**

Test the detector's eight-point minimum, sampled circle, ellipse rejection,
non-finite values, and custom epsilon. Reproduce the current allocation-heavy
reference and deep-compare seeded points. Test that one context returns the
same prepared identity and one circle computation for repeated source access,
while a fresh context observes mutated coordinates.

- [ ] **Step 2: Establish detector equivalence and context failure**

Run: `npm test -- tests/pcb-scene3d-cutout-circle-detector.test.mjs tests/pcb-scene3d-silkscreen-cutout-context.test.mjs`

Expected: detector cases PASS and the context import FAILS before creation.

- [ ] **Step 3: Remove allocation-heavy detector arrays**

Replace the two `map` calls, `reduce`, and spread `Math.max` with indexed loops.
Preserve source-order centroid sum, radius sum, maximum-error scan, and
`Math.hypot` so results remain identical.

- [ ] **Step 4: Implement the request-scoped context**

Own a private `Map` from source arrays to prepared polygons. `resolve` creates a
`PcbScene3dPreparedPolygon` only when absent; `resolveCircle` returns its circle.
Expose the same map through a getter for the drill/cutout filters. Move the
factory's circular-edge-cutout orchestration into the context so the 965-line
factory shrinks rather than crossing the line limit.

Extend `PcbScene3dBoardEdgeCutoutBuilder.isHoleInsideContour` with an optional
third `resolvedCircle` parameter. When supplied, use it instead of invoking the
detector; raw callers retain current behavior.

- [ ] **Step 5: Thread one context through every side consumer**

Create one context immediately after side cutout normalization. Pass its cache
to track chunks, arcs, every fill, fill seams, copper text filtering, drill
partition/nesting, and `PcbScene3dCutoutGeometryFilter`. Use the context for
edge-circle classification/application. Preserve public method signatures by
adding only optional final options internally.

- [ ] **Step 6: Verify integration and file limits**

Run: `npm test -- tests/pcb-scene3d-cutout-circle-detector.test.mjs tests/pcb-scene3d-silkscreen-cutout-context.test.mjs tests/pcb-scene3d-silkscreen-shape-region.test.mjs tests/pcb-scene3d-silkscreen-drill-cutouts.test.mjs tests/pcb-scene3d-board-edge-cutout-builder.test.mjs`

Expected: PASS with identical mesh positions and classification.

Run: `wc -l src/PcbScene3dSilkscreenFactory.mjs`

Expected: fewer than 1,000 lines.

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/PcbScene3dCutoutCircleDetector.mjs src/PcbScene3dSilkscreenCutoutContext.mjs src/PcbScene3dSilkscreenFactory.mjs src/PcbScene3dSilkscreenFillSeamBuilder.mjs src/PcbScene3dCopperTextFactory.mjs src/PcbScene3dBoardEdgeCutoutBuilder.mjs tests/pcb-scene3d-cutout-circle-detector.test.mjs tests/pcb-scene3d-silkscreen-cutout-context.test.mjs tests/pcb-scene3d-silkscreen-shape-region.test.mjs tests/pcb-scene3d-silkscreen-drill-cutouts.test.mjs
git commit -m "fix: reuse exact silkscreen cutout metadata"
```

---

### Task 7: Prepare copper fill coverage once per side

**Files:**

- Create: `../pcb-scene3d-viewer/src/PcbScene3dCopperFillLoopSetResolver.mjs`
- Create: `../pcb-scene3d-viewer/src/PcbScene3dCopperFillCoverageContext.mjs`
- Modify: `../pcb-scene3d-viewer/src/PcbScene3dCopperFillAreaClipper.mjs`
- Modify: `../pcb-scene3d-viewer/src/PcbScene3dCopperFillMeshBuilder.mjs`
- Modify: `../pcb-scene3d-viewer/src/PcbScene3dCopperFactory.mjs`
- Create: `../pcb-scene3d-viewer/tests/pcb-scene3d-copper-fill-loop-set-resolver.test.mjs`
- Create: `../pcb-scene3d-viewer/tests/pcb-scene3d-copper-fill-coverage-context.test.mjs`
- Modify: `../pcb-scene3d-viewer/tests/pcb-scene3d-copper-fill-overlap.test.mjs`

**Interfaces:**

- Consumes: raw fills or normalized ordered loop sets.
- Produces:

```js
PcbScene3dCopperFillLoopSetResolver.resolve(
    fills,
    normalizeBoardPoint,
    mirrorY
)

PcbScene3dCopperFillCoverageContext.fromLoopSets(loopSets)

context.queryAreas(triangleBounds, target, {
    beforeSourceIndex: Infinity,
    allowedSourceIndexes: null
})

PcbScene3dCopperFillAreaClipper.filterPrepared(
    THREE,
    mesh,
    coverageContext,
    options
)
```

- [ ] **Step 1: Extract canonical loop-set normalization with failing tests**

Test source/island order, holes, mirrored Y, invalid/zero-area loops, and bounds. Move the builder's current normalization/cleanup into the resolver without changing output.

Run: `npm test -- tests/pcb-scene3d-copper-fill-loop-set-resolver.test.mjs`

Expected before implementation: FAIL with `ERR_MODULE_NOT_FOUND`; after extraction: PASS plus the existing copper overlap suite.

- [ ] **Step 2: Add failing context tests**

Test stable area order, `beforeSourceIndex`, allowed indexes, holes, epsilon touching, distant areas, very large bounds, and brute-force candidate completeness. Each context area has:

```js
{
    outer: preparedOuter,
    holes: preparedHoles,
    bounds: preparedOuter.bounds,
    sourceIndex
}
```

Run: `npm test -- tests/pcb-scene3d-copper-fill-coverage-context.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` before the context exists.

- [ ] **Step 3: Implement the immutable context**

Prepare all ordered loops and one top-level AABB index. `queryAreas` appends possible areas, then applies `beforeSourceIndex` and `allowedSourceIndexes` without rebuilding polygons. The context retains original loop-set order and uses prepared outer/hole queries.

The resolver returns normalized `[x, y]` pairs. The context converts every pair
once to `{ x: Number(pair[0]), y: Number(pair[1]) }` before constructing the
prepared polygons; later queries never repeat that conversion.

- [ ] **Step 4: Route the clipper through prepared candidates**

Retain the current raw `filter` wrapper; it resolves loop sets, builds a context, and delegates to `filterPrepared`. For every triangle, query candidate areas once by triangle bounds. Use prepared point containment, segment bounds candidates, and vertex bounds candidates, but retain the clipper's orientation-product segment predicate, four coverage samples, recursive order, and terminal centroid decision.

Extend overlap tests to deep-compare raw and prepared position arrays for full, none, partial, recursive, enclosing-loop, hole, epsilon-boundary, and mirrored cases.

- [ ] **Step 5: Reuse one context for track, arc, and fill**

In each `#buildMaskCoveredSideGroup`, resolve loop sets and the context once. Pass the same context to track and arc filters and pass both loop sets/context into the fill builder through internal options:

```js
{
    surfaceOnly: true,
    clipContainedFillOverlaps: true,
    loopSets,
    coverageContext
}
```

Top and bottom keep separate contexts. The fill builder must not renormalize supplied loop sets.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/pcb-scene3d-copper-fill-loop-set-resolver.test.mjs tests/pcb-scene3d-copper-fill-coverage-context.test.mjs tests/pcb-scene3d-copper-fill-overlap.test.mjs tests/pcb-scene3d-copper-factory.test.mjs`

Expected: PASS with exact position arrays and shared context identity.

Run: `npm test`

Expected: PASS.

```bash
git add src/PcbScene3dCopperFillLoopSetResolver.mjs src/PcbScene3dCopperFillCoverageContext.mjs src/PcbScene3dCopperFillAreaClipper.mjs src/PcbScene3dCopperFillMeshBuilder.mjs src/PcbScene3dCopperFactory.mjs tests/pcb-scene3d-copper-fill-loop-set-resolver.test.mjs tests/pcb-scene3d-copper-fill-coverage-context.test.mjs tests/pcb-scene3d-copper-fill-overlap.test.mjs
git commit -m "fix: reuse exact copper fill coverage"
```

---

### Task 8: Reuse ordered preparation in fallback clipping

**Files:**

- Modify: `../pcb-scene3d-viewer/src/PcbScene3dCopperFillMeshBuilder.mjs`
- Modify: `../pcb-scene3d-viewer/tests/pcb-scene3d-copper-fill-overlap.test.mjs`
- Modify: `../pcb-scene3d-viewer/tests/pcb-scene3d-copper-fill-mesh-builder.test.mjs`

**Interfaces:**

- Consumes: the ordered loop sets/context from Task 7 and current polygon-boolean fallback decision.
- Produces: prefix-filtered `filterPrepared` calls with no loop-set-to-fill reparsing.

- [ ] **Step 1: Add ordered fallback tests**

Force `PcbScene3dCopperFillPolygonBoolean.resolveRemainingLoopSets` to return `null`, restoring it in `finally`. Test three overlapping fills, prefix-only clipping, later-fill exclusion, authored holes, a candidate inside an earlier hole, epsilon boundary touching, mirrored coordinates, and recursive subdivision. Assert exact position arrays and first-emitted ownership.

Use generated point objects with counted coordinate getters and assert each
earlier loop is prepared only once for the full build. This is the required RED
assertion: the current fallback converts and rereads earlier loops repeatedly.

- [ ] **Step 2: Establish fallback outputs**

Run: `npm test -- tests/pcb-scene3d-copper-fill-overlap.test.mjs tests/pcb-scene3d-copper-fill-mesh-builder.test.mjs`

Expected: existing semantics PASS, generated buffers are deterministic, and the
single-preparation getter-count assertion FAILS on the repeated fallback path.

- [ ] **Step 3: Replace repeated preparation**

Pass loop-set index and the shared context into `#appendTriangleClippedLoopSet`. Replace `#resolveClipLoopSets` with a `Set` of eligible earlier source indexes using the same bounds and `#isInsideAnyHole` tests. Replace raw fallback clipping with:

```js
const clippedMesh = PcbScene3dCopperFillAreaClipper.filterPrepared(
    THREE,
    mesh,
    coverageContext,
    {
        beforeSourceIndex: loopSetIndex,
        allowedSourceIndexes
    }
)
```

Delete `#loopSetsToFills` and its object allocation. Do not change polygon-boolean success behavior or emission order.

- [ ] **Step 4: Verify semantics and performance**

Run: `npm test -- tests/pcb-scene3d-copper-fill-overlap.test.mjs tests/pcb-scene3d-copper-fill-mesh-builder.test.mjs`

Expected: PASS with exact arrays.

Run: `npm run benchmark:exact-geometry`

Expected: identical copper count and at least 10x lower `copperFillMs` than Task 1.

- [ ] **Step 5: Verify format and commit**

Run: `npm test`

Expected: PASS.

Run: `npm run check:format`

Expected: PASS.

```bash
git add src/PcbScene3dCopperFillMeshBuilder.mjs tests/pcb-scene3d-copper-fill-overlap.test.mjs tests/pcb-scene3d-copper-fill-mesh-builder.test.mjs
git commit -m "fix: reuse ordered copper fill coverage"
```

---

### Task 9: Verify exactness, performance, and ECAD Forge integration

**Files:**

- Modify only when a new failing regression proves a general defect: files from Tasks 1-8 and their focused tests.
- Do not modify: ECAD Forge `package.json`, `package-lock.json`, production dependency ranges, or supplied traces.

**Interfaces:**

- Consumes: optimized viewer worktree and `/tmp/pcb-scene3d-exact-geometry-baseline.jsonl`.
- Produces: full test/format/build evidence, benchmark comparison, line-count evidence, and a fresh local profile or equivalent instrumentation.

- [ ] **Step 1: Run the viewer matrix**

Run:

```bash
npm test
npm run check:format
npm run benchmark:exact-geometry
wc -l src/PcbScene3dAabbIndex.mjs src/PcbScene3dPreparedPolygon.mjs src/PcbScene3dPreparedPolygonSet.mjs src/PcbScene3dCopperFillCoverageContext.mjs src/PcbScene3dCutoutGeometryFilter.mjs src/PcbScene3dSilkscreenFactory.mjs
```

Expected: all tests/format checks pass; listed files are below 1,000 lines; copper is at least 10x faster, drill at least 5x, and cutout filtering at least 5x; counts match; small geometry regresses by no more than 10% or 1 ms, whichever is larger.

- [ ] **Step 2: Install only into ECAD Forge's local `node_modules`**

From the app root, run:

```bash
npm install --no-save --package-lock=false /Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/.worktrees/exact-geometry-acceleration
npm test
npm run check:structured-data
npm run build:static
```

Expected: PASS and no new tracked app dependency/generated HTML changes.

- [ ] **Step 3: Run browser sanity and profiling**

Start `npm start`, open `http://localhost:3000/`, and use repo-owned fake samples only. Confirm the 3D scene, holes, copper, silkscreen, selection, and browser console. Capture a profile of the largest repo-owned geometry sample or equivalent function-level instrumentation. Confirm the three original full-loop hotspots are no longer dominant.

- [ ] **Step 4: Review scope and cleanliness**

Run:

```bash
git diff --check main...HEAD
git status --short --branch
git log --oneline --decorate main..HEAD
```

Expected: only approved viewer implementation/tests/benchmark changes; clean worktree; no source-specific fixture, app workaround, publish, or production dependency change.

- [ ] **Step 5: Route any proven regression back to its owning task**

When verification fails, return to the owning Task 4, 5, 6, 7, or 8, add a
focused failing test there, apply the smallest exact fix, and rerun this full
matrix. Create no empty commit when verification finds no defect.
