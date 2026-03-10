# Schematic Bus Rendering Design

**Date:** 2026-03-10

**Goal:** Restore the missing thick blue schematic routes by parsing the Altium primitive that represents bus trunks and rendering it distinctly from ordinary wires.

## Context

The current schematic parser normalizes straight lines plus record-`6` and record-`27` polylines into `schematic.lines`. On the affected sheet, the missing blue routes are stored as record-`26` primitives. Because record-`26` is not normalized, those routes never reach the SVG renderer.

Examples from the fake power-sheet fixture:

- `RECORD=26 ... X1=300 Y1=700 X2=300 Y2=680` is the `DRDM[0..1]` bus trunk.
- `RECORD=26 ... X1=415 Y1=550 X2=415 Y2=460` is the `N[7..0]` bus trunk.

## Options Considered

### Option 1: Parse record-`26` as plain lines only

Pros:

- Minimal parser change
- Restores missing geometry

Cons:

- Buses still render like ordinary thin wires
- Does not match the visual distinction the user expects

### Option 2: Parse record-`26` as bus segments and render them thicker

Pros:

- Restores missing geometry
- Preserves the visual difference between buses and wires
- Keeps the change localized to parser normalization, SVG line rendering, and junction synthesis

Cons:

- Requires one extra line metadata flag

### Option 3: Rework all line primitives around source record types

Pros:

- More extensible for future primitive-specific styling

Cons:

- Larger refactor than this bug needs
- Higher risk in a currently active codepath

## Approved Approach

Implement option 2.

### Parser

- Include record-`26` in the schematic polyline normalization path.
- Preserve a boolean `isBus` flag on normalized line segments sourced from record-`26`.

### Renderer

- Render `isBus` segments with a thicker stroke than ordinary wires while keeping their source color.
- Leave ordinary line widths unchanged.

### Junction Dots

- Exclude `isBus` segments from synthesized junction-dot detection so bus trunks do not create false wire junctions.

### Tests

- Add a parser regression on the fake power sheet proving the `DRDM[0..1]` and `N[7..0]` bus trunks are present and marked as buses.
- Add a renderer regression proving bus lines emit a thicker stroke than ordinary wires.

### Docs and Release Hygiene

- Record the implementation plan in `docs/plans/`.
- Increment the application version in `package.json`.
