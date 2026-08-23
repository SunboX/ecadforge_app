# PCB Mechanical Drawing Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the PCB mechanical-drawings checkbox only when the active PCB contains a separate off-board technical drawing sheet.

**Architecture:** Add a technical-drawing resolver to `PcbLayerVisibilityModel` and reuse it in both checkbox rendering and default hidden-state initialization. Match generic primitive layer identifiers against normalized drawing-layer aliases, then compare their artwork envelope with the physical board outline without file-specific logic.

**Tech Stack:** Browser JavaScript modules, Node test runner, npm, static GitHub Actions deployment.

## Global Constraints

- Preserve the existing default-hidden and viewport-refit behavior for PCBs with drawings.
- Empty, malformed, and ordinary on-board drawing collections count as no separate technical sheet.
- Keep all source and test files below 1000 lines and add JSDoc for every function.
- Release the refined content distinction as ECAD Forge 1.13.31.

---

### Task 1: Technical-drawing envelope resolution

**Files:**

- Modify: `tests/core/pcb-layer-visibility-model.test.mjs`
- Modify: `src/core/PcbLayerVisibilityModel.mjs`
- Create: `src/core/PcbTechnicalDrawingContent.mjs`

**Interfaces:**

- Consumes: `resolveMechanicalDrawingLayerKeys(documentModel): string[]`
- Produces: `resolveTechnicalDrawingLayerKeys(documentModel): string[]`

- [ ] **Step 1: Write the failing model tests**

Add one PCB whose declared mechanical and notes layers contain off-board tracks
and text, one whose matching primitives stay on the board, and one with empty
primitive collections. Assert only the first resolves technical-drawing keys.

- [ ] **Step 2: Verify the tests fail for missing content awareness**

Run: `node --test tests/core/pcb-layer-visibility-model.test.mjs`

Expected: FAIL because `resolveTechnicalDrawingLayerKeys` does not
exist.

- [ ] **Step 3: Implement the generic envelope resolver**

Build aliases for each qualifying layer from its stable key, name, ids, and
legacy ids. Scan `tracks`, `arcs`, `fills`, `regions`, `shapeBasedRegions`,
`polygons`, `texts`, and `dimensions`; compare matched geometry bounds with the
native board outline and return keys only for a materially larger envelope.

- [ ] **Step 4: Verify the focused model tests pass**

Run: `node --test tests/core/pcb-layer-visibility-model.test.mjs`

Expected: all tests pass with zero failures.

### Task 2: Checkbox and default-state integration

**Files:**

- Modify: `tests/ui/pcb-mechanical-drawings-toggle.test.mjs`
- Modify: `tests/app-controller-local-load-selection.test.mjs`
- Modify: `src/ui/PcbMechanicalDrawingsToggleRenderer.mjs`
- Modify: `src/core/PcbLayerVisibilityModel.mjs`

**Interfaces:**

- Consumes: `resolveTechnicalDrawingLayerKeys(documentModel): string[]`
- Produces: checkbox markup only for separate technical sheets and matching default hidden state

- [ ] **Step 1: Write failing observable behavior tests**

Assert `PcbViewRenderer.render()` omits `data-pcb-mechanical-drawings` for a
board whose mechanical primitives stay on-board. Extend controller coverage so
empty drawing-layer declarations do not create hidden-layer state.

- [ ] **Step 2: Verify the focused tests fail for the current metadata-only behavior**

Run: `node --test tests/ui/pcb-mechanical-drawings-toggle.test.mjs tests/app-controller-local-load-selection.test.mjs`

Expected: FAIL because the checkbox and hidden state are still created.

- [ ] **Step 3: Route both consumers through the content-aware resolver**

Use `resolveTechnicalDrawingLayerKeys()` in the checkbox renderer and
in `withMechanicalDrawingsHiddenByDefault()`.

- [ ] **Step 4: Verify focused tests pass**

Run: `node --test tests/core/pcb-layer-visibility-model.test.mjs tests/ui/pcb-mechanical-drawings-toggle.test.mjs tests/app-controller-local-load-selection.test.mjs`

Expected: all tests pass with zero failures.

### Task 3: Release and production verification

**Files:**

- Create: `docs/release-notes-v1.13.31.md`
- Modify: package, lockfile, and structured-data versions for 1.13.31

**Interfaces:**

- Consumes: verified app source and tests
- Produces: ECAD Forge v1.13.31 GitHub release and successful production deployment

- [ ] **Step 1: Add release notes and run fresh verification**

Run `npm test`, `npm run check:format`, `npm run check:structured-data`, and
`npm run build:static`. Every command must exit zero.

- [ ] **Step 2: Commit and publish the complete intended 1.13.31 app release**

Review `git diff`, commit intended app changes with an imperative prefixed
message, push `main`, and create GitHub release `v1.13.31` from the pushed SHA.

- [ ] **Step 3: Wait for deployment success**

Use `gh run list --branch main --commit <sha>` followed by
`gh run watch <run-id> --exit-status`. The exact deployment must conclude
`success`.

- [ ] **Step 4: Verify production behavior**

Open a PCB containing drawings and a PCB without drawings in fresh browser
state. Confirm the first exposes the unchecked control and the second has no
checkbox. Confirm the deployed footer reports version 1.13.31 and the console
has no relevant errors.
