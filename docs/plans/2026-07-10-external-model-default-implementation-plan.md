# External Model Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep external 3D models enabled by default for every PCB format while preserving an explicit disabled initial state.

**Architecture:** Remove the app-owned Altium-specific default and delegate the unspecified state to `pcb-scene3d-viewer`, whose package default is enabled. Continue forwarding `initialToggles` so an explicit `external-models: false` remains authoritative.

**Tech Stack:** JavaScript ES modules, Node.js test runner, npm release metadata scripts

## Global Constraints

- Fix the general toggle behavior without source-format, document-name, or fixture-specific rules.
- Add the regression test before changing production code.
- Increment the app patch version and synchronize structured-data HTML.
- Use repository-owned test and deployment-check scripts.

---

### Task 1: External model initial visibility

**Files:**

- Modify: `tests/ui/app-view-scene3d-external-model-defaults.test.mjs`
- Modify: `src/ui/AppViewScene3dShellRenderer.mjs`

**Interfaces:**

- Consumes: `AppViewScene3dShellRenderer.render(documentModel, translate, options)` and `options.initialToggles`
- Produces: shell markup whose `data-scene-3d-toggle="external-models"` checkbox is checked unless explicitly initialized with `false`

- [ ] **Step 1: Write the failing regression test**

Replace the Altium-specific unchecked assertion with an enabled-default assertion and add an explicit-disabled assertion:

```js
test('AppViewScene3dShellRenderer keeps Altium external models initially visible', () => {
    const markup = AppViewScene3dShellRenderer.render(
        createPcbDocument('altium'),
        (key) => key
    )

    assert.match(
        markup,
        /<input type="checkbox" checked data-scene-3d-toggle="external-models" \/>External models/
    )
})

test('AppViewScene3dShellRenderer respects an explicit disabled external model state', () => {
    const markup = AppViewScene3dShellRenderer.render(
        createPcbDocument('altium'),
        (key) => key,
        {
            initialToggles: {
                'external-models': false
            }
        }
    )

    assert.match(
        markup,
        /<input type="checkbox" data-scene-3d-toggle="external-models" \/>External models/
    )
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/ui/app-view-scene3d-external-model-defaults.test.mjs`

Expected: FAIL because the Altium default checkbox lacks the `checked` attribute; the explicit-disabled case passes.

- [ ] **Step 3: Remove the format-specific production override**

Remove the `EcadFormatRegistry` import and the private `#initialToggles()` and `#isAltiumDocument()` methods. Forward only the caller-supplied initial toggles to the shared renderer:

```js
Scene3dRenderer.render(documentModel, translate, {
    initialToggles: options.initialToggles
})
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test tests/ui/app-view-scene3d-external-model-defaults.test.mjs`

Expected: all three external-model default tests PASS.

### Task 2: Version metadata and repository verification

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: generated `src/*.html` files reported by `npm run sync:structured-data`

**Interfaces:**

- Consumes: repository version and structured-data synchronization scripts
- Produces: app version `1.9.29` consistently represented in package metadata and deployment HTML

- [ ] **Step 1: Increment the patch version**

Run: `npm version 1.9.29 --no-git-tag-version`

Expected: `package.json` and `package-lock.json` report version `1.9.29`.

- [ ] **Step 2: Synchronize and check structured data**

Run: `npm run sync:structured-data`

Expected: generated deployment HTML is updated to version `1.9.29` where applicable.

Run: `npm run check:structured-data`

Expected: PASS with structured data synchronized.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: PASS with no failed tests.

Run: `npm run build:static`

Expected: PASS and produce the static deployment build.

- [ ] **Step 4: Review the final patch**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only the focused renderer, regression test, version files, plan, and synchronized HTML changes are present.
