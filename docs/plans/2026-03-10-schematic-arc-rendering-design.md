# Schematic Arc Rendering Design

**Date:** 2026-03-10

## Goal

Render Altium schematic record-`12` primitives as proper SVG arcs so inductors and other curved symbols appear in the schematic view instead of dropping their body geometry.

## Scope

### In Scope

- Parse drawable schematic record-`12` entries into normalized arc primitives
- Render normalized schematic arcs as SVG path arcs
- Add parser and renderer regressions for the record-`12` fixture cases
- Increment the app version in `package.json`

### Out Of Scope

- Approximating arcs with line segments
- Broader symbol reconstruction heuristics beyond direct record-`12` support
- Any unrelated schematic layout or text-placement changes

## Current State

The user-provided `GEWA-G1.01.01F.SchDoc` reproduces the missing-inductor bug consistently:

1. The parser recovers the inductor components, pins, and labels.
2. The source file stores the coil loops as record `12` primitives with `Location`, `Radius`, `StartAngle`, and `EndAngle`.
3. The normalized schematic model currently has no `arcs` collection, so those primitives are discarded before rendering.
4. The SVG renderer therefore draws only wires, pins, text, and fallback component markers, leaving the inductor body invisible.

## Approaches Considered

### Approach 1: Convert Arcs To Line Segments

Expand record `12` into many short lines during parsing.

**Pros**

- Reuses the existing line renderer
- Lowest renderer change

**Cons**

- Violates the requirement to draw proper arcs
- Loses source fidelity
- Makes curved symbols look rough at some zoom levels

### Approach 2: First-Class Normalized Arcs

Add an `arcs` primitive collection to the normalized schematic model and render it as SVG arc paths.

**Pros**

- Matches the source primitive type directly
- Produces proper curved geometry
- Keeps parser and renderer responsibilities clean
- Supports other symbols that use record `12`

**Cons**

- Requires coordinated parser, renderer, and test updates

### Approach 3: Renderer Reads Raw Arc Records

Pass raw Altium records through and let the SVG renderer interpret record `12` directly.

**Pros**

- Minimal parser change

**Cons**

- Breaks the normalized-model boundary
- Makes renderer tests and future maintenance worse
- Couples UI logic to file-format details

## Selected Design

Use **Approach 2**.

The parser will normalize drawable record-`12` entries into `schematic.arcs`, preserving:

- center point
- radius
- start and end angles
- stroke color
- line width
- owner metadata

The renderer will emit each normalized arc as an SVG `<path>` using the elliptical-arc command, with the same schematic-to-SVG Y projection already used for lines and pins. Full circles will be handled explicitly so circular record-`12` primitives do not collapse into zero-length paths.

## Testing Strategy

- Add a parser regression that loads the sheet-F fixture and asserts the inductor owner keeps its three coil arcs with the expected center points, radius, and angles
- Add a pure renderer test that asserts normalized arcs become SVG arc path markup
- Add a parser-backed renderer test that verifies the sheet-F inductors render visible arc paths instead of only text and leads
- Run focused tests first, then the full `npm test` suite

## Risks

- Arc-angle interpretation could be inverted when converting from Altium coordinates to SVG coordinates
- Full-circle or near-full-circle record-`12` primitives could render incorrectly if handled like ordinary arcs
- The new `arcs` collection could affect sheet-size inference if any downstream logic assumes only lines and rectangles contribute visible geometry

## Mitigations

- Anchor the implementation with both synthetic renderer tests and real-fixture parser tests
- Handle full circles as two half-arc path segments
- Keep the layout change narrow unless tests prove sheet-size inference needs arc bounds
