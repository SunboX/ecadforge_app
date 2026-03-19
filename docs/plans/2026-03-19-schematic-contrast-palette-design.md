# Schematic Contrast Palette Design

**Goal:** Rebalance the schematic palette so it still fits the PCB/app theme, but restores clear visual separation between baseline geometry, text, warm semantic markers, and alerts.

**Context:** The first app-aligned palette pass succeeded in moving the schematic away from the legacy Altium blue/red/yellow look, but it compressed too much meaning into two narrow color families. In practice, default lines and accent geometry became too similar, text lost separation from cool geometry, and warm semantic markers no longer stood apart strongly enough.

## Options Considered

1. **Recommended: increase semantic contrast inside the current token model**
   Keep the existing resolver and renderer structure, but widen the distance between cool base geometry, dark text, warm semantic colors, and alert colors.

2. **Return closer to the original Altium differentiation**
   Reintroduce more extreme hue separation that resembles the old schematic palette more closely.

3. **Add more theme tokens**
   Split the current token set into more schematic-specific roles, then re-theme the renderers around them.

## Chosen Design

Use option 1.

The renderer already has the right semantic token surface. The problem is not missing structure; it is insufficient contrast between existing token values.

The revised palette should follow these rules:

- Default lines and standard geometry move to a darker, cooler teal so they remain clearly distinct from warmer semantics.
- Accent geometry stays cool, but becomes brighter and more cyan-leaning than the default line color.
- Text and labels move to a darker graphite so they remain readable even when surrounded by cool geometry.
- Power and port colors both remain in the warm family, but with larger spacing: power deeper and browner, ports brighter and more orange.
- Alert intentionally breaks out of the copper/rust family and becomes a more signal-like warning color so it cannot be confused with ports or power.
- Fills remain soft and light so they support the palette instead of competing with it.

## Testing

- Update the stylesheet regression to assert the revised high-contrast token values instead of the compressed first-pass values.
- Keep existing renderer token-usage assertions unchanged so markup semantics remain stable.
- Run the focused stylesheet test first, then the full `npm test` suite.
