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
- net label bounds that collide with unrelated net traces, other net labels,
  or schematic body bounds
- fallback connection segments that cross schematic body obstacles
- trace paths that can be simplified or balanced without changing endpoints
- clear trace-label detour, trace-anchored label, constrained label
  orientation, power-label corner, and routing guideline opportunities
- symbol body and pin-edge fit candidates when pin anchors and component
  bounds disagree

Diagnostic results include staged debug metadata, focused issue metadata for
affected nets, anchors, labels, segments, obstacles, merged label obstacle
groups, spatial index statistics, non-mutating candidate label bounds,
non-mutating trace-anchored label bounds, rejected trace-anchored label
candidate telemetry, constrained label-orientation candidates, power-label
corner candidates, symbol-fit candidates, per-advisor candidate budgets,
non-mutating jog suggestion paths for cross-net overlaps, trace-label detour
candidates, path cleanup candidates, routing guideline overlays, and a compact
issue repro export for regression tests or renderer debugging.

Fallback connection, label-candidate, jog-candidate, trace-detour,
path-cleanup, label-orientation, power-label, symbol-fit, and guideline
overlays are visual debug aids only. They must not replace authored `segments`,
parser connectivity, or renderer-owned source geometry.

## Stability Notes

- Additive fields may be introduced as more Altium records are normalized.
- Existing field names should remain stable because renderer and future feature code will depend on them.
- If one field must change semantics, update this document and the parser specification in the same change set.
