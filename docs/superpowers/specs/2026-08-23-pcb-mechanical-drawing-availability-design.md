# PCB Mechanical Drawing Availability Design

## Problem

The PCB toolbar currently renders the aggregate mechanical-drawings checkbox
whenever the document contains geometry on a layer whose metadata looks
mechanical or documentary. Ordinary boards also use these layers for on-board
assembly and package geometry, so populated layers alone do not prove that a
separate technical-drawing sheet exists.

## Approved behavior

- Omit the checkbox when qualifying mechanical or documentation geometry stays
  within or close to the physical PCB envelope.
- Keep the checkbox only when qualifying drawing geometry materially expands
  the combined viewport beyond the board envelope.
- Continue hiding qualifying drawing content by default and fitting the
  viewport to the board when the control is available.
- Derive the result from normalized model structure, never from file names,
  project names, sample labels, or vendor-specific text.

## Architecture

`PcbLayerVisibilityModel` owns one public technical-drawing resolver. It first
resolves the existing mechanical drawing layer keys, then delegates native
geometry inspection to `PcbTechnicalDrawingContent`. That helper matches each
primitive's layer id, legacy layer id, layer code, layer name, or layer key and
compares the populated artwork envelope with the physical board outline. A
technical sheet exists when the combined width or height exceeds 120% of the
board envelope. The supported collections are tracks, arcs, fills, regions,
shape-based regions, polygons, texts, and dimensions.

The aggregate checkbox renderer and the default hidden-layer initializer will
both use the technical-drawing resolver. This keeps UI availability and
initial visibility state consistent: empty or ordinary on-board drawing layers
neither create a checkbox nor create hidden-layer state.

## Error handling and compatibility

Missing or malformed PCB collections are treated as empty. Primitives without
a resolvable layer do not prove that technical drawing content exists. The
existing metadata-only layer resolver remains available for sidebar and layer
classification behavior.

## Verification

- A synthetic PCB with off-board drawing layers renders the checkbox.
- A synthetic PCB with populated on-board mechanical geometry omits it.
- A synthetic PCB with only empty mechanical layer declarations omits it.
- Default hidden-layer initialization follows the same distinction.
- Existing focused tests, the complete app suite, structured-data validation,
  static build, deployment workflow, and production browser checks must pass.
