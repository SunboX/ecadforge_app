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
- `src/core/AppState.mjs`: normalized view state container and explicit
  changed-root publisher for self-adjusting render propagation
- `src/core/ecad/*.mjs`: format registry, common parser/project facade, and
  shared CircuitJSON context/render/interaction/scene services
- `src/core/simulation/*.mjs`: local SPICE simulation worker client and message contract
- `src/core/webmcp/*.mjs`: configured WebMCP runtime loader, adapter, and read-only loaded-session dispatch to toolkit-owned netlist query services
- Toolkit roots: the same 18 common parser, project, document-context,
  renderer, interaction, query, manufacturing, simulation, scene,
  capabilities, units, error, and self-adjusting-computation classes across
  all four source packages
- Toolkit `/extensions`: retained source-native renderers, query helpers,
  workers, extension resolvers, and detailed inspection APIs used only when no
  source-neutral equivalent exists
- `circuitjson-toolkit`: immutable CircuitJSON documents, reusable indexes and
  derived caches, deterministic rendering and interaction, manufacturing,
  local simulation, canonical scene preparation, and the shared synchronous
  dynamic-dependency runtime with reverse reader lists, ordered propagation,
  and trace reclamation. Version 1.4.0 divides
  trusted structured-clone adoption into bounded traversal, binary-protection,
  and property-locking slices while the default preparation path retains exact
  defensive binary-value handling.
- `src/ui/AppView.mjs`: tab rendering, summary cards, diagnostics, and content mounting
- `src/ui/AppViewRenderGraph.mjs`: six named state-to-DOM computations with
  selective atomic inputs and from-scratch-compatible trace reuse
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
2. Pass intact source/project entries to the owning toolkit; source libraries
   decode Altium containers, KiCad projects/ZIPs, Gerber packages, and
   standalone CircuitJSON
3. Parse pipe-delimited Altium-style key/value records, KiCad 9 S-expressions, Gerber/Excellon commands, or CircuitJSON objects from those sources
4. Normalize shared data as CircuitJSON, accepting canonical document
   envelopes with `source.format` and retained native compatibility arrays with
   `sourceFormat`
5. Keep normal app state canonical while explicitly retaining source-native
   extensions for fidelity-sensitive operations. The Altium and KiCad
   extension resolvers select their native schematic renderer before the
   canonical fallback. KiCad native PCB rendering, hit testing, and interaction
   layers follow the same rule. No native rows are copied onto the document
   envelope, and the app does not clone or rewrite source renderer models.
6. Build additive BOM and connectivity metadata where supported
7. Feed schematic, PCB, BOM, interactive 3D, and diagnostics views from the
   common document envelope. BOM and shared services consume CircuitJSON.
   Fidelity-sensitive Altium/KiCad 2D views use the retained native extension;
   documents without a native extension use the canonical renderer. The KiCad
   3D path intentionally remains canonical for its smaller preparation graph
   and faster worker transfer. Schematic net diagnostics stay read-only and can emit staged geometry checks, restricted centerline crossings, supplemental island connection candidates, guideline-snapped elbow candidates, endpoint-preserving jog candidates, whole-island lane-shift candidates with obstacle-aware offsets, label relocation candidates, congested L-turn reroutes, merged-label trace detours, long-distance connection candidates, section-boundary connection candidates, balanced path-cleanup candidates, label placement rejection reasons, constrained label-orientation and power-label corner candidates, symbol body and pin-fit candidates, per-advisor candidate budgets, candidate decision timelines with score and collision-source metadata, stage health rows, and semantic same-side label groups. The PCB tab uses deterministic SVG renderers for normalized native boards, Gerber fabrication data, and standards-shaped element-array boards, including rich detail artwork, routed silkscreen and fabrication paths, aligned and knockout PCB text, shape-specific courtyard rows, in-board diagnostics, source-connectivity rats-nest overlays, source-net group metadata, trace-length budget labels, solder-mask/paste inspection layers, group outlines, and anchor-offset overlays, then applies app-local layer visibility, in-board object and component-side visibility settings, object opacity, component highlight, net hover/selection highlight, persistent diagnostic focus with related primitive previews, animated diagnostic viewport focus, reset/fit and opt-in hover-focus toolbar actions, sidebar candidate previews, and measurement overlays with bounds copy, zoom, selection, and clipped SVG/PNG export.

This is still not full binary reconstruction. It is a browser-first recovery strategy that mixes printable record parsing with targeted OLE stream access where the format clearly requires it, such as embedded schematic images, embedded PCB STEP payloads, and richer PCB stream recovery.

## Data Flow

1. User selects or drops Altium files, KiCad files, Gerber/Excellon files, fabrication ZIPs, CircuitJSON JSON, a KiCad project folder/ZIP, or STEP/STP, WRL/VRML, GLB/GLTF, STL, OBJ, and 3MF companion model files
2. `AppController` classifies every supported companion format, including 3MF
   and the distinct `.vrml` format, stores the unchanged 3D asset in session
   state, and posts supported design or fabrication files to the parser worker
3. `ecad-parser.worker.mjs` runs `EcadParserService`, which dispatches through
   each toolkit's identical common `Parser` or `ProjectLoader` contract. ZIP
   ownership is content-checked, and generic model companions are routed with
   each active project owner. Independent format groups run concurrently and
   are folded back into stable toolkit order. Local Altium, KiCad, and
   CircuitJSON groups use bounded full asset decoding so viewer/export
   consumers receive real bytes. The app owns this single outer parser worker
   and disables toolkit worker nesting only inside
   `ecad-parser.worker.mjs`; direct service and hero-preview callers retain the
   common toolkit `worker: 'auto'` behavior. KiCad requests include the public
   `kicad.native-model` extension so the same returned document supports both
   common services and exact native rendering.
4. The document model, including diagnostics and additive connectivity
   metadata, is posted back to the main thread; canonical envelopes keep
   CircuitJSON in `model`. After the browser completes this structured-clone
   boundary, `AppControllerParserData` adopts only canonical documents through
   `CircuitJsonDocumentContext.prepareStructuredCloneAsync`. Large native
   extension traversal and sealing, successive documents, and the first
   consumer render have cooperative scheduling boundaries so a large completed
   worker result does not become one multi-second main-thread task. The app
   explicitly transfers exclusive ownership of the already isolated browser
   clone, which is adopted and deeply frozen without another full extension
   copy. Concurrent consumers share preparation. Cancellation stops
   only that caller's wait; progressively sealed shared work completes so a
   later consumer can never inherit a partially adopted graph. A rejected host
   scheduler falls back to a zero-delay browser task, while a terminal
   structural failure remains cached for that document identity so partially
   sealed data is never restarted. Synchronous context entry points reject a
   document while its asynchronous adoption is in progress. Parser-worker
   terminal replies must carry the exact active request id, so stale or id-less
   messages cannot settle a newer request. Controller disposal advances a
   lifecycle generation before rejecting pending requests, preventing queued
   success and error continuations from publishing state afterward.
   Direct service calls, main-thread fallback results, and retained native
   compatibility documents continue through the exact defensive context
   preparation path. KiCad `${KIPRJMOD}`
   model references resolve from
   the owning `.kicad_pro` directory (or board directory when project metadata
   is absent) and link canonical `cad_component` rows to the exact project
   asset name. Canonical schematic image elements similarly resolve exact
   document asset bytes through `asset_id`. Each visible native model stays separate, parsed board thickness
   sets its top/bottom surface height, and model-local transforms remain
   independent from footprint board placement.
5. `AppState` stores parse status, recovered document models, selected
   components, selected nets, and session companion assets. Its mutators
   publish a conservative set of changed snapshot roots, including derived
   active-document roots when document membership or selection changes.
6. `AppController` forwards each snapshot and change set to `AppView`.
   `AppViewRenderGraph` starts with reverse readers of the changed roots,
   validates their exact dynamic dependencies, and re-executes only affected
   status, locale, viewer-mode, tab, sidebar, or content stages. Successful
   re-execution replaces the old trace and abandoned control-flow edges;
   unaffected DOM work remains mounted. Parsed documents and document scopes
   remain raw identity dependencies rather than traversed proxy graphs.
7. `AppView` renders the active tab from the normalized model, applies selected
   symbol/footprint/net highlights, mounts the 2D PCB interaction controller for
   board selection, view settings, reset/fit, opt-in hover focus,
   visibility-aware hover/bounds candidate previews, persistent diagnostic
   focus, measurement actions, and clipped bounds exports, and mounts the
   interactive 3D controller when needed. A PCB render performs no up-front
   interaction primitive preparation when the toolbar is hidden and neither
   measurement nor diagnostic focus is active. The common resolved-key path
   therefore builds no primitive model. When a consumer is active, the renderer
   prepares one model and shares it with the toolbar, measurement overlay,
   diagnostic focus, and compatibility fallback. Component-side attributes use
   already resolved document component rows in the common single-pass path;
   only unresolved native renderer keys can request interaction data and a
   second compatibility pass.
8. The app reuses one `CircuitJsonDocumentContext` for canonical or
   source-neutral documents across 2D rendering, interaction, and 3D scene
   preparation. `EcadScene3dService` routes canonical envelopes directly
   through the CircuitJSON adapter; the viewer retains the source format and
   resolves document and session CAD assets. Missing CircuitJSON
   solder-mask-opening flags mean covered copper, while explicit openings are
   exposed. Gerber documents render as fabrication-derived bare
   boards without component bodies. Routed plated slots retain their canonical
   polygon pad extents, pill drill dimensions, and one board-space rotation
   through the shared CircuitJSON hole primitive model. Disjoint Gerber profile
   loops remain separate viewer and export substrates. Ambiguous dark inner
   mechanical geometry becomes a cutout only when it is authored as a region
   or a source-order-continuous closed path. Authoritative X2 profile files can
   still recover unordered shared-vertex contours, and explicit clear geometry
   remains authoritative. Parser-owned draw-run identifiers preserve move,
   polarity, region, and step-repeat boundaries; non-cutout contours remain
   transparent while the indexed containment tree searches their descendants.
   This topology is resolved by Gerber Toolkit before
   the app passes the canonical CircuitJSON document to the viewer. The local 3D runtime resolves embedded
   STEP payloads from the normalized PCB model first, then accepts companion
   STEP/STP, WRL/VRML, GLB/GLTF, STL, OBJ, or 3MF assets from the canonical
   document, active session, or hosted Git project folder. The viewer attaches
   safe project-relative GLTF BIN, OBJ MTL, and WRL texture resources directly
   and keys model/group/request caches by exact source identity, so equal
   basenames in different folders cannot collide. Downloaded format substitutes
   keep the exact authored model path as an explicit asset alias, and
   missing-model lookup caches are scoped to one parsed document so equal model
   names cannot leak across projects. Downloaded assets carry an opaque
   document identity through state snapshots; project/local assets remain
   unscoped and reusable. URL paths remain case-sensitive, and same-path assets
   with conflicting source or payload provenance remain separate. Failed or
   empty lookups are evicted for a later retry. No URL-backed model is loaded
   unless missing-model search or an export caller supplies an explicit fetch
   policy. KiCad library paths are fetched
   directly from the public KiCad 3D package library, with a same-folder
   package-index fallback for close package filename matches when exact model
   names are absent; generic component-source searches use the same-origin
   `/api/component-source/*` proxy. Whole-board assembly export reuses the same
   scene-description and model-resolution path, then writes mesh-derived STEP
   B-rep, WRL, GLTF, or GLB geometry for the board substrate, copper,
   silkscreen, pads, vias, resolved component models, and fallback bodies for
   unresolved models; mesh imports preserve translucent material alpha, vertex
   colors, and OBJ sidecar materials, and GLTF/GLB exports attach rendered top
   and bottom PCB artwork as configurable board-face textures when the active
   document can render PCB views. The viewer's raw-model ZIP path preserves all
   source formats, including 3MF, without converting them.
9. `WebMcpRuntimeLoader` loads `@mcp-b/global` with same-origin tab and iframe transport options, preserving native WebMCP when present and providing package runtime support when native support is unavailable; `WebMcpAdapter` then registers read-only tools, awaits registration completion, and counts registration failures before startup continues; those tools query the current `AppState` snapshot, dispatch loaded documents to the matching toolkit query service, produce review/audit/search/diagnostic/cross-reference summaries, emit privacy-safe method-usage analytics, and never read local paths directly
10. SPICE simulation callers use `SpiceSimulationWorkerClient`, which posts netlist text to `spice-simulation.worker.mjs`; the worker delegates compatibility preprocessing, compatibility diagnostics, requested-plot diagnostics, and CircuitJSON transient graph shaping to `circuitjson-toolkit`, then returns complete simulation CircuitJSON, graph-only elements, graph summaries, and diagnostics without network access
11. Static-hosted 3D modules resolve browser `three` and `three/addons/` imports through the shell import map and the deployed `/node_modules/` asset tree

## Self-Adjusting Render Propagation

The render path applies the dynamic-dependence and change-propagation model
from the self-adjusting-computation literature at an app-owned granularity.
`AppState` is the mutator and `AppViewRenderGraph` consumes the shared
`circuitjson-toolkit` self-adjusting core.
The first render builds traces from actual snapshot reads. Later state events
use changed-root reader lists to skip unrelated stages without scanning their
dependencies. Potentially affected stages compare only previously observed
values, structure, presence, and atomic identities before deciding whether to
re-execute.

Stage order is fixed because DOM writes are observable. Within each stage,
dynamic branching determines the current trace: a successful re-execution
removes the previous reverse edges and installs the new ones. Failed or async
computations cannot replace a successful trace. Named traces replace rather
than accumulate history, and can be forgotten or cleared explicitly, bounding
runtime storage by the active render graph.

The selective boundary deliberately treats prepared ECAD documents and opaque
document scopes as atomic. They are immutable identity-bearing inputs owned by
the parser/toolkit layer, where proxy traversal would break native receivers
or `WeakMap` caches and would add first-run work disproportionate to UI state
changes. Tests compare propagated outputs with fresh runtime execution across
value, structural, deletion, and control-flow changes.

The persistent `pcb-scene3d-viewer` runtime applies the same shared core to
ordered render-group and per-component visibility effects. Toggle fields are
fine-grained modifiables; revision roots conservatively represent structural
changes inside atomic maps and sets. Copper-only changes can therefore reuse
component visibility, while selection or hidden-component changes can reuse
render-group visibility. Parser toolkits retain format-owned one-shot parsing
and expose the canonical runtime by identity for future editable input models.

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
- `GET /node_modules/*`: localhost alias for the browser dependency tree that FTP deployment publishes directly. Toolkit `.mjs` files and browser `.js` dependencies are rewritten by the local server so module workers receive versioned absolute browser dependency URLs without relying on the page import map. `/node_modules/@sunbox/occt-import-js/dist/*` is served first from the installed package and remains byte-for-byte unchanged, including its ESM factory, WASM, and package-owned worker.

## Static Deployment

The LIVE FTP workflow runs `npm run build:static` before uploading frontend files. That command copies `src/` into `.deploy-src/`, copies the required browser dependency modules into `.deploy-src/node_modules/`, including the bundled `@mcp-b/global` runtime and the installed `@sunbox/occt-import-js/dist/` tree, rewrites `index.html` to load `/style.css?v=<package version>` and `/main.mjs?v=<package version>`, rewrites local `.mjs` imports and known worker-safe package imports with the same version key, and emits a root `.htaccess` that applies no-store cache headers to browser assets on Apache/shared-hosting. Generated OCCT JavaScript, worker, and WASM assets are copied without rewriting. The generated `.htaccess` first serves extensionless `.html` landing pages when they exist, then rewrites app routes such as `/demo/kicad`, `/demo/altium`, `/pcb`, and `/diagnostics` to `index.html` so route-driven viewer links return the app shell. The workflow uploads `.deploy-src/` to the document root, `api/` to `/api/`, `docs/` to `/docs/`, and `package.json` to `/`; the processed browser module tree reaches `/node_modules/` only through the `.deploy-src/` artifact upload.
