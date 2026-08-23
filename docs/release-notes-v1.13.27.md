# ECAD Forge 1.13.27

Version 1.13.27 updates the Altium 3D scene pipeline so bottom-side embedded
STEP models retain their authored orientation and late-resolved package models
seat on the PCB surface.

## Altium 3D placement

- Bottom-side STEP models with geometry predominantly below their authored
  origin preserve the source half-turn instead of rendering upside down.
- Signed STEP bounds are derived from embedded payload coordinates and declared
  length units, without model- or component-specific matching.
- Package ownership recovered after initial scene construction now receives the
  same model-bounds seating behavior as an owner resolved in the first pass.
- Finite zero authored standoff clears only an unchanged positive source
  offset; real authored standoffs and downstream placement adjustments remain
  intact.
- Direct scene construction and asynchronous scene preparation use the same
  convergence path.

## Dependency

- `altium-toolkit` updates from 1.4.7 to 1.4.8.
- The remaining ECAD toolkit dependencies were checked against the npm registry
  and remain at their latest versions.

## Verification

- Toolkit regressions cover signed-source orientation, late-owner seating,
  authored standoffs, unresolved bodies, and adjusted offsets.
- Exact local-board verification checks the affected package seating together
  with both corrected bottom connectors.
- Release gates include the complete ECAD Forge test suite, structured-data
  validation, static build, deployment workflow, and exact-route browser check.
