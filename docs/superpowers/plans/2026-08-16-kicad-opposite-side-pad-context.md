# KiCad Opposite-Side Pad Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render copper-bearing component pads together with routed copper when ECAD Forge requests opposite-side KiCad copper context, then release and deploy the correction.

**Architecture:** `kicad-toolkit` owns the visibility correction because it owns `includeOppositeCopper` and deterministic KiCad SVG rendering. ECAD Forge keeps its existing renderer call, adds an integration regression, consumes the newly released toolkit patch, increments its app version, and follows its structured-data and FTP deployment gates.

**Tech Stack:** ECMAScript modules, Node.js test runner via repository `npm test` scripts, npm trusted publishing through GitHub Actions, GitHub releases, ECAD Forge static deployment workflow, Playwright CLI browser verification.

## Global Constraints

- `includeOppositeCopper: true` must include copper-bearing pads as well as routed copper.
- Strict side rendering must remain unchanged when the option is absent or false.
- Through-hole pads visible on both sides must render exactly once.
- Do not include opposite-side silkscreen, fabrication, courtyard, mask-only, or paste-only artwork.
- Do not mutate parsed pad side metadata or special-case any file, footprint, component, or pad count.
- Implement toolkit-owned behavior in `../kicad-toolkit`, not with an ECAD Forge overlay or model rewrite.
- Use source-neutral fake board records in automated tests.
- Follow four-space indentation, single quotes, no semicolons, no trailing commas, and JSDoc for added functions.
- Release `kicad-toolkit` `1.3.3`, update ECAD Forge to `1.13.16`, push both `main` branches, and verify the production deployment.

## File Responsibility Map

- `../kicad-toolkit/tests/ui/pcb-svg-renderer-kicad-view.test.mjs`: proves strict and contextual pad visibility using a fake two-layer board.
- `../kicad-toolkit/src/ui/PcbSvgRenderer.mjs`: selects active-side and requested opposite-side copper pads.
- `../kicad-toolkit/src/ui/PcbSvgVisibility.mjs`: owns the copper-bearing opposite-pad predicate.
- `../kicad-toolkit/package.json` and `../kicad-toolkit/package-lock.json`: own the `1.3.3` release version.
- `../kicad-toolkit/docs/release-notes-v1.3.3.md` and `../kicad-toolkit/README.md`: document the renderer correction.
- `tests/core/ecad-services.test.mjs`: proves ECAD Forge requests complete copper context on both sides.
- `package.json` and `package-lock.json`: own the ECAD Forge `1.13.16` version and `kicad-toolkit` `^1.3.3` dependency.
- `tests/toolkit-api-convergence.test.mjs`: pins the released dependency and application versions.
- `src/*.html`: receive generated `1.13.16` structured-data metadata.

---

### Task 1: Add the failing toolkit renderer regression

**Files:**
- Modify: `../kicad-toolkit/tests/ui/pcb-svg-renderer-kicad-view.test.mjs`

**Interfaces:**
- Consumes: `PcbSvgRenderer.render(board, { side, includeOppositeCopper })`.
- Produces: an observable contract for strict and contextual pad selection.

- [ ] **Step 1: Extend the fake two-layer board with side-specific pads**

Add these records to `createTwoLayerCopperBoard().pads`:

```js
[
    {
        number: 'front-pad',
        type: 'smd',
        shape: 'rect',
        x: 2,
        y: 2,
        width: 1,
        height: 1,
        rotation: 0,
        drill: 0,
        layers: ['F.Cu', 'F.Paste', 'F.Mask'],
        side: 'front'
    },
    {
        number: 'back-pad',
        type: 'smd',
        shape: 'rect',
        x: 4,
        y: 4,
        width: 1,
        height: 1,
        rotation: 0,
        drill: 0,
        layers: ['B.Cu', 'B.Paste', 'B.Mask'],
        side: 'back'
    },
    {
        number: 'through-pad',
        type: 'thru_hole',
        shape: 'circle',
        x: 6,
        y: 6,
        width: 1.8,
        height: 1.8,
        rotation: 0,
        drill: 1,
        layers: ['*.Cu', '*.Mask'],
        side: 'both'
    }
]
```

- [ ] **Step 2: Add the strict-versus-contextual Back-side test**

```js
test('PcbSvgRenderer includes opposite-side copper pads only when requested', () => {
    const strictBack = PcbSvgRenderer.render(createTwoLayerCopperBoard(), {
        side: 'back'
    })
    const contextualBack = PcbSvgRenderer.render(createTwoLayerCopperBoard(), {
        side: 'back',
        includeOppositeCopper: true
    })

    assert.doesNotMatch(strictBack, /data-pad-number="front-pad"/)
    assert.match(strictBack, /data-pad-number="back-pad"/)
    assert.match(strictBack, /data-pad-number="through-pad"/)
    assert.match(contextualBack, /data-pad-number="front-pad"/)
    assert.match(contextualBack, /data-pad-number="back-pad"/)
    assert.equal(
        contextualBack.match(/data-pad-number="through-pad"/gu)?.length,
        2
    )
})
```

The through-pad metadata occurs once on its copper shape and once on its drill,
so an exact count of two proves the pad was not duplicated.

- [ ] **Step 3: Run the focused test and verify RED**

Run from `../kicad-toolkit`:

```bash
npm test -- tests/ui/pcb-svg-renderer-kicad-view.test.mjs
```

Expected: FAIL because `contextualBack` lacks `data-pad-number="front-pad"`.

---

### Task 2: Implement copper-bearing opposite-pad visibility

**Files:**
- Modify: `../kicad-toolkit/src/ui/PcbSvgVisibility.mjs`
- Modify: `../kicad-toolkit/src/ui/PcbSvgRenderer.mjs`
- Test: `../kicad-toolkit/tests/ui/pcb-svg-renderer-kicad-view.test.mjs`

**Interfaces:**
- Produces: `PcbSvgVisibility.isOppositeSideCopperPad(pad, side): boolean`.
- Consumes: KiCad pad `side` plus `layers` metadata and the renderer's existing `includeOppositeCopper` option.

- [ ] **Step 1: Add the focused visibility predicate**

Add to `PcbSvgVisibility`:

```js
/**
 * Checks whether a copper-bearing pad belongs only to the opposite board side.
 * @param {{ side?: string, layers?: unknown }} pad Renderable pad.
 * @param {'front' | 'back'} side Active side.
 * @returns {boolean}
 */
static isOppositeSideCopperPad(pad, side) {
    if (PcbSvgVisibility.isVisibleOnSide(pad, side)) return false
    const oppositeSide = side === 'front' ? 'back' : 'front'
    if (!PcbSvgVisibility.isVisibleOnSide(pad, oppositeSide)) return false

    return (Array.isArray(pad?.layers) ? pad.layers : [pad?.layers])
        .flatMap((value) => String(value || '').split(','))
        .map((value) => value.trim())
        .some((layer) => layer === '*.Cu' || layer.endsWith('.Cu'))
}
```

- [ ] **Step 2: Apply the predicate only under `includeOppositeCopper`**

Replace the `visiblePads` filter in `PcbSvgRenderer.render()` with:

```js
const visiblePads = renderBoardModel.pads.filter((pad) => {
    return (
        PcbSvgVisibility.isVisibleOnSide(pad, side) ||
        (includeOppositeCopper &&
            PcbSvgVisibility.isOppositeSideCopperPad(pad, side))
    )
})
```

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
npm test -- tests/ui/pcb-svg-renderer-kicad-view.test.mjs
```

Expected: all tests in the focused file pass with zero failures.

- [ ] **Step 4: Run the full toolkit suite**

Run:

```bash
npm test
npm run check:format
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 5: Commit the renderer correction**

```bash
git add src/ui/PcbSvgVisibility.mjs src/ui/PcbSvgRenderer.mjs tests/ui/pcb-svg-renderer-kicad-view.test.mjs
git commit -m "fix: include pads in opposite copper context"
```

---

### Task 3: Release `kicad-toolkit` 1.3.3

**Files:**
- Modify: `../kicad-toolkit/package.json`
- Modify: `../kicad-toolkit/package-lock.json`
- Create: `../kicad-toolkit/docs/release-notes-v1.3.3.md`
- Modify: `../kicad-toolkit/README.md`

**Interfaces:**
- Produces: npm package and GitHub release `kicad-toolkit@1.3.3`.

- [ ] **Step 1: Verify the release baseline**

Run:

```bash
npm view kicad-toolkit version
git status --short
git fetch origin
git rev-list --left-right --count main...origin/main
```

Expected: registry version `1.3.2`, clean worktree, and `0 0` branch divergence.

- [ ] **Step 2: Add release metadata and patch version**

Run `npm version 1.3.3 --no-git-tag-version`, add concise release notes that
describe complete opposite-copper pad context and the strict-side preservation,
and link `docs/release-notes-v1.3.3.md` from the README release sections.

- [ ] **Step 3: Re-run release gates**

```bash
npm test
npm run check:format
npm pack --dry-run
git diff --check
```

Expected: zero failures and a package manifest containing the changed renderer files and release notes.

- [ ] **Step 4: Commit, push, and create the release**

```bash
git add package.json package-lock.json README.md docs/release-notes-v1.3.3.md
git commit -m "chore: release kicad-toolkit 1.3.3"
git push origin main
gh release create v1.3.3 --title "kicad-toolkit 1.3.3" --notes-file docs/release-notes-v1.3.3.md
```

- [ ] **Step 5: Verify trusted npm publication**

Watch the `Publish` workflow for the release commit with `gh run watch --exit-status`, then poll:

```bash
npm view kicad-toolkit@1.3.3 version
npm view kicad-toolkit@1.3.3 gitHead
```

Expected: version `1.3.3` and `gitHead` equal to the pushed release commit.

---

### Task 4: Add the failing ECAD Forge integration regression

**Files:**
- Modify: `tests/core/ecad-services.test.mjs`

**Interfaces:**
- Consumes: `EcadRendererService.renderPcb(documentModel, { side })`.
- Produces: app-level proof that Top and Bottom request complete KiCad copper context.

- [ ] **Step 1: Add a source-neutral two-sided-pad document test**

Add a test whose `pcb.kicadBoard` contains the same three fake pad records from
Task 1 and empty drawings, texts, outlines, and footprints. Render both sides
and assert:

```js
assert.match(topMarkup, /data-pad-number="front-pad"/)
assert.match(topMarkup, /data-pad-number="back-pad"/)
assert.match(bottomMarkup, /data-pad-number="front-pad"/)
assert.match(bottomMarkup, /data-pad-number="back-pad"/)
```

- [ ] **Step 2: Run the focused test against installed 1.3.2 and verify RED**

```bash
npm test -- tests/core/ecad-services.test.mjs
```

Expected: FAIL because the installed toolkit omits the opposite-side SMD pad.

---

### Task 5: Consume the toolkit release and prepare ECAD Forge 1.13.16

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/toolkit-api-convergence.test.mjs`
- Modify: `src/*.html`
- Test: `tests/core/ecad-services.test.mjs`

**Interfaces:**
- Consumes: published `kicad-toolkit@1.3.3`.
- Produces: ECAD Forge `1.13.16` with generated version metadata.

- [ ] **Step 1: Install the released toolkit and bump the app version**

```bash
npm install --save kicad-toolkit@^1.3.3
npm version 1.13.16 --no-git-tag-version
```

- [ ] **Step 2: Update convergence expectations**

Set `TARGET_DEPENDENCIES['kicad-toolkit']` to `^1.3.3` and the expected app
version to `1.13.16` in `tests/toolkit-api-convergence.test.mjs`.

- [ ] **Step 3: Run the focused integration test and verify GREEN**

```bash
npm test -- tests/core/ecad-services.test.mjs tests/toolkit-api-convergence.test.mjs
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 4: Synchronize deployment metadata**

```bash
npm run sync:structured-data
npm run check:structured-data
```

Expected: all `src/*.html` software-version fields equal `1.13.16` and the check exits zero.

- [ ] **Step 5: Run the full app release gates**

```bash
npm test
npm run check:structured-data
npm run build:static
git diff --check
```

Expected: every command exits zero.

---

### Task 6: Verify locally, push ECAD Forge, and verify production

**Files:**
- Verify: `output/playwright/kicad-bottom-after.png`

**Interfaces:**
- Produces: local visual evidence, pushed ECAD Forge release, successful FTP deployment, and live route evidence.

- [ ] **Step 1: Restart the local server and verify the exact demo route**

Open:

```text
http://localhost:3000/?demo=kicad&view=pcb&document=RP2040_minimal.kicad_pcb
```

Use the browser to select Bottom, save
`output/playwright/kicad-bottom-after.png`, and inspect console errors. A Node
render probe must report 223 Top pads and 223 Bottom pads.

- [ ] **Step 2: Commit the application release**

```bash
git add package.json package-lock.json tests/toolkit-api-convergence.test.mjs tests/core/ecad-services.test.mjs src/*.html
git commit -m "fix: restore KiCad pads in bottom copper context"
git push origin main
```

- [ ] **Step 3: Create the ECAD Forge release**

Create concise notes from the actual diff and test evidence, then run:

```bash
gh release create v1.13.16 --title "ECAD Forge 1.13.16" --notes-file /tmp/ecadforge-release-1.13.16.md
```

- [ ] **Step 4: Watch the pushed deployment**

```bash
gh run list --branch main --commit "$(git rev-parse HEAD)"
gh run watch "$(gh run list --branch main --commit "$(git rev-parse HEAD)" --workflow 'Deploy to FTP (main)' --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: `Deploy to FTP (main)` concludes `success` for the release commit.

- [ ] **Step 5: Verify production**

Open the exact production route with a cache-busting query. Confirm version
`1.13.16`, select Bottom, confirm 223 rendered pad elements and zero browser
console errors, and save a production screenshot under `output/playwright/`.
