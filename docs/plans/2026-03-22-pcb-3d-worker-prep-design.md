# PCB 3D Worker Prep Design

## Goal

Move the heavy 3D scene parsing and preprocessing work off the main thread and keep a visible loading spinner in the `3D` tab until the scene is fully ready, including all components and all resolvable external or embedded models.

## Scope

- Offload 3D scene-description building and STEP preprocessing to a dedicated browser worker.
- Keep the existing parser worker focused on native document parsing.
- Show a 3D-local loading overlay while the worker job and runtime model loading are still in flight.
- Hide the spinner only after every component is visible either through a resolved model or its fallback body and the runtime has completed a final render pass.
- Preserve the existing 3D toolbar, inspector, and diagnostics behaviors.

## Out Of Scope

- Moving the full Three.js renderer to `OffscreenCanvas`.
- Changing the top-level document parse flow.
- Cross-highlighting with the 2D PCB tab.
- Persistent 3D scene caching across page reloads.

## Recommended Approach

Introduce a dedicated `pcb-scene3d` worker that owns scene preprocessing for the `3D` tab.

- `PcbScene3dController` becomes async and job-based.
- `AppView` renders the existing 3D shell immediately, but keeps a loading overlay visible while 3D prep is pending.
- The worker builds the serializable scene description, resolves model matches, and preprocesses embedded or session-backed STEP data into renderer-friendly payloads.
- `PcbScene3dRuntime` stays on the main thread and remains responsible for browser-only rendering work: creating the canvas, constructing `THREE` objects, wiring controls, and mounting already-prepared model payloads.

This keeps the largest CPU-bound work off the UI thread without rewriting the renderer architecture.

## Architecture

### Worker Boundary

- Create `src/workers/pcb-scene3d.worker.mjs`.
- Move scene-description creation behind a worker message protocol.
- Add a small browser-side worker client wrapper, owned by the 3D controller or view layer, so the rest of the app does not speak raw worker messages directly.

### Prep Responsibilities

The 3D prep worker should:

- build the base scene description from `documentModel.pcb`
- resolve component-body and session model matches
- load and tessellate embedded or session `STEP` models when possible
- return serializable payloads that the runtime can mount without repeating heavy parsing

The main-thread runtime should:

- build the board, copper, silkscreen, and fallback body meshes
- mount preprocessed STEP meshes directly
- continue to load `WRL` models on the main thread because that path depends on browser loader APIs
- manage camera controls, selection, resize, and final rendering

## Loading And Ready Contract

The spinner must stay visible until the 3D scene is completely ready.

The controller should treat the scene as `ready` only when all of the following are true:

1. the latest 3D prep worker job has completed successfully
2. the runtime has created the scene and mounted the procedural board/fallback geometry
3. every resolved model placement has either:
    - mounted its prepared `STEP` mesh payload
    - mounted its loaded `WRL` scene
    - failed cleanly and confirmed fallback-body visibility
4. the runtime has performed one final render after the last placement state change

This means the overlay remains visible during:

- worker-side scene preprocessing
- lazy Three.js module loading
- lazy `WRL` loader work
- final placement/fallback settlement

## Job Ownership And Cancellation

The controller should assign a monotonically increasing job id to every 3D prep request.

- opening the `3D` tab starts a new job
- switching documents or adding session assets while `3D` is active starts a newer job
- late worker or runtime results from older jobs are ignored
- disposing the controller terminates any active worker client/runtime listeners

This keeps the `3D` tab stable when the user switches files quickly.

## Data Shape

The worker result should include:

- the existing scene description fields needed by `PcbScene3dRuntime`
- preprocessed external placement metadata
- prepared `STEP` mesh payloads keyed by placement or model identity
- lightweight diagnostics produced during prep

The runtime input should not contain browser-only objects such as `File`, `Blob`, `THREE` classes, or DOM nodes.

## Error Handling

Failure must remain non-fatal.

- worker initialization failure: fall back to main-thread prep and keep the loading overlay until runtime settlement still completes
- prep failure for one model: keep the scene alive, emit a diagnostic, and ensure fallback geometry remains visible
- lazy loader failure for `WRL`: emit a diagnostic and keep fallback geometry visible
- job cancellation: ignore stale completion without changing the visible scene

## Testing Strategy

- `AppView` tests should verify that the 3D view renders a loading overlay while prep is pending and removes it only after readiness is signaled.
- `PcbScene3dController` tests should verify job-based loading state, stale job suppression, and readiness callbacks.
- worker-facing tests should verify the dedicated worker URL and message protocol.
- `Scene3dRenderer` tests should verify the 3D shell includes the loading overlay mount.
- runtime/external-model tests should verify readiness waits for model settlement, not just initial canvas creation.

## Acceptance Criteria

- Opening the `3D` tab no longer performs heavy scene preprocessing on the main thread when worker support is available.
- The `3D` tab shows a visible loading spinner while preprocessing and model settlement are still in progress.
- The spinner hides only after all components are represented in the final rendered scene, either by resolved models or fallbacks.
- Switching files or assets while loading does not flash stale 3D scenes.
- Existing 3D controls, selection, and diagnostics continue to work.
