# PCB 3D Worker Prep Implementation Plan

**Goal:** Move PCB 3D preprocessing into its own worker and keep a loading spinner visible until the 3D scene is fully rendered with all components settled.

**Architecture:** Add a dedicated browser worker for 3D scene preparation, make the 3D controller job-based and async, and keep the runtime responsible for only browser-only rendering work. The controller will expose a strict readiness contract so the overlay stays visible until model loading, fallback settlement, and a final render pass all complete.

**Tech Stack:** Node 20, ESM `.mjs`, browser module workers, existing Three.js runtime, native `node:test`

---

### Task 1: Capture the 3D loading contract in renderer and view tests

**Files:**

- Modify: `tests/ui/renderers/scene3d.mjs`
- Modify: `tests/ui/app-view.test.mjs`
- Modify: `src/ui/Scene3dRenderer.mjs`
- Modify: `src/ui/AppView.mjs`
- Modify: `src/styles/20-viewer.css`

**Step 1: Write the failing test**

Add assertions that `Scene3dRenderer.render()` emits a dedicated 3D loading overlay node and spinner copy, and that `AppView` keeps it visible while 3D readiness is pending.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers/scene3d.mjs tests/ui/app-view.test.mjs`
Expected: FAIL because the current 3D shell has no loading overlay contract and `AppView` cannot track 3D readiness.

**Step 3: Write minimal implementation**

Update the 3D shell markup and view rendering flow so the loading overlay exists immediately and can be toggled without rebuilding unrelated UI.

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/renderers/scene3d.mjs tests/ui/app-view.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/ui/renderers/scene3d.mjs tests/ui/app-view.test.mjs src/ui/Scene3dRenderer.mjs src/ui/AppView.mjs src/styles/20-viewer.css
git commit -m "feat: add 3d loading shell contract"
```

### Task 2: Define the dedicated 3D worker URL and controller protocol

**Files:**

- Modify: `tests/worker-url-builder.test.mjs`
- Modify: `src/WorkerUrlBuilder.mjs`
- Modify: `tests/ui/pcb-scene3d-controller.test.mjs`
- Modify: `src/ui/PcbScene3dController.mjs`
- Create: `src/workers/pcb-scene3d.worker.mjs`

**Step 1: Write the failing test**

Add tests that assert:

- `WorkerUrlBuilder` can build a cache-busted 3D worker URL
- `PcbScene3dController` starts a prep job, reports loading, ignores stale job completions, and reports ready only for the latest job

**Step 2: Run test to verify it fails**

Run: `node --test tests/worker-url-builder.test.mjs tests/ui/pcb-scene3d-controller.test.mjs`
Expected: FAIL because no dedicated 3D worker URL or job-based controller flow exists.

**Step 3: Write minimal implementation**

Add the 3D worker URL builder, create the worker entrypoint and message protocol, and refactor the controller around async prep jobs plus readiness callbacks.

**Step 4: Run test to verify it passes**

Run: `node --test tests/worker-url-builder.test.mjs tests/ui/pcb-scene3d-controller.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/worker-url-builder.test.mjs tests/ui/pcb-scene3d-controller.test.mjs src/WorkerUrlBuilder.mjs src/ui/PcbScene3dController.mjs src/workers/pcb-scene3d.worker.mjs
git commit -m "feat: add pcb 3d worker protocol"
```

### Task 3: Move scene-description prep behind the worker boundary

**Files:**

- Modify: `tests/ui/pcb-scene-builder.test.mjs`
- Modify: `src/ui/PcbScene3dBuilder.mjs`
- Create: `src/ui/PcbScene3dWorkerClient.mjs`
- Create: `tests/ui/pcb-scene3d-worker-client.test.mjs`

**Step 1: Write the failing test**

Add tests that prove the worker-prep path returns the same deterministic scene description shape the runtime expects and that the worker client resolves or rejects job responses correctly.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene3d-worker-client.test.mjs`
Expected: FAIL because there is no worker client and the prep boundary is still implicit.

**Step 3: Write minimal implementation**

Extract the serializable prep entrypoint, wire it into the worker, and add a small client wrapper that hides request ids and termination details from the controller.

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene3d-worker-client.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene3d-worker-client.test.mjs src/ui/PcbScene3dBuilder.mjs src/ui/PcbScene3dWorkerClient.mjs src/workers/pcb-scene3d.worker.mjs
git commit -m "feat: move 3d scene prep behind worker client"
```

### Task 4: Keep the spinner up until runtime settlement finishes

**Files:**

- Modify: `tests/ui/pcb-scene-external-models.test.mjs`
- Modify: `tests/ui/pcb-scene3d-controller.test.mjs`
- Modify: `src/ui/PcbScene3dRuntime.mjs`
- Modify: `src/ui/PcbScene3dExternalModels.mjs`
- Modify: `src/ui/PcbScene3dController.mjs`

**Step 1: Write the failing test**

Add tests that assert:

- runtime readiness is not reported right after canvas creation
- readiness waits until external model loading and fallback settlement finish
- model load failures still resolve readiness once fallback visibility is restored

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/pcb-scene-external-models.test.mjs tests/ui/pcb-scene3d-controller.test.mjs`
Expected: FAIL because the current runtime has no explicit ready signal after settlement.

**Step 3: Write minimal implementation**

Make the runtime expose an async initialization/settlement promise, and have the controller hide the overlay only after that promise resolves for the active job.

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/pcb-scene-external-models.test.mjs tests/ui/pcb-scene3d-controller.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/ui/pcb-scene-external-models.test.mjs tests/ui/pcb-scene3d-controller.test.mjs src/ui/PcbScene3dRuntime.mjs src/ui/PcbScene3dExternalModels.mjs src/ui/PcbScene3dController.mjs
git commit -m "feat: wait for complete 3d scene settlement"
```

### Task 5: Offload STEP preprocessing into the 3D worker

**Files:**

- Modify: `tests/ui/pcb-scene-step-loader.test.mjs`
- Modify: `tests/ui/pcb-scene3d-controller.test.mjs`
- Modify: `src/ui/PcbScene3dStepLoader.mjs`
- Modify: `src/ui/PcbScene3dExternalModels.mjs`
- Modify: `src/workers/pcb-scene3d.worker.mjs`
- Modify: `src/ui/PcbScene3dBuilder.mjs`

**Step 1: Write the failing test**

Add tests that assert worker-side prep can preload STEP mesh payloads and that the main-thread runtime mounts those payloads without retriangulating the same model during scene startup.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/pcb-scene-step-loader.test.mjs tests/ui/pcb-scene3d-controller.test.mjs`
Expected: FAIL because STEP prep still happens entirely on the main thread.

**Step 3: Write minimal implementation**

Add a worker-safe STEP preprocessing entrypoint, return prepared mesh payloads in the worker response, and teach the external-model pipeline to consume prebuilt STEP payloads first.

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/pcb-scene-step-loader.test.mjs tests/ui/pcb-scene3d-controller.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/ui/pcb-scene-step-loader.test.mjs tests/ui/pcb-scene3d-controller.test.mjs src/ui/PcbScene3dStepLoader.mjs src/ui/PcbScene3dExternalModels.mjs src/workers/pcb-scene3d.worker.mjs src/ui/PcbScene3dBuilder.mjs
git commit -m "feat: preprocess 3d step models in worker"
```

### Task 6: Integrate bootstrap wiring and version the change

**Files:**

- Modify: `src/main.mjs`
- Modify: `src/ui/AppView.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/app-view-inputs.test.mjs`

**Step 1: Write the failing test**

Add integration coverage that proves the app bootstrap wires the dedicated 3D worker path into the 3D controller/view flow and that the current version increments cleanly.

**Step 2: Run test to verify it fails**

Run: `node --test tests/app-view-inputs.test.mjs tests/ui/app-view.test.mjs tests/worker-url-builder.test.mjs`
Expected: FAIL because bootstrap does not provide a dedicated 3D worker URL or version bump yet.

**Step 3: Write minimal implementation**

Wire the 3D worker URL into app startup, preserve existing parser-worker behavior, and bump the patch version by one.

**Step 4: Run test to verify it passes**

Run: `node --test tests/app-view-inputs.test.mjs tests/ui/app-view.test.mjs tests/worker-url-builder.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main.mjs src/ui/AppView.mjs package.json package-lock.json tests/app-view-inputs.test.mjs tests/ui/app-view.test.mjs tests/worker-url-builder.test.mjs
git commit -m "feat: wire dedicated 3d worker into app startup"
```

### Task 7: Verify the focused path and full suite

**Files:**

- Modify: any files touched in Tasks 1-6

**Step 1: Run focused regression tests**

Run: `node --test tests/ui/renderers/scene3d.mjs tests/ui/app-view.test.mjs tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene3d-controller.test.mjs tests/ui/pcb-scene-external-models.test.mjs tests/ui/pcb-scene-step-loader.test.mjs tests/worker-url-builder.test.mjs`
Expected: PASS.

**Step 2: Run the full repo suite**

Run: `npm test`
Expected: PASS with exit code `0`.

**Step 3: Review the diff**

Run: `git diff -- docs/plans/2026-03-22-pcb-3d-worker-prep-design.md docs/plans/2026-03-22-pcb-3d-worker-prep-implementation-plan.md src/main.mjs src/WorkerUrlBuilder.mjs src/ui/Scene3dRenderer.mjs src/ui/AppView.mjs src/ui/PcbScene3dController.mjs src/ui/PcbScene3dRuntime.mjs src/ui/PcbScene3dExternalModels.mjs src/ui/PcbScene3dBuilder.mjs src/ui/PcbScene3dStepLoader.mjs src/ui/PcbScene3dWorkerClient.mjs src/workers/pcb-scene3d.worker.mjs src/styles/20-viewer.css tests/ui/renderers/scene3d.mjs tests/ui/app-view.test.mjs tests/ui/pcb-scene-builder.test.mjs tests/ui/pcb-scene3d-controller.test.mjs tests/ui/pcb-scene-external-models.test.mjs tests/ui/pcb-scene-step-loader.test.mjs tests/ui/pcb-scene3d-worker-client.test.mjs tests/worker-url-builder.test.mjs tests/app-view-inputs.test.mjs package.json package-lock.json`
Expected: only the 3D worker-prep implementation, tests, docs, and version bump appear.
