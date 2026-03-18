# Title Block Alignment Design

**Goal:** Align synthesized title-block labels and values inside the correct A3 footer cells so the rendered sheet matches the reference layout.

**Context:** The renderer already uses recovered footer value hints for title-block values, but it still draws a generic synthesized footer grid and generic label positions. That mismatch places the title, document number, revision, and sheet values in the wrong boxes even when the parser has already recovered accurate value coordinates.

## Options Considered

1. **Recommended: renderer-only A3 title-block layout update**
   Keep the parser contract unchanged and replace the generic footer grid ratios with an Altium-style A3 layout when standard footer hints are present. Continue using the recovered footer hints for the value fields.

2. **Small anchor-only tweak**
   Nudge the current synthesized value positions. This is lower effort, but it would still leave the labels and dividing lines in the wrong places.

3. **Parser-side footer geometry recovery**
   Preserve every visible footer label and border primitive from the source file. This would be more faithful, but it expands the parser surface for a bug that can be fixed in the renderer.

## Chosen Design

Use option 1.

For standard A3 title blocks with recovered footer hints:

- Build the title-block frame with fixed A3-style row and column boundaries instead of the current generic ratios.
- Keep the recovered footer-hint coordinates and typography for `title`, `documentNumber`, `revision`, `sheetNumber`, and `sheetTotal`.
- Place the synthesized labels, paper size, date, file name, and drawn-by text into the matching footer cells.
- Render title-block labels with serif footer typography so the synthesized chrome matches the source family more closely.

## Testing

- Add a renderer regression that asserts the A3 title-block lines and label positions match the expected footer layout.
- Keep the existing footer-hint value assertions and update them only where the corrected layout changes the expected coordinates.
- Run the targeted renderer test file after the implementation.
