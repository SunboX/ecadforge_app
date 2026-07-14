# KiCad Canonical 3D Fidelity Design

## Problem

The canonical KiCad-to-CircuitJSON-to-3D path loses three independent pieces
of authored information:

- plated through-hole pad shapes are reduced to circular pads;
- board-owned filled silkscreen polygons become generic note paths and lose
  their fill intent;
- a downloaded STEP substitute cannot satisfy an authored WRL reference because
  the substitute no longer carries the authored path as an exact alias.

The parser's retained KiCad model still contains the correct geometry, and
project-local model assets already load correctly. The loss occurs while
projecting into CircuitJSON and resolving the canonical scene.

## Design

The fix keeps the canonical CircuitJSON route and restores only the semantics
that were dropped at its boundaries:

1. `kicad-toolkit` will encode oval plated holes with their distinct outer
   width, outer height, rotation, and drill dimensions instead of emitting a
   circular `outer_diameter` record.
2. `kicad-toolkit` will preserve whether projected artwork is filled. When the
   current CircuitJSON schema requires board-owned silkscreen to use
   `pcb_note_path`, the existing `source_layer` metadata remains the lossless
   indication that the path is authored silkscreen.
3. `pcb-scene3d-viewer` will render source-identified silkscreen note paths as
   silkscreen without enabling unrelated PCB notes. Filled paths become one
   polygon fill each; a non-positive authored stroke does not create hundreds
   of unnecessary outline segments.
4. Downloaded replacement model assets will retain their actual format/path
   and carry the original authored model path in an explicit exact-alias list.
   The viewer will index those aliases without introducing basename or
   same-stem guessing.

The privacy-preserving missing-model search default remains unchanged. Enabling
search must resolve standard-library WRL references through preferred STEP
substitutes; leaving it disabled must not trigger any outbound lookup.

## Performance

- Oval pads use native pill geometry rather than sampled polygons.
- Filled silkscreen artwork is emitted as polygon fills, not one mesh per edge.
- Model aliases are indexed once with the existing exact-path maps.
- Repeated placements reuse the same downloaded asset.

## Testing

- A synthetic KiCad board verifies an oval plated pad remains pill-shaped with
  independent width, height, rotation, and circular drill dimensions.
- Synthetic board- and footprint-owned filled silkscreen polygons verify
  canonical projection and scene fills without enabling documentation notes.
- Viewer tests verify filled-path behavior, non-positive stroke suppression,
  and exact alias matching.
- App tests verify a preferred STEP substitute satisfies an authored WRL path,
  repeated components share the asset, and unrelated same-basename paths do not
  match.
- Full library and app test suites run before local browser verification.

## Acceptance Criteria

- Oval through-hole copper pads render with their authored aspect ratio and
  rotation.
- Board-owned filled front and back silkscreen polygons render as filled ink.
- Fabrication, courtyard, and ordinary note artwork remains hidden by default.
- Project-local model files continue to resolve exactly.
- Enabling missing-model search resolves format substitutes by authored path
  alias without weakening collision safety.
- The exact local test URL renders the expected pad and silkscreen geometry.
- The coordinated toolkit, viewer, and app versions are released together only
  after their registry artifacts and the production deployment pass verification.
