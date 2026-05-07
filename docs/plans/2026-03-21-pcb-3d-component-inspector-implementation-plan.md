# PCB 3D Component Inspector Implementation Plan

**Goal:** Add click selection to the 3D PCB viewer and render a component inspector in the existing right-side panel under the toggle controls.

**Architecture:** Keep picking in the Three.js runtime, keep panel rendering in the 3D controller, and use the existing scene description as the source of truth for component and explicit external-placement metadata. Tag pickable meshes with lightweight metadata and propagate selection changes through a controller callback into a reserved inspector node in the scene shell.

**Tech Stack:** Native ES modules, Three.js runtime, existing controller/view classes, Node test runner.

---

### Task 1: Add Inspector Shell Coverage

**Files:**
- Create: none
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/ui/Scene3dRenderer.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/ui/renderers/scene3d.mjs`

**Step 1: Write the failing test**

Add a renderer test that expects the 3D markup to include an inspector container under the toggle controls and an empty-state message.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers.test.mjs`
Expected: FAIL because the inspector markup is not present.

**Step 3: Write minimal implementation**

Add the inspector mount and empty-state markup to `Scene3dRenderer.render()`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers.test.mjs`
Expected: PASS

### Task 2: Add Controller Selection Tests

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/ui/PcbScene3dController.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/ui/pcb-scene3d-controller.test.mjs`

**Step 1: Write the failing test**

Add a controller test that simulates runtime selection callbacks and asserts the inspector text updates with the selected component metadata, then clears on `null`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene3d-controller.test.mjs`
Expected: FAIL because no inspector node is wired and the runtime hook is missing.

**Step 3: Write minimal implementation**

Update the controller to:
- locate the inspector node
- pass `setSelection` into the runtime
- render a compact inspector summary into the panel

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene3d-controller.test.mjs`
Expected: PASS

### Task 3: Add Runtime Picking Tests

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/ui/PcbScene3dRuntime.mjs`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/ui/pcb-scene3d-runtime.test.mjs`

**Step 1: Write the failing test**

Add runtime tests that verify:
- pickable meshes are tagged with selection metadata
- clicking a tagged mesh emits that payload
- clicking empty space clears the selection

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene3d-runtime.test.mjs`
Expected: FAIL because no picking path exists.

**Step 3: Write minimal implementation**

Implement:
- mesh tagging for fallback and external-model objects
- raycast-based click handling
- selection callback emission

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene3d-runtime.test.mjs`
Expected: PASS

### Task 4: Style the Inspector

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/styles/20-viewer.css`
- Test: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/tests/project-structure.test.mjs`

**Step 1: Write the failing test**

Add or update a style/structure test only if needed to assert the inspector class names are present in rendered output expectations.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/project-structure.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL only if new class hooks are asserted.

**Step 3: Write minimal implementation**

Add compact panel styling for the inspector title, rows, and empty state without changing the overall 3D panel layout.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/project-structure.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS

### Task 5: Final Verification and Version Bump

**Files:**
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/package.json`
- Modify: `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/package-lock.json`

**Step 1: Run targeted tests**

Run: `npm test -- tests/ui/renderers.test.mjs tests/ui/pcb-scene3d-controller.test.mjs tests/ui/pcb-scene3d-runtime.test.mjs`
Expected: PASS

**Step 2: Bump version**

Increment the app version in both package files.

**Step 3: Run full verification**

Run: `npm test`
Expected: PASS

**Step 4: Summarize behavior**

Report:
- what is clickable
- what data the inspector shows
- whether tests passed
