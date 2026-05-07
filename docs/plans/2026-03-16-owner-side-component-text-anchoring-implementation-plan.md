# Owner-Side Component Text Anchoring Implementation Plan

**Goal:** Make left-side stacked designators keep the same visible owner-side stack as their existing value/comment text instead of shifting the whole stack left.

**Architecture:** Keep the fix in the existing schematic text post-processor. Preserve the current designator-only anchor pass, but add one exemption so a left-side designator keeps its original `start` anchor when a visible same-owner `VALUE` or `Comment` already shares the same `x` position inside the owner span.

**Tech Stack:** Node.js, ESM modules, native `node:test`, parser-backed Altium fixtures

---

### Task 1: Lock the control-sheet owner-side behavior in failing tests

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`
- Reference: `tests/fixtures/altium/Skylace-Cinder.SchDoc`

**Step 1: Write the failing test**

Add a parser-backed test that loads the control-sheet fixture and asserts the left and right resistor pairs keep the expected stacked anchors:

```js
const documentModel = await AltiumFixtureLoader.parseCinderSheet()
const anchors = documentModel.schematic.texts
    .filter((text) =>
        ['GLINT51', 'GLINT56'].includes(text.text) ||
        (text.text === '10K' &&
            ['2891', '2953'].includes(String(text.ownerIndex || '')))
    )
    .map((text) => ({
        text: text.text,
        ownerIndex: text.ownerIndex,
        anchor: text.anchor
    }))
    .sort(
        (left, right) =>
            left.ownerIndex.localeCompare(right.ownerIndex) ||
            left.text.localeCompare(right.text)
    )

assert.deepEqual(anchors, [
    { text: '10K', ownerIndex: '2891', anchor: 'start' },
    { text: 'GLINT51', ownerIndex: '2891', anchor: 'start' },
    { text: '10K', ownerIndex: '2953', anchor: 'start' },
    { text: 'GLINT56', ownerIndex: '2953', anchor: 'start' }
])
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: FAIL because the current control-sheet `GLINT51` designator still resolves to `anchor: 'end'`.

### Task 2: Add one secondary regression for the same bug class

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`
- Reference: `tests/fixtures/altium/Skylace-Nova.SchDoc`

**Step 1: Write the failing test**

Add a nova-sheet regression that locks a pre-existing left-side stacked case:

```js
const documentModel = await AltiumFixtureLoader.parseNovaSheet()
const anchors = documentModel.schematic.texts
    .filter(
        (text) =>
            ['GLINT11', '12K'].includes(text.text) &&
            text.ownerIndex === '1461'
    )
    .map((text) => ({
        text: text.text,
        anchor: text.anchor
    }))
    .sort((left, right) => left.text.localeCompare(right.text))

assert.deepEqual(anchors, [
    { text: '12K', anchor: 'start' },
    { text: 'GLINT11', anchor: 'start' }
])
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: FAIL because the current nova `GLINT11` designator still resolves to `anchor: 'end'`.

### Task 3: Implement consistent owner-side text anchoring

**Files:**
- Modify: `src/core/altium/SchematicTextPostProcessor.mjs`

**Step 1: Write minimal implementation**

Keep the owner-aware pass designator-only, but add one exemption before the left-side `anchor: 'end'` override:

```js
if (
    !text ||
    !SchematicTextPostProcessor.#isDesignatorText(text) ||
    text.rotation ||
    !text.ownerIndex
) {
    return text
}
```

Add a narrow stack detector that:

- keeps top-side designator padding behavior
- checks whether a visible same-owner `VALUE` or `Comment` shares the same `x` position within the owner span
- preserves the original anchor when that stacked text exists
- otherwise keeps the current left-side `anchor: 'end'` behavior for standalone designators

Keep raw `x` and `y` coordinates unchanged.

**Step 2: Run focused test to verify it passes**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: PASS for the new cinder-sheet and nova assertions and all existing parser checks.

### Task 4: Refactor only if needed to keep the rule readable

**Files:**
- Modify: `src/core/altium/SchematicTextPostProcessor.mjs`

**Step 1: Clean up helper boundaries**

If the new logic becomes hard to read, extract small helpers such as:

```js
static #isAnchoredComponentText(text) { ... }
static #classifyOwnerSideText(text, bounds) { ... }
static #resolveOwnerSideAnchor(text, bounds, texts, lines, pins, ports, ownerPinCount) { ... }
```

Keep the file under the repository size limit and preserve behavior from Task 3.

**Step 2: Re-run focused parser test**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: PASS with no behavior change.

### Task 5: Bump version and run focused verification

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once the bugfix is complete.

**Step 2: Run focused verification**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: PASS.

### Task 6: Run the full suite

**Files:**
- Reference: `package.json`

**Step 1: Run the repository tests**

Run: `npm test`

Expected: PASS.

**Step 2: Stop if unrelated baseline failures appear**

If `npm test` fails because of pre-existing issues unrelated to owner-side text anchoring, document them before making any completion claim.
