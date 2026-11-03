# ECAD Forge 1.13.54

Large Altium boards can render their PCB view without exhausting the
JavaScript call stack while measuring SVG bounds. The correction also covers
dense regions and holes, interaction polygon bounds, copper-layer selection,
and native overlay knockout bounds. Every input primitive is retained.

The 15 supplied analytics recordings share this one failure mechanism. The
fix uses general coordinate aggregation; no document-specific exceptions or
analytics suppression were added.

## Dependencies and scope

- `altium-toolkit`: `^1.4.19` → `^1.4.20`, locked to registry version 1.4.20.
- CircuitJSON 1.4.5, Gerber 0.4.4, KiCad 1.3.7 and PCB Scene3D 1.3.6 remain
  unchanged and match the latest registry versions checked for this release.
- App metadata and generated structured data advance from 1.13.53 to 1.13.54.
- Pending account, login, registration, payment and subscription work remains
  excluded. No private-plugin/PDF feature branch was merged.

## Verification

- Synthetic regression coverage for 75,000-track PCB rendering, exact bounds,
  bottom-side output and normal app caching.
- Toolkit regressions for 150,000-point/primitive collections, with no supplied
  PCB or identifying analytics records stored in the repository.
- App `npm test`: 1,072 passed, zero failures, one skipped.
- Toolkit `npm test`: 965 passed, zero failures, one skipped.
- Toolkit formatting, strict packed-feature contracts, performance checks and
  publish dry run pass.
- App structured-data synchronization/check and static deployment build pass.

See the [investigation](javascript-error-investigation-2026-11-03.md) for the
failure mechanism and the original-device verification boundary.
