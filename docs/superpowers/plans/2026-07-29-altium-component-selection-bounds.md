# Altium Component Selection Bounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Size and place selected Altium PCB component markers from their rendered, component-owned footprint geometry instead of a fixed marker centered on the component anchor.

**Architecture:** Extend the existing application-owned rendered-footprint bounds resolver to recognize Altium's exact `data-component` ownership contract alongside KiCad's `data-footprint-id` prefix contract. The existing component marker renderer will then consume the same geometry union, margin, and scene-transform path for both formats.

**Tech Stack:** ECMAScript modules, renderer-owned SVG markup, Node.js test runner through `npm test`, repository structured-data and static-build scripts.

## Global Constraints

- Preserve the existing KiCad `data-footprint-id` behavior.
- Match Altium `data-component` ownership exactly.
- Ignore similarly prefixed component keys.
- Reuse the existing supported SVG geometry, marker margin, and scene-transform behavior.
- Leave the fixed component-anchor marker as the final fallback when no rendered geometry exists.
- Use only source-neutral synthetic test data.
- Follow four-space indentation, single quotes, no semicolons, no trailing commas, and JSDoc for every added function.
- Keep each modified source and test file under 1000 lines.
- Increment ECAD Forge from `1.13.14` to `1.13.15` and synchronize structured data.
- Publishing, pushing, tagging, GitHub releases, and deployment are outside scope.

## File Responsibility Map

- `tests/ui/pcb-view-renderer.test.mjs`: owns the observable Altium rendered-footprint marker regression.
- `src/ui/PcbRenderedFootprintBoundsResolver.mjs`: normalizes supported rendered SVG ownership contracts into marker bounds.
- `package.json` and `package-lock.json`: own the `1.13.15` application version.
- `tests/toolkit-api-convergence.test.mjs`: pins the expected application version.
- `src/*.html`: receive generated structured-data version updates.
- `docs/superpowers/specs/2026-07-29-altium-component-selection-bounds-design.md`: records the accepted behavior and verification contract.

---

### Task 1: Resolve Altium rendered component geometry

**Files:**
- Modify: `tests/ui/pcb-view-renderer.test.mjs`
- Modify: `src/ui/PcbRenderedFootprintBoundsResolver.mjs`

**Interfaces:**
- Consumes: `PcbRenderedFootprintBoundsResolver.resolveMarkerBounds(markup: string, selectedComponentKey: string, viewBox: object | null)`.
- Produces: the existing `{ x, y, width, height, rx } | null` marker bounds from either KiCad `data-footprint-id` or exact Altium `data-component` ownership.

- [ ] **Step 1: Write the failing renderer regression**

Insert this test before the existing KiCad rendered-footprint regression in
`tests/ui/pcb-view-renderer.test.mjs`:

```js
/**
 * Verifies Altium rendered component ownership provides selection geometry
 * when parsed primitives cannot provide usable bounds.
 */
test('PcbViewRenderer bounds Altium selection markers from rendered component geometry', () => {
    const documentModel = createWrappedPcbDocument()
    const originalRenderPcb = EcadRendererService.renderPcb
    EcadRendererService.renderPcb = () =>
        '<svg class="pcb-svg pcb-svg--altium pcb-svg--top" viewBox="0 0 1000 800">' +
        '<g class="pcb-component" data-component-key="A1" transform="translate(500 250) rotate(0)"></g>' +
        '<line data-component="A1" x1="320" y1="100" x2="680" y2="100"></line>' +
        '<rect data-component="A1" x="300" y="120" width="400" height="360"></rect>' +
        '<rect data-component="A10" x="0" y="0" width="1000" height="800"></rect>' +
        '</svg>'

    try {
        const html = PcbViewRenderer.render(
            documentModel,
            'top',
            null,
            [],
            [],
            'A1'
        )

        assert.match(
            html,
            /pcb-component-selection-marker__fill" x="260" y="60" width="480" height="460"/
        )
        assert.doesNotMatch(
            html,
            /class="pcb-component-selection-marker"[^>]*transform=/
        )
    } finally {
        EcadRendererService.renderPcb = originalRenderPcb
    }
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/ui/pcb-view-renderer.test.mjs
```

Expected: FAIL in `PcbViewRenderer bounds Altium selection markers from rendered component geometry` because the current resolver ignores `data-component` and emits the transform-local fallback marker.

- [ ] **Step 3: Recognize both rendered ownership contracts**

Replace the matcher setup at the start of
`PcbRenderedFootprintBoundsResolver.resolveMarkerBounds()` with:

```js
const escapedComponentKey =
    PcbRenderedFootprintBoundsResolver.#escapeRegExp(
        PcbRenderedFootprintBoundsResolver.#escapeHtml(
            selectedComponentKey
        )
    )
const footprintPrefix =
    PcbRenderedFootprintBoundsResolver.#escapeRegExp(
        PcbRenderedFootprintBoundsResolver.#escapeHtml(
            'footprint:' + selectedComponentKey + ':'
        )
    )
const matcher = new RegExp(
    '<([a-zA-Z][\\w:-]*)\\b(?=[^>]*\\b(?:data-footprint-id="' +
        footprintPrefix +
        '|data-component="' +
        escapedComponentKey +
        '"))[^>]*>',
    'g'
)
```

The `data-footprint-id` branch remains a prefix match, while the closing quote
in the `data-component` branch makes Altium ownership exact.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- tests/ui/pcb-view-renderer.test.mjs
```

Expected: PASS with the new Altium regression and all existing PCB renderer
tests green.

- [ ] **Step 5: Check file-size and formatting constraints**

Run:

```bash
wc -l src/ui/PcbRenderedFootprintBoundsResolver.mjs tests/ui/pcb-view-renderer.test.mjs
npx prettier --check src/ui/PcbRenderedFootprintBoundsResolver.mjs tests/ui/pcb-view-renderer.test.mjs
```

Expected: both files remain below 1000 lines and Prettier reports both files
formatted.

### Task 2: Version and verify the application

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/toolkit-api-convergence.test.mjs`
- Modify: `src/*.html`

**Interfaces:**
- Consumes: the green rendered-component selection behavior from Task 1.
- Produces: a locally verified ECAD Forge `1.13.15` working tree.

- [ ] **Step 1: Increment the application version**

Run:

```bash
npm version 1.13.15 --no-git-tag-version
```

Then change the convergence assertion to:

```js
assert.equal(pkg.version, '1.13.15')
```

- [ ] **Step 2: Synchronize generated structured data**

Run:

```bash
npm run sync:structured-data
```

Expected: generated `src/*.html` software-version metadata is updated to
`1.13.15`.

- [ ] **Step 3: Run repository verification**

Run:

```bash
npm test
npm run check:structured-data
npm run build:static
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 4: Verify the exact local PCB route**

Open the supplied local route with the large component selected. Compare the
selection marker and the selected component's exact rendered
`data-component` geometry in the mounted SVG.

Expected: the marker encloses the component-owned rendered footprint geometry
on all sides, is emitted in board space without a component-anchor transform,
and the page reports ECAD Forge `1.13.15`.

- [ ] **Step 5: Commit the locally verified change**

```bash
git add docs/superpowers/specs/2026-07-29-altium-component-selection-bounds-design.md docs/superpowers/plans/2026-07-29-altium-component-selection-bounds.md tests/ui/pcb-view-renderer.test.mjs src/ui/PcbRenderedFootprintBoundsResolver.mjs package.json package-lock.json tests/toolkit-api-convergence.test.mjs src/*.html
git commit -m "fix: size PCB selection markers from rendered components"
```

Do not push, tag, publish, release, or deploy.
