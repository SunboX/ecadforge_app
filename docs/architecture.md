# Architecture

## Runtime Modules

- `src/index.html`: static viewer shell with file intake, tabs, and render anchors
- `src/main.mjs`: bootstrap and dependency wiring
- `src/AppController.mjs`: file intake, worker coordination, state transitions
- `src/core/AppState.mjs`: normalized view state container
- `src/core/altium/PrintableTextDecoder.mjs`: printable-run extraction from binary native files
- `src/core/altium/AsciiRecordParser.mjs`: pipe-delimited native record parsing
- `src/core/altium/AltiumParser.mjs`: normalized schematic and PCB model builder
- `src/core/altium/Schematic*Parser.mjs`: schematic record-family normalizers for symbols, connectivity markers, images, and nets
- `src/ui/AppView.mjs`: tab rendering, summary cards, diagnostics, and content mounting
- `src/ui/*Renderer.mjs`: pure markup renderers for schematic, PCB, BOM, and the 3D scene shell
- `src/ui/PcbScene3d*.mjs`: interactive Three.js scene builder, controller, runtime, STEP importer, and model registries/loaders
- `src/workers/altium-parser.worker.mjs`: parser offload worker
- `src/server.mjs`: local static server and metadata endpoints
- `src/vendor/fflate/browser.mjs`: vendored browser-safe compression dependency loaded by the PCB parser on both localhost and static FTP hosts
- `api/app-meta.php`: PHP metadata endpoint for FTP/shared-hosting deployments
- `api/.htaccess`: extensionless route rewrite for `/api/app-meta`

## Parse Strategy

The current parser is intentionally pragmatic:

1. Load a native file as raw bytes in the browser
2. Extract long printable runs from the binary document
3. Parse pipe-delimited Altium-style key/value records from those runs
4. Normalize the recovered data into one shared viewer model
5. Build additive schematic hierarchy, embedded-image, and connectivity metadata where supported
6. Feed schematic, PCB, BOM, interactive 3D, and diagnostics views from that normalized model

This is still not full binary reconstruction. It is a browser-first recovery strategy that mixes printable record parsing with targeted OLE stream access where the format clearly requires it, such as embedded schematic images, embedded PCB STEP payloads, and richer PCB stream recovery.

## Data Flow

1. User selects or drops one or more `.SchDoc`, `.PcbDoc`, or companion model files
2. `AppController` stores any companion 3D assets in session state and posts native design files to the parser worker
3. `altium-parser.worker.mjs` runs `parseAltiumArrayBuffer`
4. The normalized document model, including diagnostics and additive connectivity metadata, is posted back to the main thread
5. `AppState` stores parse status, the recovered document models, and session companion assets
6. `AppView` renders the active tab from the normalized model and mounts the interactive 3D controller when needed
7. The 3D runtime resolves embedded STEP payloads from the normalized PCB model first, then falls back to companion `WRL`/`STEP` assets from the active session
8. Static-hosted 3D modules resolve browser `three` and `three/addons/` imports through the shell import map and the deployed `/node_modules/` asset tree

## Styling

- `src/style.css` is the stylesheet entrypoint
- `src/styles/00-core.css` defines theme tokens
- `src/styles/10-layout.css` defines shell/layout primitives
- `src/styles/20-viewer.css` defines viewer-specific presentation

## Server Endpoints

- `GET /api/health`: liveness check
- `GET /api/app-meta`: app metadata (version)
- `GET /api/app-meta.php`: PHP/shared-hosting alias when extensionless rewrites are unavailable
- `GET /node_modules/*`: localhost alias for the browser dependency tree that FTP deployment publishes directly
