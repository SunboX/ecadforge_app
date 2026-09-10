# Large-project rendering performance

Large Altium projects exercise shared parser, worker-validation, scene-building,
and 3D geometry paths. The performance changes in the local sibling libraries
address these paths for all inputs:

- `circuitjson-toolkit` checks array and view brands before attempting binary
  buffer accessors. Short UTF-8 strings are counted without allocating encoded
  byte buffers; byte limits, Unicode handling, and binary ownership stay intact.
  Dependency tracking interns property paths within each computation, retaining
  symbol identity, alias paths, and invalidation when input values change.
  Privately created native parser workers can prove structured-clone provenance
  for received results, avoiding exception-driven buffer probes over ordinary
  records. Custom worker factories retain the generic ownership checks; callers
  cannot opt out of validation with a flag.
- `altium-toolkit` builds pad ownership indexes once per scene operation and
  limits body identity scoring to spatially eligible candidates. Source order,
  surface preferences, fallback ownership, and mutable-input behavior remain
  part of the lookup contract.
  PCB layer summaries read source layer metadata without constructing selectable
  geometry. Hit-test visibility filters are normalized once per query.
- `pcb-scene3d-viewer` clips covered copper at occlusion boundaries instead of
  repeatedly subdividing triangles. It also indexes repeated-package ownership
  and avoids temporary arrays while filtering visible relief surfaces.
  Silkscreen batches share detached cutout preparation and spatial indexes for
  each side of one build, while retaining their existing yields and cancellation.

The app keeps session-asset snapshots outside render-tracking proxies. These
assets are replaced through app state and passed to asynchronous model loading
and the scene-preparation worker. Wrapping them in tracking proxies makes
`postMessage` fail structured cloning and triggers synchronous scene preparation.
The render graph observes replacement of the complete asset snapshot instead.

Generated board and copper geometry use a separate module worker. It runs the
same geometry factories and transfers vertex buffers, normals, UVs, material
groups, colors, and object transforms to the runtime. It transfers only newly
generated buffers; the original scene remains available for model placement and
other detail stages. Disposing the runtime stops outstanding geometry work.
Hosts that cannot create the worker retain the existing geometry factories as
a fallback, which may still block the main thread on large boards.

Landing-preview work follows app state. Opening a design cancels queued preview
callbacks and pending fetches. Parsing already in progress completes and caches
its result; delivery waits until the landing page is visible again. Completed
previews are reused, including after returning from a startup project.

Tests use synthetic geometry and ownership records. Real local design files and
browser performance traces are used only for temporary verification, outside
tracked fixtures. Changes in unpublished sibling libraries require local npm
links during development; the application dependency ranges still reference
registry releases until those libraries are published through their release
workflows.

The Altium benchmark verifies the unchanged historical source manifest over
the dependency graph actually used by its parser and schematic baselines. Its
`check:features` release gate preserves historical export signatures and public
asset targets while allowing tested implementation and rendering fixes. The
immutable historical baselines remain provenance evidence. Every current source
file, including new helpers, styles, and workers, is checked against an independent
checkout snapshot before and after the packed contract tests.

When linking the edited libraries locally, link `circuitjson-toolkit` into
`altium-toolkit`, `kicad-toolkit`, and `pcb-scene3d-viewer`, as well as the application. All
consumers must resolve the same shared module instance; separate installations
produce incompatible prepared-context and validation-proof identities in Node.
The browser and static artifact already resolve these imports to one shared URL.

The static artifact includes Earcut's ESM source at the URL emitted by the import
rewriter, so copper triangulation works on static hosting without a development
server dependency fallback.
