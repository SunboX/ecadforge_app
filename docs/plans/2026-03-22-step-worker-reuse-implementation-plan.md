# STEP Worker Reuse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reuse one STEP importer worker per loader instance so 3D preprocessing avoids repeated OCCT worker startup overhead while keeping behavior unchanged.

**Architecture:** Keep `PcbScene3dStepLoader`'s public `loadModel()` contract intact, but replace the per-request worker lifecycle with a loader-owned persistent worker plus request sequencing. Add explicit disposal so long-lived workers are reclaimed when the owning controller or scene-prep runtime is torn down. Cover the change with focused `node:test` regressions for worker reuse and cleanup.

**Tech Stack:** Node.js ESM, native `node:test`, browser Web Workers, existing PCB 3D loader classes.

---

### Task 1: Lock worker reuse in a failing STEP loader test

**Files:**
- Modify: `tests/ui/pcb-scene-step-loader.test.mjs`

**Step 1: Write the failing test**

Add a worker-backed test that:
- constructs a `PcbScene3dStepLoader` with a fake `stepWorkerFactory`
- loads two different STEP models through the same loader
- asserts the factory was called exactly once
- asserts the worker saw two messages and was not terminated between loads

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/pcb-scene-step-loader.test.mjs`
Expected: FAIL because the current loader creates a new worker for every STEP load.

### Task 2: Lock cleanup in a failing STEP loader disposal test

**Files:**
- Modify: `tests/ui/pcb-scene-step-loader.test.mjs`

**Step 1: Write the failing test**

Add a disposal test that:
- loads one STEP model through a fake persistent worker
- calls `loader.dispose()`
- asserts the underlying worker is terminated exactly once

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/pcb-scene-step-loader.test.mjs`
Expected: FAIL because the current loader has no disposal API and does not retain a worker instance.

### Task 3: Implement persistent STEP worker reuse

**Files:**
- Modify: `src/ui/PcbScene3dStepLoader.mjs`

**Step 1: Write minimal implementation**

Update the loader to:
- lazily create one worker the first time worker-backed STEP import is needed
- assign request ids and route responses back to the correct pending promise
- keep the worker alive across multiple `loadModel()` calls
- expose `dispose()` to terminate the persistent worker and reject any pending requests

**Step 2: Run focused tests**

Run: `node --test tests/ui/pcb-scene-step-loader.test.mjs`
Expected: PASS for the new reuse and cleanup regressions and the existing STEP loader coverage.

### Task 4: Wire disposal through the 3D scene pipeline

**Files:**
- Modify: `src/ui/PcbScene3dExternalModels.mjs`
- Modify: `src/ui/PcbScene3dRuntime.mjs`
- Modify: `src/workers/pcb-scene3d.worker.mjs`

**Step 1: Write minimal implementation**

Ensure any long-lived `PcbScene3dStepLoader` created by the runtime or worker-backed scene prep is disposed after use so the persistent worker does not leak beyond the owning scene lifecycle.

**Step 2: Run focused tests**

Run: `node --test tests/ui/pcb-scene-step-loader.test.mjs tests/ui/pcb-scene3d-worker-client.test.mjs`
Expected: PASS with no worker lifecycle regressions.

### Task 5: Bump version and verify affected suites

**Files:**
- Modify: `package.json`

**Step 1: Update version**

Increment the patch version in `package.json`.

**Step 2: Run verification**

Run: `npm test`
Expected: PASS.
