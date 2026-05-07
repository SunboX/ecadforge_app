# PCB Model ZIP Export Implementation Plan

**Goal:** Add a `Download Models ZIP` action to the PCB `3D` view that exports one ZIP containing embedded STEP payloads and companion `STEP` or `WRL` assets, named by footprint pattern and deduplicated across repeated component instances.

**Architecture:** Reuse the existing PCB 3D resolution flow so exportable models come from the same `PcbScene3dBuilder` and `PcbScene3dModelRegistry` logic that powers the 3D scene. Keep ZIP assembly in a focused browser utility, keep toolbar wiring in the 3D controller, and keep renderer changes limited to the shell markup and styling hooks.

**Tech Stack:** Native ES modules, existing PCB 3D controller/builder/model registry, vendored `fflate`, Node test runner.

---

### Task 1: Capture the Export Button Contract

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/ui/Scene3dRenderer.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/ui/renderers/scene3d.mjs`

**Step 1: Write the failing test**

Add renderer assertions that the 3D toolbar includes a `Download Models ZIP` button with a stable selector.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/scene3d.mjs`
Expected: FAIL because the export button is not rendered.

**Step 3: Write minimal implementation**

Add the export button markup to `Scene3dRenderer.render()` without changing the existing viewport or toggle structure.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers/scene3d.mjs`
Expected: PASS

### Task 2: Add Export Utility Tests

**Files:**
- Create: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/ui/PcbModelArchiveExporter.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/ui/pcb-model-archive-exporter.test.mjs`

**Step 1: Write the failing test**

Add tests that verify:
- embedded STEP payloads are exported as UTF-8 text entries
- companion `STEP` and `WRL` assets are exported as raw bytes
- repeated placements of the same pattern/model pair are deduplicated
- conflicting models for one pattern receive deterministic suffixes

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-model-archive-exporter.test.mjs`
Expected: FAIL because no export utility exists.

**Step 3: Write minimal implementation**

Implement a browser-side export utility that:
- accepts resolved export entries
- normalizes archive names from patterns and extensions
- reads model bytes from embedded text or session files
- creates a ZIP with `fflate`
- returns the archive bytes plus a summary

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-model-archive-exporter.test.mjs`
Expected: PASS

### Task 3: Add Controller Export Wiring

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/ui/PcbScene3dController.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/ui/pcb-scene3d-controller.test.mjs`

**Step 1: Write the failing test**

Add controller tests that verify:
- the export button is bound
- clicking it collects deduplicated pattern-based export entries from the resolved model data
- success and empty-state summaries update the diagnostics area

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene3d-controller.test.mjs`
Expected: FAIL because the controller does not wire the button or call any exporter.

**Step 3: Write minimal implementation**

Update the controller to:
- find the export button and diagnostics node
- build export entries from the current document model and resolved scene/model data
- invoke the export utility
- trigger the download and render a concise diagnostics summary

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene3d-controller.test.mjs`
Expected: PASS

### Task 4: Add Sample-Driven Resolution Coverage

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/ui/pcb-scene-builder.test.mjs`

**Step 1: Write the failing test**

Add a builder-level regression test proving repeated placements that share one footprint pattern and resolved model can be grouped into one export identity.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene-builder.test.mjs`
Expected: FAIL if the current builder data is insufficient to support stable export grouping.

**Step 3: Write minimal implementation**

Only if needed, expose the minimal scene metadata required for deterministic export grouping while keeping the builder generic.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene-builder.test.mjs`
Expected: PASS

### Task 5: Style Hooks and Final Verification

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/styles/20-viewer.css`
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/package.json`
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/package-lock.json`

**Step 1: Add any minimal toolbar styling**

Keep the new button visually consistent with the existing 3D toolbar without changing the rest of the scene layout.

**Step 2: Run targeted tests**

Run: `npm test -- tests/ui/renderers/scene3d.mjs tests/ui/pcb-model-archive-exporter.test.mjs tests/ui/pcb-scene3d-controller.test.mjs tests/ui/pcb-scene-builder.test.mjs`
Expected: PASS

**Step 3: Bump version**

Increment the app version in both package files.

**Step 4: Run full verification**

Run: `npm test`
Expected: PASS

**Step 5: Run sample sanity check**

Run a local parse/export sanity check against the attached board and confirm that repeated patterns like `CK-6.35-636-6P` appear once in the resulting archive manifest.
