# PCB Authored Footprints Design

**Problem**

The PCB viewer currently renders component bodies as synthetic rounded rectangles derived from the footprint name. That hides the authored footprint geometry present in native `.PcbDoc` files, especially for fine-pitch ICs, connectors, and outline-heavy footprints. In the supplied `Starfall-Forge.PcbDoc`, the renderer drops all surface-mount pads and never draws top-side overlay or mechanical footprint outlines, so detailed packages collapse into generic blocks.

**Chosen Approach**

Render authored footprint geometry from the PCB document instead of guessing package bodies. The top-facing PCB view should:

- render all pads, including SMD pads with no drill hole
- render selected authored top-side outline layers from decoded track and fill primitives
- suppress the synthetic fallback rectangle when authored geometry already exists near the component
- keep the designator text so the board remains readable

**Layer Strategy**

The existing binary primitive streams use legacy numeric layer identifiers such as `33` for `Top Overlay` and `59` for `M3 Placement Outline`. The parser will expose those legacy names in the normalized PCB model so the renderer can choose stable, generic top-side documentation layers by name rather than hard-coding board-specific IDs.

The renderer will treat the following families as authored footprint detail when they are present on the top-facing side:

- `Top Overlay`
- top assembly / placement outline / top mechanic layers
- top reference / designator layers

Copper, via, and pad rendering remain separate from authored outline rendering.

**Fallback Behavior**

If a component has nearby authored geometry, the viewer should render only the authored geometry and designator text. If not, the existing synthetic rectangle remains as a fallback so sparse or incomplete files still display something useful.

**Testing**

Regression coverage will verify:

- `PcbModelParser` preserves legacy primitive-layer names used by decoded binary tracks
- `PcbSvgRenderer` renders SMD pads without drill holes
- `PcbSvgRenderer` emits authored footprint outline markup for selected top-side documentation layers
- `PcbSvgRenderer` suppresses the synthetic fallback body when authored detail exists nearby
