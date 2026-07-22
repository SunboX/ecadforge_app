# PCB 3D Lazy First Paint Design

## Goal

Reduce time-to-first-paint in the `3D` tab by rendering an interactive board shell immediately and deferring expensive detail work until after the first frame is visible.

## Approaches Considered

### 1. Keep eager loading

Preserve the current behavior where scene prep preloads STEP meshes and the runtime waits for all async detail before reporting ready.

- Lowest implementation risk
- Does not materially improve first paint
- Keeps the current trace hotspot intact

### 2. Defer STEP imports only

Return the scene description without preloaded STEP payloads, then let the runtime import external models later.

- Removes the largest worker hotspot
- Improves first paint substantially
- Still keeps some main-thread detail construction on the critical path

### 3. Stage the full 3D first paint

Render the board, outline, camera controls, and fallback bodies first. Defer copper, silkscreen, via detail, and external STEP models until after the initial frame.

- Best perceived performance
- Keeps the scene interactive almost immediately
- Slightly more lifecycle complexity because runtime readiness splits into first-frame readiness and background detail completion

## Chosen Approach

Approach 3.

The scene should become interactive as soon as the board and fallback bodies are present. Heavy detail remains behavior-identical in the final settled scene, but it no longer blocks the first visible frame.

## Design

### Scene prep worker

`PcbScene3dScenePreparator` should stop preloading STEP mesh payloads during the initial worker pass. Its responsibility becomes:

- resolve the model registry
- build the normalized scene description
- return that description promptly

This keeps worker prep focused on structural normalization instead of full external-model import.

### Runtime staging

`PcbScene3dRuntime` should split initialization into two phases.

Phase 1: first frame

- load Three modules
- create the renderer, scene, camera, controls, and selection interaction
- build the board mesh and outline
- mount fallback bodies
- create empty placeholder groups for deferred detail
- render once
- resolve `whenReady()`

Phase 2: deferred detail

- yield to the browser so the first frame can paint
- build and attach silkscreen
- build and attach copper and vias
- load and attach external models
- re-render after each stage as needed

### Loading semantics

The AppView loading overlay should drop after the runtime reaches first-frame readiness, not after every deferred detail stage is complete.

The diagnostics panel can continue to show normal usage guidance and any later model-load failures. The scene does not need a second blocking overlay once the first frame is visible.

### Error handling

- If deferred detail fails, keep the board shell and fallback bodies visible.
- STEP model failures should continue to surface as diagnostics and leave fallback bodies in place.
- Deferred copper or silkscreen failures should not tear down the whole runtime.

## Testing

Add or update tests to cover:

- `PcbScene3dScenePreparator` no longer calling the STEP loader during the initial prep path
- existing controller loading-state coverage still passing with first-frame readiness semantics
- existing external-model and STEP-loader tests still passing after the runtime lifecycle shift
