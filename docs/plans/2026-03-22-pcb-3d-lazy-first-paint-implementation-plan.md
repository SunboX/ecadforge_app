# PCB 3D Lazy First Paint Implementation Plan

**Goal:** Make the 3D tab paint an interactive board shell immediately while loading copper and external STEP detail in the background.

**Architecture:** Remove STEP mesh preloading from the initial scene-prep worker path, then split `PcbScene3dRuntime` into a first-frame phase and deferred detail stages. Keep the final rendered scene behavior-identical once background detail has finished loading.

**Tech Stack:** Node.js ESM, native `node:test`, browser Web Workers, Three.js-based PCB 3D runtime.

---

### Task 1: Lock lazy scene prep in a failing regression

**Files:**

- Create: `tests/ui/pcb-scene3d-scene-preparator.test.mjs`

**Step 1: Write the failing test**

Add a test that builds a scene description containing STEP-backed external models, injects a fake `stepLoader`, and asserts `PcbScene3dScenePreparator.prepare()` does not call that loader during the initial prep path.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/pcb-scene3d-scene-preparator.test.mjs`
Expected: FAIL because the current preparator eagerly preloads STEP payloads.

### Task 2: Stop blocking first paint on STEP preloading

**Files:**

- Modify: `src/ui/PcbScene3dScenePreparator.mjs`
- Modify: `src/workers/pcb-scene3d.worker.mjs`

**Step 1: Write minimal implementation**

Return the built scene description directly from scene prep and remove the eager STEP preload path from the worker-backed initial prep stage.

**Step 2: Run focused tests**

Run: `node --test tests/ui/pcb-scene3d-scene-preparator.test.mjs`
Expected: PASS.

### Task 3: Stage runtime detail after the first frame

**Files:**

- Modify: `src/ui/PcbScene3dRuntime.mjs`

**Step 1: Write minimal implementation**

Refactor runtime initialization so:

- board shell and fallback bodies render in the initial frame
- `whenReady()` resolves after that first frame
- copper, silkscreen, vias, and external models are attached in deferred background stages

**Step 2: Run focused tests**

Run: `node --test tests/ui/pcb-scene3d-controller.test.mjs tests/ui/app-view-3d-loading.test.mjs tests/ui/pcb-scene-external-models.test.mjs tests/ui/pcb-scene-step-loader.test.mjs`
Expected: PASS.

### Task 4: Bump version and run full verification

**Files:**

- Modify: `package.json`

**Step 1: Update version**

Increment the patch version in `package.json`.

**Step 2: Run verification**

Run: `npm test`
Expected: PASS.
