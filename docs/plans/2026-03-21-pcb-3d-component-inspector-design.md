# PCB 3D Component Inspector Design

## Goal

Make every visible 3D component clickable and show enough structured detail in the existing right-side 3D panel to let users report placement, rotation, and model-origin issues precisely.

## Scope

- Add click selection for procedural fallback bodies and loaded external 3D models.
- Show selection details in the existing right-side 3D panel under the toggle controls.
- Keep the panel stable while orbiting, panning, and zooming.
- Show an empty state when nothing is selected.

## Out of Scope

- Cross-highlighting into the 2D PCB/SVG view.
- Persistent selection across tab switches.
- Editing component metadata.
- Multi-select.

## Recommended Approach

Use scene picking at the runtime level and surface selection changes through the existing 3D controller.

- The runtime already owns the renderer, camera, and scene graph, so it is the right place to do raycasting.
- The controller already owns the right-side panel wiring, so it is the right place to render the selection summary.
- The scene builder already produces the normalized component/external placement data we need, so the inspector can reuse that data rather than re-parsing anything.

## Interaction Model

- A primary click on a component selects it.
- Clicking a different component replaces the current selection.
- Clicking empty space clears the selection.
- Selection should work for:
    - procedural fallback bodies
    - explicit external placements
- If both a fallback body and an external model exist for the same designator, the inspector should prefer the explicit external-placement metadata because that is the most useful debugging path for model-placement bugs.

## Inspector Content

The right-side panel should show:

- Designator
- Mount side
- Component rotation
- Component board position (`x`, `y`, `z` in mil)
- Footprint/pattern
- Source/library string when available
- External model name and format when available
- Explicit model/body data when available:
    - body `x`, `y`
    - body rotation
    - model rotation `x`, `y`, `z`
    - `dz`

When nothing is selected, the panel should show a compact instructional empty state such as “Click a component to inspect it.”

## Data Flow

1. `Scene3dRenderer` renders a reserved inspector mount in the existing right-side panel.
2. `PcbScene3dController` builds the scene as usual and prepares lookup metadata by designator.
3. `PcbScene3dRuntime` tags clickable meshes with a lightweight selection payload and emits selection callbacks on click.
4. `PcbScene3dController` receives the selected payload and renders the inspector content into the right-side panel.

## Error Handling

- If the runtime cannot initialize, the existing diagnostics behavior remains unchanged.
- If a clicked mesh has incomplete metadata, the inspector should render only the available fields.
- If an external mesh is selected without a matched component, show the external placement details without inventing missing component data.

## Testing Strategy

- Renderer test: verify the 3D shell includes an inspector mount and empty-state copy.
- Controller test: verify runtime selection callbacks populate the inspector.
- Runtime test: verify click selection emits the tagged payload and empty-space clicks clear it.

## Acceptance Criteria

- Every rendered component body is clickable.
- The selected component details appear in the right-side panel under the toggles.
- Empty-space click clears the inspector.
- The feature is covered by automated tests.
