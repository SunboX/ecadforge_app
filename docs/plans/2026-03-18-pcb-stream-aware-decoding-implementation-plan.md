# PCB Stream-Aware Decoding Implementation Plan

**Goal:** Recover richer PCB primitives from compound-document `.PcbDoc` files by parsing OLE streams before printable-record extraction, then render the recovered geometry with PCB CSS theme variables.

**Architecture:** Add a small in-repo OLE reader, introduce a stream-aware PCB record extractor that preserves stream provenance, and extend the normalized PCB model with real primitive families before upgrading the PCB SVG renderer. Keep the existing whole-file printable scan as a fallback so current fixture coverage remains stable while the PCB path gets deeper fidelity.

**Tech Stack:** Node.js 20, native `node:test` via `npm test`, ES modules, browser SVG rendering, CSS custom properties, pure JavaScript OLE parsing

---

### Task 1: Add The Low-Level Binary Reader

**Files:**

- Create: `src/core/BinaryReader.mjs`
- Create: `tests/core/binary-reader.test.mjs`

**Step 1: Write the failing test**

Add focused tests that prove the helper can read little-endian integers and reject out-of-bounds access.

```js
test('BinaryReader reads little-endian integers and enforces bounds', () => {
    const reader = new BinaryReader(
        new Uint8Array([0x34, 0x12, 0x78, 0x56]).buffer
    )

    assert.equal(reader.readUint16(0), 0x1234)
    assert.equal(reader.readUint16(2), 0x5678)
    assert.throws(() => reader.readUint32(2), /out of bounds/i)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/binary-reader.test.mjs`

Expected: FAIL because `BinaryReader` does not exist yet.

**Step 3: Write minimal implementation**

Create a class with:

- constructor storing the `ArrayBuffer`
- `readUint8(offset)`
- `readUint16(offset)`
- `readUint32(offset)`
- `readInt32(offset)`
- a private bounds check helper

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/binary-reader.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/core/binary-reader.test.mjs src/core/BinaryReader.mjs
git commit -m "feat: add binary reader utility"
```

### Task 2: Add OLE Compound Document Parsing

**Files:**

- Create: `src/core/ole/OleConstants.mjs`
- Create: `src/core/ole/OleDirectoryEntry.mjs`
- Create: `src/core/ole/OleCompoundDocument.mjs`
- Create: `tests/core/ole-compound-document.test.mjs`

**Step 1: Write the failing test**

Add synthetic-buffer tests that prove the OLE reader can:

- validate the OLE header signature
- read sector size and mini-sector size
- decode one directory entry
- resolve a named stream
- extract both standard and short stream payloads

Use tiny synthetic buffers built inside the test instead of fixture files.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/binary-reader.test.mjs tests/core/ole-compound-document.test.mjs`

Expected: FAIL because the OLE modules do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- OLE header constants and sentinel values
- directory entry decoding
- sector chain walking
- mini-stream handling
- `getStream(name)` and `listStreams()`

Keep the public API narrow:

```js
const document = OleCompoundDocument.fromArrayBuffer(arrayBuffer)
document.listStreams()
document.getStream('FileHeader')
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/binary-reader.test.mjs tests/core/ole-compound-document.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/core/ole-compound-document.test.mjs src/core/ole src/core/BinaryReader.mjs
git commit -m "feat: add ole compound document parser"
```

### Task 3: Add Fixture-Backed Failing Tests For Stream-Aware PCB Recovery

**Files:**

- Modify: `tests/fixtures/AltiumFixtureLoader.mjs`
- Modify: `tests/core/altium-parser/forge-relic.mjs`
- Create: `tests/core/altium-parser/pcb-streams.mjs`

**Step 1: Write the failing test**

Extend the repo-owned fake PCB fixture so it models a tiny OLE-backed PCB document with:

- one board outline stream
- one component placement
- at least one top-layer polygon
- at least one PCB text primitive

Add tests that assert:

- the PCB parser still recovers outline and components
- the normalized model now expects `pcb.polygons.length >= 1`
- the normalized model now expects `pcb.texts.length >= 1`
- diagnostics mention recovered primitive families or stream discovery

Example expectation:

```js
assert.equal(documentModel.kind, 'pcb')
assert.ok(documentModel.pcb.polygons.length >= 1)
assert.ok(documentModel.pcb.texts.length >= 1)
assert.match(
    documentModel.diagnostics.map((item) => item.message).join('\n'),
    /stream|polygon|text/i
)
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/altium-parser/forge-relic.mjs tests/core/altium-parser/pcb-streams.mjs`

Expected: FAIL because the current PCB parser only exposes outline, layers, and components.

**Step 3: Write minimal test-fixture support**

Update the fixture loader only enough to produce the obfuscated fake OLE-backed PCB bytes needed by the tests. Do not add native `.PcbDoc` fixtures to the repository.

**Step 4: Run test to verify it still fails for the right reason**

Run: `npm test -- tests/core/altium-parser/forge-relic.mjs tests/core/altium-parser/pcb-streams.mjs`

Expected: still FAIL, now specifically because production parsing does not yet recover polygons and texts.

### Task 4: Implement Stream-Aware PCB Extraction And Primitive Normalization

**Files:**

- Create: `src/core/altium/PcbStreamExtractor.mjs`
- Create: `src/core/altium/PcbPrimitiveParser.mjs`
- Modify: `src/core/altium/PrintableTextDecoder.mjs`
- Modify: `src/core/altium/AsciiRecordParser.mjs`
- Modify: `src/core/altium/AltiumParser.mjs`
- Modify: `src/core/altium/AltiumLayoutParser.mjs`

**Step 1: Write the minimal production extractor**

Implement a PCB extractor that:

- opens OLE streams when the file is a compound document
- filters candidate PCB streams
- runs printable-run extraction per stream
- returns parsed field records with `sourceStream`
- falls back to the current whole-file printable scan when OLE extraction is unavailable

Keep the parser boundary explicit:

```js
const extracted = PcbStreamExtractor.extract(arrayBuffer)
// {
//   records: [{ raw, fields, sourceStream }],
//   streamNames: ['FileHeader', 'Board6'],
//   usedOle: true
// }
```

**Step 2: Normalize PCB primitive families**

Add a `PcbPrimitiveParser` that recognizes structural field signatures for:

- polygons
- texts
- tracks
- pads
- vias

Only promote a primitive when the required fields are genuinely present. Do not infer geometry.

**Step 3: Update `AltiumParser.#parseForgeBoard`**

Extend the normalized `pcb` payload with:

- `polygons`
- `texts`
- `tracks`
- `pads`
- `vias`

Also add diagnostics describing:

- whether OLE stream extraction was used
- how many streams were inspected
- which primitive families were recovered

**Step 4: Run the focused parser tests**

Run: `npm test -- tests/core/altium-parser/forge-relic.mjs tests/core/altium-parser/pcb-streams.mjs tests/core/ole-compound-document.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/altium/PcbStreamExtractor.mjs src/core/altium/PcbPrimitiveParser.mjs src/core/altium/PrintableTextDecoder.mjs src/core/altium/AsciiRecordParser.mjs src/core/altium/AltiumParser.mjs src/core/altium/AltiumLayoutParser.mjs tests/fixtures/AltiumFixtureLoader.mjs tests/core/altium-parser/forge-relic.mjs tests/core/altium-parser/pcb-streams.mjs
git commit -m "feat: add stream-aware pcb primitive recovery"
```

### Task 5: Add Failing PCB Renderer And Theme Tests

**Files:**

- Modify: `tests/ui/renderers/output-renderers.mjs`

**Step 1: Write the failing test**

Add renderer tests that prove the PCB view:

- renders recovered polygon geometry
- renders recovered PCB text
- renders any recovered tracks, pads, or vias when present
- emits `var(--pcb-...)` tokens instead of literal PCB colors

Example expectations:

```js
assert.match(markup, /class="pcb-polygon"/)
assert.match(markup, /class="pcb-text"/)
assert.match(markup, /var\(--pcb-board-fill\)/)
assert.match(markup, /var\(--pcb-top-copper-fill\)/)
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: FAIL because the current renderer only draws the outline and rectangular component placeholders with literal colors.

**Step 3: Do not implement yet**

Leave production code untouched in this task.

**Step 4: Run test again to confirm the same failure**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: same FAIL reason.

### Task 6: Implement PCB SVG Primitive Rendering And CSS Variables

**Files:**

- Create: `src/ui/PcbColorResolver.mjs`
- Modify: `src/ui/PcbSvgRenderer.mjs`
- Modify: `src/styles/20-viewer.css`

**Step 1: Add the PCB color resolver**

Create a small resolver that maps semantic PCB layer families to CSS custom properties, for example:

```js
PcbColorResolver.boardFill()
PcbColorResolver.boardOutline()
PcbColorResolver.layerFill('TOP')
PcbColorResolver.layerFill('BOTTOM')
PcbColorResolver.overlayColor('TOP OVERLAY')
```

**Step 2: Update the renderer**

Render the normalized primitives in draw-order groups:

- board outline
- polygon pours
- tracks
- pads
- vias
- component overlays
- PCB text

Keep the existing component placeholder rendering only as a fallback for components with no better primitive data.

**Step 3: Move PCB colors into CSS variables**

Define scoped PCB theme variables on `.pcb-svg` and replace current literal colors with those tokens.

**Step 4: Run the focused renderer test**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/PcbColorResolver.mjs src/ui/PcbSvgRenderer.mjs src/styles/20-viewer.css tests/ui/renderers/output-renderers.mjs
git commit -m "feat: render pcb primitives with theme variables"
```

### Task 7: Verify Whole-Repo Behavior And Versioning

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `docs/troubleshooting.md`

**Step 1: Update version and docs**

- increment the app version once the implementation is complete
- update the README summary so PCB rendering is described as stream-aware and best-effort
- add a troubleshooting note describing the new PCB diagnostic states

**Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS.

**Step 3: Perform local manual verification**

Open the app with the supplied PCB file and confirm:

- polygon pours are visible
- diagnostics report recovered primitive families
- the board uses PCB CSS theme colors
- any newly recovered pads, vias, and tracks visibly improve fidelity

**Step 4: Commit**

```bash
git add package.json package-lock.json README.md docs/troubleshooting.md
git commit -m "chore: finalize pcb stream-aware decoding rollout"
```
