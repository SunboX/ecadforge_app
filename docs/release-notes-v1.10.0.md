# ECAD Forge 1.10.0

Version 1.10.0 adopts the converged ECAD toolkit release family and its
CircuitJSON-first service boundary.

## API and dependency changes

- Updates `circuitjson-toolkit` to 1.1, `gerber-toolkit` to 0.2,
  `altium-toolkit` to 1.2.1, `kicad-toolkit` to 1.1,
  `pcb-scene3d-viewer` to 1.2.1, and `@sunbox/occt-import-js` to 0.0.28.
- Altium Toolkit keeps Three.js as an example-only development dependency, so
  the app installs one viewer-owned Three.js runtime instead of two versions.
- Native APIs retained by a source toolkit are imported from its explicit
  `/extensions` entrypoint. The app no longer relies on the former native
  `/parser`, `/renderers`, `/netlist-query`, or `/scene3d` export shapes.
- Normal file and project intake now calls the identical common
  `Parser.parse({ fileName, data })`, `ProjectLoader.loadAsync()`, and
  `ProjectLoader.supports()` APIs in all four toolkits. ZIP expansion,
  project-parameter resolution, validation, and partial project diagnostics
  remain owned by the source libraries.
- The import map and static browser asset versioner mirror all common toolkit
  subpaths across the four packages, including `/extensions`; obsolete
  `netlist-query` and source-specific worker aliases are no longer mapped.
- `earcut` is pinned to 3.0.2 so deterministic PCB triangulation does not
  change through npm deduplication.

## CircuitJSON-first runtime

- Canonical `ecad-toolkit.document.v1` envelopes retain their native source
  identity while routing 2D rendering, PCB interaction, BOM derivation, and 3D
  adaptation through shared CircuitJSON services.
- Altium and KiCad schematic intake projects recovered rectangles, ellipses,
  arcs, Beziers, polygons, text frames, tables, hierarchy sheet symbols, and
  asset-backed images into canonical CircuitJSON. The app renders those
  elements and exact image bytes through the shared renderer without a native
  renderer branch, copied fields, or source-specific adapter.
- Altium project strings now arrive resolved in both canonical and explicitly
  retained native models. Hidden designators are resolved during canonical
  projection, replacing the app's former render-only clone-and-blank helper.
- `EcadCircuitJsonContext` caches one
  `CircuitJsonDocumentContext` per loaded document. Rendering, interaction,
  and scene preparation reuse validation, indexes, and derived data.
- Explicitly supplied native hybrid arrays keep their format-specific extension
  path, while every document produced by normal app parsing stays canonical.
- `pcb-scene3d-viewer` consumes canonical `model_asset`, document assets, and
  session assets directly. ECAD Forge no longer promotes asset URLs or wraps
  the viewer resolver.
- Gerber plated routed slots flow unchanged through the canonical
  `hole_with_polygon_pad` model. The viewer uses shared rotation-local pad
  extents and pill drill dimensions, so a 2.6 by 0.6 mm slot no longer appears
  as a 1 by 1 mm circular pad.
- Horizontal, diagonal, and vertical slot angles now remain board-space through
  Gerber, CircuitJSON, and viewer drill geometry, with no double rotation.
- Disjoint Gerber profile loops remain separate viewer and assembly-export
  substrates. KiCad ZIPs are no longer claimed by Gerber routing.
- Local Altium, KiCad, and CircuitJSON projects request bounded full asset
  decoding; ZIP and directory model companions retain exact bytes for the
  viewer and exporters.
- Hosted Git project companions now enter the same canonical asset boundary
  through `data`, with their exact project-relative path and source URI. The
  former app-only `bytes` shape is removed, preventing empty model blobs after
  GitHub or GitLab project loading.
- KiCad `${KIPRJMOD}` references now project to canonical `cad_component`
  assets from the owning `.kicad_pro` directory, using the board directory only
  when project metadata is absent. Expanded ZIP and directory-upload paths stay
  exact. Footprint board placement stays separate from model-local offset,
  rotation, and scale.
  Multiple visible footprint models retain independent rows, and parsed board
  thickness supplies the correct top/bottom surface height, so the viewer
  resolves real bytes without path or transform adapters.
- Independent Altium, CircuitJSON, Gerber, and KiCad project groups now parse
  concurrently. Result folding remains deterministic, reducing mixed-upload
  latency without changing document, diagnostic, or asset ordering.
- Stable asset deduplication upgrades metadata-only duplicates to the matching
  full canonical payload, so mixed Gerber/KiCad sessions cannot discard model
  bytes because of toolkit processing order.

## Direct 3D viewer contract

- The app and viewer now consume the installed OCCT ESM factory, WASM, and
  package-owned worker directly from
  `/node_modules/@sunbox/occt-import-js/dist/`. The local server and static
  build copy the same package bytes; the former vendored runtime, tarball,
  custom worker, global-script fallback, and path aliases are removed.
- The optimized importer runs in a persistent worker when available and uses a
  direct ESM import when workers are unavailable. ECAD Forge no longer owns an
  OCCT integration shim that can drift from the viewer package contract.
- Live models accept STEP/STP, WRL/VRML, GLB/GLTF, STL, OBJ, and 3MF from
  canonical text/bytes, document assets, session files, or explicitly enabled
  URLs. Text-capable formats accept both `text`/`payloadText` and string `data`.
- The app format registry now recognizes `.3mf` and preserves `.vrml` as a
  distinct first-class format during direct selection, project/folder
  collection, archive loading, and session restore. Exact source bytes reach
  the viewer through the same path as STEP, WRL, GLTF, STL, and OBJ.
- Safe project-relative GLTF BIN, OBJ MTL, and WRL texture references resolve
  from document/session assets with session priority. Parent traversal,
  absolute references, and implicit WRL texture networking are blocked.
- Remote main models and sidecars require an explicit viewer/export fetch
  policy. Shared request caches reuse successful STEP, WRL, and 3MF loads and
  evict rejected requests so a later retry can succeed.
- Model group, STEP parse, request, and raw archive identities prefer exact
  canonical paths, source streams, or asset IDs. Same-basename assets in
  different directories remain distinct; repeated exact sources are reused.
- Raw model ZIP export preserves every source extension, including 3MF, and
  accepts canonical text, byte, file, and explicitly enabled URL payloads.
  The controller forwards the same loader policy to rendering and export and
  derives archive names from canonical `source.fileName` when available.
- Canonical shell BOM counts use the toolkit BOM grouping contract. The empty
  raw-model export diagnostic is now format-neutral.

## Breaking integration changes

The app package advances from 1.9.31 to 1.10.0. Integrations that import
retained native toolkit names must use the toolkit `/extensions` entrypoint.
Canonical documents expose their elements through `model` and their source
metadata through `source`; ECAD Forge accepts both those envelopes and retained
legacy document arrays. Canonical inputs now bypass app/source-specific scene
builders and asset resolver wrappers. Viewer integrations that injected a WRL
loader receive sanitized texture data with an empty resource base path; use
`modelLoaderOptions` for any authorized URL fetches.
