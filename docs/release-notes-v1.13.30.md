# ECAD Forge 1.13.30

Version 1.13.30 improves Altium schematic fidelity and makes the PCB
mechanical-drawings control reflect actual document content.

## PCB drawing controls

- The `Mechanical drawings` checkbox is now omitted when a PCB only declares
  empty mechanical or documentation layer slots.
- Boards containing real drawing geometry or text keep the checkbox, its
  default-hidden behavior, and the compact board-first viewport.
- Checkbox availability and default hidden state use the same generic
  primitive-to-layer matching contract.

## Altium schematic fidelity

- Updated `altium-toolkit` to 1.4.12.
- Restored native schematic frames, signal harnesses, complete harness labels,
  project-resolved owner footer content, and rotated passive annotation
  placement.

## Verification

- Added integration coverage for the published Altium schematic renderer.
- Added PCB model, controller, and rendered-toolbar regressions for populated
  and empty mechanical drawing layers.
