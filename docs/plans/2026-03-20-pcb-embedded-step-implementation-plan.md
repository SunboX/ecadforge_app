# PCB Embedded STEP Implementation Plan

**Goal:** Extract embedded STEP payloads from OLE-backed `.PcbDoc` files and render them in the existing 3D viewer so a lone PCB document can show authored component models without companion files.

**Architecture:** Extend the worker-side OLE PCB parse flow to normalize embedded model payloads and body placement metadata, then resolve those embedded models through the existing 3D model pipeline. Add a browser-side STEP tessellation path with lazy-loaded wasm and cache parsed meshes by embedded model identity so repeated packages reuse geometry.

**Tech Stack:** Node.js, native `node:test`, ESM modules, OLE stream parsing, zlib inflation, Three.js, browser WebGL, browser-side wasm STEP tessellation

---

### Task 1: Add parser tests for embedded model extraction

**Files:**
- Create: `tests/core/pcb-embedded-model-extractor.test.mjs`
- Modify: `tests/core/pcb-stream-extractor.test.mjs`
- Create: `src/core/altium/PcbEmbeddedModelExtractor.mjs`

**Step 1: Write the failing test**

Add tests that build a fake OLE stream map with:

- one `Models/Data` metadata stream
- one compressed `Models/0` STEP payload
- one embedded component-body record referencing that model

Assert that extraction returns:

- one normalized embedded model entry with `id`, `checksum`, `name`, `format: 'step'`
- inflated STEP text beginning with `ISO-10303-21`
- one component-body placement entry carrying the model reference and 3D transform fields

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/pcb-embedded-model-extractor.test.mjs tests/core/pcb-stream-extractor.test.mjs`

Expected: FAIL because no embedded-model extractor exists and `PcbStreamExtractor` does not expose embedded models.

**Step 3: Write minimal implementation**

Create `PcbEmbeddedModelExtractor` with helpers to:

- parse `Models/Data`
- inflate `Models/<n>` zlib payloads
- normalize model identity and payload text
- parse `ComponentBodies6/Data` and `ShapeBasedComponentBodies6/Data` into component-body model references

Wire `PcbStreamExtractor` to include the new embedded extraction output in its returned object.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/pcb-embedded-model-extractor.test.mjs tests/core/pcb-stream-extractor.test.mjs`

Expected: PASS.

### Task 2: Attach embedded model data to the normalized PCB document model

**Files:**
- Modify: `tests/core/pcb-model-parser.test.mjs`
- Modify: `src/core/altium/PcbModelParser.mjs`

**Step 1: Write the failing test**

Add a PCB model parser test that feeds extracted records plus embedded model metadata and asserts:

- `documentModel.pcb.embeddedModels` is present
- normalized component entries carry embedded body/model reference metadata needed for scene placement
- existing component summary and BOM behavior remain unchanged

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/pcb-model-parser.test.mjs`

Expected: FAIL because `PcbModelParser` currently drops embedded model data.

**Step 3: Write minimal implementation**

Extend `PcbModelParser.parse()` to:

- preserve `embeddedModels`
- preserve normalized component-body placement records
- keep diagnostics informative when embedded models are recovered

Do not special-case model names or board-specific identifiers.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/pcb-model-parser.test.mjs`

Expected: PASS.

### Task 3: Extend scene building and model resolution for embedded sources

**Files:**
- Modify: `tests/ui/pcb-scene-builder.test.mjs`
- Modify: `tests/ui/pcb-scene-model-registry.test.mjs`
- Modify: `src/ui/PcbScene3dBuilder.mjs`
- Modify: `src/ui/PcbScene3dModelRegistry.mjs`

**Step 1: Write the failing test**

Add tests that prove:

- a parsed PCB component with embedded body/model metadata resolves to an embedded model without requiring session files
- embedded model references carry per-placement transform metadata into the scene description
- session-file matches still work
- explicit embedded references beat heuristic session-file basename matches

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene-model-registry.test.mjs`

Expected: FAIL because the builder and registry only understand session-loaded companion files today.

**Step 3: Write minimal implementation**

Update the scene builder and registry to:

- accept `documentModel.pcb.embeddedModels`
- resolve embedded assets by `MODELID` / `CHECKSUM`
- preserve transform metadata per component placement
- expose one unified `externalModel` payload shape regardless of embedded or session origin

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene-model-registry.test.mjs`

Expected: PASS.

### Task 4: Add a browser-side STEP mesh loader abstraction

**Files:**
- Create: `tests/ui/pcb-scene-step-loader.test.mjs`
- Create: `src/ui/PcbScene3dStepLoader.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/server.mjs`

**Step 1: Write the failing test**

Add tests for a STEP loader abstraction that assert:

- repeated loads of the same embedded model id reuse a cached parsed mesh payload
- invalid STEP text rejects cleanly with a descriptive error
- the server can serve any required browser-side importer or wasm asset under versioned vendor/static URLs

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene-step-loader.test.mjs tests/server-startup.test.mjs`

Expected: FAIL because no STEP loader exists and the server does not yet expose the importer runtime assets.

**Step 3: Write minimal implementation**

Install the browser-runnable STEP importer dependency and create `PcbScene3dStepLoader` that:

- lazy-loads the importer
- converts STEP text into cached mesh payloads
- exposes a renderer-friendly geometry/material structure

Update `src/server.mjs` so the importer JS and wasm assets are served with the same no-store/versioned rules as other browser modules.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene-step-loader.test.mjs tests/server-startup.test.mjs`

Expected: PASS.

### Task 5: Integrate STEP rendering into the Three.js runtime

**Files:**
- Modify: `tests/ui/pcb-scene3d-controller.test.mjs`
- Modify: `src/ui/PcbScene3dRuntime.mjs`
- Modify: `src/ui/PcbScene3dController.mjs`
- Modify: `src/ui/PcbScene3dOutlineBuilder.mjs` only if placement integration requires shared helpers

**Step 1: Write the failing test**

Extend the 3D controller/runtime tests to assert:

- embedded STEP models are attempted when present
- failed STEP loads only emit diagnostics and keep fallback bodies visible
- resolved STEP placements receive the component-centered transform and Altium-authored body rotations and `DZ`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene3d-controller.test.mjs`

Expected: FAIL because `PcbScene3dRuntime` currently skips all STEP models.

**Step 3: Write minimal implementation**

Update the runtime to:

- branch on `externalModel.format === 'step'`
- request tessellated mesh data from `PcbScene3dStepLoader`
- build `THREE.BufferGeometry` meshes from that data
- cache or clone the mesh for repeated placements
- apply embedded placement transforms before top/bottom board-side transforms

Keep diagnostics aggregated and non-fatal.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene3d-controller.test.mjs`

Expected: PASS.

### Task 6: Add parser-level integration coverage for lone `.PcbDoc` embedded STEP behavior

**Files:**
- Modify: `tests/core/altium-parser/forge-relic.mjs` or create a new obfuscated parser regression file
- Modify: `src/core/altium/AltiumParser.mjs` only if type/shape propagation needs changes

**Step 1: Write the failing test**

Add a parser integration test using repo-owned obfuscated stream fragments that proves:

- parsing a lone PCB document recovers embedded model metadata
- the normalized PCB model exposes embedded models without any session assets
- component/body references are preserved through the `AltiumParser.parseArrayBuffer()` entrypoint

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser/forge-relic.mjs`

Expected: FAIL because the top-level parser output does not yet preserve embedded model data end-to-end.

**Step 3: Write minimal implementation**

Plumb the extracted embedded model data through `AltiumParser.parseArrayBuffer()` without changing schematic behavior.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser/forge-relic.mjs`

Expected: PASS.

### Task 7: Update docs and user-facing copy for embedded STEP support

**Files:**
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/de.json`
- Modify: `docs/troubleshooting.md`
- Modify: `docs/architecture.md`

**Step 1: Write the failing test**

Add or update existing metadata/copy tests to assert that the app copy no longer frames STEP as session-companion-only when embedded models are available from lone `.PcbDoc` files.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/project-structure.test.mjs tests/server-startup.test.mjs`

Expected: FAIL or require copy updates because current strings describe STEP support as companion-file resolution only.

**Step 3: Write minimal implementation**

Update docs and localized strings to explain:

- embedded STEP support for lone `.PcbDoc`
- continued support for companion `WRL` / `STEP` files
- fallback behavior when tessellation fails

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/project-structure.test.mjs tests/server-startup.test.mjs`

Expected: PASS.

### Task 8: Verify the full feature and review the diff

**Files:**
- Modify: `package.json`
- Modify: any files touched in Tasks 1-7

**Step 1: Increment the app version**

Update `package.json` to the next patch version after the current workspace value.

**Step 2: Run focused regression tests**

Run: `npm test -- tests/core/pcb-embedded-model-extractor.test.mjs tests/core/pcb-stream-extractor.test.mjs tests/core/pcb-model-parser.test.mjs tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene-model-registry.test.mjs tests/ui/pcb-scene-step-loader.test.mjs tests/ui/pcb-scene3d-controller.test.mjs`

Expected: PASS.

**Step 3: Run the full repo test suite**

Run: `npm test`

Expected: PASS with exit code `0`.

**Step 4: Review the diff**

Run: `git diff -- docs/plans/2026-03-20-pcb-embedded-step-design.md docs/plans/2026-03-20-pcb-embedded-step-implementation-plan.md src/core/altium/PcbEmbeddedModelExtractor.mjs src/core/altium/PcbStreamExtractor.mjs src/core/altium/PcbModelParser.mjs src/core/altium/AltiumParser.mjs src/ui/PcbScene3dBuilder.mjs src/ui/PcbScene3dModelRegistry.mjs src/ui/PcbScene3dRuntime.mjs src/ui/PcbScene3dStepLoader.mjs src/server.mjs src/i18n/en.json src/i18n/de.json docs/architecture.md docs/troubleshooting.md tests/core/pcb-embedded-model-extractor.test.mjs tests/core/pcb-stream-extractor.test.mjs tests/core/pcb-model-parser.test.mjs tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene-model-registry.test.mjs tests/ui/pcb-scene-step-loader.test.mjs tests/ui/pcb-scene3d-controller.test.mjs package.json package-lock.json`

Expected: only the embedded STEP extraction, rendering, docs, tests, and version bump appear.
