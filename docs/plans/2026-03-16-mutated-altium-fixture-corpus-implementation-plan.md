# Mutated Altium Fixture Corpus Implementation Plan

**Goal:** Replace the native Altium fixture corpus with materially different fake content while preserving current parser and renderer regression coverage as closely as possible.

**Architecture:** Keep the current five-file corpus and mutate the native payloads in place. Preserve parser-relevant record classes and geometry patterns, but rewrite visible labels and metadata broadly enough that the fixtures no longer read like the current samples. Coordinate the test assertions with the new fake vocabulary and any resulting exact coordinate changes.

**Tech Stack:** Node.js, native `node:test`, ECMAScript modules, repo-owned native Altium `.SchDoc` and `.PcbDoc` fixtures

---

### Task 1: Add failing corpus-integrity assertions

**Files:**

- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`
- Test: `tests/core/altium-parser.test.mjs`
- Test: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Add focused assertions that the parser-backed and renderer-backed outputs expose the new fake vocabulary for one representative label set on each fixture role, and no longer expose the legacy visible strings selected for replacement.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL because the fixtures still expose the old visible labels.

**Step 3: Write minimal implementation**

Do not touch production code. Only add the failing fixture-integrity assertions and any helper selectors needed in the tests.

**Step 4: Run test to verify it still fails for the right reason**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL on the new fixture-integrity assertions, not on syntax or harness errors.

**Step 5: Commit**

```bash
git add tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs
git commit -m "test: lock mutated altium fixture vocabulary"
```

### Task 2: Mutate the schematic fixture corpus

**Files:**

- Modify: `tests/fixtures/altium/Skylace-Dawn.SchDoc`
- Modify: `tests/fixtures/altium/Skylace-Moon.SchDoc`
- Modify: `tests/fixtures/altium/Skylace-Nova.SchDoc`
- Modify: `tests/fixtures/altium/Skylace-Cinder.SchDoc`
- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Keep the new vocabulary assertions plus the existing parser/render regressions in place.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL until the native schematic payloads and exact assertions agree.

**Step 3: Write minimal implementation**

Mutate the four `.SchDoc` files in place:

- rewrite titles, hierarchy names, room labels, library identifiers, and source descriptions
- rename selected visible test labels while preserving the same behavior classes
- update exact parser and renderer assertions only where the new fake content changes the observable output

**Step 4: Run test to verify it passes**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/fixtures/altium/Skylace-Dawn.SchDoc tests/fixtures/altium/Skylace-Moon.SchDoc tests/fixtures/altium/Skylace-Nova.SchDoc tests/fixtures/altium/Skylace-Cinder.SchDoc tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs
git commit -m "test: mutate schematic fixture corpus"
```

### Task 3: Mutate the PCB fixture corpus

**Files:**

- Modify: `tests/fixtures/altium/Skylace-Forge.PcbDoc`
- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Add or update one focused parser-backed assertion for the new fake PCB metadata and keep the existing PCB geometry checks intact.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL until the PCB payload and expectations match.

**Step 3: Write minimal implementation**

Mutate the `.PcbDoc` payload in place:

- rewrite hierarchical sheet references and room names to match the new fake schematic vocabulary
- rewrite source component metadata and other high-signal text content
- keep board-outline and placement behaviors required by the parser tests

**Step 4: Run test to verify it passes**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/fixtures/altium/Skylace-Forge.PcbDoc tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs
git commit -m "test: mutate pcb fixture corpus"
```

### Task 4: Final verification and guidance alignment

**Files:**

- Modify: `docs/getting-started.md`
- Modify: `docs/testing.md`
- Modify: `package.json`
- Review: `src/core/altium/SchematicTextPostProcessor.mjs`
- Review: `src/core/altium/SchematicMultipartOwnerMatcher.mjs`

**Step 1: Write the failing test**

Use repo-wide searches plus the full test suite as the final contract.

**Step 2: Run test to verify it fails**

Run: repo-wide searches for the retired visible fixture vocabulary plus `npm test`
Expected: FAIL if any old labels remain in active docs or if the mutated corpus broke the regression net.

**Step 3: Write minimal implementation**

Update active docs to reference the mutated fake corpus, confirm parser logic stayed generic, and increment the app version in `package.json`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/getting-started.md docs/testing.md package.json
git commit -m "chore: finalize mutated altium fixture corpus"
```
