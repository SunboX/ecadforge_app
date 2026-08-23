# ECAD Forge 1.13.25

Version 1.13.25 prevents renderer crashes when opening dense Altium PCB views.

## PCB rendering

- Updates `altium-toolkit` to 1.4.7.
- Replaces repeated full-SVG pad relocation with one linear partition while
  preserving surface and opposite-side copper grouping.
- Preserves ordered pads, default surface placement, nested slotted-pad markup,
  and layer-only exports.

## Verification

- Covers 1,000 grouped pads and 5,000 tracks in a 384 MiB bounded heap.
- Verifies the original public LimeSDR-Micro PCB deep link in a real browser.
- Passes the complete app tests, structured-data check, and static deployment
  build.
