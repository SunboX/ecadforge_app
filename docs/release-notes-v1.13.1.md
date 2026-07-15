# ECAD Forge 1.13.1

Version 1.13.1 updates Gerber Toolkit to 0.4.2 and restores correct bare-board
3D topology for fabrication archives whose mechanical artwork contains
pen-separated frame strokes.

## Gerber profile topology

- Ambiguous dark inner mechanical geometry is projected as a cutout only when
  it is authored as a region or a source-order-continuous closed path.
- X2 files that explicitly declare `FileFunction=Profile` retain unordered
  shared-vertex contour recovery, while clear-polarity geometry remains
  authoritative.
- Outline growth stops as soon as a contour closes, preventing later strokes
  from being swallowed into an already complete loop.
- Native primitives carry stable draw-run identity across moves, polarity and
  region boundaries, including independent step-repeat instances.
- Ineligible artwork is transparent to containment depth, so it cannot create
  a false cutout or suppress a valid nested cutout.
- Circular and curved outline sampling is normalized once and reused by both
  ordered and unordered chaining, avoiding repeated point normalization during
  canonical projection.
- Contour containment uses cached boundary indexes with exact intersection
  tests, keeping large mechanical layers responsive.

These rules are format-structural. They do not match archive names, project
identifiers, or sample artwork.

## App and viewer boundary

- ECAD Forge installs the registry release `gerber-toolkit@0.4.2` and keeps its
  normal common parser/project API contract.
- The app passes the resulting CircuitJSON document directly to the 3D viewer.
  No app-side outline rewrite, compatibility adapter, or rendering workaround
  was added.
- Existing Gerber regions, explicit clear geometry, authoritative profile
  files, disjoint substrates, drilled holes, and plated slots retain their
  established behavior.

## Validation

- The Gerber Toolkit suite covers pen-separated mechanical frames,
  source-continuous inner loops, transparent containment nodes, step-repeat
  identity, concave intersections, already-closed contours, and
  quantized-degenerate full-circle arcs followed by valid cutouts.
- ECAD Forge's toolkit convergence test pins the published dependency range and
  verifies the shared public API layout against the installed registry package.
- The complete app suite passes all 915 tests with the published registry
  package installed.
- Structured data is synchronized and verified, and the static deployment
  build completes for version 1.13.1.
