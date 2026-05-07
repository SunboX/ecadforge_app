# Schematic Ink Token Rename Implementation Plan

**Goal:** Rename the two blue schematic theme tokens to purpose-based ink names without changing rendered colors.

**Architecture:** Keep the existing raw color mapping values and renderer behavior intact while replacing only the semantic CSS variable identifiers. Update one focused renderer test first to drive the rename, then apply the token rename consistently across stylesheet defaults, the schematic color resolver, renderer fallbacks, and assertion strings.

**Tech Stack:** Node.js test runner, ES modules, CSS custom properties, browser SVG rendering

---

### Task 1: Drive the rename with a focused failing test

**Files:**
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Update the existing `renderSchematicSvg maps imported schematic colors to theme variables` assertions to expect `--schematic-default-ink-color` and `--schematic-accent-ink-color`.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/renderers.test.mjs --test-name-pattern "maps imported schematic colors to theme variables"`

Expected: FAIL because the renderer still emits the old `--schematic-blue-color` and `--schematic-bright-blue-color` variables.

**Step 3: Write minimal implementation**

No implementation in this task.

**Step 4: Run test to verify it still fails for the right reason**

Run the same command and confirm the mismatch is still the old variable name.

### Task 2: Rename the schematic ink tokens in production code

**Files:**
- Modify: `src/styles/20-viewer.css`
- Modify: `src/ui/SchematicColorResolver.mjs`
- Modify: `src/ui/SchematicShapeRenderer.mjs`
- Modify: `src/ui/SchematicJunctionRenderer.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`

**Step 1: Replace the semantic token names**

Rename the dark schematic token to `--schematic-default-ink-color` and the bright token to `--schematic-accent-ink-color` everywhere production code references them.

**Step 2: Run the focused test**

Run: `node --test tests/ui/renderers.test.mjs --test-name-pattern "maps imported schematic colors to theme variables"`

Expected: PASS.

### Task 3: Update the remaining assertions and version metadata

**Files:**
- Modify: `tests/ui/renderers.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Rename the remaining test expectations**

Replace all remaining renderer assertions that mention the old blue token names with the new semantic ink names.

**Step 2: Increment the app version**

Bump the app version metadata to the next patch version in both package files.

**Step 3: Run full verification**

Run: `npm test`

Expected: PASS with the full suite green.
