# PCB Embedded STEP Design

**Problem**

The current 3D viewer can render the PCB substrate, copper detail, procedural fallback bodies, and externally loaded `WRL` models. It still does not render embedded `STEP` models when the user opens only a lone `.PcbDoc`. That leaves many boards visually incomplete even though the native Altium container already carries model payloads and placement metadata.

The target behavior is:

- a lone `.PcbDoc` should render any embedded `STEP` package models it contains
- externally loaded `.step` or `.stp` files should keep working through the same placement pipeline
- extraction and rendering should remain generic, local-first, and board-agnostic

**Observed File Structure**

The referenced sample board is an OLE Compound Document, not the ZIP-style container used by some newer Altium workflows. The relevant streams are:

- `Models/<n>`: zlib-compressed payloads that inflate directly into `ISO-10303-21` STEP text
- `Models/Data`: compact model metadata records, including `ID`, `CHECKSUM`, `NAME`, `ROTX`, `ROTY`, `ROTZ`, and `DZ`
- `ComponentBodies6/Data` and `ShapeBasedComponentBodies6/Data`: per-placement model references and 3D placement metadata, including `MODELID`, `MODEL.CHECKSUM`, `MODEL.EMBED`, `MODEL.NAME`, `MODEL.2D.X`, `MODEL.2D.Y`, `MODEL.3D.ROTX`, `MODEL.3D.ROTY`, `MODEL.3D.ROTZ`, and `MODEL.3D.DZ`

That means the extraction path belongs in the parser layer, not in the browser intake layer.

**Chosen Approach**

Add an embedded-model extraction stage to the existing OLE-backed PCB parser and expose normalized embedded 3D model assets on the parsed PCB document model. The 3D runtime should treat those embedded assets as first-class model sources alongside currently loaded external files.

For rendering, use a browser-runnable STEP tessellation library backed by wasm so the browser can convert STEP text into triangle meshes without a backend conversion service. The runtime should keep the current local-first architecture and preserve procedural fallbacks for unsupported or failed model loads.

**Architecture**

The implementation should extend the existing flow rather than add a parallel one.

- `PcbStreamExtractor` remains responsible for reading low-level OLE streams.
- A new embedded-model extractor should scan the stream map, decompress `Models/<n>` payloads, parse `Models/Data`, and expose a normalized embedded model index.
- `PcbModelParser` should attach that embedded-model information to the normalized `documentModel.pcb`, including model placement metadata derived from `ComponentBodies6/Data`.
- `PcbScene3dBuilder` should enrich component scene entries with embedded-model references and per-body placement transforms when available.
- `PcbScene3dModelRegistry` should resolve both session-loaded companion models and parser-extracted embedded models behind one lookup API.
- `PcbScene3dRuntime` should add a STEP mesh-loading path parallel to the existing VRML path, using the resolved model source and the authored Altium 3D transforms.

This keeps the worker-based parse boundary intact and lets the runtime stay focused on rendering.

**Data Model**

The parsed PCB model should gain an embedded-model collection that is stable and renderer-friendly. A normalized entry should contain:

- logical identity: `id`, `checksum`, `name`, `format`
- source bytes or text: inflated STEP payload
- source origin: `embedded` vs `session`
- default authored transform from `Models/Data` when available

Each component scene entry should also gain a resolved model placement payload that can include:

- `modelId`
- `checksum`
- `name`
- `format`
- `source`
- `rotationDeg` or axis rotations
- `offsetMil`
- `anchor2dMil`

This is necessary because multiple components may reuse the same embedded STEP payload with different rotations or offsets.

**Resolution Rules**

Model resolution order should be:

1. explicit embedded model reference on the component body entry
2. explicit session-file reference if the parsed data points to an external path and that file is loaded
3. heuristic session-file basename matching
4. procedural fallback body

When both embedded and session models exist for the same logical model, prefer the embedded payload for lone-document correctness unless the user explicitly loaded a matching external file with the same path reference. That keeps the app deterministic and avoids surprising overrides.

**STEP Rendering Strategy**

Three.js alone does not parse STEP, so the runtime needs a dedicated importer. The importer should:

- run fully in the browser
- accept raw STEP text or bytes
- emit triangle meshes and material groups the runtime can convert into `THREE.BufferGeometry`
- be loaded lazily so the `3D` tab does not penalize the rest of the app

The runtime should cache parsed STEP results by embedded model identity so repeated packages do not retriangulate on every placement. Each placement should clone or instance the cached geometry and apply the Altium-authored 3D transform afterward.

**Transforms and Placement**

The existing 3D placement bug work showed that the board scene must use one consistent centered coordinate space. Embedded STEP placement should follow the same rule:

- parser-level component and body coordinates stay in board-space mils
- `PcbScene3dBuilder` converts placements into centered scene coordinates
- runtime applies model-local rotation and `DZ` offset before board-side top/bottom transforms

The authored `MODEL.2D.X` / `MODEL.2D.Y` anchor and `MODEL.3D.ROTX` / `ROTY` / `ROTZ` values should be treated as authoritative over footprint-family heuristics whenever an embedded model is present.

**Error Handling**

Failure to extract or render one embedded STEP model must not break the whole 3D scene.

- missing `Models/<n>` payload for referenced metadata: record diagnostic, keep fallback body
- corrupt zlib payload: record diagnostic, keep fallback body
- unsupported or failed STEP tessellation: record diagnostic, keep fallback body
- component body has transform metadata but no matching embedded payload: record diagnostic, keep fallback body

Diagnostics should stay lightweight and aggregated so dense boards do not flood the UI.

**Testing**

Coverage should focus on deterministic parser and scene-description behavior.

- parser tests should verify embedded `Models/Data` records and compressed `Models/<n>` payloads normalize into stable embedded STEP entries
- parser tests should verify component-body records map embedded model references onto scene-relevant placement metadata
- registry tests should verify embedded assets and session assets resolve through one API with the intended precedence
- runtime-level tests should verify STEP load failures degrade to diagnostics without breaking the scene
- the existing 3D outline and placement regressions should remain green to ensure STEP work does not reintroduce geometry drift

Tests must use repo-owned fake stream fragments and obfuscated model metadata only.

**Recommendation**

Implement embedded STEP support in two layers:

1. parser extraction and normalized model references
2. runtime STEP tessellation and placement

That sequence gives a reusable foundation, keeps lone `.PcbDoc` support correct, and avoids hard-coding any assumptions from the sample file into production parsing rules.
