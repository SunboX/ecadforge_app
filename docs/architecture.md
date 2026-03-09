# Architecture

## Runtime Modules

- `src/index.html`: static viewer shell with file intake, tabs, and render anchors
- `src/main.mjs`: bootstrap and dependency wiring
- `src/AppController.mjs`: file intake, worker coordination, state transitions
- `src/core/AppState.mjs`: normalized view state container
- `src/core/altium/PrintableTextDecoder.mjs`: printable-run extraction from binary native files
- `src/core/altium/AsciiRecordParser.mjs`: pipe-delimited native record parsing
- `src/core/altium/AltiumParser.mjs`: normalized schematic and PCB model builder
- `src/ui/AppView.mjs`: tab rendering, summary cards, diagnostics, and content mounting
- `src/ui/*Renderer.mjs`: pure markup renderers for schematic, PCB, BOM, and 3D summary views
- `src/workers/altium-parser.worker.mjs`: parser offload worker
- `src/server.mjs`: local static server and metadata endpoints

## Parse Strategy

The current parser is intentionally pragmatic:

1. Load a native file as raw bytes in the browser
2. Extract long printable runs from the binary document
3. Parse pipe-delimited Altium-style key/value records from those runs
4. Normalize the recovered data into one shared viewer model
5. Feed schematic, PCB, BOM, 3D-summary, and diagnostics views from that normalized model

This is not full binary/OLE reconstruction yet. It is a browser-only recovery strategy that already works well enough on the provided sample corpus to render useful views while keeping the implementation pure JavaScript.

## Data Flow

1. User selects or drops a `.SchDoc` or `.PcbDoc`
2. `AppController` reads the file and posts it to the parser worker
3. `altium-parser.worker.mjs` runs `parseAltiumArrayBuffer`
4. The normalized document model is posted back to the main thread
5. `AppState` stores parse status and the recovered model
6. `AppView` renders the active tab from the normalized model

## Styling

- `src/style.css` is the stylesheet entrypoint
- `src/styles/00-core.css` defines theme tokens
- `src/styles/10-layout.css` defines shell/layout primitives
- `src/styles/20-viewer.css` defines viewer-specific presentation

## Server Endpoints

- `GET /api/health`: liveness check
- `GET /api/app-meta`: app metadata (version)
- `GET /api/app-meta.php`: PHP-compatible alias
