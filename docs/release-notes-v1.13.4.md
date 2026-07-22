# ECAD Forge 1.13.4

Version 1.13.4 corrects Gerber via copper and solder-mask rendering in the
interactive 3D viewer.

## Gerber via fidelity

- Ordinary plated via annuli are covered on every board surface that has
  solder-mask artwork, matching covered track presentation.
- A via surface remains exposed only when its center lies inside a larger
  same-side copper pad whose solder-mask image opens that pad.
- Offset and rotated via-in-pad containment is evaluated in pad-local
  coordinates.
- The authored Gerber copper flash determines the via annulus diameter; the
  drill-only barrel fallback remains available when no copper flash exists.
- Tented surfaces receive an annular mask overlay while the plated drill wall
  remains copper-colored. Top and bottom states render independently.

## Package ownership

- `gerber-toolkit` 0.4.3 owns fabrication-derived annulus sizing and
  side-specific mask classification.
- `pcb-scene3d-viewer` 1.3.1 owns the copper-barrel and mask-surface meshes.
- ECAD Forge contains no board-, archive-, filename-, or format-specific
  rendering workaround for this behavior.

## Validation

- Package and app regressions cover ordinary tented vias, one-sided
  via-in-pad openings, rotated offset containment, authored annulus diameter,
  mixed-side rendering, and copper drill walls.
- Release gates include the complete app suite, structured-data consistency,
  static deployment build, and browser verification of the reported Gerber
  archive in top, bottom, and isometric views.
