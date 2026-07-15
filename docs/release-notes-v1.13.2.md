# ECAD Forge 1.13.2

Version 1.13.2 updates KiCad Toolkit to 1.3.1 and restores bottom-side SMD
pads that disappeared after KiCad boards were projected into CircuitJSON.

## KiCad pad projection

- One-sided pads retain the copper face authored by the source layer set,
  including `B.Cu`, `F.Cu`, front/back, and canonical top/bottom names.
- Pad width, height, shape, round-rectangle radius, rotation, and local offset
  come from the active pad-stack face and retain their millimeter units.
- Face offsets rotate with their source pads and are folded into canonical pad
  and port centers.
- Explicit solder-mask coverage and expansion are preserved on canonical SMD
  pads.
- Canonical pad and port ownership resolves to an existing
  `pcb_component_id`, keeping component relationships valid for downstream
  interaction and rendering.

The behavior is structural and applies to any KiCad board. It does not match
project names, component references, footprints, or example files.

## App and viewer boundary

- ECAD Forge installs the published `kicad-toolkit@1.3.1` package and consumes
  its CircuitJSON output directly.
- `pcb-scene3d-viewer` already rendered valid bottom-layer canonical pads
  correctly, so no viewer compatibility shim or app-side pad reconstruction
  was added.
- Top-side SMD pads and through-hole pads keep their established behavior.

## Validation

- KiCad Toolkit's full suite passes all 478 tests and its feature-preservation
  gate validates 9,020 mappings.
- A source-neutral regression board verifies bottom-layer placement, active
  face geometry, a nonzero rotated face offset, round-rectangle radius,
  solder-mask metadata, and valid pad and port ownership.
- ECAD Forge's complete suite passes all 915 tests. Structured data is in sync,
  and the static deployment build completes for version 1.13.2.
