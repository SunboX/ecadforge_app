# ECAD Forge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based Altium viewer that opens standalone native `.SchDoc` and `.PcbDoc` files client-side, decodes them in pure JavaScript, and renders initial schematic, PCB, 3D, BOM, and diagnostics views.

**Architecture:** Generate the standard web app scaffold first, then add a layered decode pipeline: browser file intake, OLE container parsing, format-specific Altium decoding, a normalized intermediate model, and separate renderers/UI panels driven only by normalized state. Prioritize a resilient parser and visible diagnostics so partial decode results remain useful while record coverage grows.

**Tech Stack:** Node 20, npm, ESM `.mjs`, Vite-based browser app, Node test runner, pure JavaScript parser modules, worker-based decode pipeline, CSS-based UI, browser canvas/SVG/WebGL primitives where needed.

---

### Task 1: Scaffold The Application Baseline

**Files:**

- Create: `AGENTS.md`
- Create: `README.md`
- Create: `package.json`
- Create: `.prettierrc.json`
- Create: `src/`
- Create: `tests/`
- Create: `docs/`
- Create: `spec/`

**Step 1: Write the failing test**

Create a structure test that asserts the scaffolded app contains the baseline files and folders required by the web-app-developer skill.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="project structure"`
Expected: fail because the scaffold does not exist yet

**Step 3: Write minimal implementation**

Run the scaffold script in the workspace with:

```bash
node /Users/afiedler/.codex/skills/web-app-developer/scripts/scaffold_web_app.mjs \
  --target /Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app \
  --app-name "ECAD Forge" \
  --description "Browser-based viewer for native Altium schematic and PCB files" \
  --port 3000 \
  --force
```

Keep default feature flags:

- i18n enabled
- workers enabled
- WebMCP disabled
- PHP compatibility disabled

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: structure tests pass

**Step 5: Commit**

```bash
git add .
git commit -m "feat: scaffold ecad forge app"
```

### Task 2: Add Binary Reading And OLE Container Parsing

**Files:**

- Create: `src/core/BinaryReader.mjs`
- Create: `src/core/ole/OleConstants.mjs`
- Create: `src/core/ole/OleDirectoryEntry.mjs`
- Create: `src/core/ole/OleCompoundDocument.mjs`
- Create: `tests/core/BinaryReader.test.mjs`
- Create: `tests/core/OleCompoundDocument.test.mjs`

**Step 1: Write the failing test**

Add tests for:

- little-endian integer reads
- bounds checking
- OLE header signature validation
- sector size extraction
- directory entry decoding on synthetic buffers

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/BinaryReader.test.mjs tests/core/OleCompoundDocument.test.mjs`
Expected: fail because the parser modules do not exist

**Step 3: Write minimal implementation**

Implement the smallest binary utilities and OLE parser needed to read:

- file header
- sector allocation tables
- directory entries
- named stream lookup
- stream extraction for standard and short streams

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/BinaryReader.test.mjs tests/core/OleCompoundDocument.test.mjs`
Expected: pass

**Step 5: Commit**

```bash
git add src/core/BinaryReader.mjs src/core/ole src/tests tests/core
git commit -m "feat: add ole compound file parser"
```

### Task 3: Build Altium Decode Pipeline And Normalized Model

**Files:**

- Create: `src/core/altium/AltiumFileSniffer.mjs`
- Create: `src/core/altium/AltiumDiagnostics.mjs`
- Create: `src/core/altium/AltiumDocumentModel.mjs`
- Create: `src/core/altium/SchDocDecoder.mjs`
- Create: `src/core/altium/PcbDocDecoder.mjs`
- Create: `src/core/altium/DecodedDocumentSummary.mjs`
- Create: `tests/core/AltiumFileSniffer.test.mjs`
- Create: `tests/core/SchDocDecoder.test.mjs`
- Create: `tests/core/PcbDocDecoder.test.mjs`

**Step 1: Write the failing test**

Add tests that prove:

- the sniffer identifies `.SchDoc` and `.PcbDoc`
- local sample files can be opened as OLE documents
- decoder returns a normalized document object with metadata and diagnostics even when deep record coverage is incomplete

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/AltiumFileSniffer.test.mjs tests/core/SchDocDecoder.test.mjs tests/core/PcbDocDecoder.test.mjs`
Expected: fail because decoder modules do not exist

**Step 3: Write minimal implementation**

Implement:

- file type sniffing
- stream inventory extraction
- normalized summary extraction from available records and stream names
- diagnostics collection for unknown streams and unsupported record families

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/AltiumFileSniffer.test.mjs tests/core/SchDocDecoder.test.mjs tests/core/PcbDocDecoder.test.mjs`
Expected: pass

**Step 5: Commit**

```bash
git add src/core/altium tests/core
git commit -m "feat: add altium decode pipeline foundation"
```

### Task 4: Wire Browser File Intake And Worker Parsing

**Files:**

- Modify: `src/main.mjs`
- Create: `src/core/AppController.mjs`
- Create: `src/workers/altium-parser.worker.mjs`
- Create: `src/core/ViewerState.mjs`
- Create: `tests/ui/AppController.test.mjs`

**Step 1: Write the failing test**

Add tests for:

- accepting a selected file
- dispatching parse requests
- updating state to loading, success, and error modes

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/AppController.test.mjs`
Expected: fail because controller and state modules do not exist

**Step 3: Write minimal implementation**

Implement:

- upload/drop UI wiring
- worker parse request/response protocol
- main-thread fallback path
- state transitions for unreadable, partial, and decoded files

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/AppController.test.mjs`
Expected: pass

**Step 5: Commit**

```bash
git add src/main.mjs src/core/AppController.mjs src/core/ViewerState.mjs src/workers tests/ui
git commit -m "feat: add browser file intake and parser worker flow"
```

### Task 5: Implement The Viewer Shell And Diagnostics Surface

**Files:**

- Modify: `src/index.html`
- Modify: `src/style.css`
- Create: `src/styles/viewer-shell.css`
- Create: `src/ui/ViewerShell.mjs`
- Create: `src/ui/DiagnosticsPanel.mjs`
- Create: `tests/ui/ViewerShell.test.mjs`

**Step 1: Write the failing test**

Add tests for:

- initial empty-state rendering
- decoded-state rendering
- diagnostics list rendering

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/ViewerShell.test.mjs`
Expected: fail because UI shell modules do not exist

**Step 3: Write minimal implementation**

Implement a viewer shell with:

- header and file input
- tabbed views for schematic, PCB, 3D, BOM, and diagnostics
- decode summary cards
- diagnostics panel with severity and details

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/ViewerShell.test.mjs`
Expected: pass

**Step 5: Commit**

```bash
git add src/index.html src/style.css src/styles src/ui tests/ui
git commit -m "feat: add ecad forge shell and diagnostics panels"
```

### Task 6: Implement Initial Schematic, PCB, 3D, And BOM Views

**Files:**

- Create: `src/ui/SchematicView.mjs`
- Create: `src/ui/PcbView.mjs`
- Create: `src/ui/Board3dView.mjs`
- Create: `src/ui/BomView.mjs`
- Create: `tests/ui/SchematicView.test.mjs`
- Create: `tests/ui/PcbView.test.mjs`
- Create: `tests/ui/BomView.test.mjs`

**Step 1: Write the failing test**

Add tests for:

- rendering normalized schematic summaries
- rendering PCB geometry summaries and layer listings
- rendering BOM rows from component summaries

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/SchematicView.test.mjs tests/ui/PcbView.test.mjs tests/ui/BomView.test.mjs`
Expected: fail because the view modules do not exist

**Step 3: Write minimal implementation**

Implement:

- initial schematic visual surface for available entities
- initial PCB visual surface for available entities
- 3D placeholder scene using derived board metadata
- BOM table from normalized component data

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/SchematicView.test.mjs tests/ui/PcbView.test.mjs tests/ui/BomView.test.mjs`
Expected: pass

**Step 5: Commit**

```bash
git add src/ui tests/ui
git commit -m "feat: add initial schematic pcb 3d and bom views"
```

### Task 7: Update Docs, Specs, And Validation Coverage

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/security.md`
- Modify: `docs/troubleshooting.md`
- Modify: `spec/web-app-specification.md`
- Modify: `tests/structure.test.mjs`

**Step 1: Write the failing test**

Add or update any structure/spec expectations required by the new parser/viewer modules.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: fail if docs/spec-required structure is missing

**Step 3: Write minimal implementation**

Document:

- supported file types
- client-only parsing constraints
- worker architecture
- diagnostics behavior
- local sample corpus usage for manual validation

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: full test suite passes

**Step 5: Commit**

```bash
git add README.md docs spec tests
git commit -m "docs: describe altium viewer architecture and usage"
```
