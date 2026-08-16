# KiCad Opposite-Side Pad Context Design

## Problem

ECAD Forge asks the KiCad SVG renderer for opposite-side copper context in
both Top and Bottom PCB views. The renderer applies that option to routed
copper drawings, but its pad filter remains strictly side-specific. On a board
whose footprints are all on the front, Bottom therefore shows mirrored front
copper traces while omitting the connected front SMD pads.

The bundled fake KiCad demo exposes the mismatch clearly: the parsed board has
223 pads, comprising 132 front SMD pads and 91 through-hole pads visible on
both sides. Top renders all 223 pads, while Bottom renders only the 91
through-hole pads.

## Goals

- Make `includeOppositeCopper` apply consistently to routed copper and
  copper-bearing pads.
- Preserve strict active-side pad rendering when `includeOppositeCopper` is
  absent or false.
- Preserve through-hole pads exactly once in either view.
- Keep Bottom mirroring, pad geometry, drills, metadata, ownership, and
  interaction behavior unchanged.
- Implement the renderer correction in `kicad-toolkit`, not as an ECAD Forge
  model rewrite or SVG overlay.
- Add source-neutral fake-board regressions in the library and at the app
  integration boundary.
- Release the library, update ECAD Forge to the released dependency, push both
  repositories, and verify the deployed demo.

## Non-goals

- Rendering opposite-side silkscreen, fabrication, courtyard, mask, or paste
  artwork.
- Changing the meaning of the Top and Bottom controls.
- Special-casing the bundled demo file, a footprint name, a component
  reference, or a known pad count.
- Changing Altium, Gerber, or CircuitJSON rendering.
- Reconstructing pads in ECAD Forge after SVG rendering.

## Approaches Considered

### 1. Extend the KiCad renderer's opposite-copper pad selection

This is the selected approach. `PcbSvgRenderer` will retain an opposite-side
pad only when `includeOppositeCopper` is true and the pad's layer metadata
contains copper. Existing pad rendering then preserves shape, dimensions,
rotation, metadata, drill ordering, and component ownership.

This makes the existing option internally consistent while keeping its false
case unchanged for consumers that require a strict side view.

### 2. Rewrite pad sides in ECAD Forge before rendering

This would make the current demo appear correct, but it would duplicate KiCad
renderer policy in the host app and corrupt the semantic meaning of the parsed
model. It also violates the repository rule that toolkit-owned behavior must
be fixed in the local toolkit.

### 3. Hide opposite-side traces

Removing opposite-side routed copper would make pads and traces equally
absent, but it would discard the intentional full-copper context and would not
restore the requested component-pad visibility.

## Architecture and Data Flow

`kicad-toolkit/src/ui/PcbSvgRenderer.mjs` already selects `visiblePads` before
rendering pad copper and pad drills. The selection will use two branches:

1. retain pads visible on the active side, including through-hole pads whose
   side is `both`;
2. when `includeOppositeCopper` is true, retain pads visible on the opposite
   side only if their `layers` metadata contains a KiCad copper layer.

The second branch is a visibility decision only. It does not change the pad
object or its authored side. The existing bottom scene transform mirrors the
result, and the existing render functions emit the same shape, drill, net,
component, and layer metadata.

ECAD Forge continues to call the renderer with
`includeOppositeCopper: true`. After `kicad-toolkit` is released, ECAD Forge
updates its dependency and version metadata; no app-side rendering workaround
is added.

## Testing

The toolkit regression uses a synthetic two-layer board with:

- one front SMD copper pad;
- one back SMD copper pad;
- one through-hole pad on both sides;
- front and back routed copper traces.

It proves that strict Back rendering contains the back and through-hole pads
but not the front pad. It then proves that Back rendering with
`includeOppositeCopper: true` also contains the front copper pad, without
duplicating the through-hole pad.

The ECAD Forge integration regression supplies a source-neutral native KiCad
document with equivalent pad records. It proves that both app-rendered sides
contain the opposite copper pad because ECAD Forge intentionally requests full
copper context.

After automated tests, the exact local demo route is reopened. Top and Bottom
pad counts must both equal the parsed board's 223 pads, the browser console
must contain no errors, and a Bottom screenshot must show the restored SMD pad
shapes. After deployment, the same production route is verified again.

## Versioning and Release

1. Increment and publish `kicad-toolkit` from `1.3.2` to the next patch
   version, expected to be `1.3.3` after registry verification.
2. Update ECAD Forge from `1.13.15` to the next patch version, expected to be
   `1.13.16`, and depend on the released toolkit version.
3. Run both repositories' full test suites.
4. Run ECAD Forge structured-data synchronization, structured-data checks,
   and the static deployment build.
5. Push both `main` branches and create the corresponding releases or tags
   required by their established workflows.
6. Watch the ECAD Forge deployment workflow to a `success` conclusion before
   reporting deployment complete.
7. Verify the production demo route and rendered Bottom pad count.

