# ECAD Forge 1.13.7

Version 1.13.7 introduces self-adjusting UI change propagation and moves the
application onto the matching published toolkit release family.

## Incremental rendering

- `AppState` publishes the snapshot roots changed by each state transition,
  including roots derived from document and active-document changes.
- `AppViewRenderGraph` records the dependencies actually read by six ordered
  DOM stages and propagates changes only to affected status, locale,
  viewer-mode, tab, sidebar, and content computations.
- Parsed ECAD documents and document scopes remain immutable atomic inputs so
  native receivers and identity-based caches keep their existing contracts.
- Re-execution replaces stale dynamic traces and reader edges, while named
  trace reclamation keeps storage bounded by the active render graph.
- Status-only updates preserve mounted document and content UI instead of
  rebuilding unrelated DOM.

## Published toolkit family

- `circuitjson-toolkit` 1.4.1 provides the shared self-adjusting computation
  runtime.
- `altium-toolkit` 1.4.1, `gerber-toolkit` 0.4.4, and `kicad-toolkit` 1.3.2
  expose that runtime through their common root API.
- `pcb-scene3d-viewer` 1.3.2 applies the runtime to persistent render-group and
  per-component visibility effects while retaining the prior Gerber copper,
  solder-mask, and via fidelity fixes.
- ECAD Forge installs every dependency from the npm registry; no local package
  links or app-side compatibility workarounds are used.

## Validation

- Runtime tests cover dynamic dependency discovery, change propagation,
  structural changes, trace replacement, failure handling, and reclamation.
- App regressions cover emitted change roots, unaffected-sidebar reuse,
  published dependency convergence, and retained Gerber service behavior.
- Release gates include the complete app suite, formatting, structured-data
  consistency, and the static deployment build.
