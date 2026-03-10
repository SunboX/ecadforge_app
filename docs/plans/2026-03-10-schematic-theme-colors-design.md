# Schematic Theme Colors Design

## Goal

Replace renderer-emitted schematic hex colors with CSS custom properties so the app can swap schematic themes later without rewriting SVG markup or parser output.

## Current State

The schematic pipeline preserves raw Altium colors in the normalized document model and many renderers write those colors straight into SVG `fill` and `stroke` attributes. The stylesheet also hard-codes schematic chrome colors such as the sheet backdrop, frame, and fallback node marker.

## Decision

Keep parser color extraction unchanged and apply theming at the render layer.

This design introduces a shared schematic color resolver that maps raw imported colors and synthetic fallback colors onto a stable set of CSS variable tokens. Renderers will emit `var(--schematic-...)` values instead of literal hex colors, and schematic-related CSS rules will define the default theme palette in one place.

## Theme Surface

The renderer should expose a semantic palette large enough to preserve the current visual distinctions:

- primary line and annotation blue
- bright signal blue
- neutral text
- power and port red
- alert red
- warm fills
- light fills
- note border
- sheet chrome colors
- synthetic component marker colors

Unknown imported colors should still resolve to the closest semantic fallback for that primitive type so the theme always wins over document-defined colors.

## Rendering Strategy

- Add a shared resolver for SVG stroke, fill, and text colors.
- Update schematic renderers to route every emitted color through that resolver.
- Replace schematic stylesheet literals with CSS variables on `.schematic-svg`.
- Leave parser tests and parser data intact so imported documents still preserve source color metadata for future use.

## Testing
