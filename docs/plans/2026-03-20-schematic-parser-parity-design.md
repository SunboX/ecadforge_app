# Schematic Parser Parity Design

## Goal

Extend the schematic parser and normalized model so `ECAD Forge` preserves more of the authored Altium structure that appears in established open source parsers, while staying focused on future viewer features and not just raw record dumps.

## Problem

The current schematic pipeline already recovers a useful viewer-driven subset of Altium data:

- components and owner-linked texts
- pins, ports, power-port labels, directives, and crosses
- wires, buses, polygons, rectangles, ellipses, arcs, and note boxes
- sheet sizing and title-block metadata

That subset is good enough for many viewer scenarios, but it leaves several meaningful record families and parser behaviors under-modeled or missing:

- no first-class `sheetSymbols` model for `RECORD=15`
- no first-class `sheetEntries` model for `RECORD=16`
- no explicit authored `junctions` model for `RECORD=29`
- no schematic `images` model for `RECORD=30`
- no first-class `busEntries` model for `RECORD=37`
- no normalized schematic `nets` model
- no durable schematic parser specification that documents supported record families, naming rules, and intentional gaps

The result is a parser that is stronger than a simple text recovery tool, but still too narrow for future features such as:

- sheet hierarchy navigation
- connectivity inspection and diagnostics
- explicit net highlighting and cross-probing
- richer authored-symbol fidelity
- embedded image rendering or placeholders

## External References

This design is informed by these open source parser implementations:

- [a3ng7n/Altium-Schematic-Parser](https://github.com/a3ng7n/Altium-Schematic-Parser)
- [esophagoose/python-schdoc](https://github.com/esophagoose/python-schdoc)
- [vadmium/python-altium](https://github.com/vadmium/python-altium)

### What they contribute

- `python-schdoc` provides the broadest typed record inventory and a useful normalized record vocabulary.
- `python-altium` provides the strongest per-record format notes, geometry semantics, and rendering-oriented behavior hints.
- `Altium-Schematic-Parser` provides a practical netlist-oriented traversal model that shows which connectivity primitives are worth prioritizing.

## Comparison Summary

### Current implementation strengths

- Strong viewer-focused normalization for common primitives already visible in the current app.
- Good recovery of schematic text behavior, multipart component ownership, and sheet sizing heuristics.
- Better existing renderer integration than the reference repos, which mostly stop at record parsing or SVG export.

### Clear gaps versus the references

| Area | Reference repos | Current app |
| --- | --- | --- |
| Sheet symbol / sheet entry | Modeled as `15` / `16` | Missing first-class model and renderer support |
| Explicit junction | Modeled as `29` | Only non-connect markers are modeled; connection dots are synthesized |
| Embedded image | Modeled as `30` | Missing |
| Bus entry | Modeled as `37` | Missing |
| Netlist / connectivity | Present in `a3ng7n` and `python-schdoc` | Missing normalized net model |
| Typed parser specification | Broad documented catalog | No app-owned schematic parser spec |
| Record-parent hierarchy | Preserved in multiple references | Preserved only where needed for current viewer behavior |

### Things not worth chasing in this pass

The reference repos also enumerate additional record families such as `3`, `5`, `9`, `10`, `215`, `216`, `217`, and `218`. Some are incomplete even in those repos, and some do not currently unlock meaningful viewer behavior in `ECAD Forge`.

This pass should not try to fully clone every reference parser. It should add the missing behavior that is both:

- structurally well-understood from the references
- useful for current or near-future app features

## Decision

Take a viewer-first parity pass plus foundational parser extensions.

That means:

- add missing normalized record families that are clearly useful now
- add a durable schematic net model for future features
- add embedded image extraction because it is a common authored schematic element and requires the same OLE groundwork the app already uses for PCB documents
- document the supported Altium schematic record families and normalized data model as a project-owned specification

This is deliberately broader than a renderer-only patch and narrower than a full parser-clone project.

## Architecture

### 1. Parsing stays record-driven

The parser should keep its current structure:

- printable record recovery
- record-family specific normalization
- post-processing and ownership resolution
- renderer-facing normalized document model

New behavior should be added through focused parser modules instead of growing `AltiumParser.mjs` into a monolith.

### 2. Add first-class schematic sub-parsers

Introduce small modules under `src/core/altium/`:

- `SchematicSheetParser.mjs`
- `SchematicJunctionParser.mjs`
- `SchematicBusEntryParser.mjs`
- `SchematicImageParser.mjs`
- `SchematicNetlistBuilder.mjs`

Each module should normalize one family of related records from already-parsed field objects.

### 3. Preserve authored structure separately from viewer heuristics

The current renderer synthesizes junction dots from line geometry. That should stay, but authored connection records must also be preserved.

The normalized schematic model should distinguish:

- authored records recovered from the file
- synthesized viewer aids created for presentation only

That boundary matters for future diagnostics, export, and cross-probing.

### 4. Reuse OLE infrastructure for schematic images

`RECORD=30` images require access to embedded storage content. The repo already has a reusable OLE reader for PCB stream recovery. Schematic image extraction should build on that infrastructure instead of introducing a separate binary pathway.

## Normalized Model Additions

Extend the schematic payload with these additive collections:

```js
schematic: {
    sheet,
    lines,
    polygons,
    rectangles,
    regions,
    ellipses,
    arcs,
    directives,
    texts,
    components,
    pins,
    ports,
    crosses,
    sheetSymbols,
    sheetEntries,
    junctions,
    busEntries,
    images,
    nets
}
```

### `sheetSymbols`

Derived from `RECORD=15`.

Proposed fields:

- `x`
- `y`
- `width`
- `height`
- `color`
- `fill`
- `isSolid`
- `transparent`
- `ownerIndex`
- `uniqueId`
- `renderOrder`

### `sheetEntries`

Derived from `RECORD=16`.

Proposed fields:

- `ownerIndex`
- `name`
- `side`
- `direction`
- `style`
- `shape`
- `x`
- `y`
- `width`
- `height`
- `color`
- `fill`
- `textColor`
- `fontId`
- `harnessType`
- `renderOrder`

The parser should resolve entry position from parent sheet-symbol bounds plus `DistanceFromTop` semantics documented in the references.

### `junctions`

Derived from `RECORD=29`.

Proposed fields:

- `x`
- `y`
- `color`
- `renderOrder`

These should represent authored connection points only. Synthesized junction dots remain a renderer concern.

### `busEntries`

Derived from `RECORD=37`.

Proposed fields:

- `x1`
- `y1`
- `x2`
- `y2`
- `color`
- `width`
- `renderOrder`

### `images`

Derived from `RECORD=30`.

Proposed fields:

- `x`
- `y`
- `cornerX`
- `cornerY`
- `fileName`
- `embedded`
- `keepAspect`
- `mimeType`
- `dataBase64`
- `renderOrder`
- `diagnosticState`

If the image is embedded and can be decoded safely, include `mimeType` and `dataBase64`. If not, preserve placement metadata and diagnostic state so the renderer can draw a placeholder instead of silently dropping it.

### `nets`

Derived after primitive normalization.

Proposed fields:

- `name`
- `segments`
- `labels`
- `powerPorts`
- `pins`
- `ports`
- `junctions`
- `busEntries`
- `sheetEntries`

Each endpoint reference should carry enough information for later UI features without forcing the renderer to recompute connectivity.

## Net Resolution Rules

Connectivity should be built from normalized geometry and a few explicit semantic records.

### Connectivity primitives

- wire line segments
- bus line segments only where bus-entry behavior explicitly applies
- pin connection points
- off-sheet port connection points
- power-port connection points
- explicit junction records
- bus-entry endpoints
- sheet-entry connection points
- net-label anchor points

### Naming precedence

Use deterministic precedence rules:

1. explicit power-port text
2. explicit net-label text
3. stable sheet-entry or off-sheet naming context when it is the only named endpoint
4. stable fallback `UnknownNet<n>`

When multiple named records merge, preserve the earliest stable non-fallback name and record a diagnostic when a second competing explicit name appears.

### Scope

This pass should build a practical single-sheet connectivity model. It should not attempt full hierarchical connectivity resolution across sheet symbols and sheet entries beyond preserving the local entry nodes and names needed for future work.

## Renderer Changes

Add viewer support for the newly normalized schematic collections:

- sheet symbol rectangles
- sheet entry callouts and labels
- explicit junction dots
- bus entry diagonals
- image rendering or placeholder boxes

Keep rendering additive:

- existing lines, texts, pins, and ports must keep working unchanged
- synthesized junction logic should remain, but explicit `junctions` should be rendered directly
- image rendering should never block the rest of the schematic scene

## Diagnostics

Add clearer schematic diagnostics for:

- embedded image extraction success or failure
- number of sheet symbols and entries recovered
- number of explicit junctions and bus entries recovered
- number of resolved nets
- competing explicit net names when applicable

The parser should stay tolerant. These new families should never make the whole schematic parse fail unless the entire file is unreadable.

## Specifications To Add

Add project-owned docs under `docs/`:

### `docs/altium-schematic-parser-spec.md`

Document:

- supported schematic record families
- key field semantics adopted from the reference repos
- normalization rules actually implemented by `ECAD Forge`
- intentionally unsupported or deferred record families

### `docs/altium-schematic-normalized-model.md`

Document:

- normalized schematic object shape
- required and optional fields
- semantics of `texts`, `ports`, `sheetEntries`, `images`, and `nets`
- distinction between authored data and synthesized viewer aids

### Update `spec/web-app-specification.md`

Expand the app-level specification so it explicitly states:

- schematic hierarchy markers are preserved when present
- embedded schematic images may be rendered locally
- diagnostics include connectivity and recovery details

## Testing Strategy

### Parser tests

Add focused fixture-free tests for:

- `RECORD=15` sheet symbols
- `RECORD=16` sheet entries
- `RECORD=29` explicit junctions
- `RECORD=37` bus entries
- netlist naming and merging behavior
- `RECORD=30` image placement and embedded-image extraction

Use small embedded fake records or small repo-owned synthetic OLE containers. Do not commit native customer files or extracted proprietary payloads.

### Renderer tests

Add SVG assertions for:

- sheet-symbol boxes
- sheet-entry shapes and labels
- explicit junction dots
- bus-entry linework
- image placeholders or decoded embedded images

### Regression tests

Keep current schematic fixture coverage intact and verify that existing moon, dawn, nova, and cinder behavior does not regress while the model grows.

## Non-Goals

- full parity with every documented Altium record family
- full hierarchical multi-sheet net resolution
- fixture-specific parsing rules
- parser branches keyed to source file names or identifiers
- external image file loading outside the local parse context

## Follow-Up Work Enabled By This Design

If this pass lands cleanly, later features can build on the new model without reopening parsing fundamentals:

- net highlighting in the viewer
- connectivity diagnostics UI
- sheet hierarchy browsing
- cross-probing between schematic view and BOM
- better SVG or JSON export of normalized schematic data
