# Fake Altium Test Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove every retired vendor-specific reference from the repo and move parser-backed tests onto repo-local fake Altium fixtures.

**Architecture:** Keep the existing parser and renderer regression coverage, but replace the external Downloads-based corpus with sanitized fixture files stored under `tests/fixtures/altium/`. Centralize fixture loading in one test helper so file names and paths only need to change in one place, then scrub docs and plan history to remove all remaining retired vendor-specific references.

**Tech Stack:** Node 20, npm, ESM `.mjs`, Node test runner, printable-record Altium parser, SVG string renderers.

---

### Task 1: Repoint Tests To Repo Fixtures

**Files:**

- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`
- Create: `tests/fixtures/AltiumFixtureLoader.mjs`

**Step 1: Write the failing test**

Replace the hard-coded Downloads paths and old vendor-specific file names with helper-backed repo-local fake fixture paths and fake sample names.

The helper should expose:

- one path per fake sample file
- one method to load a fixture into an `ArrayBuffer`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL because the new fake fixture files do not exist yet or assertions still reference the old names.

**Step 3: Write minimal implementation**

Do not change production code. Only add the test helper and update the tests to depend on repo fixtures.

**Step 4: Run test to verify it still fails for the right reason**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL due to missing fake fixture files or intentionally outdated expectations.

**Step 5: Commit**

```bash
git add tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs tests/fixtures/AltiumFixtureLoader.mjs
git commit -m "test: repoint parser fixtures to repo-owned samples"
```

### Task 2: Add The Fake Altium Fixture Corpus

**Files:**

- Create: `tests/fixtures/altium/AtlasControl-A1.01.01A.SchDoc`
- Create: `tests/fixtures/altium/AtlasControl-A1.01.01E.SchDoc`
- Create: `tests/fixtures/altium/AtlasControl-A1.01.01F.SchDoc`
- Create: `tests/fixtures/altium/AtlasControl-A1.01.08.PcbDoc`
- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Keep the existing parser-backed coverage, but update visible expectations to use fake identifiers such as:

- fake file names in `parseArrayBuffer(...)`
- fake title-block values instead of the old project title
- fake summary-title matching instead of the old vendor-specific name

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL until the sanitized fake fixtures and updated expectations line up.

**Step 3: Write minimal implementation**

Create the fake fixture files by preserving the printable record structure required by the parser while sanitizing identifying names and file references.

Keep the change narrow:

- remove retired vendor-specific references
- keep parser-relevant record structure intact
- avoid unnecessary content rewriting

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/fixtures/altium tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs
git commit -m "test: add fake altium parser fixture corpus"
```

### Task 3: Scrub Documentation And Plan History

**Files:**

- Modify: `README.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/testing.md`
- Modify: `docs/plans/2026-03-09-schematic-pin-label-alignment-design.md`
- Modify: `docs/plans/2026-03-09-schematic-pin-label-alignment-implementation-plan.md`
- Modify: `docs/plans/2026-03-09-schematic-multipart-rendering-design.md`
- Modify: `docs/plans/2026-03-09-schematic-multipart-rendering-implementation-plan.md`

**Step 1: Write the failing test**

Use a repo-wide search as the contract.

**Step 2: Run test to verify it fails**

Run: `rg -n "/Users/afiedler/Downloads" README.md docs tests`
Expected: FINDINGS in docs and plan history that still point at the old external corpus.

**Step 3: Write minimal implementation**

Replace remaining retired vendor-specific references with the fake sample names and repo-local fixture paths.

**Step 4: Run test to verify it passes**

Run: `rg -n "/Users/afiedler/Downloads" README.md docs tests`
Expected: no matches

**Step 5: Commit**

```bash
git add README.md docs/getting-started.md docs/testing.md docs/plans
git commit -m "docs: remove legacy fixture references from repo history"
```

### Task 4: Final Verification And Repo Requirements

**Files:**

- Modify: `package.json`

**Step 1: Write the failing test**

No new test file is required here beyond final verification.

**Step 2: Run test to verify integrated behavior**

Run: `npm test`
Expected: PASS

**Step 3: Write minimal implementation**

Increment the app version in `package.json` beyond the current in-worktree version.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version for fake fixture migration"
```
