# ECAD Forge Specification

## 1. Goal

Build a browser-based viewer for Altium, KiCad, Gerber, and CircuitJSON design files with client-side parsing, normalized document models, and browser views for schematic, PCB, interactive 3D, BOM, and diagnostics.

## 2. Functional Requirements

1. The app starts via `npm start` and serves the browser app locally.
2. The app accepts standalone native `.SchDoc` and `.PcbDoc` files, KiCad `.kicad_pro`/`.kicad_sch`/`.kicad_pcb` files, KiCad project ZIPs, Gerber/Excellon files, fabrication ZIPs, CircuitJSON `.json` files, companion `.PrjPcb`/`WRL`/`STEP` assets, and project-folder selections through drag-and-drop or file selection.
3. Parsing runs client-side in browser JavaScript with worker offload and main-thread fallback.
4. The app normalizes recovered native data into a shared viewer model.
5. The `Schematic` tab renders recovered schematic geometry, hierarchy markers, embedded-image placements, and text.
6. The `PCB` tab renders recovered board outline, layer metadata, fabrication layers, and component placements where available.
7. Clicking a PCB footprint or schematic symbol selects the shared component, opens the matching `Footprints` or `Symbols` sidebar panel, and highlights and scrolls the selected row into view there. Multipart schematic symbols share one `Symbols` row and highlight every visible part for the selected component. Clicking a schematic wire, PCB trace/pad/via/zone, or net row selects the shared net, opens the `Nets` sidebar panel, and renders the net in the viewer highlight color with a subtle glow.
8. The `3D` tab renders an interactive PCB scene with orbit, pan, zoom, procedural board/package geometry, bare-board Gerber fabrication geometry, embedded STEP extraction from lone `.PcbDoc` files, companion-model resolution when matching session assets are available, single-file STEP/WRL assembly export for board geometry, copper, silkscreen, pads, vias, and resolved component models, and an opt-in missing-model search that can fetch STEP or WRL assets from known KiCad model-library paths, close same-folder KiCad package matches, or the configured component source.
9. The `BOM` tab renders grouped component rows from recovered metadata.
10. The `Diagnostics` tab exposes parser recovery, connectivity, and warning messages.
11. The UI reads app metadata (version) from `/api/app-meta` and falls back to `/api/app-meta.php` on PHP-only hosts, with both endpoints sourcing the version from `package.json`.
12. The app test suite validates app integration, interaction behavior, server behavior, and project structure; parser, deterministic renderer, and non-interactive scene-data behavior is validated in the shared toolkit packages.
13. Runtime language switching detects supported browser locales on first load, persists manual user selection, falls back to English, and includes Brazilian Portuguese.
14. The schematic parser preserves supported hierarchy records, explicit junctions, bus entries, and a normalized single-sheet net model when those records are recoverable.
15. Embedded schematic image payloads remain local-first; the app renders embedded image data when present and falls back to visible placeholders plus diagnostics when the payload is missing.
16. Shared-hosting deployment publishes an Apache-ready static frontend artifact with versioned browser module URLs and no-store cache headers.
17. When native browser WebMCP support is available through `document.modelContext`, the app registers read-only loaded-session tools for listing loaded designs, listing/searching components and nets, reviewing design coverage, auditing metadata/connectivity issues, listing diagnostics, querying direct net membership, querying BOM rows, listing pin connections, listing component type counts, listing single-pin nets, cross-referencing schematic nets against PCB pads, comparing schematic/PCB and BOM/PCB parity, summarizing loaded design state, querying component pins, inspecting PCB component placement, inspecting PCB net geometry, summarizing PCB board/routing/stackup data, listing PCB design rules, reviewing fabrication-readiness signals, and tracing extended connectivity.
18. The app shell provides the production WebMCP origin-trial token for `https://ecadforge.app/` and the served/deployed app applies `Origin-Agent-Cluster: ?1` plus `Permissions-Policy: tools=(self)`.

## 3. Non-Functional Requirements

1. Use modern JavaScript ESM modules.
2. Keep each source file below 1000 LOC.
3. Use 4-space formatting with single quotes and no semicolons.
4. Include JSDoc for all public and private methods.
5. Keep documentation in `docs/` and tests in `tests/`.
6. Keep file parsing local-first and avoid outbound network calls unless the user explicitly enables the 3D missing-model search option. Missing-model lookup must not upload native design or fabrication files.
7. WebMCP tools must not upload files, scan local paths, fetch remote resources, mutate app state, or expose raw file contents. Registered descriptors must mark the tools as read-only and untrusted-content capable.
8. Production analytics may load only on deployed HTTP(S) origins; localhost, file URLs, and private-network dev origins must not send events with the production site key.

## 4. Architecture

1. `src/core/`: state and domain primitives.
2. `altium-toolkit`: binary-to-printable recovery, targeted OLE-backed recovery where required, normalized Altium parsing, deterministic schematic/PCB/BOM rendering, and complete non-interactive 3D scene-description building.
3. `kicad-toolkit`: KiCad 9 S-expression parsing, project loading, normalized KiCad schematic/PCB/BOM rendering, and complete data-only 3D scene-description building.
4. `gerber-toolkit`: Gerber/Excellon parsing, fabrication ZIP expansion, source-layer normalization, deterministic PCB SVG rendering, bare-board 3D scene-description building, and interaction helpers.
5. `circuitjson-toolkit`: CircuitJSON parsing and standards-native board/assembly data loading.
6. `src/ui/`: app shell, local interaction controllers, and interactive 3D runtime modules.
7. `src/AppController.mjs`: orchestration and action layer.
8. `src/workers/ecad-parser.worker.mjs`: worker parser entrypoint.
9. `src/main.mjs`: browser entrypoint.
10. `src/server.mjs`: local static/API server.
11. `src/StaticDeployBuilder.mjs` and `scripts/build-static-deploy.mjs`: static FTP deployment artifact builder.
12. `src/core/webmcp/`: native WebMCP adapter, tool registry, and loaded-session dispatch to toolkit-owned netlist query APIs.

## 5. Security / Privacy

1. Keep secrets server-side only.
2. Validate supported file types before parsing.
3. Escape parser-derived text before inserting it into the DOM.
4. Document any external network call behavior.
5. Do not upload native design or fabrication files anywhere.
6. Resolve embedded schematic images from the local file container only; never fetch remote image assets during parsing.

## 6. Acceptance Criteria

1. `npm install && npm start` serves the app without errors.
2. `npm test` passes.
3. The UI can load a native `.SchDoc` and show a populated schematic view.
4. The UI can load a native `.PcbDoc` and show a populated PCB view.
5. The UI can load standalone KiCad schematic/PCB files or a KiCad project folder/ZIP and show schematic, PCB, BOM, and diagnostics views from the normalized documents.
6. The UI can load Gerber/Excellon files or a fabrication ZIP and show a composite PCB fabrication view with a separated-layer option.
7. The `BOM`, `3D`, and `Diagnostics` tabs render from compatible normalized models without crashing.
8. The `3D` tab remains usable from a lone `.PcbDoc`, renders bare-board Gerber fabrication scenes, renders embedded STEP payloads when the board file contains them, upgrades to companion `WRL`/`STEP` models when the user also loads matching files in the same session, exports a full PCB assembly as STEP or WRL while skipping and reporting unresolved component models, and can search known KiCad model-library paths, close same-folder KiCad package matches, or the configured component source for missing models only when the user enables the checkbox.
9. Docs and spec files are present and linked from `README.md`.
10. The app version shown in UI matches the single-source version in `package.json`.
11. Supported schematic hierarchy records, explicit junctions, bus entries, and embedded images render without breaking existing schematic content.
12. Supported schematic files expose a normalized `nets` model and emit diagnostics for missing embedded image payloads, missing KiCad sheet files, or conflicting explicit net names.
13. The FTP workflow uploads the static build artifact rather than raw browser source.
14. In browsers with native WebMCP support, the registered tools answer from currently loaded documents only and return clear errors for missing designs, ambiguous selectors, broad regex searches, missing schematic/PCB cross-reference data, PCB-only connectivity, missing components, missing nets, and blocked power/ground traversal starts.
15. Share/startup URLs can restore the requested viewer tab, active loaded document, selected component, and selected net when `view=`, `document=`, `component=`, and `net=` query parameters are present.
