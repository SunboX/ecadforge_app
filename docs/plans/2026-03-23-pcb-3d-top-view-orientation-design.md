# PCB 3D Top View Orientation Design

## Problem

The `Bottom` preset now matches the reference viewer, but the `Top` preset appears vertically inverted relative to the same PCB in the reference tool. The board stays portrait, yet top-edge features show up on the bottom edge of the 3D view.

## Root Cause

The PCB model is already normalized into viewer-space coordinates before the 3D scene is built.

- `PcbOutlineRecovery.flipGeometryVertically()` mirrors PCB geometry across board `Y` so 2D rendering matches the viewer convention.
- `PcbModelParser.#normalizeComponentBodies()` applies the same vertical flip to embedded 3D body placements.
- `PcbScene3dBuilder` and `PcbScene3dRuntime` then reuse those already-flipped coordinates directly in world space.

That means the 3D scene is not in raw board coordinates. The current `Top` preset still renders it with an identity scene scale, so the pre-flipped `Y` axis appears upside-down. The `Bottom` preset currently looks correct because its runtime `X` mirror compensates for the underside orientation independently.

## Goals

- Make the `Top` preset align with the reference viewer orientation.
- Keep the `Bottom` preset behavior that was just approved.
- Keep `Isometric` unchanged.
- Avoid reworking parser, builder, or component-placement math.

## Non-Goals

- Reversing the parser-side PCB coordinate normalization.
- Changing camera pose math for `Top` or `Bottom`.
- Rewriting mount-rig, copper, silkscreen, or external-model placement.

## Recommended Approach

Keep the fix isolated to the runtime view-orientation wrapper.

- Apply a preset-specific `Y = -1` scale for `Top`.
- Keep the existing `X = -1` scale for `Bottom`.
- Leave `Isometric` at identity scale.
- Add regression coverage that proves `Top` now flips vertically while `Bottom` continues to mirror horizontally.

## Alternatives Considered

### 1. Change the top camera preset

Rejected because the camera basis itself is already a normal top-down portrait view. The mismatch comes from the scene coordinate convention, not from camera pose.

### 2. Undo the parser-side vertical flip for 3D only

Rejected because that would fork the PCB coordinate system between 2D and 3D and would force broad changes across builder, detail factories, and external placements.

### 3. Add a top-only runtime `Y` mirror

Accepted because it corrects the final rendered orientation at the narrowest possible layer and composes cleanly with the existing bottom-only `X` mirror.

## Testing Strategy

- Extend the runtime-orientation test to assert that `Top` applies `{ x: 1, y: -1, z: 1 }`.
- Project a representative top-view anchor point and assert it lands in the expected screen quadrant only after that `Y` flip.
- Keep the existing `Bottom` regression to ensure the approved underside orientation does not regress.
- Run focused 3D tests, then run `npm test`.
