# PCB 3D Bottom View Orientation Design

## Problem

The `Bottom` preset in the interactive PCB `3D` view does not match the expected backside orientation. In the current implementation, underside connectors such as `PORT17` remain on the same horizontal screen side as the top view, while the reference viewer mirrors the board horizontally when switching to the bottom view without rotating the board into landscape.

## Root Cause

The issue is not just in the camera preset. The scene geometry is authored so top-side and bottom-side placements share the same world-space `X/Y` positions, and underside detail is flipped onto the board's lower face by local side transforms.

- Bottom-side component placement already uses underside-specific mount transforms.
- Bottom copper and silkscreen detail already apply side-aware mirroring before the underside flip group rotates them below the board.
- A pure camera change can only choose among in-plane screen bases. It cannot both keep the board portrait and move `J17` from the `top-right` edge to the `top-left` edge with the current world coordinates.

Using `up = { x: 0, y: -1, z: 0 }` keeps the board portrait but leaves `J17` on the `top-right` edge. Using `up = { x: 1, y: 0, z: 0 }` moves the connector to the left side, but rotates the whole board `90` degrees. The missing behavior is a bottom-only horizontal mirror of the rendered scene while keeping the portrait camera basis.

## Goals

- Make the `Bottom` preset match the reference viewer orientation closely enough that bottom-side connectors and labels appear on the expected side.
- Keep the scene geometry, component placement, and external-model transforms unchanged.
- Keep the board in the same portrait orientation as the `Top` preset.
- Preserve the current `Top` and `Isometric` presets.

## Non-Goals

- Reworking board-coordinate normalization.
- Changing component or external-model placement math.
- Reworking underside geometry factories just to compensate for view orientation.

## Recommended Approach

Split the fix between the camera and the runtime scene wrapper.

- Restore the bottom camera preset in `PcbScene3dCameraRig` to the portrait underside basis: camera below the board with `up = { x: 0, y: -1, z: 0 }`.
- Add a preset-dependent wrapper transform in `PcbScene3dRuntime` that mirrors scene `X` only for the `Bottom` preset.
- Add regression coverage that proves the combined camera basis plus runtime mirror keeps the board portrait while moving a representative underside anchor into the `top-left` screen quadrant.

## Alternatives Considered

### 1. Camera-only preset changes

Rejected because all viable camera-only bases fail one of the two user-visible requirements: either `J17` stays on the right edge or the board rotates `90` degrees.

### 2. Rewrite underside geometry placement or mount rigs

Rejected because the evidence points to a view-orientation problem rather than a geometry-placement problem.

### 3. Mirror the whole scene through a runtime wrapper

Accepted because it changes only the rendered bottom view, leaves authored placement math intact, and can be isolated behind one preset-dependent scale transform.

## Testing Strategy

- Keep a camera-rig regression test that locks the portrait `Bottom` basis.
- Add a runtime-orientation regression that combines the bottom camera basis with the runtime mirror and asserts the representative underside anchor ends up in the `top-left` screen quadrant.
- Run focused 3D camera tests, then run the repo test script and report unrelated pre-existing failures separately if they persist.
