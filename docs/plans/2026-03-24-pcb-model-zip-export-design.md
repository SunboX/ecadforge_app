# PCB Model ZIP Export Design

## Goal

Add a browser-side action that exports the resolved 3D component models for a loaded PCB document into one ZIP archive, naming each entry after the component footprint pattern and including repeated footprints only once.

## Scope

- Add a `Download Models ZIP` action to the `3D` view.
- Export embedded STEP payloads recovered from `.PcbDoc` files.
- Export companion `STEP` and `WRL` assets loaded into the current session.
- Deduplicate repeated component instances so each footprint pattern is exported once per distinct resolved model.

## Out of Scope

- Converting `WRL` files into `STEP`.
- Adding any server-side export or conversion service.
- Exporting procedural fallback bodies that do not have a resolved external model.
- Changing the existing model-resolution precedence used by the 3D viewer.

## Recommended Approach

Reuse the existing PCB 3D model-resolution pipeline instead of introducing a parallel export matcher.

- The parser already exposes embedded STEP payloads on `documentModel.pcb.embeddedModels`.
- The 3D builder already matches component bodies to components and resolves explicit external placements.
- The model registry already centralizes embedded-versus-session model precedence.

Using that same flow keeps the export aligned with what the `3D` tab can already render and avoids duplicating the fragile body-to-component matching logic.

## Interaction Model

- The `3D` toolbar gains one `Download Models ZIP` button.
- The button is shown only in the `3D` scene shell for PCB documents.
- Clicking the button resolves the same exportable models the 3D scene uses.
- If no exportable models are resolved, the action should not download an empty ZIP and should instead surface a concise status message in the existing 3D diagnostics area.

## Export Rules

- ZIP file name: derive from the board title or file name, e.g. `GEWA-G1-DT.20.01-models.zip`.
- ZIP entry name: use the component `pattern` plus the resolved model extension, e.g. `CK-6.35-636-6P.step`.
- Deduplicate by resolved `pattern + model identity` so repeated instances of the same footprint/model pair are exported once.
- If one pattern resolves to multiple distinct models, export all of them using deterministic suffixes such as `Pattern.ext`, `Pattern--2.ext`, `Pattern--3.ext`.

## Data Sources

The export path should support three model origins:

- Embedded STEP payloads from `documentModel.pcb.embeddedModels`, written as UTF-8 text files.
- Companion `STEP` files loaded in the current browser session, copied byte-for-byte from the loaded asset.
- Companion `WRL` files loaded in the current browser session, copied byte-for-byte from the loaded asset.

## Data Flow

1. `Scene3dRenderer` renders the export button in the existing toolbar.
2. `PcbScene3dController` binds the button click and prepares an exportable model list from the resolved scene/model metadata.
3. A dedicated browser export utility reads each resolved model payload, normalizes ZIP entry names, and creates a ZIP via `fflate`.
4. The utility triggers a browser download and returns a summary that the controller can show in the 3D diagnostics area.

## Error Handling

- No resolved models: show a user-facing message and skip the download.
- Missing session asset bytes for a resolved companion file: skip that entry and report it in the summary.
- Unsupported resolved model format: skip it and report it.
- ZIP build failure: surface a concise error in the diagnostics area without breaking the 3D scene.

The export should be best-effort. One broken model must not block the entire archive when other entries are valid.

## Testing Strategy

- Renderer coverage: verify the 3D shell includes the export button.
- Controller coverage: verify the controller binds the button and requests an export with deduplicated pattern-based entries.
- Utility coverage: verify embedded STEP text, companion `STEP`, and companion `WRL` inputs become ZIP entries with the expected names and bytes.
- Board sanity check: confirm the attached sample PCB deduplicates repeated patterns such as `CK-6.35-636-6P`.

## Acceptance Criteria

- The `3D` toolbar includes a `Download Models ZIP` button.
- Repeated instances of the same footprint/model pair are exported once.
- Embedded STEP models are exported as `.step`/`.stp` text files.
- Companion `WRL` and companion `STEP` session assets are exported as-is.
- The ZIP entry names are derived from component patterns.
- The feature is covered by automated tests.
