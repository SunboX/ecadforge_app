# Gerber 3D Native Fidelity Routing Design

## Problem

Canonical Gerber documents are currently routed through the generic
CircuitJSON 3D adapter before ECAD Forge checks their declared source format.
That adapter receives standards-level copper images and fabrication artwork,
but it does not retain all source-native Gerber rendering semantics.

The visible result is a substantial fidelity regression: flashed copper pads
are absent, plated holes do not render as vias, routed connections are shown as
flattened filled regions, and top and bottom silkscreen are missing. Copper
fills cannot be visually trusted while they share that flattened path.

The parser already retains the native Gerber document under the negotiated
`gerber.native-model` extension. The existing Gerber scene builder converts
that model into the track, pad, via, filled-copper, solder-mask-opening, and
silkscreen structures expected by `pcb-scene3d-viewer`.

## Goals

- Preserve Gerber pads, vias, routed tracks, filled copper, solder-mask
  coverage, and both silkscreen sides in the 3D scene.
- Match the material hierarchy already used by Altium and KiCad scenes:
  exposed copper uses the copper material, mask-covered copper remains visible
  through the solder-mask tint, and silkscreen remains distinct from copper.
- Keep canonical CircuitJSON documents on the generic CircuitJSON adapter.
- Keep the fix source-neutral and independent of file names, project names,
  labels, or fixture-specific geometry.
- Preserve synchronous and asynchronous scene construction behavior.

## Non-goals

- Inferring solder-mask or silkscreen colors that are not encoded by Gerber
  fabrication files.
- Reconstructing components or external 3D models from fabrication output.
- Changing Gerber parsing, canonical projection, or the shared 3D viewer.
- Claiming exact primitive-count equality between native Gerber, Altium, and
  KiCad source formats; their source models decompose equivalent artwork
  differently.

## Approaches Considered

### 1. Route retained native Gerber data to the existing Gerber scene builder

This is the selected approach. ECAD Forge will resolve the retained native
document through `EcadGerberFabrication.nativeDocument()` and invoke the
format-specific Gerber scene builder before considering the generic
CircuitJSON route.

This is the smallest change and preserves the existing ownership boundary:
the app chooses the source-specific renderer, while `gerber-toolkit` owns
Gerber scene construction.

### 2. Expand the generic CircuitJSON adapter and Gerber canonical projection

This would require coordinated changes across `gerber-toolkit` and
`pcb-scene3d-viewer`. It would also need new canonical identities for
source-native tracks, flashes, mask interactions, vias, and silkscreen artwork
that are currently flattened or represented generically. The scope and
regression risk are disproportionate when the retained native path already
contains the required semantics.

### 3. Merge native details into the generic scene after construction

This would create duplicate geometry and two competing coordinate/material
pipelines. It would be an app-side adapter rather than a clean ownership
decision, so it is rejected.

## Architecture and Data Flow

`EcadScene3dService` remains the only app-level format router.

1. Resolve an Altium native model and use the Altium scene builder when one is
   present.
2. Resolve the document source format.
3. For Gerber, resolve the retained native document with
   `EcadGerberFabrication.nativeDocument()`.
4. Build or prepare the scene with the Gerber scene builder/preparator and
   retain the existing KiCad silkscreen-smoothing adapter.
5. Route true CircuitJSON documents and canonical documents without a usable
   source-specific native model through `PcbScene3dCircuitJsonAdapter`.
6. Keep the existing KiCad and fallback Altium branches unchanged.

Both `build()` and `prepare()` must apply the same ordering and native-document
resolution so worker fallback cannot produce a visually different scene.

If a Gerber document lacks retained native data, ECAD Forge will fall back to
the generic CircuitJSON scene rather than passing an incompatible canonical
envelope into the native builder.

## Testing

Add a source-neutral regression to the existing ECAD scene-service test suite.
The test document will be a synthetic canonical Gerber envelope with an
obfuscated retained native model containing:

- one routed copper track;
- one flashed surface pad;
- one plated via or drilled pad;
- one filled copper region;
- top and bottom solder-mask openings;
- top and bottom silkscreen geometry.

The regression must fail on the current generic route by observing missing
native scene detail. After the fix it must assert observable scene output:

- non-empty track, pad, via, and polygon collections;
- non-empty top and bottom silkscreen collections;
- preserved solder-mask coverage/opening fields;
- `sourceFormat === 'gerber'`;
- parity between `build()` and `prepare()` for the relevant collections.

The test must not include or name the reported archive, its project, or any
provided native source file.

## Visual Acceptance

After automated tests pass, load the reported Gerber archive through its
normal URL and verify:

- top, bottom, and isometric camera presets;
- exposed copper pads are visible;
- routed connections have rounded track geometry and mask-covered tint;
- copper fills do not replace unrelated tracks or pads;
- top and bottom silkscreen are visible on their respective sides;
- plated vias have visible annuli, holes, and barrels;
- copper-detail toggling hides and restores all copper detail consistently;
- no new browser console errors occur.

Compare the material relationships with current Altium and KiCad scenes, while
allowing Gerber to retain its default board colors because fabrication output
does not encode the source editor's display or board-finish color.

## Versioning and Verification

The behavior change requires an ECAD Forge patch-version increment. After the
change:

1. Run the focused regression and `npm test`.
2. Run `npm run sync:structured-data` and include generated HTML changes.
3. Run `npm run check:structured-data`.
4. Run `npm run build:static`.
5. Perform the browser acceptance checks above.

Publishing, pushing, tagging, and deployment are outside this implementation
unless explicitly requested.
