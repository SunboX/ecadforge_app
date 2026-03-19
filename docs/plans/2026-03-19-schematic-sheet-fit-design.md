# Schematic Sheet Fit Design

**Goal:** Make normalized schematic content render closer to the authored Altium sheet placement by scaling it up to the normalized page limit and anchoring it against the main drawing box instead of tiny top outliers, without moving the page chrome.

**Context:** The current normalized-sheet content transform scales recovered primitives into promoted pages, but it still anchors vertical placement to the absolute top-most primitive. On promoted sheets that means small connector labels or other outliers above the main drawing box keep the schematic visually low, even when the larger authored box should sit close to the top chrome in the Altium reference.

## Options Considered

1. **Recommended: dominant-box normalized anchor**
   Keep the existing content-only wrapper transform, but detect a large authored rectangle/region and use its top edge as the vertical anchor for promoted sheets. Keep the normalized page scale limit, fit the overall content width, and still guard the result against the bottom drawing area.

2. **Scale-only relaxation**
   Increase the normalized scale cap while leaving the current absolute-bounds anchor in place. This makes content larger, but the dominant drawing box still sits too low.

3. **Fixed visual bias**
   Add a hard-coded upward offset and scale bump. This is easy to ship, but it would be brittle across different sheets and typography mixes because it still would not distinguish dominant frames from outlier labels.

## Chosen Design

Use option 1.

For normalized sheets in `SchematicContentLayout`:

- Keep the existing overall content bounds collection and content-only SVG transform.
- Detect a dominant rendered rectangle or region whose size covers a meaningful share of the sheet content envelope.
- Use that dominant box as the normalized vertical anchor when it sits below the absolute top-most primitive.
- Restore the normalized page scale limit so promoted sheets can grow to the available standard-sheet size again.
- Keep the overall right-fit limit and the bottom-fit limit as safety guards based on the available drawing area.
- Set the normalized dominant-box top to `margin + contentPadding * 0.2`, then derive the wrapper translate from the difference between the dominant top and the absolute top-most primitive.
- Preserve the existing footer reserve, clip path, border, zones, and title block behavior.

This keeps the sheet chrome fixed while making promoted sheets visually match the Altium layout more closely: the main disabled/drawing box sits near the top chrome, but the overall content still stays clipped and bottom-fitted inside the sheet frame.

## Testing

- Add one renderer regression that locks the normalized-sheet transform to the normalized page scale on ordinary promoted sheets.
- Add a second regression with a large rectangle plus a small top outlier so the dominant-box anchor stays locked.
- Keep the sparse custom-sheet scaling regression unchanged so bottom-left anchored custom-page behavior does not move.
- Run the focused renderer test first, then run `npm test`.
