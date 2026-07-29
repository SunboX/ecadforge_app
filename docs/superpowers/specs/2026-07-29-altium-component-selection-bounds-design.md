# Altium Component Selection Bounds Design

## Problem

The 2D PCB selection marker can use rendered footprint geometry or a fixed
component-anchor fallback. Rendered KiCad primitives expose ownership through
`data-footprint-id`, which the current bounds resolver recognizes. Rendered
Altium primitives expose the equivalent ownership through `data-component`,
which the resolver currently ignores.

When parsed model primitives cannot provide usable board-space bounds, an
Altium component therefore receives the fallback marker. The fallback assumes
that the component transform origin is the footprint center and uses a fixed
size. Component anchors are not required to be footprint centers, and
footprints have different dimensions, so the resulting marker can be both
misplaced and incorrectly sized.

## Goals

- Size and place selected Altium component markers from the selected
  component's rendered footprint geometry.
- Preserve the existing rendered-bounds behavior for KiCad footprints.
- Match component ownership exactly so similarly prefixed component keys do
  not contaminate the selected bounds.
- Continue using the existing marker margin and scene-transform behavior.
- Keep the fix source-neutral and independent of file names, project names,
  component patterns, or fixture-specific dimensions.

## Non-goals

- Changing PCB rendering or the SVG metadata produced by source toolkits.
- Changing which PCB objects are interactive.
- Changing selection color, opacity, or marker styling.
- Reconstructing native Altium primitive ownership in the application model.
- Publishing, pushing, tagging, releasing, or deploying the application.

## Selected Approach

Extend `PcbRenderedFootprintBoundsResolver` so its rendered-element scan
recognizes both supported ownership contracts:

- a `data-footprint-id` value beginning with
  `footprint:<selected-component-key>:`; or
- a `data-component` value exactly equal to the selected component key.

The resolver will continue to consider only supported SVG geometry elements
such as lines, rectangles, circles, paths, polygons, and polylines. It will
union the owned geometry, apply the existing viewBox-relative marker margin,
and return the same marker-bounds structure used by
`PcbComponentSelectionMarkerRenderer`.

This belongs in the application resolver rather than a sibling toolkit because
the resolver already normalizes renderer-owned SVG geometry across source
formats. Altium already provides unambiguous component ownership, so changing
the toolkit's output contract would add redundant metadata without improving
the source data.

## Data Flow

1. `PcbViewRenderer` obtains renderer-owned PCB SVG markup.
2. `PcbComponentSelectionMarkerRenderer` first attempts parsed model primitive
   bounds.
3. When those bounds are unavailable or outside the SVG viewBox, it asks
   `PcbRenderedFootprintBoundsResolver` for rendered bounds.
4. The resolver finds supported SVG elements owned by the selected component
   through either ownership contract.
5. The renderer maps the returned bounds through the existing `.pcb-scene`
   transform and appends a board-space selection marker.
6. Only when no owned rendered geometry exists does the existing fixed
   component-anchor fallback remain active.

## Testing

Add an observable `PcbViewRenderer` regression using a source-neutral synthetic
Altium document and renderer markup. The document provides a component anchor
but no usable parsed primitive bounds. The markup provides:

- a component group whose anchor is intentionally not the rendered footprint
  center;
- multiple rendered geometry elements with an exact `data-component` owner;
- an element owned by a similarly prefixed component key outside the selected
  footprint.

Before the fix, the test must fail because the fixed transform-local marker is
rendered. After the fix, it must prove that:

- the marker encloses the selected component's rendered geometry with the
  established margin;
- the marker has no fallback component transform; and
- the similarly prefixed owner does not affect its bounds.

Existing KiCad rendered-footprint, scene-transform, parsed-primitive, and
bottom-side marker tests must remain green.

## Versioning and Verification

Increment ECAD Forge from `1.13.14` to `1.13.15`. After the red-green cycle:

1. Run the focused PCB renderer test.
2. Run `npm test`.
3. Run `npm run sync:structured-data`.
4. Run `npm run check:structured-data`.
5. Run `npm run build:static`.
6. Run `git diff --check`.
7. Reopen the exact local PCB route and verify that the selected large
   footprint marker encloses the rendered component geometry.

Publishing, pushing, tagging, GitHub releases, and deployment remain outside
scope.
