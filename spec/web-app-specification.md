# Altium Viewer Specification

## 1. Goal

Build a browser-based viewer for standalone native Altium `.SchDoc` and `.PcbDoc` files with client-side parsing, normalized document models, and browser views for schematic, PCB, 3D summary, BOM, and diagnostics.

## 2. Functional Requirements

1. The app starts via `npm start` and serves the browser app locally.
2. The app accepts standalone native `.SchDoc` and `.PcbDoc` files through drag-and-drop or file selection.
3. Parsing runs client-side in browser JavaScript with worker offload and main-thread fallback.
4. The app normalizes recovered native data into a shared viewer model.
5. The `Schematic` tab renders recovered schematic geometry and text.
6. The `PCB` tab renders recovered board outline, layer metadata, and component placements.
7. The `3D` tab renders a presentational 3D-style board summary from PCB dimensions and placements.
8. The `BOM` tab renders grouped component rows from recovered metadata.
9. The `Diagnostics` tab exposes parser recovery and warning messages.
10. The UI reads app metadata (version) from `/api/app-meta`.
11. The test suite validates parser behavior, renderer output, and project structure.
12. Runtime language switching remains available for the shell UI.

## 3. Non-Functional Requirements

1. Use modern JavaScript ESM modules.
2. Keep each source file below 1000 LOC.
3. Use 4-space formatting with single quotes and no semicolons.
4. Include JSDoc for all public and private methods.
5. Keep documentation in `docs/` and tests in `tests/`.
6. Keep file parsing local-first and avoid outbound network calls.

## 4. Architecture

1. `src/core/`: state and domain primitives.
2. `src/core/altium/`: binary-to-printable recovery and normalized Altium parsing.
3. `src/ui/`: view/render modules.
4. `src/AppController.mjs`: orchestration and action layer.
5. `src/workers/altium-parser.worker.mjs`: worker parser entrypoint.
6. `src/main.mjs`: browser entrypoint.
7. `src/server.mjs`: local static/API server.

## 5. Security / Privacy

1. Keep secrets server-side only.
2. Validate supported file types before parsing.
3. Escape parser-derived text before inserting it into the DOM.
4. Document any external network call behavior.
5. Do not upload native design files anywhere.

## 6. Acceptance Criteria

1. `npm install && npm start` serves the app without errors.
2. `npm test` passes.
3. The UI can load a native `.SchDoc` and show a populated schematic view.
4. The UI can load a native `.PcbDoc` and show a populated PCB view.
5. The `BOM`, `3D`, and `Diagnostics` tabs render from the normalized model without crashing.
6. Docs and spec files are present and linked from `README.md`.
7. The app version shown in UI matches `package.json`.
