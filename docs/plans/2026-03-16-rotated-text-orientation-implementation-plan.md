# Rotated Text Orientation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve Altium rotated-text orientation metadata and render opposite source orientations with the correct opposite SVG text flow.

**Architecture:** Keep the parser’s existing text normalization flow, but add one explicit source-orientation field to normalized schematic text records. Update the schematic SVG renderer to derive signed rotated-text transforms from that field so `Orientation=1` and `Orientation=3` no longer collapse into the same output.

**Tech Stack:** Node.js, ESM modules, native `node:test`, parser-backed Altium fixtures, SVG text rendering

---

### Task 1: Lock the parser behavior in failing tests

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`
- Reference: `tests/fixtures/altium/Starfall-Moon.SchDoc`
- Reference: `tests/fixtures/altium/Starfall-Cinder.SchDoc`

**Step 1: Write the failing test**

Add a parser-backed test that loads the moon and cinder-sheet fixtures and asserts:

```js
const d16 = bluetoothDocument.schematic.texts.find(
    (text) => text.text === 'D16'
)
const jtag = bluetoothDocument.schematic.texts.find(
    (text) => text.text === 'JTAG'
)
const r24 = controlDocument.schematic.texts.find(
    (text) => text.text === 'R24'
)
const r24Value = controlDocument.schematic.texts.find(
    (text) => text.text === '10K' && text.ownerIndex === '3652'
)

assert.equal(d16?.rotation, 90)
assert.equal(jtag?.rotation, 90)
assert.equal(d16?.sourceOrientation, 1)
assert.equal(jtag?.sourceOrientation, 1)
assert.equal(r24?.rotation, 90)
assert.equal(r24Value?.rotation, 90)
assert.equal(r24?.sourceOrientation, 3)
assert.equal(r24Value?.sourceOrientation, 3)
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: FAIL because `sourceOrientation` is not yet present on normalized text records.

**Step 3: Commit**

```bash
git add tests/core/altium-parser.test.mjs
git commit -m "test: lock rotated text orientation metadata"
```

### Task 2: Preserve source orientation in normalized schematic text

**Files:**
- Modify: `src/core/altium/SchematicTextParser.mjs`
- Reference: `src/core/altium/ParserUtils.mjs`
- Modify: `src/core/altium/AltiumParser.mjs`

**Step 1: Write minimal implementation**

Update normalized schematic text records so they preserve raw Altium orientation when available:

```js
const sourceOrientation =
    ParserUtils.parseNumericField(fields, 'Orientation')

const textRecord = {
    x,
    y,
    text,
    color: ...,
    rotation,
    sourceOrientation:
        sourceOrientation === null ? undefined : sourceOrientation,
    anchor: ...
}
```

Update the public text-model JSDoc in parser-facing code so the new field is documented where schematic text records are described.

**Step 2: Run test to verify it passes**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: PASS for the new orientation-metadata assertions and all existing parser checks.

**Step 3: Commit**

```bash
git add src/core/altium/SchematicTextParser.mjs src/core/altium/AltiumParser.mjs tests/core/altium-parser.test.mjs
git commit -m "fix: preserve rotated text source orientation"
```

### Task 3: Lock renderer behavior in failing tests

**Files:**
- Modify: `tests/ui/renderers.test.mjs`
- Reference: `tests/fixtures/altium/Starfall-Moon.SchDoc`
- Reference: `tests/fixtures/altium/Starfall-Cinder.SchDoc`

**Step 1: Write the failing test**

Add renderer assertions that distinguish opposite rotated-text transforms:

```js
const moonDocument = await AltiumFixtureLoader.parseMoonSheet()
const bluetoothMarkup = SchematicSvgRenderer.render(bluetoothDocument)

assert.match(
    bluetoothMarkup,
    /<text class="schematic-label"[^>]*transform="rotate\(-90 225 612\)">D16</
)

const cinderDocument = await AltiumFixtureLoader.parseCinderSheet()
const controlMarkup = SchematicSvgRenderer.render(controlDocument)

assert.match(
    controlMarkup,
    /<text class="schematic-label"[^>]*transform="rotate\(90 415 794\)">R24</
)
assert.match(
    controlMarkup,
    /<text class="schematic-label"[^>]*transform="rotate\(90 415 844\)">10K</
)
```

Adjust the exact expected coordinates only if the parser-backed output shows a more accurate final anchor after the implementation change. The key behavior is opposite signed rotation between the moon and cinder-sheet fixtures.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: FAIL because the renderer still emits the same signed rotation for both orientations.

**Step 3: Commit**

```bash
git add tests/ui/renderers.test.mjs
git commit -m "test: lock rotated text svg direction"
```

### Task 4: Implement signed rotated-text rendering

**Files:**
- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Modify: `src/ui/SchematicSvgUtils.mjs`

**Step 1: Write minimal implementation**

Add a renderer helper that resolves text options for schematic labels:

```js
static #resolveSchematicTextRenderOptions(text) {
    const rotation = Number(text.rotation || 0)
    const sourceOrientation = Number(text.sourceOrientation || 0)

    return {
        fontSize: text.fontSize,
        fontFamily: text.fontFamily,
        fontWeight: text.fontWeight,
        rotation: SchematicSvgRenderer.#resolveSvgTextRotation(
            rotation,
            sourceOrientation
        )
    }
}
```

Resolve opposite signed rotation for opposite Altium orientations:

```js
static #resolveSvgTextRotation(rotation, sourceOrientation) {
    if (!rotation) return 0
    if (sourceOrientation === 3) return rotation
    return -rotation
}
```

Route schematic free-text rendering through that helper instead of always applying `-text.rotation`.

If needed, keep `createSvgText(...)` unchanged and pass the signed value through the existing `options.rotation` interface.

**Step 2: Run test to verify it passes**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: PASS for the new rotated-text renderer assertions and all existing renderer checks.

**Step 3: Commit**

```bash
git add src/ui/SchematicSvgRenderer.mjs src/ui/SchematicSvgUtils.mjs tests/ui/renderers.test.mjs
git commit -m "fix: render rotated schematic text with source orientation"
```

### Task 5: Run focused verification

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once the fix is complete.

**Step 2: Run focused tests**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: PASS with no new failures.

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version for rotated text fix"
```

### Task 6: Verify the full repository state

**Files:**
- Reference: `package.json`

**Step 1: Run the full suite**

Run: `npm test`

Expected: PASS.

**Step 2: Record any baseline blockers**

If the suite fails due to unrelated pre-existing issues in the current workspace, stop and document them before continuing.

**Step 3: Commit final integration**

```bash
git add src/core/altium/SchematicTextParser.mjs src/core/altium/AltiumParser.mjs src/ui/SchematicSvgRenderer.mjs src/ui/SchematicSvgUtils.mjs tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs package.json
git commit -m "fix: correct rotated schematic text orientation"
```
