# ECAD Forge 1.10.4

Version 1.10.4 restores the source rendering fidelity lost during the common
toolkit API convergence while keeping CircuitJSON as the shared internal model
and fast 3D interchange path.

- Updates `circuitjson-toolkit` to 1.1.2, `kicad-toolkit` to 1.1.4, and
  `pcb-scene3d-viewer` to 1.2.2.
- Altium schematics again use the retained native renderer, restoring the ECAD
  Forge palette, complete wiring, source text placement, symbol bodies, and
  sheet styling.
- KiCad schematics again use the retained native renderer, restoring the full
  ECAD Forge palette instead of browser-default black fills.
- KiCad PCB SVG, hit testing, and interaction layers use the matching native
  model when present. Canonical CircuitJSON remains the fallback for documents
  without a retained native extension.
- KiCad 3D stays on the smaller, faster CircuitJSON path. The viewer now keeps
  the source identity and correctly treats omitted trace, pour, and via
  mask-opening flags as solder-mask-covered copper; explicit openings remain
  exposed.
- BOM, query, diagnostics, and other shared services continue to operate on
  CircuitJSON. No app-side renderer-model adapter or duplicated source parser
  was added.

The repaired KiCad and Altium demos were checked in a real browser against the
pre-convergence reference renderings. Automated coverage includes native-first
routing, canonical fallbacks, BOM behavior, source identity, mask coverage,
material selection, and all existing app behavior.
