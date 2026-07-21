# ECAD Forge 1.13.3

Version 1.13.3 restores source-native Gerber fidelity in the interactive 3D
viewer.

## Gerber 3D fidelity

- Canonical Gerber documents with a retained native extension now use the
  existing Gerber 3D scene builder before the generic CircuitJSON fallback.
- Flashed surface pads, plated via barrels, routed tracks, filled copper,
  solder-mask openings, and top and bottom silkscreen retain their native scene
  semantics.
- Mask-covered copper keeps the solder-mask tint while explicitly opened pads
  remain exposed copper.
- Canonical Gerber documents without retained native data continue to use the
  generic CircuitJSON scene path.

## Ownership boundary

- ECAD Forge changes only its format-routing decision.
- `gerber-toolkit` remains responsible for Gerber parsing and scene
  construction.
- `pcb-scene3d-viewer` remains responsible for shared copper, board,
  silkscreen, and via materials; no app-side geometry reconstruction or viewer
  workaround was added.

## Validation

- Source-neutral regressions cover synchronous and asynchronous canonical
  Gerber scenes with two copper sides, flashed copper, a plated drill, a copper
  region, mask openings, and both silkscreen sides.
- The complete app test suite, structured-data check, and static deployment
  build pass for version 1.13.3.
- Browser verification covers top, bottom, and isometric views, copper-detail
  toggling, and comparison with the current Altium and KiCad material
  hierarchy.
