# PCB Interaction Candidate Filter Design

## Problem

The 2D PCB controller currently forwards every visible hit-test candidate into
the same hover and click pipeline. Copper zones or ground planes can cover most
of a board, so moving the pointer anywhere inside one previews its net,
highlights a large portion of the PCB, and renders its information. Silkscreen
primitives can also carry a component key, which makes them appear selectable
even though the visible object is documentation rather than the component
itself.

The screenshots show the resulting cyan whole-board highlight. The problem is
not the highlight color or opacity; it is that non-interactive object classes
are allowed into candidate prioritization.

## Goals

- Keep components, copper tracks or traces, pads, and vias interactive.
- Make copper pours, zones, ground planes, and silkscreen non-interactive.
- Apply the same policy to mouse hover, mouse click, and touch selection.
- Prevent rejected candidates from driving net highlighting, the pointer
  cursor, hover focus, sidebar previews, or interaction information.
- Treat a click containing only rejected candidates as empty board space so it
  clears an existing component or net selection.
- Preserve the source order and priority of retained candidates.
- Keep the behavior source-neutral and independent of board size, net name,
  file name, project name, or fixture-specific geometry.

## Non-goals

- Changing PCB rendering, visibility controls, measurements, or area
  selection.
- Making decisions from an object's visual size.
- Removing copper pours or silkscreen from the document model.
- Changing toolkit hit-test APIs for consumers outside ECAD Forge.
- Publishing, pushing, tagging, or deploying a release.

## Approaches Considered

### 1. Filter candidates once at the ECAD Forge controller boundary

This is the selected approach. A focused policy module will normalize the
format-specific candidate schema and retain only component, track or trace,
pad, and via semantics. `PcbViewController` will apply the policy immediately
after `EcadRendererService.hitTestPcb()` and before either click or hover
candidate selection.

This keeps click, hover, and touch consistent without changing renderer or
measurement behavior.

### 2. Change each source toolkit's interaction index

This would duplicate the policy across Altium, KiCad, Gerber, and CircuitJSON
and would alter hit testing for every toolkit consumer. It is too broad for an
ECAD Forge interaction decision.

### 3. Suppress only highlighting and information rendering

This would hide the visible symptom while leaving pours and silkscreen
clickable and able to affect candidate priority. It does not meet the accepted
behavior.

## Architecture and Data Flow

Add `PcbInteractionCandidatePolicy` under `src/ui/`. Its public
`filter(candidates)` method returns a new ordered list containing only
selectable candidates.

For native Altium, KiCad, and canonical CircuitJSON candidates, the policy
uses normalized `kind`, `type`, or `role` values. The accepted semantic values
are:

- `component`;
- `track` or `trace`;
- `pad`;
- `via`.

Trace-shaped candidates must additionally belong to a copper layer.
Format-owned indexes may use `track` for overlay, mechanical, mask, paste, or
other documentation lines, so the primitive type alone is not sufficient.
Known non-copper layer metadata such as `Top Overlay`, `Mechanical 13`, or
`F.SilkS` rejects the candidate even when it carries stale component or net
metadata.

The policy evaluates the object kind before component or net metadata. This is
required because component-owned silkscreen may legitimately contain a
`componentKey`, but that metadata must not make the documentation primitive
interactive.

Gerber candidates do not contain component-level identities. The policy maps
unambiguous fabrication primitives as follows:

- copper `line` and `arc` primitives behave as traces;
- copper `flash` primitives behave as pads;
- `drill` and `slot` primitives behave as vias;
- `region` primitives are treated as pours and rejected;
- silkscreen, documentation, mask, paste, and outline roles are rejected.

`PcbViewController.#resolveBoardHit()` applies the policy to the service result.
All existing downstream behavior then consumes the same filtered list:

1. Hover computes its component and net candidates from retained objects.
2. Net highlighting and sidebar preview receive only retained objects.
3. Click and touch selection receive only retained objects.
4. A hit containing no retained objects produces an empty candidate update and
   clears existing component and net selection through the existing paths.

The raw toolkit hit-test result remains unchanged for measurements and any
other consumers.

Net hover and selection highlighting independently indexes only trace or arc,
pad, and via SVG primitives. This prevents stale `data-net` metadata on
non-copper artwork or plane regions from coloring excluded geometry when a
legitimate copper object on the same net is hovered.

## Testing

Add focused policy tests using source-neutral candidate records. They must
prove:

- component, track, trace, pad, and via candidates remain ordered and
  selectable;
- zones, regions, ground planes, text, and silkscreen are rejected;
- component-owned silkscreen is rejected despite its `componentKey`;
- net-backed pours are rejected despite their `netName`;
- track-shaped overlay, mechanical, and silkscreen artwork is rejected from
  layer metadata while copper-layer tracks remain selectable;
- Gerber copper lines, arcs, flashes, drills, and slots map to accepted
  semantics while Gerber regions and non-copper artwork are rejected;
- invalid input returns an empty list without throwing.

Add controller regressions that observe emitted interaction changes:

- hover sends only retained candidates and chooses its preview from them;
- clicking a location whose hit list contains only a pour and silkscreen emits
  an empty candidate list and clears existing component and net selection;
- stale net metadata highlights only trace, arc, pad, and via SVG primitives,
  never planes or non-copper artwork;
- the existing component, trace, pad, and via selection tests remain green.

Tests and fixtures must not identify any provided board or screenshot source.

## Versioning and Verification

The original implementation incremented ECAD Forge from `1.13.12` to
`1.13.13`. The layer-semantics follow-up increments it to `1.13.14`. After the
red-green cycle:

1. Run the focused policy and controller tests.
2. Run `npm test`.
3. Run `npm run sync:structured-data` and include generated HTML changes.
4. Run `npm run check:structured-data`.
5. Run `npm run build:static`.
6. Run `git diff --check`.

Publishing, pushing, tagging, GitHub releases, and deployment remain outside
scope.
