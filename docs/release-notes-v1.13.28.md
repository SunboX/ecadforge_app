# ECAD Forge 1.13.28

Version 1.13.28 adds a reversible mechanical-drawings control to the PCB viewer,
uses a board-first initial fit, and restores mechanical and documentation text
in native Altium PCB rendering.

## PCB mechanical drawings

- A localized `Mechanical drawings` checkbox appears beside the Top and Bottom
  PCB controls whenever the document exposes mechanical, assembly,
  fabrication, dimension, courtyard, notes, or documentation layers.
- Mechanical drawings start hidden for newly loaded PCB documents, so the
  initial viewport centers and fits the physical board.
- Enabling the checkbox restores all member-layer geometry and annotations,
  including off-board title blocks and fabrication notes.
- Toggling the aggregate refits the viewport between the compact board view and
  the complete drawing sheet while preserving pan and zoom for unrelated layer
  changes.
- Individual layer visibility controls remain authoritative; the aggregate
  checkbox reflects whether all represented drawing layers are visible.

## Rendering

- Hidden drawing-layer aliases are forwarded to the native renderer for
  visible-content viewport calculation while their SVG markup remains available
  for instant toggling.
- Ordinary electrical-layer visibility changes retain the existing cached base
  SVG behavior.
- Layer classification is derived from normalized document metadata without
  board, project, vendor, file, or annotation-specific matching.

## Dependency

- `altium-toolkit` updates from 1.4.8 to 1.4.9 for complete drawing text and
  visible-layer viewport bounds.

## Verification

- App regressions cover drawing-layer classification, default state, aggregate
  checkbox markup, grouped visibility actions, renderer forwarding, and cache
  behavior.
- Toolkit regressions cover both board sides, unclipped drawing annotations,
  retained hidden markup, and visible-layer bounds.
- Release gates include the complete ECAD Forge test suite, structured-data
  validation, static build, deployment workflow, and exact-route browser check.
