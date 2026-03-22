# PCB 3D Bottom View Orientation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the `Bottom` 3D camera preset aligned with the approved underside orientation while leaving geometry placement unchanged.

**Architecture:** Keep the fix isolated to the camera preset logic in `PcbScene3dCameraRig`. Add regression coverage that locks the approved bottom preset pose so later camera changes do not reintroduce the upside-down underside view.

**Tech Stack:** Node.js, native `node:test`, ES modules, Three.js camera preset logic

---

### Task 1: Lock the bottom-view orientation with a failing camera test

**Files:**
- Modify: `tests/ui/pcb-scene3d-camera-rig.test.mjs`

**Step 1: Write the failing test**

Add a test helper that derives a preset's screen-right vector from `position`, `target`, and `up`. Assert that:

- `top` produces positive board-X on screen-right
- `bottom` also preserves positive board-X on screen-right
- `bottom` keeps its approved negative-Y `up` vector

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="PcbScene3dCameraRig"`
Expected: FAIL because the current bottom preset no longer matches the approved underside orientation.

**Step 3: Write minimal implementation**

Update `src/ui/PcbScene3dCameraRig.mjs` so the `bottom` preset keeps the approved negative-Y `up` vector while the camera remains below the board.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="PcbScene3dCameraRig"`
Expected: PASS.

### Task 2: Bump version and verify the change

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Update version**

Bump the patch version by one to reflect the user-visible 3D view behavior change.

**Step 2: Run focused and full verification**

Run: `npm test -- --test-name-pattern="PcbScene3dCameraRig|PcbScene3dController|renderScene3d"`
Expected: PASS for the affected 3D coverage.

Run: `npm test`
Expected: Either PASS or the same unrelated baseline failures already present elsewhere in the workspace, with no new 3D camera failures.
