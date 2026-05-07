# PCB Authored Footprints Implementation Plan

**Goal:** Replace synthetic PCB component body rectangles with authored footprint geometry from `.PcbDoc` content whenever that geometry is available.

**Architecture:** Extend PCB normalization to expose legacy primitive-layer names used by binary primitives, then update the SVG renderer to draw all pads plus selected top-side authored outline layers. Keep the existing synthetic body only as a fallback when no authored geometry exists near a component.

**Tech Stack:** Node.js, native `node:test`, ESM modules, SVG rendering

---

### Task 1: Add parser coverage for primitive layer names

**Files:**
- Modify: `tests/core/pcb-model-parser.test.mjs`
- Modify: `src/core/altium/PcbModelParser.mjs`
- Modify: `src/core/altium/AltiumLayoutParser.mjs`

**Step 1: Write the failing test**

Add a test that feeds `PcbModelParser.parse()` a minimal `Board6/Data` layer-name record containing legacy entries such as `LAYER33NAME=Top Overlay` and `LAYER59NAME=M3 Placement Outline`, then assert the normalized PCB model exposes those primitive layer names with their numeric IDs.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/pcb-model-parser.test.mjs`

Expected: FAIL because the normalized PCB model does not yet expose primitive-layer names.

**Step 3: Write minimal implementation**

Add a layout-parser helper for legacy primitive-layer names and pass its output through `PcbModelParser.parse()` into the normalized PCB model.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/pcb-model-parser.test.mjs`

Expected: PASS.

### Task 2: Add renderer regression coverage for authored footprint detail

**Files:**
- Modify: `tests/ui/renderers/output-renderers.mjs`
- Modify: `src/ui/PcbSvgRenderer.mjs`
- Modify: `src/styles/20-viewer.css`

**Step 1: Write the failing test**

Add a renderer test with:

- one SMD pad with `holeDiameter: 0`
- one authored outline track on a top-side documentation layer
- one component colocated with that authored detail

Assert that the markup includes SMD pad output, authored footprint outline markup, and no synthetic fallback body for that component.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: FAIL because the renderer currently filters out SMD pads and always emits the synthetic rectangle.

**Step 3: Write minimal implementation**

Update the renderer to:

- include all pads
- omit drill-hole markup for SMD pads
- classify selected top-side documentation layers by normalized name
- render those authored outline primitives with dedicated SVG classes
- suppress the synthetic fallback body when authored detail exists near the component

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers/output-renderers.mjs`

Expected: PASS.

### Task 3: Verify the integrated renderer and bump version

**Files:**
- Modify: `package.json`
- Modify: `api/app-version.json`
- Modify: any touched implementation files from Tasks 1-2

**Step 1: Increment the app version**

Update `package.json` and `api/app-version.json` to the next patch version.

**Step 2: Run focused regression tests**

Run: `npm test -- tests/core/pcb-model-parser.test.mjs tests/ui/renderers/output-renderers.mjs`

Expected: PASS.

**Step 3: Run the full repo test suite**

Run: `npm test`

Expected: PASS with exit code `0`.

**Step 4: Review the diff**

Run: `git diff -- src/core/altium/AltiumLayoutParser.mjs src/core/altium/PcbModelParser.mjs src/ui/PcbSvgRenderer.mjs src/styles/20-viewer.css tests/core/pcb-model-parser.test.mjs tests/ui/renderers/output-renderers.mjs package.json api/app-version.json`

Expected: Only the authored-footprint implementation, tests, docs, and version updates appear.
