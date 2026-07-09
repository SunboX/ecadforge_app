# Exact Geometry Acceleration Design

## Status

Approved direction: aggressive performance optimization with exact rendered
geometry. This document covers the first bounded subproject of the larger
rendering-performance campaign.

The owning implementation repository is the local sibling
`pcb-scene3d-viewer`. ECAD Forge remains the integration and end-to-end
verification target. OCCT/WASM import optimization and scene lifecycle/draw-call
optimization are separate follow-up subprojects; their work should be chosen
from fresh traces after this geometry phase lands.

## Motivation

The five supplied browser traces show that the largest avoidable main-thread
costs are exact polygon queries inside `pcb-scene3d-viewer`:

- one Gerber workload spends about 27.4 seconds in copper fill-area clipping,
  mostly scanning every loop edge and vertex for every triangle;
- one KiCad workload spends about 4.7 seconds removing nested drill cutouts;
- the shared cutout geometry filter and circle detector recur across all five
  workloads and consume additional multi-second blocks;
- track, arc, and fill overlap paths repeatedly prepare or scan the same fill
  geometry.

The current algorithms are correct but their hot paths are commonly
`triangles × polygon vertices`, `polygon pairs × polygon vertices`, or repeated
preparation of the same loop sets. Small allocation-heavy predicates amplify
that asymptotic cost.

## Goals

- Preserve the existing clipping, containment, subdivision, epsilon, and
  ordering behavior exactly for the same input and options.
- Replace full polygon scans with exact spatial candidate queries.
- Prepare each polygon's bounds, segments, vertices, and circle metadata once
  per render/build context and reuse them.
- Share the accelerator across copper coverage, drill containment, and cutout
  filtering instead of adding isolated app-side workarounds.
- Keep public renderer inputs as ordinary point arrays. Prepared structures are
  internal implementation details.
- Keep all new and changed source and test files below 1,000 lines and document
  every function with JSDoc.
- Establish reproducible, trace-shaped benchmarks without committing supplied
  files or source-derived identifiers.

## Non-goals

- No mesh-detail reduction, polygon simplification, hole removal, tolerance
  widening, or approximate clipping.
- No customer-, vendor-, filename-, or fixture-specific behavior.
- No OCCT build changes, STEP worker pool, OffscreenCanvas migration, scene
  remount changes, or draw-call batching in this subproject.
- No publishing or production dependency update as an implicit side effect.
  Package release and ECAD Forge dependency integration require their normal
  explicit release workflow after the local optimization is verified.

## Exactness Contract

Spatial acceleration is broad phase only. It may return false-positive
candidates, which the existing exact predicates reject, but it must never omit
a possible candidate.

For a given source geometry, point arrays, and options:

- source triangles are visited in the same order;
- recursive subdivision visits children in the same order and uses the same
  depth and edge-length limits;
- `0.001` geometry epsilon behavior remains unchanged;
- point-on-boundary, point-in-polygon, segment intersection, circular overlap,
  and containment decisions retain their current inclusive or strict semantics;
- retained triangle coordinates and their output order remain unchanged;
- duplicate equal-area cutouts retain the current first-source-wins rule;
- invalid or empty geometry continues to return the current unchanged/empty
  result instead of introducing a new exception.

Any optimization that cannot prove those properties must remain outside this
exact phase.

## Architecture

### `PcbScene3dAabbIndex`

Add a small internal class that builds an immutable binary AABB hierarchy over
items with finite bounds. Construction uses median splits along the widest
axis, producing `O(n log n)` preparation and expected `O(log n + k)` queries.

The index exposes allocation-conscious query methods that append matching
source items or indexes into a caller-owned array. Queries use inclusive bounds
expanded by the caller's epsilon. Small collections use a linear leaf path so
the index does not penalize ordinary simple boards. Items with non-finite bounds
remain in an overflow list and are checked linearly instead of being discarded.

Every indexed item retains its original source index. Callers whose tie-breaking
depends on source order request stable ordering; boolean hot paths may consume
the tree order because their result is order-independent.

The implementation must include a linear fallback. Non-finite bounds are not
indexed, and a failed/empty index must never turn into a false-negative query.

### `PcbScene3dPreparedPolygon`

Add an internal prepared-polygon class that owns request-scoped numeric metadata
for one finite loop:

- original source reference and source index;
- caller-prepared numeric points and polygon bounds;
- signed and absolute area plus the existing arithmetic-mean centroid where
  required by drill filtering;
- segments with delta, squared length, and segment bounds;
- a segment AABB index and vertex AABB index for sufficiently complex loops;
- circle metadata resolved once with the current circle detector.

It provides exact narrow-phase operations used by the current call sites:

- strict and inclusive point containment;
- point-on-boundary checks;
- segment candidates for one line or triangle-edge bounds;
- vertex candidates inside one triangle bounds;
- triangle/boundary intersection;
- bounds containment and overlap.

Point-in-polygon casts the same horizontal ray as the current code, but its
broad phase asks the segment index only for edges whose bounds can cross that
ray. Boundary and intersection checks similarly query epsilon-expanded boxes
before running the current scalar cross/dot predicates.

Triangle containment uses three scalar cross products without allocating a
`signs` array or callback closures. This is an implementation optimization, not
a predicate change.

### `PcbScene3dPreparedPolygonSet`

Add a request-scoped collection that prepares polygons once and indexes their
outer bounds. It supports overlap queries and containment-candidate queries,
and preserves source indexes for exact tie-breaking.

The collection is immutable after construction. For ordered fill-to-fill
clipping, all loop sets are known before triangle emission; they are prepared in
one batch and tagged with their emission index. A query can then consider only
areas whose emission index precedes the current fill without rebuilding an
incremental index.

No global cache is used. This avoids stale results if a caller mutates a point
array and ensures the temporary indexes are released after the geometry build.

## Integration

### Copper fill coverage

Refactor `PcbScene3dCopperFillAreaClipper` so it can create and consume an
internal prepared coverage context. Its existing `filter(...)` entry point
continues to accept raw fills and prepares a context when one is not supplied.

`PcbScene3dCopperFactory` prepares one side-specific context and reuses it for
the track and arc meshes. Top and bottom remain separate because their
normalized/mirrored coordinates differ.

`PcbScene3dCopperFillMeshBuilder` prepares its already-normalized ordered loop
sets once. When fill `i` is emitted, it clips only against spatially overlapping
areas with an earlier emission index. It no longer converts every accumulated
loop set back into a new fill object and reparses all prior polygons for every
fill.

For each triangle, the area index first limits candidate outer polygons. Each
candidate then uses prepared segment and vertex indexes for boundary crossing.
The four existing coverage samples and exact hole semantics remain unchanged.

### Drill cutout filtering

Refactor `PcbScene3dDrillCutoutFilter` to build one prepared polygon set for
cutouts and one for authored holes per operation.

Before testing exact coverage, query only polygons whose bounds overlap the
candidate, then apply the existing bounds-containment, centroid, every-vertex,
area, and source-index rules. Point queries use the prepared containing
polygon, eliminating repeated scans of thousands of edges.

The returned arrays remain the original source arrays in original order.

### Triangle/cutout filtering

Split prepared-polygon and predicate responsibilities out of the existing
998-line `PcbScene3dCutoutGeometryFilter`. Its recursive traversal, terminal
classifier, settings, and output construction remain the orchestration layer.

The existing top-level cutout candidate reduction can be replaced by the shared
AABB index once differential tests prove candidate completeness. Every prepared
cutout retains the shape expected by circular overlap and terminal
classification. Internal segment and vertex scans delegate to the prepared
polygon queries.

Subdivided child triangles continue to reuse the already-prepared overlapping
cutout objects. They never rebuild polygon metadata.

### Circle metadata

Resolve circle metadata while preparing a polygon and reuse it throughout one
silkscreen/cutout build. Direct raw-array circle detection remains available for
callers that do not have a prepared context, but hot renderer paths must not
repeatedly resolve the same polygon.

This cache is scoped to a build context rather than a persistent `WeakMap`, so
mutable external point arrays cannot produce stale circle results.

## Data Flow

1. A renderer stage receives its existing point arrays or fill primitives.
2. The owning stage normalizes them exactly once for its coordinate space.
3. A prepared polygon set computes reusable metadata and its AABB hierarchy.
4. Each triangle or polygon asks the broad phase for possible candidates.
5. Existing exact predicates run only on those candidates.
6. Existing keep, discard, or subdivision logic emits geometry in the original
   traversal order.
7. The prepared context becomes unreachable when the stage finishes.

## Error and Degenerate Geometry Handling

- Empty and malformed collections retain current early-return behavior.
- Each call site retains its current point coercion and loop-eligibility rules;
  the shared prepared class does not silently impose a new normalization rule.
- Zero-length segments remain valid predicate inputs and use the current
  epsilon behavior.
- Degenerate AABBs are queried inclusively rather than dropped.
- Very small polygon sets use exact linear scans.
- If an index is unavailable, the caller falls back to all prepared candidates;
  correctness takes precedence over acceleration.
- No caught exception may silently discard a triangle or cutout.

## Testing Strategy

All fixtures are generated, generic, and source-obfuscated. No supplied native
files, trace payloads, board names, library strings, or project identifiers are
committed.

### Test-first unit coverage

- AABB index tests compare indexed query results with brute-force bounds tests
  for seeded random, degenerate, edge-touching, very long, and clustered boxes.
- Prepared polygon tests compare indexed predicates with small independent
  linear references for convex, concave, mirrored, collinear, holed, and
  boundary-epsilon cases.
- Copper clipper tests assert identical position arrays and order for full,
  partial, hole, boundary-crossing, overlapping-fill, and ordered-fill cases.
- Drill filter tests cover nested, duplicate equal-area, overlapping but not
  containing, authored-hole, and high-vertex polygons.
- Cutout filter tests cover circular and polygonal cutouts, terminal overlap,
  recursive subdivision, fully covered triangles, and indexed candidate reuse.
- Small-geometry tests protect against regressions caused by index setup cost.

### Differential verification

Before replacing each hot path, capture the observable output of the current
implementation for generated deterministic geometry. After integration, compare
position buffers, polygon source identities, ordering, and circle metadata.

Candidate-completeness tests are mandatory: every candidate found by a
brute-force bounds scan must also be returned by the index. Extra candidates are
allowed.

### Performance benchmarks

Add a repo-owned benchmark script separate from correctness tests. It generates
deterministic trace-shaped geometry and reports warm median timings for:

- hundreds of triangles against a loop with roughly ten thousand vertices;
- hundreds of nested/overlapping cutouts with a high-vertex container;
- recursive cutout filtering with many complex cutouts;
- the same operations with small ordinary polygons.

Run the same script against the baseline and optimized commits on the same
machine. Minimum phase gates are:

- at least 10x lower median time for the large copper boundary workload;
- at least 5x lower median time for the large drill containment workload;
- at least 5x lower median time for the complex cutout-filter workload;
- no material small-input regression, defined as more than 10% or 1 ms,
  whichever is larger.

These are minimum gates, not stop targets. Optimization continues while the
profiler shows a general exact hot path with a favorable risk/reward ratio.

## Verification and Completion

The subproject is complete only when:

1. `pcb-scene3d-viewer` repo-owned tests pass.
2. Its formatting check passes.
3. Differential and candidate-completeness tests prove the exactness contract.
4. Baseline-versus-optimized benchmarks meet the minimum gates.
5. The patched local viewer source is exercised through ECAD Forge and the
   relevant ECAD Forge tests pass.
6. A browser sanity run shows no geometry or selection regression on repo-owned
   fake samples.
7. A new performance capture or equivalent instrumentation confirms that the
   original polygon scans are no longer the dominant main-thread work.

If the new trace moves the bottleneck to OCCT/WASM, the next spec covers exact
STEP import optimization. If scene rebuilds or draw calls dominate instead, the
scene lifecycle/render-throughput spec comes next. The next phase is selected
from evidence rather than executed automatically in a fixed order.
