# PCB 3D Bottom View Orientation Implementation Plan

**Goal:** Make the `Bottom` 3D preset place representative underside connectors in the `top-left` screen quadrant while keeping the board portrait and leaving authored geometry placement unchanged.

**Architecture:** Restore the portrait underside camera basis in `PcbScene3dCameraRig`, then add a bottom-only runtime wrapper transform in `PcbScene3dRuntime` that mirrors scene `X`. Lock both behaviors with focused tests so later changes cannot drift back to the `top-right` portrait variant or the `90` degree rotated variant.

**Tech Stack:** Node.js, native `node:test`, ES modules, Three.js camera/runtime scene graph logic

---

### Task 1: Lock the correct bottom-view behavior with failing tests

**Files:**

- Modify: `tests/ui/pcb-scene3d-camera-rig.test.mjs`
- Add: `tests/ui/pcb-scene3d-runtime.test.mjs`

**Step 1: Write the failing test**

Update the camera-rig test so it asserts that:

- `top` still uses the normal top-view basis
- `bottom` uses the portrait underside basis `up = { x: 0, y: -1, z: 0 }`

Add a runtime test helper that combines:

- the bottom camera preset basis
- a preset-dependent runtime view scale
- a representative underside anchor point

Assert that the combined result lands in the `top-left` screen quadrant without rotating the board.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/pcb-scene3d-camera-rig.test.mjs tests/ui/pcb-scene3d-runtime.test.mjs`
Expected: FAIL because the current bottom preset still uses the wrong in-plane basis and the runtime mirror hook does not exist yet.

**Step 3: Write minimal implementation**

Update `src/ui/PcbScene3dCameraRig.mjs` so the `bottom` preset uses the portrait underside basis while the camera remains below the board.

Update `src/ui/PcbScene3dRuntime.mjs` to:

- introduce a wrapper group above the scene root
- resolve a preset-dependent view scale
- apply `x = -1` only for the `bottom` preset

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/pcb-scene3d-camera-rig.test.mjs tests/ui/pcb-scene3d-runtime.test.mjs`
Expected: PASS.

### Task 2: Bump version and verify the change

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Update version**

Bump the patch version by one to reflect the user-visible 3D view behavior change.

**Step 2: Run focused and full verification**

Run: `node --test tests/ui/pcb-scene3d-camera-rig.test.mjs tests/ui/pcb-scene3d-runtime.test.mjs`
Expected: PASS for the affected 3D coverage.

Run: `npm test`
Expected: Either PASS or the same unrelated baseline failures already present elsewhere in the workspace, with no new 3D camera failures.
