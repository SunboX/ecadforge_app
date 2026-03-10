# ESM Class API Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor reusable `.mjs` modules to modern ESM class-based APIs with narrower exports while preserving the current ECAD Forge behavior.

**Architecture:** Keep runtime boot modules as scripts, keep existing stateful classes intact, and convert parser and renderer function modules into one exported class per file with static methods and private static helpers. Update imports and tests to use the new class entrypoints, centralize duplicate renderer utilities, and preserve behavior through incremental verification.

**Tech Stack:** Node 20, npm, ESM `.mjs`, Node test runner, Express, browser DOM APIs, worker modules, SVG/HTML string renderers.

---

### Task 1: Lock In The New Public API With Failing Tests

**Files:**

- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Update the tests so they import class modules and call the intended public API:

- `AltiumParser.parseArrayBuffer(...)`
- `SchematicSvgRenderer.render(...)`
- `PcbSvgRenderer.render(...)`
- `Scene3dRenderer.render(...)`
- `BomTableRenderer.render(...)`

Keep the current behavior assertions unchanged.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL because the source modules still export standalone functions

**Step 3: Write minimal implementation**

Do not add behavior changes yet. Only proceed once the tests are failing for the expected API mismatch.

**Step 4: Run test to verify it still fails for the right reason**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL with import or method errors tied to the pending class API refactor

**Step 5: Commit**

```bash
git add tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs
git commit -m "test: define class-based parser and renderer APIs"
```

### Task 2: Convert Parser Helper Modules To Static Class APIs

**Files:**

- Modify: `src/core/altium/ParserUtils.mjs`
- Modify: `src/core/altium/SchematicTextParser.mjs`
- Modify: `src/core/altium/SchematicPinParser.mjs`
- Modify: `src/core/altium/SchematicAnnotationParser.mjs`

**Step 1: Write the failing test**

Use the failing tests from Task 1 as the initial contract. Add no extra tests unless a parser helper regression appears during implementation.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs`
Expected: FAIL because parser helper imports still target standalone functions

**Step 3: Write minimal implementation**

Refactor the helper modules to:

- export one class per file
- expose current public helper behavior as static methods
- move internal-only helpers to private static methods where practical
- preserve current return shapes and fallback behavior
- keep JSDoc coverage on public and private methods

Target APIs:

- `ParserUtils.dedupeByDesignator(...)`
- `ParserUtils.stripExtension(...)`
- `ParserUtils.getDisplayText(...)`
- `ParserUtils.getField(...)`
- `ParserUtils.parseNumericField(...)`
- `ParserUtils.parseBoolean(...)`
- `ParserUtils.toColor(...)`
- `ParserUtils.countMatchingKeys(...)`
- `SchematicTextParser.extractMetadata(...)`
- `SchematicTextParser.extractFonts(...)`
- `SchematicTextParser.normalizeTextRecord(...)`
- `SchematicTextParser.extractTitleBlock(...)`
- `SchematicTextParser.isTitleBlockFooterRecord(...)`
- `SchematicPinParser.parsePins(...)`
- `SchematicPinParser.parsePorts(...)`
- `SchematicPinParser.parseCrosses(...)`
- `SchematicPinParser.parsePolyline(...)`
- `SchematicAnnotationParser.buildSyntheticTexts(...)`

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser.test.mjs`
Expected: PASS once downstream parser imports are updated

**Step 5: Commit**

```bash
git add src/core/altium tests/core/altium-parser.test.mjs
git commit -m "refactor: convert parser helpers to class APIs"
```

### Task 3: Convert The Altium Parser Entry Module To A Class

**Files:**

- Modify: `src/core/altium/AltiumParser.mjs`
- Modify: `src/AppController.mjs`
- Modify: `src/workers/altium-parser.worker.mjs`
- Modify: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing test**

Rely on the updated parser test import from Task 1 and verify the runtime call sites now fail against the old function export.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs`
Expected: FAIL until `AltiumParser` exists with `parseArrayBuffer(...)`

**Step 3: Write minimal implementation**

Refactor `AltiumParser.mjs` to:

- export `class AltiumParser`
- expose `static parseArrayBuffer(fileName, arrayBuffer)`
- convert internal helpers to private static methods where reasonable
- update `AppController` and the parser worker to call the class method
- preserve the normalized model shape and parsing behavior

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/altium-parser.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/altium/AltiumParser.mjs src/AppController.mjs src/workers/altium-parser.worker.mjs tests/core/altium-parser.test.mjs
git commit -m "refactor: convert altium parser to class API"
```

### Task 4: Convert Renderer Utilities And Renderer Modules To Classes

**Files:**

- Modify: `src/ui/SchematicSvgUtils.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Modify: `src/ui/BomTableRenderer.mjs`
- Modify: `src/ui/PcbSvgRenderer.mjs`
- Modify: `src/ui/Scene3dRenderer.mjs`
- Modify: `src/ui/AppView.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Use the updated renderer tests from Task 1 as the contract for the new class-based render API.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers.test.mjs`
Expected: FAIL because renderer modules still expose standalone functions

**Step 3: Write minimal implementation**

Refactor the renderer modules to:

- export one class per file
- expose `render(...)` as the public method for each renderer
- move duplicate HTML and number helpers behind `SchematicSvgUtils`
- update `AppView` to call renderer classes instead of function imports
- keep current markup and empty-state strings stable

Target APIs:

- `SchematicSvgUtils.escapeHtml(...)`
- `SchematicSvgUtils.formatNumber(...)`
- `SchematicSvgUtils.projectY(...)`
- `SchematicSvgUtils.createText(...)`
- `SchematicSvgUtils.basename(...)`
- `SchematicSvgUtils.buildCurrentDateValue()`
- `SchematicSvgRenderer.render(...)`
- `BomTableRenderer.render(...)`
- `PcbSvgRenderer.render(...)`
- `Scene3dRenderer.render(...)`

If `SchematicSvgRenderer.mjs` risks growing past the file size limit during refactor, split secondary markup builders into one or more new internal class modules and update imports accordingly.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ui tests/ui/renderers.test.mjs
git commit -m "refactor: convert renderers to class APIs"
```

### Task 5: Verify Full Project Wiring And Repo Requirements

**Files:**

- Modify: `package.json`
- Modify: `tests/project-structure.test.mjs`
- Modify: `tests/mjs-line-limit.test.mjs`

**Step 1: Write the failing test**

Only add or adjust tests if the refactor introduces new `.mjs` files or changes project structure expectations.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL only if structure or line-limit expectations need updates

**Step 3: Write minimal implementation**

Finish the refactor by:

- incrementing the app version in `package.json`
- updating any project-structure or line-limit tests if new modules were added
- keeping all `.mjs` files under the repo limits

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json tests
git commit -m "chore: finalize class api refactor"
```
