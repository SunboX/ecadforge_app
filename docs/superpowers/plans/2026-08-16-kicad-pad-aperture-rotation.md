# KiCad Pad Aperture Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve KiCad pad aperture rotations on rotated footprints so rectangular pads render with the correct orientation in both Top and Bottom PCB views.

**Architecture:** Fix the board-oriented pad angle at the owning `kicad-toolkit` parser boundary instead of compensating in ECAD Forge or matching the reported board. A source-neutral parser regression proves front-footprint angles survive parsing, and an app integration regression proves the published toolkit renders the same rotated pad correctly in both board views.

**Tech Stack:** JavaScript ES modules, Node test runner, KiCad S-expressions, deterministic SVG, npm, GitHub Actions, Playwright CLI.

## Global Constraints

- The parser and renderer fix must be universal and must not match a sample filename, designator, or project identifier.
- Tests must use embedded source-neutral fake KiCad data.
- Every app change increments the ECAD Forge version.
- Toolkit and app releases must pass their repository-owned tests before publishing.
- ECAD Forge is complete only after the exact production deployment workflow succeeds and both live board sides are checked.

---

### Task 1: Preserve board-oriented front pad angles

**Files:**
- Modify: `../kicad-toolkit/tests/core/kicad-pcb-parser.test.mjs`
- Modify: `../kicad-toolkit/src/core/kicad/KicadLayerResolver.mjs`

**Interfaces:**
- Consumes: `KicadPcbParser.parse(source, { fileName })` and `KicadLayerResolver.resolvePadLayers(layers, transform)`.
- Produces: normalized pad models whose `rotation` retains the board-oriented front pad angle while existing back-side mirroring remains intact.

- [ ] **Step 1: Write the failing parser regression**

Add an embedded fake footprint placed at `-90` degrees whose rectangular pads carry the KiCad board-oriented angle `270`, then assert both parsed pad rotations remain `270`:

```js
test('KicadPcbParser preserves board-oriented pad rotations in rotated front footprints', () => {
    const board = KicadPcbParser.parse(rotatedFrontPadFixture(), {
        fileName: 'rotated-front-pad-fake.kicad_pcb'
    })

    assert.deepEqual(
        board.pads.map((pad) => pad.rotation),
        [270, 270]
    )
})
```

The fixture must contain only fake identifiers and two `roundrect` pads with `(at -1 0 270)` and `(at 1 0 270)` inside a front footprint at `(at 10 20 -90)`.

- [ ] **Step 2: Run the regression and verify RED**

Run:

```bash
npm test -- tests/core/kicad-pcb-parser.test.mjs
```

Expected: the new assertion fails with actual rotations `[0, 0]`.

- [ ] **Step 3: Preserve the pad angle at the parser boundary**

Update `KicadLayerResolver.resolvePadLayers()` so `preserveLocalRotation` is true for pad apertures on every footprint side. `KicadPcbPadParser.transformPrimitiveRotation()` already preserves front angles and negates back angles when that contract is true.

- [ ] **Step 4: Run focused and full toolkit verification**

Run:

```bash
npm test -- tests/core/kicad-pcb-parser.test.mjs
npm test
npm run check:format
git diff --check
```

Expected: all commands pass and the new parser test reports rotations `[270, 270]`.

- [ ] **Step 5: Commit the toolkit fix**

```bash
git add src/core/kicad/KicadLayerResolver.mjs tests/core/kicad-pcb-parser.test.mjs
git commit -m "fix: preserve KiCad pad aperture rotations"
```

### Task 2: Publish kicad-toolkit 1.3.4

**Files:**
- Modify: `../kicad-toolkit/package.json`
- Modify: `../kicad-toolkit/package-lock.json`
- Modify: `../kicad-toolkit/README.md`
- Create: `../kicad-toolkit/docs/release-notes-v1.3.4.md`

**Interfaces:**
- Consumes: the green parser behavior from Task 1.
- Produces: npm package `kicad-toolkit@1.3.4`, GitHub release `v1.3.4`, and registry `latest` pointing at the release commit.

- [ ] **Step 1: Recheck branch, registry, and release state**

Run the npm-library release preflight, including fresh branch fetch, unmerged-branch checks, current package version, and `npm view kicad-toolkit version`.

- [ ] **Step 2: Bump and document 1.3.4**

Run `npm version 1.3.4 --no-git-tag-version`, add concise source-neutral release notes, and include the new release-note file in the package allowlist when required.

- [ ] **Step 3: Verify the package artifact**

Run:

```bash
npm test
npm run check:format
npm publish --dry-run --cache /private/tmp/kicad-toolkit-1.3.4-npm-cache
git diff --check
```

Expected: tests and formatting pass and the dry-run tarball is `kicad-toolkit-1.3.4.tgz` with the new release notes included.

- [ ] **Step 4: Commit, push, release, and publish**

Commit the release metadata, push `main`, create GitHub release `v1.3.4` at the exact commit, then publish through npm web authentication.

- [ ] **Step 5: Verify distribution identity**

Verify npm version, `latest`, npm `gitHead`, GitHub release target, CI, GitHub Packages, and a clean synchronized toolkit checkout.

### Task 3: Prove both ECAD Forge board views consume the fix

**Files:**
- Modify: `tests/core/ecad-renderer-pad-context.test.mjs`
- Modify: `tests/toolkit-api-convergence.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: published `kicad-toolkit@1.3.4`.
- Produces: an integration regression that parses a rotated fake front footprint and checks a `270`-degree pad transform in both Top and Bottom SVG output.

- [ ] **Step 1: Write the failing app integration regression against 1.3.3**

Import `EcadParserService`, encode an embedded fake `.kicad_pcb`, parse it, and render both sides. For each SVG assert the pad element contains `transform="rotate(270 ...)"` and does not contain the cancelled `rotate(0 ...)` transform.

- [ ] **Step 2: Run the app regression and verify RED**

Run:

```bash
npm test -- tests/core/ecad-renderer-pad-context.test.mjs
```

Expected: both views expose the old cancelled pad angle and the new assertion fails.

- [ ] **Step 3: Install the published toolkit and bump the app**

Install all five ECAD toolkit dependencies through npm `@latest`, run `npm version 1.13.17 --no-git-tag-version`, and update convergence assertions to `kicad-toolkit ^1.3.4` and app `1.13.17`.

- [ ] **Step 4: Verify GREEN and release gates**

Run:

```bash
npm test -- tests/core/ecad-renderer-pad-context.test.mjs tests/toolkit-api-convergence.test.mjs
npm run sync:structured-data
npm test
npm run check:structured-data
npm run build:static
git diff --check
```

Expected: 0 failures and a static deployment for version 1.13.17.

### Task 4: Release and verify ECAD Forge 1.13.17

**Files:**
- Modify: generated `src/*.html` structured-data pages.
- Create: `/tmp/ecadforge-release-1.13.17.md`

**Interfaces:**
- Consumes: the verified app dependency and integration regression from Task 3.
- Produces: app release `v1.13.17`, successful `Deploy to FTP (main)` workflow, and production screenshots of correct Top and Bottom pad orientation.

- [ ] **Step 1: Verify the exact sample locally on both sides**

Restart only the ECAD Forge server process, open the reported demo route with Playwright, capture Top and Bottom screenshots, and confirm rotated rectangular pad transforms survive in both SVGs with zero console errors.

- [ ] **Step 2: Commit and push the app release**

Stage all in-scope release changes, commit `chore: release ECAD Forge 1.13.17`, push `main`, and create GitHub release `v1.13.17` at the exact commit.

- [ ] **Step 3: Watch deployment to a final success**

Find the `Deploy to FTP (main)` run for the release SHA and run `gh run watch <run-id> --exit-status`.

- [ ] **Step 4: Verify production Top and Bottom**

Open the cache-busted production demo URL, inspect both side buttons, capture both screenshots, check the affected pad transforms, verify version `1.13.17`, and confirm zero console errors.

- [ ] **Step 5: Run final integrity checks**

Re-run toolkit tests/format and app tests/deploy gates, then verify both repositories are clean, synchronized, and point to the published npm/GitHub/deployment identities.
