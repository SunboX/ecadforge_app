# Schematic Pan And Zoom Implementation Plan

**Goal:** Add cursor-centered mouse-wheel zoom and primary-button drag panning to the schematic SVG without changing the existing schematic renderer output.

**Architecture:** Introduce a small stateful UI controller that owns SVG `viewBox` math and DOM event binding. Keep `SchematicSvgRenderer` as a pure markup generator, then have `AppView` attach and dispose the controller whenever the schematic tab is rendered so interaction state resets naturally with each fresh SVG.

**Tech Stack:** Node.js, native `node:test`, ESM modules, SVG `viewBox` math, existing `AppView` render flow, CSS cursor states.

---

### Task 1: Lock the viewport math with failing controller tests

**Files:**

- Create: `tests/ui/schematic-viewport-controller.test.mjs`
- Create: `src/ui/SchematicViewportController.mjs`

**Step 1: Write the failing test**

Create a fake SVG element test harness that stores `viewBox`, event listeners, and a fixed `getBoundingClientRect()` response, then add focused behavior tests such as:

```js
test('wheel zoom keeps the cursor document point stable', () => {
    const svg = createFakeSvg({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 }
    })
    const controller = new SchematicViewportController(svg)

    svg.dispatch('wheel', {
        deltaY: -100,
        clientX: 100,
        clientY: 50,
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '25 12.5 100 50')
    controller.dispose()
})
```

Also cover zoom-out clamping and drag panning while the primary mouse button is held.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/schematic-viewport-controller.test.mjs`

Expected: FAIL because `src/ui/SchematicViewportController.mjs` does not exist yet.

**Step 3: Write minimal implementation**

Add `SchematicViewportController` as a single-class module with private fields for the SVG node, default/current `viewBox`, drag state, and bound listeners. Implement:

- constructor that reads the initial `viewBox` and binds listeners
- wheel handler that scales around the cursor's document-space point
- mouse handlers for primary-button drag pan
- `dispose()` to remove listeners and clear transient state
- small private helpers for parsing/serializing `viewBox`, converting client points to SVG points, and clamping zoom extents

Keep the public API minimal:

```js
export class SchematicViewportController {
    #svg
    #defaultViewBox
    #viewBox
    #isDragging

    constructor(svgElement) {
        this.#svg = svgElement
        this.#defaultViewBox = this.#readViewBox()
        this.#viewBox = { ...this.#defaultViewBox }
        this.#bindEvents()
    }

    dispose() {
        this.#unbindEvents()
        this.#isDragging = false
    }
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/schematic-viewport-controller.test.mjs`

Expected: PASS for cursor-centered zoom, zoom limits, and drag pan behavior.

**Step 5: Commit**

Run:

```bash
git add tests/ui/schematic-viewport-controller.test.mjs src/ui/SchematicViewportController.mjs
git commit -m "feat: add schematic viewport controller"
```

### Task 2: Attach the controller from the view layer and style the interaction surface

**Files:**

- Modify: `src/ui/AppView.mjs`
- Modify: `src/styles/20-viewer.css`
- Create: `tests/ui/app-view.test.mjs`

**Step 1: Write the failing integration test**

Add an `AppView` test that builds the minimum document shell needed for `render()`, renders a schematic snapshot, mutates the SVG `viewBox` through the controller, renders the same snapshot again, and asserts the new SVG is back at the default full-sheet camera.

Use a narrow observable contract:

```js
assert.equal(
    document.querySelector('.schematic-svg').getAttribute('viewBox'),
    '0 0 200 100'
)
```

Also assert that the schematic SVG gets the expected idle cursor styling hook.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/app-view.test.mjs`

Expected: FAIL because `AppView` does not yet create or dispose a schematic viewport controller.

**Step 3: Write minimal implementation**

Update `AppView` to own one `#schematicViewportController` field. Before replacing `#viewContent.innerHTML`, dispose the current controller if present. After rendering schematic markup, query `.schematic-svg` and attach a new `SchematicViewportController`.

Keep the renderer untouched. The `AppView` change should be limited to lifecycle wiring:

```js
if (this.#schematicViewportController) {
    this.#schematicViewportController.dispose()
    this.#schematicViewportController = null
}

this.#contentNode.innerHTML = SchematicSvgRenderer.render(
    snapshot.documentModel
)
const svgNode = this.#contentNode.querySelector('.schematic-svg')
if (svgNode instanceof SVGElement) {
    this.#schematicViewportController = new SchematicViewportController(svgNode)
}
```

Update `src/styles/20-viewer.css` so `.schematic-svg` advertises `cursor: grab`, disables text selection during drag, and has a modifier such as `.schematic-svg.is-panning { cursor: grabbing; }`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/schematic-viewport-controller.test.mjs tests/ui/app-view.test.mjs`

Expected: PASS for controller math and `AppView` re-render reset behavior.

**Step 5: Commit**

Run:

```bash
git add src/ui/AppView.mjs src/styles/20-viewer.css tests/ui/app-view.test.mjs
git commit -m "feat: wire schematic pan and zoom into app view"
```

### Task 3: Bump the app version and verify the full repository

**Files:**

- Modify: `package.json`

**Step 1: Bump version**

Increment `package.json` once after the feature code and tests are in place.

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS with the new viewport tests included and no regressions elsewhere.

**Step 3: Commit**

Run:

```bash
git add package.json docs/plans/2026-03-16-schematic-pan-zoom-design.md docs/plans/2026-03-16-schematic-pan-zoom-implementation-plan.md
git commit -m "feat: add schematic pan and zoom interactions"
```
