# Sheet Zone Separators Design

**Goal:** Add visible separator strokes between synthesized sheet zone markers on all four sheet edges so row and column labels sit in clearly divided gutter cells.

**Context:** The schematic renderer already synthesizes numeric column labels on the top and bottom edges and alphabetic row labels on the left and right edges. It does not draw the gutter divider strokes between those labels, so the sheet chrome looks incomplete compared with Altium-style page borders.

## Options Considered

1. **Recommended: renderer-only gutter separator strokes**
   Extend the existing sheet-zone renderer to emit short divider lines at every internal zone boundary on the top, bottom, left, and right gutters. Keep the current frame rectangle and zone-label placement unchanged.

2. **Replace the frame rectangle with segmented edge geometry**
   Rebuild the whole sheet frame from individual line segments so the dividers become part of the outer border geometry. This would be harder to maintain and adds unnecessary risk to the existing border and title-block layout.

3. **Parse source border primitives instead of synthesizing them**
   Recover the divider strokes from source records. This is broader parser work for a purely synthesized chrome issue and is not needed for the current behavior gap.

## Chosen Design

Use option 1.

The change stays in the synthesized sheet chrome:

- Continue using `xZones`, `yZones`, `marginWidth`, and the current frame bounds from `SchematicSheetChromeRenderer.#buildSheetZoneMarkup()`.
- For each internal column boundary, draw a short vertical separator from the page edge down to the frame edge on the top gutter and from the frame edge down to the page edge on the bottom gutter.
- For each internal row boundary, draw a short horizontal separator from the page edge to the frame edge on the left gutter and from the frame edge to the page edge on the right gutter.
- Keep the separators outside the sheet content area so they divide only the label gutters and do not slice through the inner schematic frame.
- Style the new separator strokes with the same sheet-frame stroke token as the rest of the page chrome.

## Testing

- Add a renderer regression that asserts separator lines appear at the expected internal zone boundaries on all four sheet edges.
- Keep the existing sheet-frame and zone-label assertions so the new test proves the separators are added without disturbing existing labels.
- Run the targeted renderer test file after implementation.
