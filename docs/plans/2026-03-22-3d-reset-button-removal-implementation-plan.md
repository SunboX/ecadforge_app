# 3D Reset Button Removal Implementation Plan

**Goal:** Remove the redundant visible `Reset` button from the 3D toolbar while keeping the existing internal `reset` preset alias behavior intact.

**Architecture:** Limit the UI change to the renderer and UI-facing tests so the 3D toolbar no longer exposes `Reset`. Preserve controller and camera compatibility for the `reset` preset name so any internal or legacy calls still resolve to the current isometric reset behavior.

**Tech Stack:** Node.js, native `node:test`, ES modules, browser renderer markup

---

### Task 1: Lock the toolbar contract with a failing renderer test

**Files:**

- Modify: `tests/ui/renderers/scene3d.mjs`

**Step 1: Write the failing test**

Add an assertion that the rendered 3D toolbar does not contain the `Reset` label.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/renderers/scene3d.mjs`
Expected: FAIL because the renderer still emits the `Reset` preset button.

**Step 3: Write minimal implementation**

Remove the `Reset` preset button from the 3D renderer markup.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/renderers/scene3d.mjs`
Expected: PASS.

### Task 2: Keep controller coverage aligned with the visible toolbar

**Files:**

- Modify: `tests/ui/pcb-scene3d-controller.test.mjs`

**Step 1: Write the failing test**

Update the fake toolbar button set and expectations so the controller test reflects the visible `Top`, `Bottom`, and `Isometric` buttons only.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/pcb-scene3d-controller.test.mjs`
Expected: FAIL because the existing test still expects a fourth `Reset` button.

**Step 3: Write minimal implementation**

Adjust the fake root node and assertions to match the reduced button set without changing runtime compatibility.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/pcb-scene3d-controller.test.mjs`
Expected: PASS.

### Task 3: Bump version and verify the repo scripts

**Files:**

- Modify: `package.json`

**Step 1: Update version**

Bump the patch version by one to reflect the UI change.

**Step 2: Run verification**

Run: `npm test`
Expected: PASS with exit code 0.
