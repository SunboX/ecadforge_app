# Source Obfuscation Implementation Plan

**Goal:** Remove remaining source-derived labels from docs and the repo-owned test fixture layer while keeping generic technical test vocabulary intact.

**Architecture:** Keep the change centered on `tests/fixtures/AltiumFixtureLoader.mjs`, which already owns obfuscation for imported samples. Update parser and renderer tests to assert the new fantasy labels, then clean up historical docs that still reference old source names or file names.

**Tech Stack:** Node.js, repo-owned fake Altium fixtures, `node:test`, Markdown docs

---

### Task 1: Write the failing expectation updates

**Files:**

- Modify: `tests/core/altium-parser/schematic-basics.mjs`
- Modify: `tests/core/altium-parser/schematic-layout.mjs`
- Modify: `tests/core/altium-parser/schematic-symbols.mjs`
- Modify: `tests/ui/renderers/schematic-ports.mjs`
- Modify: `tests/ui/renderers/starlit-relics.mjs`

**Step 1: Write the failing test expectations**

Change the assertions and comments that still mention source-derived labels so they expect the new fantasy file names, title text, bus labels, designators, and power labels.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser/schematic-basics.mjs tests/core/altium-parser/schematic-layout.mjs tests/core/altium-parser/schematic-symbols.mjs tests/ui/renderers/schematic-ports.mjs tests/ui/renderers/starlit-relics.mjs`

Expected: FAIL because the fixture loader still emits the old source-derived labels.

### Task 2: Expand fixture obfuscation coverage

**Files:**

- Modify: `tests/fixtures/AltiumFixtureLoader.mjs`

**Step 1: Write minimal implementation**

Update the fake fixture file names, embedded title text, known exact string replacements, and fixture-derived designator rewriting so parsed fixture output no longer leaks the source labels.

**Step 2: Run the focused tests to verify they pass**

Run: `npm test -- tests/core/altium-parser/schematic-basics.mjs tests/core/altium-parser/schematic-layout.mjs tests/core/altium-parser/schematic-symbols.mjs tests/ui/renderers/schematic-ports.mjs tests/ui/renderers/starlit-relics.mjs`

Expected: PASS

### Task 3: Clean up remaining documentation references

**Files:**

- Modify: `docs/plans/2026-03-09-schematic-pin-label-alignment-design.md`
- Modify: `docs/plans/2026-03-09-schematic-multipart-rendering-design.md`
- Modify: `docs/plans/2026-03-09-schematic-multipart-rendering-implementation-plan.md`
- Modify: `docs/plans/2026-03-16-multipart-pin-numbering-implementation-plan.md`
- Modify: `docs/plans/2026-03-19-pcb-authored-footprints-design.md`
- Modify: `docs/plans/2026-03-20-pcb-embedded-step-design.md`

**Step 1: Rewrite stale source references**

Replace lingering board-specific references, old sample file names, raw source part numbers, and source-derived designators in historical docs with generic wording or the new fantasy labels.

**Step 2: Verify no targeted raw labels remain**

Run a targeted `rg` search for the known legacy labels across `docs` and `tests`.

Expected: no matches for the targeted raw source labels

### Task 4: Bump version and run full verification

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Increment the patch version**

Update the app version by one patch release to reflect the repo-wide obfuscation cleanup.

**Step 2: Run full verification**

Run: `npm test`

Expected: PASS
