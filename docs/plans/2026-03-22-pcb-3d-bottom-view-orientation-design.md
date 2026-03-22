# PCB 3D Bottom View Orientation Design

## Problem

The `Bottom` camera preset in the interactive PCB `3D` view does not match the expected backside orientation. In the current implementation, underside connectors such as `PORT17` remain on the same horizontal screen side as the top view, while the reference viewer mirrors the board horizontally when switching to the bottom view.

## Root Cause

The issue is in the camera preset, not the board-placement pipeline.

- Bottom-side component placement already uses underside-specific mount transforms.
- Bottom copper and silkscreen detail already apply side-aware mirroring before the underside flip group rotates them below the board.
- The `Bottom` preset must keep the same underside orientation the reference viewer expects, with the camera below the board and `up = { x: 0, y: -1, z: 0 }`.

The earlier experiment that changed `up` to positive Y fixed one horizontal comparison but made the full board appear upside down. The correct behavior for this app is the document-style underside orientation, which keeps the current bottom preset's in-plane rotation.

## Goals

- Make the `Bottom` preset match the reference viewer orientation closely enough that bottom-side connectors and labels appear on the expected side.
- Keep the scene geometry, component placement, and external-model transforms unchanged.
- Preserve the current `Top` and `Isometric` presets.

## Non-Goals

- Reworking board-coordinate normalization.
- Changing component or external-model placement math.
- Introducing preset-specific scene transforms.

## Recommended Approach

Keep the fix isolated to the `Bottom` camera preset in `PcbScene3dCameraRig`.

- Keep the camera position below the board along negative Z.
- Keep the bottom preset `up` vector at negative Y.
- Add regression coverage so the underside preset preserves the approved in-plane orientation instead of drifting during later camera cleanup.

## Alternatives Considered

### 1. Mirror or rotate the whole scene for the bottom preset

Rejected because it is more invasive and risks regressions in selection, panning, and external-model alignment.

### 2. Change underside geometry placement or mount rigs

Rejected because the evidence points to a view-orientation problem rather than a geometry-placement problem.

## Testing Strategy

- Add a camera-rig regression test that derives the screen-right direction from the returned preset pose.
- Assert that the top preset keeps positive screen-right on board X while the bottom preset flips that horizontal direction.
- Run focused 3D camera tests, then run the repo test script and report unrelated pre-existing failures separately if they persist.
