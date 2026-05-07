# Neutral Fixture Naming Implementation Plan

**Goal:** Remove the retired sheet-G identifier from the repo by renaming the fake schematic fixture, updating tests and docs, and codifying that parser behavior must remain universal rather than schematic-specific.

**Architecture:** Keep the current parser and renderer normalization rules structural. Replace the old fixture name and loader API with neutral fake naming, preserve the existing regression assertions, and add contributor guidance in `AGENTS.md` so future fixes stay generic.

**Tech Stack:** Node.js, native `node:test`, ECMAScript modules, repo-owned fake Altium fixtures

---

### Task 1: Flip tests to neutral fixture naming

**Files:**
- Modify: `tests/fixtures/AltiumFixtureLoader.mjs`
- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Update the active tests to call a neutral fixture helper such as `parseCinderSheet()` and rename the legacy fixture-specific test titles/comments to behavior-focused names.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL because the neutral loader accessor and fixture name do not exist yet.

**Step 3: Write minimal implementation**

Rename the loader getter/parser method and update any dependent references so the tests can load the same schematic through the neutral fake name.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS for the renamed tests.

**Step 5: Commit**

```bash
git add tests/fixtures/AltiumFixtureLoader.mjs tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs
git commit -m "test: rename neutral schematic fixture coverage"
```

### Task 2: Rename and sanitize the schematic fixture

**Files:**
- Create: `tests/fixtures/altium/Skylace-Cinder.SchDoc`
- Modify: `tests/fixtures/altium/Skylace-Cinder.SchDoc`
- Delete: the prior sheet-G fixture path

**Step 1: Write the failing test**

Keep the neutral loader pointed at the new fake file name before the file exists.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL with a missing fixture file error.

**Step 3: Write minimal implementation**

Rename the fixture file to the neutral name and replace any remaining retired-identifier payload strings inside the file.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS with the renamed fixture.

**Step 5: Commit**

```bash
git add tests/fixtures/altium/Skylace-Cinder.SchDoc
git commit -m "test: sanitize neutral schematic fixture data"
```

### Task 3: Remove remaining legacy-name references and add guidance

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/plans/2026-03-16-control-sheet-callout-sizing-implementation-plan.md`
- Modify: `docs/plans/2026-03-16-multipart-pin-numbering-design.md`
- Modify: `docs/plans/2026-03-16-multipart-pin-numbering-implementation-plan.md`
- Modify: `docs/plans/2026-03-16-owner-side-component-text-anchoring-design.md`
- Modify: `docs/plans/2026-03-16-owner-side-component-text-anchoring-implementation-plan.md`
- Modify: `docs/plans/2026-03-16-rotated-text-orientation-design.md`
- Modify: `docs/plans/2026-03-16-rotated-text-orientation-implementation-plan.md`
- Modify: any other active repo file returned by the repository-wide token search

**Step 1: Write the failing test**

Run a repo-wide search and treat every remaining retired-identifier hit as an unresolved failure.

**Step 2: Run test to verify it fails**

Run: repository-wide token search across `AGENTS.md`, `docs`, `tests`, `src`, `spec`, and `README.md`
Expected: FAIL with remaining references listed.

**Step 3: Write minimal implementation**

Replace the old name with neutral fake naming and add AGENTS guidance that tests must use fake schematics and parser fixes must never special-case one schematic or file name.

**Step 4: Run test to verify it passes**

Run: the same repository-wide token search
Expected: no output

**Step 5: Commit**

```bash
git add AGENTS.md docs tests
git commit -m "docs: remove legacy schematic fixture naming"
```

### Task 4: Verify universal parser behavior and release bookkeeping

**Files:**
- Modify: `package.json`
- Review: `src/core/altium/SchematicTextPostProcessor.mjs`
- Review: `src/core/altium/SchematicMultipartOwnerMatcher.mjs`

**Step 1: Write the failing test**

Use the focused parser and renderer regressions as proof that the neutral fixture still exercises the same generic behavior.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL if any rename or sanitization broke generic parsing behavior.

**Step 3: Write minimal implementation**

Only if needed, adjust parser code to keep the behavior structural and file-name-agnostic. Then increment the app version in `package.json`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json src/core/altium/SchematicTextPostProcessor.mjs src/core/altium/SchematicMultipartOwnerMatcher.mjs
git commit -m "chore: enforce neutral fixture guidance"
```
