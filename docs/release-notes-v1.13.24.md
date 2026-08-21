# ECAD Forge 1.13.24

Version 1.13.24 adds bounded, privacy-safe runtime context to centralized
JavaScript error recordings.

## Diagnostics

- Publishes the app version, parse phase, active view, source/format family,
  document count, and self-adjusting render-graph counts when available.
- Synchronizes retained context when the deferred Analytics tracker finishes
  loading, including safe source/format dimensions captured during startup.
- Keeps file names, raw URLs, document contents, project identifiers, component
  names, net names, and error text outside host runtime context.

## Memory validation

A 4,000-propagation replacement stress run kept the render graph at six
computations, twelve dependencies, and twelve reader edges with a 0.27 MiB heap
delta after garbage collection. The toolkit therefore remains unchanged; the
observed source line was the cleanup boundary where the browser surfaced the
allocation failure, not evidence of retained traces.
