# PCB 3D Top View Orientation Implementation Plan

**Goal:** Make the `Top` 3D preset match the viewer orientation without regressing the approved `Bottom` preset.

**Architecture:** Keep camera poses unchanged and fix orientation in `PcbScene3dRuntime` via preset-dependent scene scales. `Top` gets a vertical mirror, `Bottom` keeps its horizontal mirror, and `Isometric` stays identity.

**Tech Stack:** Node.js, native `node:test`, ES modules, Three.js runtime scene graph logic

---

### Task 1: Lock the intended orthogonal preset scales with failing tests

**Files:**

- Modify: `tests/ui/pcb-scene3d-runtime.test.mjs`

**Step 1: Write the failing test**

Add a top-view runtime regression that:

- resolves the `Top` preset basis from `PcbScene3dCameraRig`
- applies `PcbScene3dRuntime.resolveViewScale('top')`
- projects a representative top-side anchor point
- asserts that the point lands in the expected top-side screen quadrant

Keep the existing bottom-view regression and update the simple scale assertions so they cover `Top`, `Bottom`, and `Isometric`.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/pcb-scene3d-runtime.test.mjs`
Expected: FAIL because `resolveViewScale('top')` still returns the wrong top-view scale.

**Step 3: Write minimal implementation**

Update `src/ui/PcbScene3dRuntime.mjs` so `resolveViewScale('top')` returns `{ x: 1, y: -1, z: 1 }` while preserving the existing bottom and isometric behavior.

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/pcb-scene3d-runtime.test.mjs tests/ui/pcb-scene3d-camera-rig.test.mjs`
Expected: PASS.

### Task 2: Bump version and verify the change

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Update version**

Bump the patch version by one to reflect the visible 3D orientation correction.

**Step 2: Run focused and full verification**

Run: `node --test tests/ui/pcb-scene3d-runtime.test.mjs tests/ui/pcb-scene3d-camera-rig.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: PASS with no new 3D regressions.
