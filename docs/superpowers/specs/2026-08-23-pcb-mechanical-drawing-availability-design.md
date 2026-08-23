# PCB Mechanical Drawing Availability Design

## Problem

The PCB toolbar currently renders the aggregate mechanical-drawings checkbox
whenever the document declares a layer whose metadata looks mechanical or
documentary. ECAD formats commonly declare empty mechanical layer slots, so a
PCB without technical drawing artwork can still show a control that has no
visible effect.

## Approved behavior

- Omit the checkbox when no renderable PCB primitive is assigned to a
  qualifying mechanical or documentation layer.
- Keep the checkbox for boards containing real drawing geometry or text.
- Continue hiding qualifying drawing content by default and fitting the
  viewport to the board when the control is available.
- Derive the result from normalized model structure, never from file names,
  project names, sample labels, or vendor-specific text.

## Architecture

`PcbLayerVisibilityModel` will own one public content-aware resolver. It first
resolves the existing mechanical drawing layer keys, then scans the PCB's
renderable primitive collections and matches each primitive's layer id, legacy
layer id, layer code, layer name, or layer key against those layers. The
supported collections are tracks, arcs, fills, regions, shape-based regions,
polygons, texts, and dimensions.

The aggregate checkbox renderer and the default hidden-layer initializer will
both use the content-aware resolver. This keeps UI availability and initial
visibility state consistent: an empty declared layer neither creates a
checkbox nor creates hidden-layer state.

## Error handling and compatibility

Missing or malformed PCB collections are treated as empty. Primitives without
a resolvable layer do not prove that technical drawing content exists. The
existing metadata-only layer resolver remains available for sidebar and layer
classification behavior.

## Verification

- A synthetic PCB with populated drawing layers continues to render the
  checkbox.
- A synthetic PCB with only empty mechanical layer declarations omits it.
- Default hidden-layer initialization follows the same distinction.
- Existing focused tests, the complete app suite, structured-data validation,
  static build, deployment workflow, and production browser checks must pass.
