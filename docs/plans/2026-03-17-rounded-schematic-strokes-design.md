# Rounded Schematic Strokes Design

## Goal

Render rounded line ends for schematic symbol and wire primitives so recovered drawings match the reference styling more closely.

## Current State

`SchematicSvgRenderer` emits most open schematic primitives inside plain SVG groups with default stroke behavior. That leaves wires, pin stubs, crosses, arcs, and power-port linework with square stroke caps.

## Decision

Apply `stroke-linecap="round"` only to SVG groups that contain open electrical primitives:

- schematic wires
- schematic arcs
- schematic pin stubs
- schematic cross markers
- schematic power-port linework

This keeps the fix close to the rendered primitive categories, avoids rewriting every child element, and preserves square corners for sheet chrome, rectangles, note boxes, and off-sheet port polygons.

## Testing

Add a renderer test that verifies:

- open schematic primitive groups opt into rounded stroke caps
- power-port symbol groups opt into rounded stroke caps
- the root `<svg>` does not receive a global rounded-cap default

## Non-Goals

- rounding sheet-frame or title-block chrome
- rounding rectangle or polygon corners
- changing note-box rendering
