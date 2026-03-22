# Altium Schematic Parser Spec

## Purpose

This document describes the `ECAD Forge` schematic parser surface that is intentionally supported by the application today.

It is informed by these open source references:

- [a3ng7n/Altium-Schematic-Parser](https://github.com/a3ng7n/Altium-Schematic-Parser)
- [esophagoose/python-schdoc](https://github.com/esophagoose/python-schdoc)
- [vadmium/python-altium](https://github.com/vadmium/python-altium)

Those projects are reference material, not compatibility targets. `ECAD Forge` documents only the record families and semantics that it currently implements or intentionally defers.

## Parser Pipeline

1. Recover printable byte runs from the native file.
2. Parse Altium-style pipe-delimited key/value records.
3. Normalize supported schematic record families into a shared model.
4. Apply post-processing for ownership, label anchoring, and layout heuristics.
5. Build additive connectivity and diagnostic metadata.

For schematic embedded images, the parser also attempts OLE stream lookup when an image record declares an embedded payload.

## Supported Schematic Record Families

### Core document and metadata

- `HEADER`: file sniffing and schematic detection
- `31`: sheet metadata, fonts, grid, page sizing, title-block context
- `41`: hidden metadata and visible parameter text
- `4`: visible text and title-block footer hints

### Symbol and drawing primitives

- `6`: polyline and symbol outline segments
- `7`: filled polygons
- `8`: ellipses and circles
- `11`: elliptical arcs
- `12`: circular arcs
- `13`: straight lines
- `14`: rectangles
- `211`: rectangular regions
- `225`: listed rectangle fallback treated as a rectangle primitive

### Component and connectivity primitives

- `1`: component placement and library reference
- `2`: schematic pins
- `17`: power ports
- `18`: off-sheet ports
- `22`: non-connect crosses
- `25`: net labels
- `26`: buses
- `27`: wires
- `29`: explicit junctions
- `37`: bus entries
- `43`: directives and warning markers

### Hierarchy and image primitives

- `15`: sheet symbols
- `16`: sheet entries
- `30`: schematic image placements with embedded-stream recovery when available

### Auxiliary ownership records used by normalization

- `34`: designator labels
- `44`, `45`, `46`, `48`: multipart implementation ownership support

## Implemented Semantics

### Sheet symbols and entries

- `RECORD=15` is normalized as a sheet symbol with top-left origin, width, height, fill, stroke, and authored render order.
- `RECORD=16` is normalized relative to its parent sheet symbol using `OwnerIndex`, `Side`, `DistanceFromTop`, `IOType`, `Style`, and text color fields.
- `DistanceFromTop` is interpreted using the same `x10` whole-unit convention documented in the reference material, plus optional `_FRAC1` support.

### Explicit junctions

- `RECORD=29` is preserved as authored junction data.
- Synthesized viewer junctions still exist separately and must not be conflated with authored junction records.

### Bus entries

- `RECORD=37` is normalized as a dedicated diagonal bus-entry marker.
- It is not allowed to leak through the generic `Location` to `Corner` line fallback.

### Embedded images

- `RECORD=30` preserves placement bounds, file name, keep-aspect flag, and embedded/external intent.
- If `EmbedImage` is set and the file is an OLE container, the parser attempts to resolve a stream whose leaf name matches the declared image file name.
- If the embedded payload is found, the parser stores a MIME type and base64 payload.
- If the embedded payload is missing or unreadable, the parser preserves the placement record and emits a warning diagnostic instead of failing the schematic parse.

### Net labels

- `RECORD=25` labels are preserved as visible text nodes and are also used for net naming.
- Orientation `1` and `3` are normalized to a visible vertical rotation.

### Connectivity model

The parser builds a single-sheet normalized net model from:

- non-owner, non-bus wire segments
- net-label positions
- power-port positions
- pin connection points
- off-sheet port connection points
- explicit junctions
- bus-entry endpoints
- sheet-entry connection points

Name precedence is:

1. explicit power-port text
2. explicit net-label text
3. stable fallback `UnknownNet<n>`

When multiple explicit names resolve onto one grouped net, the parser keeps the first stable explicit name and emits a warning diagnostic.

## Intentionally Deferred Or Partial Areas

The following record families are known from the reference projects but are not yet modeled as first-class viewer data in `ECAD Forge`:

- `3`: IEEE symbols
- `5`: beziers
- `9`: piecharts
- `10`: rounded rectangles
- `39`: template files
- `215`, `216`, `217`, `218`: harness connector family

Deferral reasons vary:

- limited confidence in stable field semantics from the current sample corpus
- low current viewer value
- better handled after the hierarchy and connectivity surface is in regular use

## Robustness Rules

- The parser must not special-case source file names, customer identifiers, or fixture names.
- Unknown or partially malformed supported records should degrade to diagnostics where practical instead of aborting the entire parse.
- Embedded image recovery must remain local-first and must never fetch external network resources.
- Additive record-family support must not regress existing schematic normalization behavior.
