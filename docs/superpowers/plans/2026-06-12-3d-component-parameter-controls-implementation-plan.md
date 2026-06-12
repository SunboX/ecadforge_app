# 3D Component Parameter Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live, resettable 3D component scale, rotation, and offset controls for selected components in ECAD Forge.

**Architecture:** Implement the behavior in `../pcb-scene3d-viewer`, where selection, inspector markup, and Three.js runtime transforms already live. ECAD Forge consumes the local package and increments its app version without mutating source ECAD files.

**Tech Stack:** JavaScript ES modules, Node test runner, Three.js scene graph, ECAD Forge app wrapper.

---

### Task 1: Controller Inspector Inputs

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/src/PcbScene3dController.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/tests/pcb-scene3d-controller.test.mjs`

- [ ] **Step 1: Write failing controller tests**

Add tests that select an external model, assert scale/rotation/offset inputs exist, dispatch an input change, and dispatch reset. Extend the fake selection node enough to expose queried controls after `innerHTML` changes.

- [ ] **Step 2: Run controller tests and verify RED**

Run: `npm test -- tests/pcb-scene3d-controller.test.mjs`

Expected: FAIL because `data-scene-3d-adjustment` controls do not exist and runtime adjustment calls are never made.

- [ ] **Step 3: Implement controller adjustment state**

Add private fields for a per-designator adjustment map and selected designator. Add helpers to resolve baseline adjustments from `externalPlacement.modelTransform` or neutral fallback values, convert offsets between mm and mil, sanitize numeric values, and render grouped controls.

- [ ] **Step 4: Bind inspector input/reset events**

Bind `input`/`change` events on `[data-scene-3d-adjustment]` and `click` on `[data-scene-3d-adjustment-reset]`. Forward normalized values to `runtime.setComponentAdjustment(designator, adjustment)`, update in-memory state, and rerender the selected inspector.

- [ ] **Step 5: Run controller tests and verify GREEN**

Run: `npm test -- tests/pcb-scene3d-controller.test.mjs`

Expected: PASS.

### Task 2: Runtime Transform Targets

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/src/PcbScene3dRuntime.mjs`
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/src/PcbScene3dExternalModels.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/tests/pcb-scene3d-runtime.test.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/tests/pcb-scene-external-models.test.mjs`

- [ ] **Step 1: Write failing runtime and external-model tests**

Add tests proving external placements expose a `scene3dAdjustmentTarget` group and fallback bodies receive a transform target that changes when `setComponentAdjustment()` is called.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/pcb-scene3d-runtime.test.mjs tests/pcb-scene-external-models.test.mjs`

Expected: FAIL because the adjustment target and runtime method do not exist.

- [ ] **Step 3: Add adjustment target groups**

Wrap external model groups in a model-local adjustment group after view compensation and before the model mesh. Wrap fallback body meshes in an equivalent adjustment group inside the face group. Mark these groups with `userData.scene3dAdjustmentTarget = true`.

- [ ] **Step 4: Add runtime adjustment application**

Track adjustment targets by designator. Add `setComponentAdjustment(designator, adjustment)` and apply position, rotation, and scale to all registered targets. Use the same Z-Y-X model rotation order as external model placement: rotate Z, then Y, then X with negative degree-to-radian conversion.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- tests/pcb-scene3d-runtime.test.mjs tests/pcb-scene-external-models.test.mjs`

Expected: PASS.

### Task 3: Styling And Package Verification

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/src/styles/scene3d.css`
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer/docs/api.md`

- [ ] **Step 1: Add compact control styles**

Add styles for parameter fieldsets, rows, labels, numeric inputs, and reset action. Keep the controls dense enough for the ECAD Forge right panel and avoid nested card styling.

- [ ] **Step 2: Document the controller/runtime adjustment API**

Update `docs/api.md` to mention editable inspector controls and the `setComponentAdjustment()` runtime method.

- [ ] **Step 3: Run package test suite**

Run: `npm test`

Expected: PASS.

### Task 4: ECAD Forge Integration

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/package.json`
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/package-lock.json`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/ui/app-view-3d-loading.test.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/app-runtime-version.test.mjs`

- [ ] **Step 1: Write or update app integration tests**

Add an assertion that the 3D shell remains controller-owned and forwards selected component state without remounting. Update version expectations to `1.5.45`.

- [ ] **Step 2: Run focused app tests and verify RED**

Run: `npm test -- tests/ui/app-view-3d-loading.test.mjs tests/app-runtime-version.test.mjs`

Expected: FAIL before the app version is bumped to `1.5.45`.

- [ ] **Step 3: Link local `pcb-scene3d-viewer` and bump app version**

Set `pcb-scene3d-viewer` to consume `file:../pcb-scene3d-viewer`, run `npm install`, and increment ECAD Forge `package.json` version from `1.5.44` to `1.5.45`.

- [ ] **Step 4: Run focused app tests and verify GREEN**

Run: `npm test -- tests/ui/app-view-3d-loading.test.mjs tests/app-runtime-version.test.mjs`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run package verification**

Run: `npm test` in `/Users/afiedler/Documents/privat/Andrés_Werkstatt/pcb-scene3d-viewer`

Expected: PASS.

- [ ] **Step 2: Run app verification**

Run: `npm test` in `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app`

Expected: PASS. If unrelated dirty-worktree changes cause failures, record the exact failing tests and their messages, then run the focused suites from this plan to isolate this feature's status.

- [ ] **Step 3: Inspect changed files**

Run: `git status --short` in both repositories and review diffs for only intended files.
