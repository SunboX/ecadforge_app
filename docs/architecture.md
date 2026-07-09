# Architecture

## Runtime Modules

- `src/index.html`: static viewer shell with file intake, tabs, and render anchors
- `src/main.mjs`: bootstrap and dependency wiring
- `src/AppController.mjs`: file intake, worker coordination, state transitions
- `src/AnalyticsTrackerLoader.mjs`: deployed-origin analytics tracker loader that disables production-key analytics on local/private dev origins
- `src/StartupSourceResolver.mjs`: route and query-string startup source detection
- `src/DemoProjectRegistry.mjs`: bundled demo metadata, source URLs, and license metadata
- `src/GitHubSourceLoader.mjs`: GitHub/GitLab raw/blob/tree URL loading, folder discovery, browser fetch handling, Gerber/CircuitJSON direct-source handling, and project-local KiCad model asset discovery
- `src/GitSourceUrlResolver.mjs`: Git host URL normalization and folder API entry resolution for GitHub and GitLab sources
- `src/PrivacySafeAnalytics.mjs`: event wrapper that emits activation, view, and WebMCP method-usage events without file names, raw URLs, contents, or WebMCP payload data
- `src/core/AppState.mjs`: normalized view state container
- `src/core/ecad/*.mjs`: format registry plus parser, renderer, and scene facades
- `src/core/simulation/*.mjs`: local SPICE simulation worker client and message contract
- `src/core/webmcp/*.mjs`: configured WebMCP runtime loader, adapter, and read-only loaded-session dispatch to toolkit-owned netlist query services
- `altium-toolkit/parser`: printable-run extraction, OLE/binary helpers, and normalized schematic/PCB model parsing
- `altium-toolkit/renderers`: deterministic schematic SVG, PCB SVG, and BOM HTML renderers
- `altium-toolkit/netlist-query`: normalized Altium netlist extraction, search validation, component grouping, and traversal rules
- `altium-toolkit/scene3d`: complete non-interactive Altium PCB 3D scene-description builders, board-outline refinement, silkscreen drill cutouts, and model registry logic
- `kicad-toolkit/parser`: KiCad 9 schematic/PCB/project loading and normalized model parsing
- `kicad-toolkit/renderers`: deterministic KiCad schematic SVG, PCB SVG, and BOM HTML renderers
- `kicad-toolkit/netlist-query`: normalized KiCad netlist extraction, search validation, component grouping, and traversal rules
- `kicad-toolkit/scene3d`: complete data-only KiCad PCB 3D scene-description builders, external placement metadata, copper text detail, and model registry logic
- `gerber-toolkit/parser`: Gerber/Excellon project loading, fabrication ZIP expansion, source-layer classification, and normalized fabrication models
- `gerber-toolkit/renderers`: deterministic Gerber PCB SVG rendering and PCB interaction helpers
- `gerber-toolkit/scene3d`: bare-board Gerber 3D scene-description builders from outline, copper, pad, and drill fabrication geometry
- `circuitjson-toolkit`: CircuitJSON parsing and local SPICE transient graph helpers for standards-native board, assembly, and simulation data
- `src/ui/AppView.mjs`: tab rendering, summary cards, diagnostics, and content mounting
- `src/ui/Scene3dRenderer.mjs`: ECAD Forge interactive 3D tab shell markup
- `src/ui/PcbScene3d*.mjs`: interactive Three.js controller, runtime, STEP importer, and local 3D interaction helpers
- `src/workers/ecad-parser.worker.mjs`: parser offload worker
- `src/workers/spice-simulation.worker.mjs`: local SPICE simulation offload worker
- `src/server.mjs`: local static server and metadata endpoints
- `src/StaticDeployBuilder.mjs`: Apache/shared-hosting artifact builder that rewrites static assets before FTP upload
- `scripts/build-static-deploy.mjs`: CLI wrapper that writes `.deploy-src/`
- `api/app-meta.php`: PHP metadata endpoint for FTP/shared-hosting deployments
- `api/.htaccess`: extensionless route rewrite for `/api/app-meta`

## Parse Strategy

The current parser is intentionally pragmatic:

1. Load native Altium files, KiCad files, Gerber/Excellon fabrication data, CircuitJSON documents, or project bundles in the browser
2. Extract long printable runs from Altium binary documents, read KiCad project entries, expand Gerber ZIP archives, or parse standalone CircuitJSON JSON
3. Parse pipe-delimited Altium-style key/value records, KiCad 9 S-expressions, Gerber/Excellon commands, or CircuitJSON objects from those sources
4. Normalize the recovered data into one shared viewer model with `sourceFormat` as an additive discriminator
5. Build additive schematic hierarchy, embedded-image, BOM, and connectivity metadata where supported
6. Feed schematic, PCB, BOM, interactive 3D, and diagnostics views from that normalized model. Schematic net diagnostics stay read-only and can emit staged geometry checks, restricted centerline crossings, supplemental island connection candidates, guideline-snapped elbow candidates, endpoint-preserving jog candidates, whole-island lane-shift candidates with obstacle-aware offsets, label relocation candidates, congested L-turn reroutes, merged-label trace detours, long-distance connection candidates, section-boundary connection candidates, balanced path-cleanup candidates, label placement rejection reasons, constrained label-orientation and power-label corner candidates, symbol body and pin-fit candidates, per-advisor candidate budgets, candidate decision timelines with score and collision-source metadata, stage health rows, and semantic same-side label groups. The PCB tab uses deterministic SVG renderers for normalized native boards, Gerber fabrication data, and standards-shaped element-array boards, including rich detail artwork, routed silkscreen and fabrication paths, aligned and knockout PCB text, shape-specific courtyard rows, in-board diagnostics, source-connectivity rats-nest overlays, source-net group metadata, trace-length budget labels, solder-mask/paste inspection layers, group outlines, and anchor-offset overlays, then applies app-local layer visibility, in-board object and component-side visibility settings, object opacity, component highlight, net hover/selection highlight, persistent diagnostic focus with related primitive previews, animated diagnostic viewport focus, reset/fit and opt-in hover-focus toolbar actions, sidebar candidate previews, and measurement overlays with bounds copy, zoom, selection, and clipped SVG/PNG export.

This is still not full binary reconstruction. It is a browser-first recovery strategy that mixes printable record parsing with targeted OLE stream access where the format clearly requires it, such as embedded schematic images, embedded PCB STEP payloads, and richer PCB stream recovery.

## Data Flow

1. User selects or drops Altium files, KiCad files, Gerber/Excellon files, fabrication ZIPs, CircuitJSON JSON, a KiCad project folder/ZIP, or companion model files
2. `AppController` stores any companion 3D assets in session state and posts supported design or fabrication files to the parser worker
3. `ecad-parser.worker.mjs` runs `EcadParserService`, which dispatches to the Altium, KiCad, Gerber, or CircuitJSON toolkit
4. The normalized document model, including diagnostics and additive connectivity metadata, is posted back to the main thread
5. `AppState` stores parse status, the recovered document models, selected components, selected nets, and session companion assets
6. `AppView` renders the active tab from the normalized model, applies selected symbol/footprint/net highlights, mounts the 2D PCB interaction controller for board selection, view settings, reset/fit, opt-in hover focus, visibility-aware hover/bounds candidate previews, persistent diagnostic focus, measurement actions, and clipped bounds exports, and mounts the interactive 3D controller when needed
7. The app uses `EcadScene3dService` to choose the Altium, KiCad, Gerber, or CircuitJSON scene-description path. Gerber documents render as fabrication-derived bare boards without component bodies. The local 3D runtime resolves embedded STEP payloads from the normalized PCB model first, falls back to companion STEP, WRL, GLB, GLTF, STL, or OBJ assets from the active session or hosted Git project folder, and can add matching remote model assets only when the missing-model search preference is enabled. KiCad library paths are fetched directly from the public KiCad 3D package library, with a same-folder package-index fallback for close package filename matches when exact model names are absent; generic component-source searches use the same-origin `/api/component-source/*` proxy. Whole-board assembly export reuses the same scene-description and model-resolution path, then writes mesh-derived STEP B-rep, WRL, GLTF, or GLB geometry for the board substrate, copper, silkscreen, pads, vias, resolved component models, and fallback bodies for unresolved models; mesh imports preserve translucent material alpha and OBJ sidecar material colors, and GLTF/GLB exports attach rendered top and bottom PCB artwork as configurable board-face textures when the active document can render PCB views.
8. `WebMcpRuntimeLoader` loads `@mcp-b/global` with same-origin tab and iframe transport options, preserving native WebMCP when present and providing package runtime support when native support is unavailable; `WebMcpAdapter` then registers read-only tools, awaits registration completion, and counts registration failures before startup continues; those tools query the current `AppState` snapshot, dispatch loaded documents to the matching toolkit query service, produce review/audit/search/diagnostic/cross-reference summaries, emit privacy-safe method-usage analytics, and never read local paths directly
9. SPICE simulation callers use `SpiceSimulationWorkerClient`, which posts netlist text to `spice-simulation.worker.mjs`; the worker delegates compatibility preprocessing, compatibility diagnostics, requested-plot diagnostics, and CircuitJSON transient graph shaping to `circuitjson-toolkit`, then returns complete simulation CircuitJSON, graph-only elements, graph summaries, and diagnostics without network access
10. Static-hosted 3D modules resolve browser `three` and `three/addons/` imports through the shell import map and the deployed `/node_modules/` asset tree

## WebMCP

The WebMCP layer is loaded by `src/main.mjs` after the controller is created.
`WebMcpRuntimeLoader` configures `@mcp-b/global` before importing it so tab and
iframe transports accept only the current page origin. The package runtime
preserves native `document.modelContext` support when present and provides the
runtime/polyfill path when native support is unavailable. If the package fails
to load, the viewer continues normally and WebMCP tool registration is skipped.

The app shell provides the production WebMCP origin-trial token for
`https://ecadforge.app/`. Local server responses and generated Apache deploys
set `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`, matching
Chrome's document-scoped WebMCP and default same-origin tools policy.

Registered tools operate only on loaded session documents. `design` arguments
can target `active`, a loaded document id, an exact loaded file name, or an
unambiguous loaded file base name. Current WebMCP browsers receive object-form
tool descriptors with `execute` handlers and read-only/untrusted-content
annotations. The adapter awaits registration promises returned by the
browser/runtime so cross-document publication errors are reported through
registration analytics. Older positional browser APIs remain supported with
MCP-style JSON text results.

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

- `GET /`, `/demo/kicad`, `/demo/altium`, and supported query variants return the app shell and are resolved by browser startup logic; `view=`, `document=`, `component=`, and `net=` restore the active tab, loaded file path, selected component, and selected net when present
- `GET /altium-pcbdoc-viewer`, `/altium-schdoc-viewer`, `/kicad-viewer-online`, `/kicad-project-viewer`, `/ecad-viewer-no-upload`, `/altium-kicad-browser-viewer`, `/pcb-3d-viewer-browser`, and `/bom-viewer-kicad-altium`: crawlable SEO landing pages
- `GET /api/health`: liveness check
- `GET /api/app-meta`: app metadata (version)
- `GET /api/app-meta.php`: PHP/shared-hosting alias when extensionless rewrites are unavailable
- `GET /api/component-source/search`: same-origin component-source search proxy for optional 3D model lookup
- `GET /api/component-source/components/:id`: same-origin component-source detail proxy
- `GET /api/component-source/models/:id.step`: same-origin component-source STEP download proxy
- `GET /api/component-source.php?path=...`: PHP/shared-hosting alias for the same component-source proxy paths; the upstream timeout defaults to 5 seconds and can be tuned with `ECAD_FORGE_COMPONENT_SOURCE_TIMEOUT_SECONDS`
- `GET /robots.txt`: crawler policy that allows public app crawling and points to the production sitemap
- `GET /sitemap.xml`: production sitemap for the app shell and crawlable view URLs
- `GET /node_modules/*`: localhost alias for the browser dependency tree that FTP deployment publishes directly. Toolkit `.mjs` files are rewritten by the local server so module workers receive absolute browser dependency URLs without relying on the page import map.

## Static Deployment

The LIVE FTP workflow runs `npm run build:static` before uploading frontend files. That command copies `src/` into `.deploy-src/`, copies the required browser dependency modules into `.deploy-src/node_modules/`, including the bundled `@mcp-b/global` runtime, rewrites `index.html` to load `/style.css?v=<package version>` and `/main.mjs?v=<package version>`, rewrites local `.mjs` imports and known worker-safe package imports with the same version key, and emits a root `.htaccess` that applies no-store cache headers to browser assets on Apache/shared-hosting. The generated `.htaccess` first serves extensionless `.html` landing pages when they exist, then rewrites app routes such as `/demo/kicad`, `/demo/altium`, `/pcb`, and `/diagnostics` to `index.html` so route-driven viewer links return the app shell. The workflow uploads `.deploy-src/` to the document root, `api/` to `/api/`, `docs/` to `/docs/`, and `package.json` to `/`; the processed browser module tree reaches `/node_modules/` only through the `.deploy-src/` artifact upload.
