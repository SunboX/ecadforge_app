# ECAD Forge 1.10.2

Version 1.10.2 consumes schema-valid KiCad CircuitJSON directly from the
published common toolkit API.

- Updates `kicad-toolkit` to 1.1.2.
- Legacy KiCad footprint values now reach typed CircuitJSON component fields
  without app-side repair.
- Footprint silkscreen, fabrication, board-note, and courtyard elements retain
  canonical ownership, side, and shape semantics.
- Rotated courtyard rectangles preserve their transformed polygon geometry,
  and three-point artwork arcs retain their curve through deterministic path
  tessellation.
- The app regression suite parses a source-neutral KiCad fixture through both
  the installed `Parser` and `ProjectLoader`, then validates the returned model
  with `CircuitJsonDocument`.

The app uses the package output as-is. No compatibility adapter, copied parser
logic, or fixture-specific workaround was added.
