# Selected Part Export Design

## Context

ECAD Forge already lets a user select one PCB component in the PCB and 3D
views. The 3D model sidebar now exposes editable model transform parameters for
that selected component. The 3D runtime can export all resolved scene models as
a ZIP, but it does not export a complete reusable part.

The requested feature exports the currently selected component as a reusable
part bundle for KiCad, Altium, or CircuitJSON. A bundle includes the selected
symbol, footprint, resolved 3D model file when available, and a manifest with
conversion diagnostics.

## Goals

- Add selected-part export actions to the existing left sidebar `3D model` tab.
- Export the selected component as a ZIP for KiCad, Altium, or CircuitJSON.
- Include symbol data, footprint data, resolved 3D model bytes, and a manifest.
- Preserve raw/native source where the parser model still has it.
- Generate best-effort valid library output from normalized data when raw source
  is unavailable.
- Put reusable format-specific exporters in sibling toolkits when the logic is
  not app-specific.
- Keep lossy or incomplete exports explicit through structured manifest
  diagnostics.

## Non-Goals

- Do not build a full project exporter.
- Do not export every component in the board.
- Do not silently claim bit-perfect native library recovery when source data has
  already been normalized.
- Do not require outbound model search during export. Already resolved scene
  models and session assets may be included.
- Do not move download UI or app state into the toolkits.

## UI

The `3D model` sidebar tab gains an `Export selected part` section below the
selected-component summary and transform controls. It is visible only when a
component is selected.

The section contains three compact buttons:

- `KiCad ZIP`
- `Altium ZIP`
- `CircuitJSON ZIP`

If no component is selected, the existing empty message remains. If the selected
component cannot be exported, the section shows a concise diagnostic and the
buttons are disabled.

## Package Boundaries

### `ecadforge_app`

The app owns selection, UI, downloads, and ZIP orchestration:

- Resolve the active document and selected designator.
- Collect selected schematic component, PCB footprint, and resolved 3D model
  metadata.
- Invoke toolkit exporters for the requested target format.
- Add `manifest.json` and package returned entries into a browser download.
- Render user-facing success and failure messages in the sidebar.

### `../kicad-toolkit`

KiCad-specific reusable export belongs here:

- Add an S-expression serializer for parsed KiCad AST nodes.
- Add a selected symbol library exporter that writes a `.kicad_sym`.
- Add a selected footprint exporter that writes a `.kicad_mod`.
- Prefer raw `lib_symbols` and footprint S-expression nodes when present.
- Fall back to generated symbol or footprint nodes from normalized component
  data when raw nodes are unavailable.

### `../altium-toolkit`

Altium library writing remains here:

- Reuse the existing `AltiumSchLibExporter` and `AltiumPcbLibExporter`.
- Add only a small adapter if selected app data needs normalization into the
  existing source component bundle shape.
- Include model bytes through the existing bundle model asset contract.

### `../circuitjson-toolkit`

CircuitJSON remains the interchange representation:

- Reuse the existing model adapter where possible.
- Add a selected-part filter helper only if it is cleaner than app-local
  filtering.

### `../pcb-scene3d-viewer`

The 3D viewer remains scene-focused:

- Keep all-part model ZIP export where it is.
- Do not add symbol or footprint export knowledge to the viewer.
- Expose resolved scene/model information through existing controller or scene
  data paths only if the app cannot otherwise access the selected model bytes.

## Data Flow

1. User selects a 3D component.
2. The app stores the selected designator in `selectedPcbComponents`.
3. The `3D model` sidebar renders export buttons for the selected component.
4. User clicks one target format.
5. `SelectedPartExportService` resolves:
   - selected schematic component by designator,
   - selected PCB footprint by designator,
   - selected 3D model from resolved scene data, embedded model data, or session
     asset data.
6. The app builds a normalized selected-part bundle.
7. The target exporter produces format entries.
8. The app adds `manifest.json`, any available 3D model file, and downloads a
   ZIP named from the designator and target format.

## ZIP Contents

### KiCad

- `kicad/<part>.kicad_sym`
- `kicad/<part>.kicad_mod`
- `models/<model file>` when bytes are available
- `manifest.json`

### Altium

- `altium/<part>.SchLib`
- `altium/<part>.PcbLib`
- `models/<model file>` when bytes are available
- `source/source.json`
- `manifest.json`

### CircuitJSON

- `circuitjson/<part>.circuit.json`
- `models/<model file>` when bytes are available
- `manifest.json`

## Manifest

Every ZIP includes a deterministic manifest:

- selected designator,
- source document name and format,
- target format,
- symbol export status,
- footprint export status,
- 3D model export status,
- generated file list,
- diagnostics with severity, code, and message.

Diagnostics are required for any lossy conversion, missing model bytes, missing
symbol data, missing footprint data, or generated fallback output.

## Error Handling

- No selected component: disable export controls.
- Scene not ready: allow symbol/footprint export, mark 3D model unavailable.
- Missing symbol: export footprint/model when possible and add an error
  diagnostic.
- Missing footprint: export symbol/model when possible and add an error
  diagnostic.
- Missing model bytes: export symbol/footprint and add a warning diagnostic.
- Native exporter failure: abort the requested ZIP and show the error in the
  sidebar.

## Testing

- Unit-test selected-part resolution from fake app document models.
- Unit-test KiCad S-expression serialization and selected symbol/footprint
  export in `../kicad-toolkit`.
- Unit-test Altium selected bundle normalization or adapter behavior in
  `../altium-toolkit` if an adapter is added.
- Unit-test CircuitJSON selected output shape.
- Unit-test sidebar rendering and click event binding in `ecadforge_app`.
- Run the relevant toolkit tests plus `npm test` in `ecadforge_app`.
- Do a browser sanity check that selecting a 3D component exposes export buttons
  in the `3D model` tab and clicking each button initiates a ZIP download.
