# Altium Schematic Normalized Model

## Purpose

This document defines the normalized schematic model emitted by `AltiumParser`
from `altium-toolkit` for `.SchDoc` files.

The model is intentionally viewer-oriented, but it now preserves more authored structure so future features can build on it without reopening parser fundamentals.

## Top-Level Shape

```js
{
    kind: 'schematic',
    fileType: 'SchDoc',
    fileName,
    summary,
    diagnostics,
    schematic,
    bom
}
```

## `summary`

Current fields include:

- `title`
- `componentCount`
- `lineCount`
- `textCount`
- `bomRowCount`

## `diagnostics`

Diagnostics are additive and user-facing. They may report:

- printable record recovery counts
- fallback sheet sizing
- embedded image recovery failures
- net naming conflicts

## `schematic`

### Document and drawing primitives

- `sheet`
- `lines`
- `polygons`
- `rectangles`
- `regions`
- `ellipses`
- `arcs`
- `directives`
- `texts`

### Components and connectivity markers

- `components`
- `pins`
- `ports`
- `crosses`
- `junctions`
- `busEntries`

### Hierarchy and image data

- `sheetSymbols`
- `sheetEntries`
- `images`

### Connectivity model

- `nets`

## Authored Versus Synthesized Data

The model contains both authored and synthesized data. They must be treated differently.

### Authored data

Examples:

- `sheetSymbols`
- `sheetEntries`
- `junctions`
- `busEntries`
- `images`
- visible `texts`
- recovered `lines`

### Synthesized viewer aids

Examples:

- synthetic component texts
- synthesized junction dots derived at render time
- title-block reconstruction from footer hints and hidden metadata

Future features should prefer authored data where it exists and fall back to synthesized data only where the native record does not preserve the same intent directly.

## Collection Details

### `sheetSymbols`

```text
{
    x,
    y,
    width,
    height,
    color,
    fill,
    isSolid,
    transparent,
    ownerIndex,
    uniqueId,
    renderOrder
}
```

Coordinates use authored schematic space. `y` is the authored top edge of the symbol.

### `sheetEntries`

```text
{
    ownerIndex,
    name,
    side,
    direction,
    style,
    x,
    y,
    color,
    fill,
    textColor,
    harnessType,
    renderOrder
}
```

- `x`, `y` represent the connection point on the parent sheet symbol perimeter.
- `side` is one of `left`, `right`, `top`, `bottom`.
- `direction` is one of `unspecified`, `output`, `input`, `bidirectional`.

### `junctions`

```text
{
    x,
    y,
    color,
    renderOrder
}
```

These are authored `RECORD=29` junctions only.

### `busEntries`

```text
{
    x1,
    y1,
    x2,
    y2,
    color,
    width,
    renderOrder
}
```

### `images`

```text
{
    x,
    y,
    cornerX,
    cornerY,
    fileName,
    embedded,
    keepAspect,
    mimeType,
    dataBase64,
    renderOrder,
    diagnosticState
}
```

`diagnosticState` currently uses these values:

- `embedded`
- `missing-embedded-payload`
- `external`

### `nets`

```text
{
    name,
    segments,
    labels,
    powerPorts,
    pins,
    ports,
    junctions,
    busEntries,
    sheetEntries
}
```

`segments` is currently the grouped wire-segment list for one single-sheet net.

### Net Geometry Diagnostics

The app can derive read-only schematic net geometry diagnostics from the
normalized `nets` collection without mutating the source document model.

Diagnostics may report:

- nets with no authored segment geometry but enough coordinate-bearing anchors
  to sketch a fallback connection overlay
- segment rows whose alternate coordinate forms disagree
- segment rows with incomplete or non-finite coordinates
- suspicious authored path shapes such as zero-length parts, tiny parts,
  immediate backtracks, or excessive turns
- disconnected islands within one net's authored segment geometry
- coordinate-bearing anchors that are not connected to any authored segment
- pin-like anchors placed outside the sheet, inside a symbol body, or away from
  the expected symbol edge
- colinear overlapping wire segments that belong to different nets
- multi-part trace segments that can shift locally to clear a cross-net overlap
- net label bounds that collide with unrelated net traces, other net labels,
  or schematic body bounds
- fallback connection segments that cross schematic body obstacles
- trace paths that can be simplified, balanced, or turn-minimized without
  changing endpoints or crossing labels and body obstacles
- clear trace-label detour, merged-label trace detour, whole-island lane
  shift, sampled label relocation, trace-anchored label, sampled constrained
  label orientation, power-label corner, and routing guideline opportunities
- label relocation chains where accepted moves resolve later label collisions
  before additional candidates are evaluated
- constrained label orientation connector paths that report whether the label
  bounds or the connector path hit a label, trace, or schematic body
- local snip-and-reconnect trace-label detours when only the colliding trace
  span needs to move around a label
- obstacle-aware lane-shift offsets and alternate congested L-turn rectangle
  reroutes where overlapping or blocked legs make the authored path hard to
  inspect
- L-turn reroute telemetry with the evaluated turn, blocker intersections, and
  rectangle candidates that led to an accepted or rejected path
- port-only label relocations with candidate statuses for label, chip, and
  trace blockers
- long direct fallback or supplemental connections where a label or port-style
  connection would be easier to read
- anchor-pair supplemental connection decisions with distance, section,
  centerline, and obstacle-risk rejection reasons
- direct fallback or supplemental connections that cross logical schematic
  section boundaries
- symbol body and pin-edge fit candidates when pin anchors and component
  bounds disagree

Diagnostic results include staged debug metadata, focused issue metadata for
affected nets, anchors, labels, segments, obstacles, merged label obstacle
groups, spatial index statistics, non-mutating candidate label bounds,
non-mutating trace-anchored label bounds, rejected trace-anchored label
candidate telemetry, constrained label-orientation candidates with lateral
search and connector-collision metadata, power-label corner candidates,
symbol-fit candidates, per-advisor candidate budgets with final acceptance
status metadata,
non-mutating jog suggestion paths for cross-net overlaps, trace-label detour
candidates, merged-label trace-detour candidates, whole-island lane-shift
candidates, segment-level overlap shift candidates, sampled and port-only
label relocation candidates, congested L-turn reroute candidates with accepted
and rejected alternate paths plus blocker-intersection telemetry,
long-distance connection candidates,
section-boundary connection candidates, anchor-pair supplemental connection
decisions, snip-and-reconnect trace-label detour candidates, candidate decision
rows with generated, rejected, selected, score, and collision-source metadata,
symbol-fit decision telemetry, stage health rows with compact snapshot exports,
collision-aware path cleanup candidates, routing guideline overlays, and a
compact issue repro export for regression tests or renderer debugging.

Fallback connection, label-candidate, label-relocation, jog-candidate,
lane-shift, segment-overlap-shift, congested L-turn reroute, trace-detour,
snip-and-reconnect detour, long-distance connection, section-boundary
connection, path-cleanup, label-orientation, power-label, symbol-fit, and
guideline overlays are visual debug aids only. They must not replace authored
`segments`, parser connectivity, or renderer-owned source geometry.

## Stability Notes

- Additive fields may be introduced as more Altium records are normalized.
- Existing field names should remain stable because renderer and future feature code will depend on them.
- If one field must change semantics, update this document and the parser specification in the same change set.
