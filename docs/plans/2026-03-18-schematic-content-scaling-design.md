# Schematic Content Scaling Design

**Goal:** Scale recovered schematic primitives into a normalized larger sheet frame without scaling the border, zones, or footer/title block chrome.

**Context:** Some native sheets declare a smaller custom source page and are later normalized to a larger ISO page so the recovered footer fits. The page chrome now matches the normalized page, but the schematic primitives still render at the original source scale and look undersized relative to the border.

## Options Considered

1. **Recommended: content-only SVG scaling anchored to the inner-frame origin**
   Keep the normalized sheet chrome unchanged and wrap drawable schematic primitives in one SVG group transform. Compute a uniform scale from the source inner-frame size to the normalized inner-frame size, capped by the smaller axis so symbols are not distorted.

2. **Content crop/viewBox tightening**
   Change the SVG viewport instead of the schematic coordinates. This hides the mismatch rather than fixing it and weakens the page-to-content relationship.

3. **Parser-side coordinate rewriting**
   Rewrite every primitive into normalized coordinates during parsing. This is more invasive, harder to verify, and couples rendering concerns into parsing.

## Chosen Design

Use option 1.

When `sheet.sourceWidth`/`sheet.sourceHeight` are smaller than the resolved `sheet.width`/`sheet.height`, compute:

- `sourceInnerWidth = sourceWidth - margin * 2`
- `sourceInnerHeight = sourceHeight - margin * 2`
- `targetInnerWidth = width - margin * 2`
- `targetInnerHeight = height - margin * 2`
- `scale = min(targetInnerWidth / sourceInnerWidth, targetInnerHeight / sourceInnerHeight)`

Apply that transform only to the schematic primitive groups. The transform anchor is the inner-frame bottom-left corner in projected SVG space:

- `pivotX = margin`
- `pivotY = height - margin`

That keeps the border and footer fixed while expanding the content into the normalized frame.

## Testing

- Add a renderer regression that proves the content wrapper transform appears for a normalized A3 sheet with a smaller source size.
- Keep the existing footer/title-block regression unchanged to ensure chrome remains fixed.
- Run `npm test` after the implementation.
