# Opposite-Side Pad Fading Design

## Goal

Make opposite-side SMD pads visually recede with the opposite-side traces in
Altium and KiCad composite PCB views. Keep plated through-hole and multilayer
pads fully visible, colored like the traces on the currently viewed board side.

## Scope

- Apply the behavior symmetrically to Top and Bottom views.
- Support Altium and KiCad PCB SVG output.
- Preserve pad geometry, layer identity, drill rendering, selection metadata,
  and layer visibility behavior.
- Keep the change in the app palette because both toolkit renderers already
  expose stable side, layer, and pad-type metadata.
- Do not change, publish, or release either toolkit.
- Do not push or deploy the app as part of this task.

## Rendering Rules

### Opposite-side SMD pads

An SMD pad is opposite-side context when its physical copper layer does not
match the active board view:

- Top view: Bottom copper pads are opposite-side context.
- Bottom view: Top copper pads are opposite-side context.

The pad fill and stroke use the same subsurface copper color as opposite-side
traces. The pad opacity matches the existing opposite-trace opacity for its
format, so pads and their connected traces have the same visual hierarchy.

Altium pads are identified by the existing `pcb-pad--smd` class and physical
`data-layer-id`. KiCad pads are identified by `data-pad-type="smd"` and physical
`data-layer-id`. Through-hole pads are excluded structurally rather than being
restyled afterward.

### Through-hole and multilayer pads

Through-hole and multilayer pads remain fully visible from either board side.
Their annular copper uses the active surface trace color:

- Top view: Top trace color.
- Bottom view: Bottom trace color.

Drill holes and slots retain their existing styling.

## Implementation

Update `src/styles/25-kicad-pcb.css` with shared palette variables and
format-specific semantic selectors:

- Add an opposite-pad opacity variable with format-specific values matching the
  existing opposite-trace rules.
- Apply subsurface fill, stroke, and opacity only to opposite-side SMD pads.
- Derive the through-hole pad fill from `--pcb-surface-track-color`, which is
  already side-aware.

No renderer post-processing or toolkit API changes are needed.

## Tests

Use red-green TDD to add observable stylesheet regression coverage for:

- Altium Top and Bottom opposite-side SMD selectors.
- KiCad Top and Bottom opposite-side SMD selectors.
- SMD-only fading that cannot affect through-hole pads.
- Opposite pad fill/stroke and opacity matching the format's opposite traces.
- Through-hole/multilayer pad fill following the active surface trace color.

Run the focused palette tests, then the complete app suite. Bump the local app
version to `1.13.20`, synchronize structured data, and run the structured-data
and static-build gates. Finally, inspect both formats on Top and Bottom in the
local browser and capture screenshots under `output/playwright/`.

## Success Criteria

- Opposite-side SMD pads are visibly as subdued as opposite-side traces.
- Same-side SMD pads retain their current surface styling.
- Through-hole and multilayer pads stay full-strength and switch between Top
  and Bottom trace colors with the active view.
- Altium and KiCad Top and Bottom views render without browser errors.
- All app tests and deployment checks pass locally.
