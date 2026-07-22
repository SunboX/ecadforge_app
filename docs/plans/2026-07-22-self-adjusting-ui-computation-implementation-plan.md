# Self-Adjusting UI Computation Implementation Plan

**Goal:** Repair only ECAD Forge UI stages affected by state changes while
preserving from-scratch behavior.

**Architecture:** `AppState` is the explicit mutator and publishes conservative
changed roots. A reusable runtime records dynamic reads, maintains reverse
reader lists, and propagates changes through six named `AppView` DOM stages in
deterministic order. Trace replacement removes stale control dependencies and
bounds memory by the current graph.

**Tech stack:** JavaScript ES modules, private class fields, Node.js test
runner, browser `Proxy` and `Reflect` APIs.

## Constraints

- Work directly on the existing dirty local `main` branch.
- Do not create a worktree, push, publish, tag, deploy, stage, or commit.
- Preserve parsed-document identity and toolkit cache ownership.
- Keep `.mjs` files below 1000 lines and document every method with JSDoc.
- Use repo-owned fake data and repository test commands.

## Task 1: Dynamic trace runtime

**Files:**

- Create `src/core/SelfAdjustingComputation.mjs`.
- Create `tests/self-adjusting-computation.test.mjs`.

- [x] Add failing tests for dependency reads, control flow, enumeration,
      property presence, atomic identity, failure, and write rejection.
- [x] Implement synchronous proxy tracing and exact dependency comparison.
- [x] Add failing tests for changed-root reader lists, stale-edge deletion,
      from-scratch consistency, trace reclamation, and async trace escape.
- [x] Implement ordered `propagate()`, reverse reader indexes, atomic trace
      replacement, `forget()`, `clear()`, and trace statistics.
- [x] Verify the focused runtime tests pass.

## Task 2: Explicit mutator change sets

**Files:**

- Modify `src/core/AppState.mjs`.
- Modify `src/AppController.mjs`.
- Modify `tests/app-state.test.mjs`.

- [x] Add a failing test for initial, direct, and derived changed paths.
- [x] Publish `null` for initial execution and conservative root paths for
      state mutations.
- [x] Include derived document identity, filename, selection, visibility, and
      opacity roots when document membership can normalize them.
- [x] Forward change paths through `AppController` to the view.
- [x] Verify state and controller-compatible tests pass.

## Task 3: Self-adjusting AppView stages

**Files:**

- Create `src/ui/AppViewRenderGraph.mjs`.
- Modify `src/ui/AppView.mjs`.
- Modify `tests/ui/app-view-schematic-reuse.test.mjs`.

- [x] Add a failing status-only propagation integration test.
- [x] Route status, locale, viewer mode, tabs, sidebar, and content through
      stable named computations in DOM execution order.
- [x] Make locale an explicit dependency for translated stages.
- [x] Preserve raw document/scope identity outside the proxy membrane.
- [x] Avoid eager whole-snapshot reads in sidebar preparation.
- [x] Verify focused runtime, state, and UI integration tests pass.

## Task 4: Documentation, version, and full verification

**Files:**

- Modify `docs/architecture.md`.
- Modify `package.json`, `package-lock.json`, generated `src/*.html`, and the
  version convergence test.

- [x] Record publication-derived requirements and scope in the design spec.
- [x] Document the mutator, trace runtime, render graph, and guarantees in the
      architecture inventory and data flow.
- [x] Advance the existing dirty app version from `1.13.5` to `1.13.6`.
- [x] Run structured-data synchronization and validation.
- [x] Run the full repository test suite.
- [x] Build the static deployment artifact locally.
- [x] Run formatting/diff checks and inspect the final dirty branch without
      staging, committing, pushing, publishing, or deploying.

## Task 5: Shared local-library ownership

**Files:**

- Move `SelfAdjustingComputation` and its unit suite to the local
  `circuitjson-toolkit` sibling.
- Modify the root API and API-entrypoint tests in `circuitjson-toolkit`,
  `gerber-toolkit`, `altium-toolkit`, and `kicad-toolkit`.
- Create `PcbScene3dVisibilityGraph.mjs` and its focused tests in
  `pcb-scene3d-viewer`; modify `PcbScene3dRuntime.mjs` and its public API.
- Modify ECAD Forge imports, convergence tests, architecture docs, and version
  artifacts.

- [x] First make the common-runtime tests fail in `circuitjson-toolkit`, then
      move the implementation to the shared package and make them pass.
- [x] Add API identity tests before exposing the canonical runtime from every
      local format toolkit.
- [x] Add selective 3D visibility-repair and from-scratch-consistency tests
      before integrating the visibility graph into the persistent runtime.
- [x] Install the dirty local siblings without changing dependency ranges or
      publishing packages, then run every affected repository's own tests.
- [x] Advance the app version, regenerate structured data, and rerun the app
      test, structured-data, and static-build gates.
