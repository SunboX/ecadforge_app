# Schematic App Palette Design

**Goal:** Shift the schematic renderer onto the same teal, copper, and neutral palette family as the PCB view and the rest of the app without changing schematic rendering behavior.

**Context:** The schematic renderer already maps imported Altium colors onto semantic CSS tokens such as `--schematic-default-ink-color`, `--schematic-power-color`, and `--schematic-fill-color`. That abstraction is correct, but the token values still reflect the legacy Altium blue, red, and yellow palette while the PCB renderer and app chrome already use a more cohesive teal, copper, and sand palette.

## Options Considered

1. **Recommended: token-only palette shift**
   Keep the resolver and renderers unchanged and retune only the `.schematic-svg` CSS custom property values in the viewer stylesheet.

2. **Palette shift plus resolver remap**
   Update the stylesheet and also change one or more raw color-to-token mappings in the schematic color resolver.

3. **Shared cross-view theme refactor**
   Extract common app, PCB, and schematic tokens into a shared theme layer and refactor both views to consume it.

## Chosen Design

Use option 1.

The renderer already emits semantic theme tokens, so the lowest-risk way to align the schematic with the PCB/app palette is to keep all markup and parser output intact and update only the token values.

Palette direction:

- Move default schematic ink from navy to the app accent teal family.
- Keep a brighter cool accent for highlighted signal primitives, but keep it within the same PCB/app teal range.
- Keep power, port, and alert semantics distinct by mapping them onto darker and brighter copper/rust tones already used by the PCB renderer and app brand colors.
- Replace the bright yellow schematic fills with softer sand and cream fills that match the app canvas and PCB component tones.
- Preserve the quiet neutral sheet chrome so the schematic content remains the visual focus.

## Testing

- Add a stylesheet regression that reads `src/styles/20-viewer.css` and asserts the `.schematic-svg` block defines the expected app-aligned token values.
- Keep the existing renderer tests that assert semantic token usage in generated SVG markup.
- Run the focused stylesheet test first, then the full suite after the CSS update.
