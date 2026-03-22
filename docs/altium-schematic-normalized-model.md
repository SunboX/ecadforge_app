# Altium Schematic Normalized Model

## Purpose

This document defines the normalized schematic model emitted by `src/core/altium/AltiumParser.mjs` for `.SchDoc` files.

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

```js
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

```js
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

```js
{
    x,
    y,
    color,
    renderOrder
}
```

These are authored `RECORD=29` junctions only.

### `busEntries`

```js
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

```js
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

```js
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

## Stability Notes

- Additive fields may be introduced as more Altium records are normalized.
- Existing field names should remain stable because renderer and future feature code will depend on them.
- If one field must change semantics, update this document and the parser specification in the same change set.
