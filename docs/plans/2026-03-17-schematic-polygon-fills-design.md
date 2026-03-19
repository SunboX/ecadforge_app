# Schematic Polygon Fills Design

## Goal

Render filled diode, transistor, and similar schematic symbol bodies when the source Altium polygon primitive marks them as solid and provides an `AreaColor`.

## Current State

The parser currently expands record-7 schematic polygons into closed line segments only. That preserves visible outlines, but it discards the fill semantics, so solid symbol triangles and arrows render hollow even when the source `SchDoc` marks them `IsSolid=T`.

## Source Evidence

The provided obfuscated sample schematic contains record-7 polygons on the affected diode and transistor owners with:

- `IsSolid=T`
- `AreaColor` present
- `LocationCount` values matching triangle and arrow bodies

That means the missing fill is a generic polygon-support gap, not a symbol-specific exception.

## Decision

Add first-class normalized schematic polygons while keeping the existing polygon-derived line segments.

- The parser should preserve record-7 polygons as polygon primitives with points, stroke color, fill color, solidity, transparency, line width, and `ownerIndex`.
- The renderer should draw these polygons in a dedicated SVG group before the wire and symbol linework so filled bodies sit behind the existing outlines.
- Polygon fills should use the source `AreaColor` when present.
- Color resolution should still prefer CSS theme variables when a recovered polygon fill matches a known imported color token. When no mapping exists, the renderer should preserve the normalized source hex instead of collapsing to a generic fallback variable.

Keeping the existing line segments avoids disturbing owner-bound calculations, text anchoring, and current outline coverage while adding the missing fill behavior.

## Testing

Add:

- a parser regression proving record-7 polygons are preserved as solid polygon primitives while their outline line segments remain available
- a renderer regression proving polygon fills use theme tokens when known and preserve raw hex fills when unknown

## Non-Goals

- special-casing transistor or diode library names
- removing polygon-derived outline lines
- changing rectangle, note, or off-sheet port fill behavior
