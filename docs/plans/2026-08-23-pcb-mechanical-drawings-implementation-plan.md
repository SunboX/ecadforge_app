# PCB Mechanical Drawings Visibility Implementation Plan

> **For Codex:** Execute this plan inline with test-driven development, because
> the approved release changes the app and its sibling rendering library.

**Goal:** Hide PCB mechanical/documentation drawings by default, fit the
viewport to visible board content, and render the drawing text when users show
those layers.

**Architecture:** Extend `altium-toolkit` with shared documentation-text
selection and hidden-layer-aware viewBox calculation. Reuse ECAD Forge's
existing hidden-layer state and grouped layer event contract for the aggregate
checkbox, initializing that state when parsed documents are added.

**Tech stack:** Browser JavaScript modules, Node test runner, npm package
release, static deployment through GitHub Actions.

---

### Task 1: Lock toolkit renderer behavior with failing tests

**Files:**

- Modify: `../altium-toolkit/tests/ui/pcb-text-primitive-renderer.test.mjs`
- Modify: `../altium-toolkit/tests/ui/pcb-svg-semantic-metadata.test.mjs`

Add generic models containing top/bottom overlay text and shared mechanical,
assembly, dimension, and notes text. Assert shared text appears on either side.
Add off-board detail geometry and assert a matching hidden-layer option removes
it from the viewBox but not from SVG markup. Run the focused tests and confirm
they fail for the missing behavior.

### Task 2: Implement the toolkit behavior

**Files:**

- Modify: `../altium-toolkit/src/ui/PcbTextPrimitiveRenderer.mjs`
- Modify: `../altium-toolkit/src/ui/PcbSvgRenderer.mjs`

Resolve shared documentation layers from normalized roles and names. Normalize
optional hidden-layer identifiers, match them against semantic layer aliases,
and filter only the primitive/text collections passed to viewBox calculation.
Include visible text extents in that calculation. Run focused tests, then the
full toolkit suite.

### Task 3: Lock app state and UI behavior with failing tests

**Files:**

- Modify: `tests/core/pcb-layer-visibility-model.test.mjs`
- Modify: the focused controller parsed-document test
- Modify: `tests/ui/pcb-view-renderer*.test.mjs`
- Modify: `tests/ui/viewer-sidebar-event-binder.test.mjs`

Assert generic compact names such as `Mechanical1` classify correctly, newly
loaded PCB documents initialize those layers hidden, the aggregate checkbox is
rendered unchecked, grouped checkbox changes reuse the existing layer callback,
and hidden aliases affect renderer options and base-SVG caching.

### Task 4: Implement app integration

**Files:**

- Modify: `src/core/PcbLayerVisibilityModel.mjs`
- Modify: `src/AppController.mjs`
- Modify: `src/ui/PcbViewRenderer.mjs`
- Modify: `src/ui/ViewerSidebarEventBinder.mjs`
- Modify: relevant PCB toolbar CSS and UI text modules

Add public aggregate resolution and initialization helpers, merge defaults only
for new PCB document ids, render the checkbox beside side controls, bind its
change event, and forward hidden aliases into the renderer/cache key. Keep
individual layer controls and presets synchronized through the same state map.

### Task 5: Release the sibling toolkit

Update toolkit documentation/changelog as appropriate, bump to `1.4.8`, run
the full suite and `npm publish --dry-run`, commit all intended toolkit work,
push `main`, create the GitHub release, publish to npm, and verify the registry
version and dist-tag.

### Task 6: Integrate and release ECAD Forge

Install the published toolkit version, bump ECAD Forge to `1.13.27`, sync
structured data, and run `npm test`, `npm run check:structured-data`, and
`npm run build:static`. Commit all intended work, push `main`, create the GitHub
release, wait for the exact deployment workflow to succeed, then verify the
deployed version and behavior in a fresh browser session.
