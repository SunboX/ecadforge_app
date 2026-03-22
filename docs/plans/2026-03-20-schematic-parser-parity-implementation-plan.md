# Schematic Parser Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend schematic parsing with sheet symbols, sheet entries, explicit junctions, bus entries, embedded images, and a normalized net model while also adding project-owned parser specifications for future features.

**Architecture:** Keep the current record-driven parser pipeline, add focused schematic sub-parsers for the new record families, build connectivity from normalized geometry and explicit connection records, and update the SVG renderer only after the parser surface is covered by failing tests. Reuse the existing OLE infrastructure for embedded schematic images and keep all new behavior additive so current fixture coverage remains stable.

**Tech Stack:** Node.js 20, native `node:test` via `npm test`, ES modules, browser SVG rendering, pure JavaScript OLE parsing, Markdown specifications

---

### Task 1: Add Failing Tests For Missing Schematic Record Families

**Files:**
- Create: `tests/core/altium-parser/schematic-parity.mjs`
- Modify: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing test**

Add focused parser tests that build small synthetic record strings for:

- `RECORD=15` sheet symbol bounds and fill
- `RECORD=16` sheet entry positioning relative to its parent sheet symbol
- `RECORD=29` explicit junction recovery
- `RECORD=37` bus entry recovery

Example expectation:

```js
assert.deepEqual(documentModel.schematic.sheetSymbols, [
    {
        x: 80,
        y: 120,
        width: 140,
        height: 90,
        color: '#000080',
        fill: '#ffff80'
    }
])
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: FAIL because the current parser does not expose these collections.

**Step 3: Keep the failing expectations narrow**

Do not add renderer expectations yet. Keep these tests strictly about normalized parser output so failures identify the missing production model surface.

**Step 4: Run test to verify it still fails for the right reason**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: still FAIL, now specifically because `sheetSymbols`, `sheetEntries`, `junctions`, and `busEntries` are absent.

**Step 5: Commit**

```bash
git add tests/core/altium-parser/schematic-parity.mjs tests/core/altium-parser.test.mjs
git commit -m "test: add failing schematic parity parser coverage"
```

### Task 2: Implement Sheet Symbol, Sheet Entry, Junction, And Bus Entry Parsing

**Files:**
- Create: `src/core/altium/SchematicSheetParser.mjs`
- Create: `src/core/altium/SchematicJunctionParser.mjs`
- Create: `src/core/altium/SchematicBusEntryParser.mjs`
- Modify: `src/core/altium/AltiumParser.mjs`
- Modify: `src/core/altium/ParserUtils.mjs`

**Step 1: Write minimal production parsers**

Implement:

- `SchematicSheetParser.parseSheetSymbols(records)`
- `SchematicSheetParser.parseSheetEntries(records, sheetSymbols)`
- `SchematicJunctionParser.parseSchematicJunctions(records)`
- `SchematicBusEntryParser.parseSchematicBusEntries(records)`

Use only field semantics that are stable in the reference implementations:

- `Location.X`, `Location.Y`, `XSize`, `YSize` for `15`
- `OwnerIndex`, `DistanceFromTop`, `Side`, `IOType`, `Style` for `16`
- location/color for `29`
- `Location` / `Corner` plus `LineWidth` for `37`

**Step 2: Wire the new parsers into `AltiumParser`**

Extend the returned schematic payload with:

- `sheetSymbols`
- `sheetEntries`
- `junctions`
- `busEntries`

Keep existing collections unchanged.

**Step 3: Run the focused parser tests**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: PASS for the new parity assertions and no regression in existing schematic parser suites.

**Step 4: Refactor only if needed**

If `AltiumParser.mjs` grows awkwardly, extract small private helpers, but do not broaden scope beyond the tested record families.

**Step 5: Commit**

```bash
git add src/core/altium/SchematicSheetParser.mjs src/core/altium/SchematicJunctionParser.mjs src/core/altium/SchematicBusEntryParser.mjs src/core/altium/AltiumParser.mjs src/core/altium/ParserUtils.mjs tests/core/altium-parser/schematic-parity.mjs tests/core/altium-parser.test.mjs
git commit -m "feat: parse schematic sheet symbols and connectivity markers"
```

### Task 3: Add Failing Renderer Tests For The New Schematic Primitives

**Files:**
- Modify: `tests/ui/renderers/schematic-core.mjs`

**Step 1: Write the failing test**

Add SVG assertions that prove the renderer can emit:

- sheet-symbol rectangles
- sheet-entry polygons or paths with labels
- explicit junction dots
- bus-entry diagonals

Keep the test input synthetic and minimal:

```js
const markup = SchematicSvgRenderer.render({
    summary: { title: 'Parity schematic' },
    schematic: {
        sheet: { width: 300, height: 200 },
        lines: [],
        texts: [],
        components: [],
        sheetSymbols: [...],
        sheetEntries: [...],
        junctions: [...],
        busEntries: [...]
    }
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: FAIL because the renderer does not yet draw these collections.

**Step 3: Keep the assertions implementation-tolerant**

Assert by class names and key geometry, not by every attribute ordering detail.

**Step 4: Run test to verify failure signal**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: FAIL with missing class names or missing labels.

**Step 5: Commit**

```bash
git add tests/ui/renderers/schematic-core.mjs
git commit -m "test: add failing schematic parity renderer coverage"
```

### Task 4: Implement Renderer Support For Sheet Symbols, Entries, Junctions, And Bus Entries

**Files:**
- Create: `src/ui/SchematicSheetSymbolRenderer.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`
- Modify: `src/ui/SchematicColorResolver.mjs`

**Step 1: Add minimal renderer module**

Implement a dedicated renderer for:

- sheet symbol outlines and fills
- sheet entry callouts and entry labels

Keep explicit junctions and bus entries simple if they fit naturally in `SchematicSvgRenderer.mjs`.

**Step 2: Render authored junctions separately from synthesized junctions**

Preserve current synthesized junction behavior, but also render `schematic.junctions` directly so authored connection dots survive even when the heuristic logic would differ.

**Step 3: Render bus entries**

Emit one diagonal line per bus entry with normalized width and color.

**Step 4: Run the focused renderer tests**

Run: `npm test -- tests/ui/renderers/schematic-core.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/SchematicSheetSymbolRenderer.mjs src/ui/SchematicSvgRenderer.mjs src/ui/SchematicColorResolver.mjs tests/ui/renderers/schematic-core.mjs
git commit -m "feat: render schematic hierarchy and bus entry primitives"
```

### Task 5: Add Failing Tests For Embedded Schematic Images

**Files:**
- Create: `tests/core/altium-parser/schematic-images.mjs`
- Modify: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing test**

Add a synthetic OLE-backed schematic test that includes:

- one embedded image record `RECORD=30`
- one embedded image payload in the compound document

Assert that the parser returns one `schematic.images` item with placement metadata and embedded content metadata.

Example expectation:

```js
assert.deepEqual(
    {
        fileName: image.fileName,
        embedded: image.embedded,
        mimeType: image.mimeType
    },
    {
        fileName: 'glyph.bmp',
        embedded: true,
        mimeType: 'image/bmp'
    }
)
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/core/ole-compound-document.test.mjs`

Expected: FAIL because schematic image extraction is not implemented.

**Step 3: Add one malformed-image expectation**

Assert that when the image stream is missing, the parser keeps the placement metadata and emits a warning instead of crashing.

**Step 4: Run the test to confirm the expected failure**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/core/ole-compound-document.test.mjs`

Expected: FAIL for missing `schematic.images` support.

**Step 5: Commit**

```bash
git add tests/core/altium-parser/schematic-images.mjs tests/core/altium-parser.test.mjs
git commit -m "test: add failing schematic embedded image coverage"
```

### Task 6: Implement Schematic Image Extraction And Rendering

**Files:**
- Create: `src/core/altium/SchematicImageParser.mjs`
- Modify: `src/core/altium/AltiumParser.mjs`
- Modify: `src/core/ole/OleCompoundDocument.mjs`
- Modify: `src/ui/SchematicSvgRenderer.mjs`

**Step 1: Implement parser-side image extraction**

Add a parser that:

- normalizes `RECORD=30` placement bounds
- detects `EmbedImage`
- loads embedded image bytes through `OleCompoundDocument`
- infers a safe MIME type from file name or content signature
- returns placeholder-ready metadata if extraction fails

**Step 2: Add image diagnostics**

Emit diagnostics for:

- embedded image recovered
- embedded image record present but payload missing
- unsupported embedded image payload type

**Step 3: Add renderer support**

Render:

- decoded embedded images with `<image ... href="data:...">` when available
- placeholder frame markup when only placement metadata is recoverable

**Step 4: Run image-focused tests**

Run: `npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers/schematic-core.mjs tests/core/ole-compound-document.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/altium/SchematicImageParser.mjs src/core/altium/AltiumParser.mjs src/core/ole/OleCompoundDocument.mjs src/ui/SchematicSvgRenderer.mjs tests/core/altium-parser/schematic-images.mjs tests/core/altium-parser.test.mjs tests/ui/renderers/schematic-core.mjs
git commit -m "feat: recover and render schematic embedded images"
```

### Task 7: Add Failing Tests For Netlist Recovery And Correct Net-Label Orientation

**Files:**
- Create: `tests/core/altium-parser/schematic-nets.mjs`
- Modify: `tests/core/altium-parser.test.mjs`

**Step 1: Write the failing test**

Add connectivity tests that assert:

- wires, pins, power ports, and net labels resolve into normalized `schematic.nets`
- explicit junctions merge touching segments into one net
- competing explicit names produce deterministic naming plus a warning
- `RECORD=25` labels honor documented orientation semantics instead of defaulting to generic free-text behavior

Example expectation:

```js
assert.deepEqual(
    documentModel.schematic.nets.map((net) => net.name),
    ['+3V3', 'UART_RX', 'UnknownNet0']
)
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: FAIL because `schematic.nets` does not exist and net-label orientation coverage is incomplete.

**Step 3: Keep the graph small**

Use a synthetic single-sheet graph with only a handful of wires and endpoints so the failure signal stays readable.

**Step 4: Run test to verify the intended failure**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: FAIL with missing nets and orientation mismatch.

**Step 5: Commit**

```bash
git add tests/core/altium-parser/schematic-nets.mjs tests/core/altium-parser.test.mjs
git commit -m "test: add failing schematic net model coverage"
```

### Task 8: Implement Normalized Netlist Recovery And Net-Label Orientation Fixes

**Files:**
- Create: `src/core/altium/SchematicNetlistBuilder.mjs`
- Modify: `src/core/altium/SchematicTextParser.mjs`
- Modify: `src/core/altium/SchematicTextPostProcessor.mjs`
- Modify: `src/core/altium/AltiumParser.mjs`

**Step 1: Build the netlist module**

Implement a builder that:

- resolves connection points for pins, ports, power ports, labels, junctions, sheet entries, and bus entries
- groups touching wire segments into connected components
- attaches named endpoints
- chooses a stable net name using the documented precedence rules

**Step 2: Fix `RECORD=25` net-label orientation**

Add record-aware rotation and anchor handling for net labels so they follow documented Altium orientation values instead of inheriting generic text defaults where that is wrong.

**Step 3: Extend the returned schematic model**

Add `nets` to the schematic payload and extend diagnostics with:

- recovered net count
- named net count
- naming conflict warnings when needed

**Step 4: Run focused parser tests**

Run: `npm test -- tests/core/altium-parser.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/altium/SchematicNetlistBuilder.mjs src/core/altium/SchematicTextParser.mjs src/core/altium/SchematicTextPostProcessor.mjs src/core/altium/AltiumParser.mjs tests/core/altium-parser/schematic-nets.mjs tests/core/altium-parser.test.mjs
git commit -m "feat: add schematic netlist normalization"
```

### Task 9: Add Project-Owned Parser Specifications

**Files:**
- Create: `docs/altium-schematic-parser-spec.md`
- Create: `docs/altium-schematic-normalized-model.md`
- Modify: `docs/architecture.md`
- Modify: `spec/web-app-specification.md`

**Step 1: Write the specification docs**

Document:

- supported record families and their meanings
- normalized schematic model fields
- net naming precedence
- authored versus synthesized rendering data
- intentional gaps carried forward from the reference repos

Use the external repositories as inputs, but document only behavior that `ECAD Forge` implements or deliberately defers.

**Step 2: Update the app-level spec**

Add acceptance and architecture language for:

- preserved schematic hierarchy markers
- embedded images
- connectivity diagnostics and net modeling

**Step 3: Run a focused structure test if needed**

Run: `npm test -- tests/project-structure.test.mjs`

Expected: PASS.

**Step 4: Review docs for consistency**

Make sure terminology matches the code and normalized field names exactly.

**Step 5: Commit**

```bash
git add docs/altium-schematic-parser-spec.md docs/altium-schematic-normalized-model.md docs/architecture.md spec/web-app-specification.md
git commit -m "docs: add schematic parser and model specifications"
```

### Task 10: Bump Version And Run Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Increment the app version**

Update `package.json` and `package-lock.json` to the next patch version, following repo policy.

**Step 2: Run focused verification while iterating**

Run:

```bash
npm test -- tests/core/altium-parser.test.mjs tests/ui/renderers/schematic-core.mjs tests/core/ole-compound-document.test.mjs
```

Expected: PASS.

**Step 3: Run the full suite**

Run:

```bash
npm test
```

Expected: PASS.

**Step 4: Review diagnostics and snapshots manually**

Inspect the changed parser and renderer output for:

- new diagnostics phrasing
- stable SVG class names
- no regressions in existing schematic fixtures

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version for schematic parser parity"
```
