# 3D Component Parameter Controls Design

## Goal

Allow users to select a 3D component and adjust its displayed scale, rotation,
and offset in the live 3D viewer, using compact KiCad-style controls in the
component inspector.

## Scope

- Add editable controls for selected 3D component parameters:
  - scale X, Y, Z
  - rotation X, Y, Z in degrees
  - offset X, Y, Z in millimeters
- Apply edits immediately to the selected live 3D scene object.
- Support external model placements and procedural fallback bodies.
- Provide a reset action that restores the selected component to the original
  scene-description transform.
- Keep edits in memory only while the 3D scene controller is mounted.
- Integrate the updated `pcb-scene3d-viewer` package into ECAD Forge.

## Out Of Scope

- Writing edits back to `.kicad_pcb`, `.PcbDoc`, source models, or downloads.
- Persisting edits across reloads, tab remounts, or new file loads.
- Multi-select editing.
- Changing parser logic or adding file-format-specific placement special cases.
- Exporting adjusted placement metadata.

## Recommended Approach

Implement the feature primarily in `../pcb-scene3d-viewer`.

That package already owns the component selection inspector, the selected
runtime roots, and the Three.js transform chain. Keeping the editable inspector
and live transform application there avoids fragile app-level DOM overlays and
keeps the behavior reusable for any host application.

ECAD Forge should consume the updated local package and keep app-level changes
limited to dependency wiring, version metadata, tests, and any styling needed
for the larger viewer layout.

## Interaction Model

- Selecting a component shows the existing component metadata plus editable
  transform controls.
- Numeric inputs use stepper-friendly fields:
  - scale fields default to `1.0000`
  - rotation fields display degrees
  - offset fields display millimeters
- Changing a value updates the selected rendered object immediately.
- Reset restores the selected component's original runtime transform and field
  values.
- Selecting a different component shows that component's current in-memory
  adjustment, or its original values if it has not been edited.
- Clicking empty space clears the inspector, preserving any in-memory edits for
  components already adjusted during the current scene session.

## Data Model

The 3D controller stores a per-designator adjustment map for the mounted scene:

```js
{
    scale: { x: 1, y: 1, z: 1 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    offsetMil: { x: 0, y: 0, z: 0 }
}
```

Offsets are displayed in millimeters but stored/applied in mil so they match the
existing scene-description and runtime coordinate units.

For external models, the baseline values come from
`externalPlacement.modelTransform`. For fallback bodies, the baseline values are
neutral model-local adjustments applied on top of the existing component mount
rig.

## Runtime Architecture

`PcbScene3dRuntime` should register a transform target for every selectable
component root. A new method such as `setComponentAdjustment(designator,
adjustment)` applies the selected adjustment to the correct target and rerenders
the scene.

External model adjustments should be applied at a model-local adjustment group
inside the placement wrapper, after footprint placement and before the model
mesh. Fallback body adjustments should use an equivalent adjustment group around
the procedural body mesh. This keeps component board placement intact while
letting users tune model-local parameters like KiCad's 3D model panel.

## Inspector Architecture

`PcbScene3dController` should render the selected inspector with:

- existing read-only component metadata
- three grouped editable sections: Scale, Rotation, Offset
- a reset button

The controller owns DOM event binding for these controls. Input changes update
the mounted runtime through the new runtime adjustment method and refresh the
selected inspector values. The controller should not mutate the source
`documentModel` or prepared scene description.

## ECAD Forge Integration

ECAD Forge should consume the updated local `pcb-scene3d-viewer` package so the
app uses the editable inspector implementation. App-side tests should verify
that the 3D controller interface still receives selected component state and
that the scene can stay mounted while selection changes.

The app version in `package.json` must be incremented with the integration
change.

## Error Handling

- Invalid numeric values are ignored and the previous valid value remains
  active.
- Missing runtime transform targets leave the inspector usable but do not throw.
- If no component metadata exists for a selected designator, the existing
  no-metadata state remains.
- Runtime startup and model-loading diagnostics continue using the existing 3D
  diagnostics area.

## Testing Strategy

- `pcb-scene3d-viewer` controller tests:
  - selected external model renders editable scale, rotation, and offset fields
  - changing an input forwards a normalized adjustment to the runtime
  - reset restores the baseline values
- `pcb-scene3d-viewer` runtime tests:
  - external placement adjustment mutates only the model-local adjustment target
  - fallback body adjustment mutates only the fallback body adjustment target
  - selection changes preserve per-designator in-memory adjustments
- ECAD Forge tests:
  - app integration still mounts the 3D controller and forwards selected
    component changes without remounting
  - package/version metadata reflects the integration change

## Acceptance Criteria

- A selected 3D component exposes editable scale, rotation, and offset controls.
- Edits update the live 3D scene immediately.
- Reset returns the selected component to its original displayed transform.
- Edits are not persisted to source ECAD files or downloads.
- External models and fallback bodies both support live adjustment.
- Automated tests cover the controller, runtime, and ECAD Forge integration.
