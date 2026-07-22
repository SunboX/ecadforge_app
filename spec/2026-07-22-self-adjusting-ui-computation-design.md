# Self-Adjusting UI Computation Design

**Date:** 2026-07-22

## Goal

Apply the self-adjusting-computation principles developed in Umut A. Acar's
publications to ECAD Forge's state-driven UI: record data and control
dependencies, start propagation at reads of changed modifiables, repair only
affected execution traces, and keep the repaired result consistent with a
from-scratch render.

This is an application of the publications to the existing UI architecture,
not a claim that ECAD Forge embeds one of the papers' complete source
languages or compilers.

## Publication-Derived Requirements

The design uses the publications listed in the
[research index](https://www.umut-acar.org/research#h.x3l3dlvx3g5f), with the
following requirements drawn from the work on adaptive functional
programming, selective memoization, imperative and implicit self-adjusting
computation, consistent semantics, trace-distance cost semantics,
non-monotonic reuse, memory management, and CEAL:

1. Separate the **mutator** that changes input from the self-adjusting
   **core** that observes it.
2. Record both data dependencies and control dependencies dynamically.
3. Maintain reverse reader lists so input changes identify potentially
   inconsistent reads directly.
4. Process affected work in original execution order where side effects make
   order observable.
5. Re-execute an affected computation only when its observed value, shape,
   presence, or identity actually changed.
6. Replace the old trace after re-execution so dependencies from abandoned
   control-flow branches are deleted.
7. Select stable and changeable boundaries deliberately; equality and
   identity checks must be cheap and valid for the selected data.
8. Reuse a computation trace, not merely an output value, so the reused work
   remains eligible for later propagation.
9. Bound space by the current trace rather than the history of changes, and
   provide explicit trace reclamation.
10. Test **from-scratch consistency**: propagation and a fresh execution must
    produce the same observable result for the new input.

## Existing Problem

`AppController` publishes a complete `AppState` snapshot for every state
transition. `AppView.render()` historically revisited status, locale,
shell-mode, tab, sidebar, and active-content work on every update. A few
content renderers have local reuse signatures, but there was no shared trace
that knew which state reads controlled which DOM stages.

A small status-message update could therefore revisit an unrelated document
sidebar or viewer. Manual cache keys also drift when a renderer's branching
logic starts reading a new field.

## Considered Approaches

### Manual signatures per stage

Each renderer would declare a state-field cache key. This is cheap but makes
the dependency graph a manually maintained duplicate of the implementation.
It misses the papers' central dynamic-dependence principle.

### Fine-grained signals throughout the app

Every field and derived value could become an explicit signal. This would
offer precise updates but requires a broad controller/view rewrite and would
entangle current local Gerber and 3D work.

### Dynamic stage traces with explicit change sets

The selected design keeps the snapshot API. `AppState` reports the roots
changed by each mutation. Each render stage executes against a read-tracking
snapshot proxy, and the runtime indexes its observed paths by root. A later
change starts at the matching reader lists; exact dependency comparison then
suppresses propagation if normalization produced an equivalent value.

This combines explicit mutator information with implicit dependency discovery
and fits the existing app-owned state-to-DOM boundary.

## Architecture

### Mutator: `AppState`

`setValue()` and `patch()` remain the only normal state mutation operations.
Subscribers now receive `(snapshot, changedPaths)`:

- the initial subscription sends `null`, requiring from-scratch execution;
- later events contain conservative root paths such as
  `[['statusMessage']]`;
- document-list and active-document changes include derived roots such as
  `documentModel`, `activeFileName`, and normalized selection maps.

The change set may over-approximate but must never omit a value the mutation
can change. Exact trace comparison removes false positives before DOM work is
re-executed.

### Shared core: `circuitjson-toolkit/SelfAdjustingComputation`

The format-neutral runtime belongs to `circuitjson-toolkit`, the common data
and API boundary used by every local format toolkit. Gerber, Altium, and KiCad
re-export the exact same class identity instead of maintaining independent
copies. ECAD Forge and `pcb-scene3d-viewer` consume that shared class through
their normal package dependency.

For each named computation the runtime stores its last successful value and
dynamic dependency trace. It also maintains reverse reader lists keyed by the
first input-path segment.

`propagate(input, changedPaths, computations)` performs ordered change
propagation:

1. Build an affected frontier from readers of the changed roots.
2. Visit named computations in caller-supplied execution order.
3. Reuse computations outside the frontier without scanning their traces.
4. For frontier entries, compare recorded value, container kind, key order,
   property presence, and enumerability dependencies against the new input.
5. Reuse an entry if those observations are equal.
6. Otherwise execute it through the tracking proxy and atomically replace its
   successful trace and reverse edges.

Returning a tracked input container records its raw identity and unwraps the
proxy. Mutations through the proxy are rejected. Asynchronous computations
are rejected because their reads would escape the synchronous trace extent.
Thrown computations do not replace the last successful trace.

`forget()` and `clear()` delete trace and reader-list storage. Re-execution of
a named computation replaces its trace rather than appending history. The
runtime exposes bounded trace counts for diagnostics and consistency tests.

### Selective stable/changeable boundary

Plain snapshot objects and arrays are traversable. Parsed document models,
document scopes, typed arrays, class instances, functions, and other
non-plain values are atomic identity dependencies. This is intentional:

- parsed documents are immutable after preparation;
- toolkit `WeakMap` caches depend on raw object identity;
- native objects may require their original receiver;
- tracing large document internals would make first-run overhead dominate the
  repeated UI update being optimized.

This selective boundary follows the publications' guidance that dependency
precision must be balanced against equality and tracing cost.

### `AppView` render graph

`AppViewRenderGraph` owns six stable traces, evaluated in deterministic DOM
order:

1. persistent and landing status;
2. locale selector;
3. viewer-mode CSS state;
4. active tab state;
5. document sidebar;
6. active view content.

Sidebar and content stages read `locale` explicitly because translations come
from an external closure. The sidebar uses a prototype-delegating snapshot
with only the resolved `documents` override, avoiding an eager spread that
would falsely read every root.

The named traces can be reused independently even when unrelated application
work is reordered. DOM stages themselves stay ordered because their side
effects are observable; the full trace-slicing algorithm for arbitrary
non-monotonic imperative execution is neither necessary nor safe here.

`AppView.#lastSnapshot` advances on every state event, including events for
which all DOM traces are reused, so interaction callbacks still see current
state.

### Local toolkit application

The parser toolkits expose immutable parse/load operations, so incrementalizing
those one-shot calls without an editable input model would add cache policy
without a valid mutator boundary. They therefore expose the common
self-adjusting primitive at their converged root API while retaining their
format-owned parsing behavior.

`pcb-scene3d-viewer` does own persistent mutable state. Its render-group and
component-visibility effects become two ordered computations. Toggle paths
form the fine-grained modifiables; explicit group and component revision roots
represent mutation inside atomic `Map` and `Set` containers. A copper-only
toggle can repair group visibility without reapplying component visibility,
while selection/hidden-component changes repair the component stage alone.
Unknown structural changes conservatively advance both revisions.

## Correctness Invariants

- Reused work returns the prior successful value and leaves its DOM effect in
  place.
- A changed recorded primitive or atomic identity invalidates its trace.
- Adding, deleting, or reordering enumerated keys invalidates structural
  readers.
- Adding or deleting a property invalidates presence readers.
- Inactive branch dependencies do not trigger work.
- Re-execution removes reverse edges for the old branch before indexing the
  new trace.
- A failed or asynchronous execution cannot replace a valid trace.
- Propagated results equal fresh-runtime results for the same input.
- Trace count is bounded by the active named computations, not update count.

## Testing

Runtime tests cover unrelated and nested changes, control-flow trace
replacement, structural enumeration, property presence, raw document
identity, failed execution, write rejection, reader-list frontier selection,
stale-edge deletion, from-scratch consistency, trace reclamation, and async
trace escape.

`AppState` tests cover initial and derived change sets. `AppView` integration
proves a status-only change updates status while reusing the document sidebar.
The full UI and repository suites continue to cover controller wiring,
selection, viewport preservation, and active panels.

Each format toolkit verifies that its root entry point exports the canonical
`circuitjson-toolkit` class by identity. The 3D viewer additionally verifies
selective stage repair and compares propagated visibility against a fresh
visibility graph for the same state.

## Scope

This implementation adjusts repeated app-state-to-DOM and 3D-visibility
computations. It does not incrementalize native file parsing because the app
exposes file loads, not edits to a persistent parser input. A future editable
document model would need format-owned modifiables and parser-owned traces
rather than an app-side adapter or example-specific workaround.
