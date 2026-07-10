# External Model Default Design

## Problem

The app overrides the shared 3D viewer's external-model visibility default for
Altium documents. As a result, the External models checkbox is unchecked every
time the 3D shell is rendered, including after a reload.

## Design

The app will no longer apply a format-specific default for external models. It
will pass caller-provided initial toggle values through unchanged and otherwise
allow `pcb-scene3d-viewer` to use its existing enabled default.

An explicit `initialToggles['external-models'] = false` remains authoritative,
so a user- or caller-selected disabled state is still respected. No
document-name, fixture, or source-format special case will be introduced.

## Testing

The app regression test will assert that external models start enabled for both
Altium and KiCad documents. A separate assertion will verify that an explicit
disabled initial toggle remains disabled.

## Acceptance Criteria

- External models are enabled by default for every supported PCB format.
- Reloading or rebuilding an Altium 3D shell does not force the checkbox off.
- An explicit disabled initial state remains disabled.
- The focused regression tests and the full app test suite pass.
