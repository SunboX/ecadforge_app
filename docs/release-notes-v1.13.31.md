# ECAD Forge 1.13.31

Version 1.13.31 distinguishes separate PCB technical-drawing sheets from
ordinary on-board mechanical geometry.

## PCB drawing controls

- The `Mechanical drawings` checkbox now appears only when populated drawing
  layers materially expand beyond the physical board envelope.
- Boards using mechanical layers solely for package, assembly, or other
  on-board geometry no longer show the checkbox.
- Separate technical drawings remain hidden by default, so the initial
  viewport fits the complete PCB; enabling the checkbox reveals the full
  drawing sheet.

## Verification

- Added model, controller, and rendered-toolbar regressions for off-board,
  on-board, and empty drawing-layer content.
- Verified the behavior with real PCB documents both with and without a
  separate technical drawing.
