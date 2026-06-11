# Architecture

## Runtime Modules

- `src/index.html`: static viewer shell with file intake, tabs, and render anchors
- `src/main.mjs`: bootstrap and dependency wiring
- `src/AppController.mjs`: file intake, worker coordination, state transitions
- `src/AnalyticsTrackerLoader.mjs`: deployed-origin analytics tracker loader that disables production-key analytics on local/private dev origins
- `src/StartupSourceResolver.mjs`: route and query-string startup source detection
- `src/DemoProjectRegistry.mjs`: bundled demo metadata, source URLs, and license metadata
- `src/GitHubSourceLoader.mjs`: GitHub raw/blob/tree URL normalization, folder discovery, browser fetch handling, and project-local KiCad model asset discovery
- `src/PrivacySafeAnalytics.mjs`: event wrapper that emits activation events without file names, raw URLs, or contents
- `src/core/AppState.mjs`: normalized view state container
- `src/core/ecad/*.mjs`: format registry plus parser, renderer, and scene facades
- `src/core/webmcp/*.mjs`: browser-native WebMCP adapter plus read-only loaded-session dispatch to toolkit-owned netlist query services
- `altium-toolkit/parser`: printable-run extraction, OLE/binary helpers, and normalized schematic/PCB model parsing
- `altium-toolkit/renderers`: deterministic schematic SVG, PCB SVG, and BOM HTML renderers
- `altium-toolkit/netlist-query`: normalized Altium netlist extraction, search validation, component grouping, and traversal rules
- `altium-toolkit/scene3d`: complete non-interactive Altium PCB 3D scene-description builders, board-outline refinement, silkscreen drill cutouts, and model registry logic
- `kicad-toolkit/parser`: KiCad 9 schematic/PCB/project loading and normalized model parsing
- `kicad-toolkit/renderers`: deterministic KiCad schematic SVG, PCB SVG, and BOM HTML renderers
- `kicad-toolkit/netlist-query`: normalized KiCad netlist extraction, search validation, component grouping, and traversal rules
- `kicad-toolkit/scene3d`: complete data-only KiCad PCB 3D scene-description builders, external placement metadata, copper text detail, and model registry logic
- `src/ui/AppView.mjs`: tab rendering, summary cards, diagnostics, and content mounting
- `src/ui/Scene3dRenderer.mjs`: ECAD Forge interactive 3D tab shell markup
- `src/ui/PcbScene3d*.mjs`: interactive Three.js controller, runtime, STEP importer, and local 3D interaction helpers
- `src/workers/ecad-parser.worker.mjs`: parser offload worker
- `src/server.mjs`: local static server and metadata endpoints
- `src/StaticDeployBuilder.mjs`: Apache/shared-hosting artifact builder that rewrites static assets before FTP upload
- `scripts/build-static-deploy.mjs`: CLI wrapper that writes `.deploy-src/`
- `api/app-meta.php`: PHP metadata endpoint for FTP/shared-hosting deployments
- `api/.htaccess`: extensionless route rewrite for `/api/app-meta`

## Parse Strategy

The current parser is intentionally pragmatic:

1. Load native Altium files, KiCad files, or KiCad project bundles in the browser
2. Extract long printable runs from Altium binary documents or read KiCad project entries
3. Parse pipe-delimited Altium-style key/value records from those runs or KiCad 9 S-expressions from project entries
4. Normalize the recovered data into one shared viewer model with `sourceFormat` as an additive discriminator
5. Build additive schematic hierarchy, embedded-image, BOM, and connectivity metadata where supported
6. Feed schematic, PCB, BOM, interactive 3D, and diagnostics views from that normalized model

This is still not full binary reconstruction. It is a browser-first recovery strategy that mixes printable record parsing with targeted OLE stream access where the format clearly requires it, such as embedded schematic images, embedded PCB STEP payloads, and richer PCB stream recovery.

## Data Flow

1. User selects or drops Altium files, KiCad files, a KiCad project folder/ZIP, or companion model files
2. `AppController` stores any companion 3D assets in session state and posts native design files to the parser worker
3. `ecad-parser.worker.mjs` runs `EcadParserService`, which dispatches to the Altium or KiCad toolkit
4. The normalized document model, including diagnostics and additive connectivity metadata, is posted back to the main thread
5. `AppState` stores parse status, the recovered document models, and session companion assets
6. `AppView` renders the active tab from the normalized model and mounts the interactive 3D controller when needed
7. The app uses `EcadScene3dService` only to choose the Altium or KiCad toolkit scene-description builder; the local 3D runtime then resolves embedded STEP payloads from the normalized PCB model first and falls back to companion `WRL`/`STEP` assets from the active session or GitHub project folder
8. `WebMcpAdapter` registers read-only tools when native browser WebMCP support is available; those tools query the current `AppState` snapshot, dispatch loaded documents to the matching toolkit query service, produce review/audit/search/diagnostic/cross-reference summaries, and never read local paths directly
9. Static-hosted 3D modules resolve browser `three` and `three/addons/` imports through the shell import map and the deployed `/node_modules/` asset tree

## WebMCP

The WebMCP layer is loaded by `src/main.mjs` after the controller is created.
It is dependency-free and feature-detects the current `document.modelContext`
API. If native support is unavailable, registration is skipped and the viewer
continues normally.

The app shell provides the production WebMCP origin-trial token for
`https://ecadforge.app/`. Local server responses and generated Apache deploys
set `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`, matching
Chrome's document-scoped WebMCP and default same-origin tools policy.

Registered tools operate only on loaded session documents. `design` arguments
can target `active`, a loaded document id, an exact loaded file name, or an
unambiguous loaded file base name. Current WebMCP browsers receive object-form
tool descriptors with `execute` handlers and read-only/untrusted-content
annotations. Older positional browser APIs remain supported with MCP-style JSON
text results.

The app WebMCP service owns session selection, source-format dispatch, bounded
list response shaping, design review, audit issue generation, BOM/component
search, compact net and pin summaries, focused diagnostics, BOM-to-PCB
comparison, schematic-to-PCB net cross-reference summaries, PCB placement/net
inspection, design-rule summaries, and fabrication-readiness checks. The
toolkit query services derive compact netlists from normalized schematic nets,
schematic/PCB component records, and BOM rows. PCB-only documents can still
provide component metadata, board summaries, design rules, and fabrication
signals when present, but schematic connectivity tools return a clear error if
schematic connectivity is unavailable.

## Styling

- `src/style.css` is the stylesheet entrypoint
- `src/styles/00-core.css` defines theme tokens
- `src/styles/10-layout.css` defines shell/layout primitives
- `src/styles/20-viewer.css` defines viewer-specific presentation
- `src/styles/30-scene3d.css` defines interactive 3D viewer presentation

## Server Endpoints

- `GET /`, `/demo/kicad`, `/demo/altium`, and supported query variants return the app shell and are resolved by browser startup logic; `view=` restores the active tab and `document=` restores the active loaded file path when present
- `GET /altium-pcbdoc-viewer`, `/altium-schdoc-viewer`, `/kicad-viewer-online`, `/kicad-project-viewer`, `/ecad-viewer-no-upload`, `/altium-kicad-browser-viewer`, `/pcb-3d-viewer-browser`, and `/bom-viewer-kicad-altium`: crawlable SEO landing pages
- `GET /api/health`: liveness check
- `GET /api/app-meta`: app metadata (version)
- `GET /api/app-meta.php`: PHP/shared-hosting alias when extensionless rewrites are unavailable
- `GET /robots.txt`: crawler policy that allows public app crawling and points to the production sitemap
- `GET /sitemap.xml`: production sitemap for the app shell and crawlable view URLs
- `GET /node_modules/*`: localhost alias for the browser dependency tree that FTP deployment publishes directly. Altium and KiCad Toolkit `.mjs` files are rewritten by the local server so module workers receive absolute browser dependency URLs without relying on the page import map.

## Static Deployment

The LIVE FTP workflow runs `npm run build:static` before uploading frontend files. That command copies `src/` into `.deploy-src/`, rewrites `index.html` to load `/style.css?v=<package version>` and `/main.mjs?v=<package version>`, rewrites local `.mjs` imports and known worker-safe package imports with the same version key, and emits a root `.htaccess` that applies no-store cache headers to browser assets on Apache/shared-hosting. The generated `.htaccess` first serves extensionless `.html` landing pages when they exist, then rewrites app routes such as `/demo/kicad`, `/demo/altium`, `/pcb`, and `/diagnostics` to `index.html` so route-driven viewer links return the app shell. The workflow uploads `.deploy-src/` to the document root, `api/` to `/api/`, `docs/` to `/docs/`, `package.json` to `/`, and production `node_modules/` to `/node_modules/` when dependency metadata changes.
