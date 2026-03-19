# Multipart Pin Numbering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove overlapping pin numbers from control-sheet multipart resistor networks and make visible multipart designators render as `R92A/B/C/D` while keeping the connector as `J4`.

**Architecture:** Keep the fix inside schematic normalization. Extend multipart owner matching so left-anchored passive owners resolve to their active `OwnerPartId`, then tighten multipart designator decoration so suffixes only appear when multiple active owners share the same base designator text.

**Tech Stack:** Node.js, ESM modules, native `node:test`, parser-backed Altium fixtures, SVG renderer tests

---

### Task 1: Lock the passive multipart anchor behavior in a failing matcher test

**Files:**
- Modify: `tests/core/schematic-multipart-owner-matcher.test.mjs`
- Modify: `src/core/altium/SchematicMultipartOwnerMatcher.mjs`

**Step 1: Write the failing test**

Add a unit test for a passive multipart owner whose pin records sit inside the body bounds, but whose component placement lands on the left outer pin endpoint. The test should assert that `collectActiveMultipartOwnerParts()` resolves the active owner part instead of returning no match.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/schematic-multipart-owner-matcher.test.mjs`

Expected: FAIL because the current matcher only scores corner anchors and misses the passive left-edge anchor.

### Task 2: Lock the control-sheet parser behavior in failing regressions

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`
- Reference: `tests/fixtures/altium/Starfall-Cinder.SchDoc`

**Step 1: Write the failing tests**

Add one parser-backed control-sheet regression that asserts:

- the visible designator texts include `R92A`, `R92B`, `R92C`, and `R92D`
- the visible designator texts include `J4`
- the visible designator texts do not include `J4A`

Add one parser-backed control-sheet pin regression that asserts each multipart `R92` owner exposes exactly two pin designators after normalization:

```js
const pinGroups = [...new Set(['4010', '4050', '4088', '4126'])].map(
    (ownerIndex) => ({
        ownerIndex,
        pins: documentModel.schematic.pins
            .filter((pin) => pin.ownerIndex === ownerIndex)
            .map((pin) => pin.designator)
            .sort((left, right) => Number(left) - Number(right))
    })
)
```

Assert the groups resolve to the expected active pairs instead of four overlapping pairs.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs`

Expected: FAIL because the current control-sheet parse still exposes overlapping `R92` owner pins and `J4A`.

### Task 3: Lock the rendered control-sheet labels in a failing SVG regression

**Files:**
- Modify: `tests/ui/renderers.test.mjs`
- Reference: `tests/fixtures/altium/Starfall-Cinder.SchDoc`

**Step 1: Write the failing test**

Add a control-sheet renderer regression that renders the parsed fixture and asserts:

- `>R92A<`, `>R92B<`, `>R92C<`, and `>R92D<` are present
- `>J4<` is present
- `>J4A<` is absent

If practical, also assert the specific overlapping inactive pin numbers for one `R92` section are absent from the rendered markup.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers.test.mjs`

Expected: FAIL because the current renderer output still contains `J4A` and the unsuffixed `R92` texts.

### Task 4: Implement passive multipart owner matching

**Files:**
- Modify: `src/core/altium/SchematicMultipartOwnerMatcher.mjs`

**Step 1: Write minimal implementation**

Keep the existing multipart-owner matcher, but extend it so passive owners can match by their actual source anchor:

- include derived outer pin endpoints in `#collectSchematicRecordPoints()` when a record is a pin with a usable `PinLength` and `PinConglomerate`
- preserve the existing corner-based scoring for standard and mirrored symbols
- add a passive left-edge midpoint anchor candidate for non-mirrored owners
- keep the score threshold tight enough to avoid ambiguous matches

Prefer a small helper for deriving the raw outer pin endpoint rather than duplicating orientation logic inline.

**Step 2: Run focused matcher and parser tests**

Run: `node --test tests/core/schematic-multipart-owner-matcher.test.mjs tests/core/altium-parser.test.mjs`

Expected: PASS for the new matcher test and improved control-sheet multipart filtering, with any remaining designator-suffix failure isolated for the next task.

### Task 5: Implement duplicate-base multipart designator suffixing

**Files:**
- Modify: `src/core/altium/SchematicTextPostProcessor.mjs`
- Modify: `src/core/altium/AltiumParser.mjs` if the decoration call site needs extra context

**Step 1: Write minimal implementation**

Change multipart designator decoration so it:

- starts from the active multipart owners already selected by the matcher
- groups visible `Designator` texts by their current base text
- appends the formatted multipart suffix only when more than one active owner shares that same base text
- leaves single visible multipart designators such as `J4` unchanged

Keep the existing suffix formatting and avoid changing non-designator texts.

**Step 2: Run focused parser and renderer tests**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: PASS for the new control-sheet suffix and renderer assertions.

### Task 6: Bump version and run focused verification

**Files:**
- Modify: `package.json`

**Step 1: Bump version**

Increment the app version once the bugfix and regressions are green.

**Step 2: Run focused verification**

Run: `node --test tests/core/schematic-multipart-owner-matcher.test.mjs tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`

Expected: PASS.

### Task 7: Run the full suite

**Files:**
- Reference: `package.json`

**Step 1: Run the repository tests**

Run: `npm test`

Expected: PASS.

**Step 2: Stop if unrelated baseline failures appear**

If the full suite fails for reasons unrelated to multipart pin numbering, document the exact failures before making any completion claim.
