# ECAD Library Exporter Design

## Context

ECAD Forge already renders interactive PCB 3D scenes from normalized Altium,
KiCad, and CircuitJSON models. The 3D path can use embedded Altium STEP
payloads and session-provided STEP or WRL companion files. Missing component
models currently fall back to procedural bodies.

The requested feature automatically searches for missing PCB component 3D
models and adds a checkbox that disables this behavior. The scope was expanded
to include the full library exporter surface in the local toolkit libraries, not
just the missing-model lookup.

Reference exporter behavior includes LCEDA/LCSC component search, STEP and
OBJ/MTL download, raw EasyEDA source export, Altium `.SchLib` export, Altium
`.PcbLib` export, STEP embedding in PCB libraries, batch export, merged library
output, append-to-merged-library, progress reporting, checkpoint resume, and
retry of transient request failures.

## Goals

- Add a full ECAD library exporter surface to the local library ecosystem.
- Keep Altium library writing in `../altium-toolkit`.
- Keep generic 3D model archive and model-loading mechanics in
  `../pcb-scene3d-viewer`.
- Keep `../kicad-toolkit` unchanged unless shared scene-model contract gaps are
  discovered.
- Add an ECAD Forge checkbox to control automatic missing-model lookup for PCB
  3D rendering.
- Preserve ECAD Forge's local-first defaults by making outbound network behavior
  explicit, injectable, documented, and user-controlled.

## Non-Goals

- Do not add KiCad-native library export in this pass.
- Do not add host app UI, drag/drop, file picker, or download orchestration to
  `altium-toolkit`.
- Do not call global `fetch` implicitly from toolkit code.
- Do not special-case customer files, source project names, fixture file names,
  component labels, or vendor-specific text in production parser or exporter
  rules.
- Do not require a server-side conversion service for ECAD Forge rendering.

## Package Boundaries

### `../altium-toolkit`

`altium-toolkit` owns the Altium export domain:

- LCEDA/EasyEDA HTTP client abstractions.
- Search by keyword, part name, and LCSC ID.
- Symbol, footprint, and 3D model source download.
- Normalized EasyEDA component bundle model.
- Raw EasyEDA source bundle export.
- Altium schematic library writer for `.SchLib`.
- Altium PCB footprint library writer for `.PcbLib`.
- STEP embedding when upstream STEP data is available.
- OBJ/MTL asset export for source bundles when available.
- Batch export orchestration.
- Merged library output.
- Append mode for existing merged library outputs.
- Per-part progress events.
- Retry policy for transient network failures.
- Checkpoint/resume for non-merged batch exports.

### `../pcb-scene3d-viewer`

`pcb-scene3d-viewer` continues to own reusable 3D runtime and archive behavior:

- Existing STEP/WRL load and placement behavior.
- Existing model ZIP archive export for resolved scene models.
- Optional small adapter hooks only if downloaded STEP/OBJ assets need a common
  scene-model asset shape.

### `ecadforge_app`

ECAD Forge owns product UI and state:

- Checkbox for automatic missing-model search.
- User-facing copy and diagnostics describing outbound model lookup.
- Wiring from unresolved 3D component models to the toolkit search/download API.
- Fallback to procedural bodies when search, download, or placement fails.
- Security, privacy, README, and specification updates for outbound behavior.

### `../kicad-toolkit`

No planned changes in this pass. KiCad scenes can consume downloaded model assets
through existing scene asset contracts if ECAD Forge provides them.

## Data Flow

1. `LcedaComponentClient.search(query, options)` searches LCEDA/LCSC by keyword,
   part name, or LCSC ID.
2. `LcedaComponentClient.fetchBundle(candidate, options)` downloads EasyEDA
   symbol JSON, footprint JSON, model metadata, STEP, and OBJ/MTL where
   available.
3. `EasyEdaComponentBundleNormalizer.normalize(rawBundle)` converts raw
   responses into a deterministic internal bundle.
4. `EasyEdaSourceBundleExporter.export(bundle, options)` writes source JSON,
   model files, and a manifest.
5. `AltiumSchLibExporter.export(bundleOrBundles, options)` writes schematic
   library bytes.
6. `AltiumPcbLibExporter.export(bundleOrBundles, options)` writes PCB footprint
   library bytes and embeds STEP when available.
7. `AltiumLibraryBatchExporter.export(ids, options)` handles batch export,
   merged output, append mode, retries, progress callbacks, and checkpoints.
8. ECAD Forge uses only the missing-model subset: derive search candidates from
   component metadata, fetch the best available model bundle, expose the
   downloaded model as a scene asset, and let the existing 3D renderer place it.

## Public API Sketch

```js
const client = new LcedaComponentClient({
    fetcher,
    baseUrl,
    retryPolicy
})

const candidates = await client.search('C2040', { limit: 5 })
const rawBundle = await client.fetchBundle(candidates[0])
const bundle = EasyEdaComponentBundleNormalizer.normalize(rawBundle)

const sourceExport = await EasyEdaSourceBundleExporter.export(bundle)
const schLibBytes = await AltiumSchLibExporter.export(bundle)
const pcbLibBytes = await AltiumPcbLibExporter.export(bundle, {
    embedStep: true
})

await AltiumLibraryBatchExporter.export(['C2040', 'C1234'], {
    client,
    outputMode: 'merged',
    libraryName: 'GeneratedParts',
    append: true,
    continueOnError: true,
    onProgress(progress) {}
})
```

APIs return bytes, manifests, and structured result objects. They do not create
browser downloads or write host filesystem paths directly unless a Node-specific
adapter is added later.

## Normalized Bundle Shape

The normalized EasyEDA bundle should include:

- `source`: service, source IDs, LCSC ID, EasyEDA identifiers, fetched URL
  metadata, and timestamps when supplied by caller.
- `part`: manufacturer part number, title, value, package, description, and
  category fields when available.
- `symbol`: pins, labels, graphics, parameters, and pin-to-pad intent.
- `footprint`: pads, tracks, arcs, fills, regions, silkscreen, courtyard or
  mechanical primitives, and origin data.
- `models`: STEP assets, OBJ/MTL assets, model transforms, checksums when
  available, and source format metadata.
- `diagnostics`: warnings for missing symbol, missing footprint, missing model,
  unsupported primitive, or lossy conversion.

The bundle is service-neutral enough for tests and future clients, but the first
implementation targets LCEDA/EasyEDA fields.

## ECAD Forge Integration

The 3D panel gains a checkbox named along the lines of "Auto-search missing 3D
models". Its default needs to preserve local-first expectations. The checkbox
controls only outbound lookup, not visibility of already resolved external
models. Existing `external-models`, `fallback-bodies`, and `copper` toggles keep
their current meaning.

When enabled:

- Scene preparation identifies components without `externalModel` or explicit
  external placement.
- Search terms are derived from generic component metadata such as LCSC ID,
  manufacturer part number, source, pattern, value, and package fields.
- The app limits concurrent requests and caches lookup results per session.
- Successful model downloads are exposed as normal scene assets.
- Failures become diagnostics and procedural fallbacks remain visible.

When disabled:

- No LCEDA/EasyEDA search or model download requests are made.
- Existing embedded and session companion models continue to work.

## Privacy And Network Behavior

- Toolkit network clients require an injected `fetcher`.
- ECAD Forge only injects browser `fetch` when the checkbox is enabled.
- The UI explains that enabling lookup sends component identifiers to the model
  source.
- No complete board file, schematic file, PCB source text, or local path is sent
  for missing-model lookup.
- Documentation updates must revise current "no outbound network calls" wording
  to distinguish default local parsing from optional model lookup.

## Error Handling

- Search misses return empty candidate sets and a diagnostic.
- HTTP errors, rate limits, malformed JSON, and missing model assets are
  recoverable per component.
- Batch export can continue on error and returns per-part result entries.
- Retry policy is limited to transient failures and has deterministic testable
  backoff inputs.
- Checkpoints store completed IDs, failed IDs, source bundle hashes, and output
  manifest data so resumed runs avoid duplicate work.
- Append mode reads existing output manifests and skips already-exported LCSC
  IDs.

## Testing Strategy

All tests use fake LCEDA/EasyEDA responses and repo-owned fake component data.

`altium-toolkit`:

- Client tests for search, fetch, retry, rate-limit, and malformed response
  behavior with injected fake fetchers.
- Normalizer tests for symbol, footprint, source, and model bundle contracts.
- Source bundle exporter tests for deterministic manifest and asset names.
- `.SchLib` writer tests for deterministic library structure.
- `.PcbLib` writer tests for deterministic footprint records and STEP embedding
  metadata.
- Batch tests for merged output, append skipping, progress events,
  continue-on-error, and checkpoint resume.

`pcb-scene3d-viewer`:

- Only add tests if a shared downloaded-asset adapter is needed.
- Existing model archive export tests should continue to pass.

`ecadforge_app`:

- State and UI tests for checkbox rendering and disabled default behavior.
- Controller tests that disabled mode performs no model-search calls.
- Enabled-mode tests that unresolved components call the search client through
  injected fetch and produce scene assets or diagnostics.
- 3D preparation tests that procedural fallback remains when lookup fails.

Each changed repo must pass `npm test` before the implementation is considered
complete.

## Risks

- Altium `.SchLib` and `.PcbLib` binary writing is the highest-risk area because
  exact compatibility with Altium Designer needs careful validation.
- LCEDA/EasyEDA APIs may change or enforce rate limits. The client must isolate
  API assumptions and provide diagnostics.
- Automatically chosen 3D models may not align perfectly with recovered PCB
  footprints. The renderer must keep fallback bodies and diagnostics available.
- ECAD Forge copy and docs must be precise so optional outbound requests do not
  weaken the local-first promise.

## Open Implementation Notes

- Prefer small, separately tested exporter modules over one large exporter file.
- Add public exports through existing package entrypoints only after focused API
  tests define the contract.
- Because `../altium-toolkit` currently has unrelated uncommitted schematic
  work, implementation should either wait for that work to settle or keep edits
  in new exporter files plus entrypoint/doc/test files that do not overlap.
