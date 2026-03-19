# Schematic Vivid Palette Design

**Goal:** Increase the schematic renderer's overall color energy by making the dominant baseline linework noticeably more vivid while keeping text readable and semantic marker colors distinct.

**Context:** The contrast-focused palette pass improved separation between cool geometry, text, and warm markers, but the schematic still feels visually flat because the dominant baseline linework remains too restrained. In practice, the overall page impression is still muted even when secondary tokens such as `power`, `port`, and `alert` are separated correctly.

## Options Considered

1. **Recommended: push the baseline linework toward a vivid cyan-teal**
   Keep the token structure intact and increase the chroma of `--schematic-default-ink-color`, with `--schematic-accent-ink-color` staying even brighter.

2. **Only saturate the secondary tokens**
   Leave the base linework restrained and raise vibrance only on warm markers and alerts.

3. **Raise saturation across all tokens equally**
   Increase chroma everywhere, including fills and neutrals.

## Chosen Design

Use option 1.

The schematic's perceived vibrance is driven primarily by the baseline linework because it occupies most of the visible geometry. The fix is therefore to move the default linework to a more saturated cyan-teal and lift the accent teal alongside it, while keeping text dark and semantic markers distinct.

The revised palette should follow these rules:

- Default linework becomes a clearly more vivid cyan-teal than the previous muted teal.
- Accent linework remains in the same family but becomes brighter and more electric so it still reads as a distinct tier.
- Text remains dark graphite to preserve readability and prevent the entire schematic from collapsing into one saturated layer.
- Power and port colors remain warm and saturated, with ports brighter than power.
- Alert stays outside the warm family as a high-visibility signal color.
- Fills, notes, and sheet chrome stay soft and restrained so the schematic content carries the added vibrance.

## Testing

- Update the stylesheet regression to assert the more vivid cyan-teal baseline token values.
- Keep the existing renderer token-usage assertions unchanged.
- Run the focused stylesheet test first, then the full `npm test` suite.
