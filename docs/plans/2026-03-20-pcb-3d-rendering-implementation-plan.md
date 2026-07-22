# PCB 3D Rendering Implementation Plan

**Goal:** Replace the placeholder 3D summary tab with a real interactive Three.js PCB scene that works from a lone `.PcbDoc` and can overlay companion `WRL` or `STEP` models when those files are loaded into the session.

**Architecture:** Keep parsing and view routing in the existing app flow, but replace the presentational `Scene3dRenderer` with a real panel shell and add an imperative `PcbScene3dController` plus a scene-description pipeline. Companion assets are indexed from the session file set, resolved generically, and attached as optional component models on top of the procedural board scene.

**Tech Stack:** Node.js, native `node:test`, ESM modules, Three.js, browser WebGL, existing app state/view classes

---

### Task 1: Capture the 3D panel shell and view attachment behavior

**Files:**

- Modify: `tests/ui/renderers/output-renderers.mjs`
- Modify: `tests/ui/app-view.test.mjs`
- Modify: `src/ui/Scene3dRenderer.mjs`
- Modify: `src/ui/AppView.mjs`
- Create: `src/ui/PcbScene3dController.mjs`

**Step 1: Write the failing test**

Add a renderer test that asserts `Scene3dRenderer.render()` emits:

- a `scene-3d__viewport` mount node
- camera preset buttons
- model/detail toggle controls
- a diagnostics region for 3D model resolution feedback

Add an `AppView` test that renders the `3d` snapshot and asserts a 3D controller is attached to the mounted viewport and disposed when the active content changes.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs tests/ui/app-view.test.mjs`

Expected: FAIL because the 3D tab still renders static summary markup and no controller is attached.

**Step 3: Write minimal implementation**

Create a lightweight `PcbScene3dController` class interface with constructor and `dispose()`. Update `Scene3dRenderer` to output the new panel shell. Update `AppView` to attach the controller when the `3D` tab is rendered and dispose it alongside the SVG viewport controller.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs tests/ui/app-view.test.mjs`

Expected: PASS.

### Task 2: Add scene-description and procedural package tests

**Files:**

- Create: `tests/ui/pcb-scene-builder.test.mjs`
- Create: `src/ui/PcbScene3dBuilder.mjs`
- Create: `src/ui/PcbScene3dPackages.mjs`

**Step 1: Write the failing test**

Add tests that feed a minimal normalized PCB model into the scene builder and assert:

- board outline and thickness metadata are produced
- top and bottom component instances are separated
- known footprint names such as `0603`, `SOT-23`, and radial-cap style names map to distinct procedural package families
- explicit component heights override package defaults
- unknown packages fall back to a generic body sized from local geometry

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene-builder.test.mjs`

Expected: FAIL because no builder exists yet.

**Step 3: Write minimal implementation**

Create a builder that converts the normalized PCB model into a deterministic scene description. Add a package catalog helper that classifies footprints by generic family and resolves reasonable default dimensions.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene-builder.test.mjs`

Expected: PASS.

### Task 3: Add companion-model resolution tests

**Files:**

- Create: `tests/ui/pcb-scene-model-registry.test.mjs`
- Create: `src/ui/PcbScene3dModelRegistry.mjs`

**Step 1: Write the failing test**

Add tests that build a session asset registry and assert:

- loaded `WRL` and `STEP` files are indexed by normalized basename and relative path
- explicit model references win over basename heuristics
- unknown references do not crash resolution
- lone `.PcbDoc` sessions produce empty external-model matches without errors

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene-model-registry.test.mjs`

Expected: FAIL because the registry does not exist yet.

**Step 3: Write minimal implementation**

Create the model registry and generic resolution helpers for session files and component references.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene-model-registry.test.mjs`

Expected: PASS.

### Task 4: Integrate Three.js scene runtime

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/ui/PcbScene3dController.mjs`
- Modify: `src/ui/PcbScene3dBuilder.mjs`
- Modify: `src/ui/PcbScene3dModelRegistry.mjs`
- Modify: `src/ui/AppView.mjs`

**Step 1: Write the failing test**

Extend the 3D controller tests to assert that the controller:

- creates a render canvas inside the viewport
- exposes preset camera actions
- records non-fatal diagnostics when a requested external model is unresolved

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/app-view.test.mjs tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene-model-registry.test.mjs`

Expected: FAIL because the controller is still a stub.

**Step 3: Write minimal implementation**

Install `three`, wire the controller to create a renderer, camera, scene, lights, orbit-style controls, and board/component meshes from the builder output. Integrate the model registry so resolved external models can be attached when available.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/app-view.test.mjs tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene-model-registry.test.mjs`

Expected: PASS.

### Task 5: Add 3D panel styling and browser affordance coverage

**Files:**

- Modify: `src/styles/20-viewer.css`
- Modify: `tests/ui/renderers/output-renderers.mjs`

**Step 1: Write the failing test**

Add stylesheet assertions for:

- the 3D viewport shell
- floating control groups
- diagnostics panel styling
- WebGL fallback styling

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: FAIL because the new selectors are not defined yet.

**Step 3: Write minimal implementation**

Add the new 3D panel styles while preserving the existing app palette and responsive behavior.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: PASS.

### Task 6: Session companion-file support and version bump

**Files:**

- Modify: `src/AppController.mjs`
- Modify: `src/core/AppState.mjs`
- Modify: `src/ui/AppView.mjs`
- Modify: `tests/app-controller.test.mjs`
- Modify: `tests/app-state.test.mjs`
- Modify: `package.json`

**Step 1: Write the failing test**

Add controller and state tests that prove:

- non-`.SchDoc` and non-`.PcbDoc` companion assets can be retained in session for 3D model resolution
- lone supported documents still parse as before
- 3D companion assets do not become active top-level documents

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app-controller.test.mjs tests/app-state.test.mjs`

Expected: FAIL because the current controller rejects non-native files entirely.

**Step 3: Write minimal implementation**

Extend the session state to retain companion asset metadata for the 3D viewer without changing the document tabs. Update the controller to index supported companion assets alongside native documents.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app-controller.test.mjs tests/app-state.test.mjs`

Expected: PASS.

### Task 7: Verify, bump version, and review the diff

**Files:**

- Modify: `package.json`
- Modify: any files touched in Tasks 1-6

**Step 1: Increment the app version**

Update `package.json` to the next patch version after the current workspace value.

**Step 2: Run focused regression tests**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs tests/ui/app-view.test.mjs tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene-model-registry.test.mjs tests/app-controller.test.mjs tests/app-state.test.mjs`

Expected: PASS.

**Step 3: Run the full repo test suite**

Run: `npm test`

Expected: PASS with exit code `0`.

**Step 4: Review the diff**

Run: `git diff -- docs/plans/2026-03-20-pcb-3d-rendering-design.md docs/plans/2026-03-20-pcb-3d-rendering-implementation-plan.md src/ui/Scene3dRenderer.mjs src/ui/PcbScene3dController.mjs src/ui/PcbScene3dBuilder.mjs src/ui/PcbScene3dPackages.mjs src/ui/PcbScene3dModelRegistry.mjs src/ui/AppView.mjs src/AppController.mjs src/core/AppState.mjs src/styles/20-viewer.css tests/ui/renderers/output-renderers.mjs tests/ui/app-view.test.mjs tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene-model-registry.test.mjs tests/app-controller.test.mjs tests/app-state.test.mjs package.json package-lock.json`

Expected: Only the 3D rendering implementation, tests, docs, and version bump appear.
