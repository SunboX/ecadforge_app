# PCB Mechanical Drawings Visibility Design

## Problem

Altium PCB documents can contain large drawing sheets, title blocks, assembly
notes, dimensions, and other fabrication documentation outside the physical
board outline. ECAD Forge currently renders that geometry by default and lets
it enlarge the SVG viewBox, so a small PCB can occupy only a fraction of the
initial viewport. Mechanical and documentation text is also filtered out of
the composite renderer, leaving otherwise legitimate drawing sheets blank.

## Approved behavior

- Add a `Mechanical drawings` checkbox beside the Top and Bottom PCB controls.
- Treat the checkbox as an aggregate of every physical layer whose normalized
  metadata identifies mechanical, assembly, fabrication, drawing, dimension,
  courtyard, or notes/documentation content.
- Start newly loaded PCB documents with that aggregate hidden.
- Compute the initial and reset viewport from geometry on visible layers, while
  always retaining the physical board outline.
- When the aggregate is enabled, render its geometry and text and include it in
  the fitted viewport.
- Keep individual layer controls authoritative. The aggregate is checked only
  when all of its member layers are visible.

## Architecture

`altium-toolkit` owns Altium SVG semantics and geometry. Its renderer will:

1. select shared mechanical/documentation text for both board-side composites;
2. accept optional hidden-layer identifiers as render context;
3. exclude hidden-layer primitives and text only from viewBox calculation,
   without removing their SVG markup.

ECAD Forge will:

1. classify aggregate members from resolved interaction-layer roles and names;
2. initialize hidden-layer state for newly loaded PCB documents;
3. render the aggregate checkbox with the existing grouped layer-action
   contract;
4. pass resolved hidden-layer aliases to the toolkit render call and include
   them in the app renderer cache key.

The existing CSS visibility injection remains responsible for showing and
hiding SVG elements. This avoids duplicating Altium geometry calculations in
the app and keeps all layer choices reversible without reparsing the document.

## Generality and compatibility

Classification is derived from layer metadata rather than file names, project
names, or sample text. Optional renderer fields preserve existing callers. PCB
formats that do not expose mechanical/documentation layers simply omit the
checkbox, and their current rendering behavior remains unchanged.

## Verification

- Toolkit unit tests cover shared documentation text and visible-layer
  viewBox bounds with generic synthetic models.
- App tests cover classification, default state, checkbox markup/events,
  render-option forwarding, and cache separation.
- Full repository suites and release gates run before publication.
- Local and deployed browser checks confirm the board-first initial viewport,
  reversible checkbox behavior, and restored drawing text.
