# WebMCP Execution Cancellation Design

## Context

Chrome 153 passes a per-invocation `AbortSignal` to imperative WebMCP tool
callbacks as `execute(input, { signal })`. ECAD Forge currently accepts only
the input argument in its native tool wrapper. The browser can stop awaiting a
cancelled invocation, but the signal is not available to the app-owned or
toolkit-owned query boundaries.

ECAD Forge registers loaded-session inspection tools and dispatches Altium and
KiCad queries to the matching toolkit `LoadedDesignNetlistService`. Those
queries are synchronous and local-only. They must remain synchronous and
backward compatible; converting them to workers or asynchronous generators is
outside this change.

## Goals

- Accept the current WebMCP `execute(input, { signal })` callback shape.
- Preserve the exact signal identity through the app registry and dispatcher.
- Give Altium and KiCad query services backward-compatible cancellation
  boundaries without putting runtime data into JSON tool arguments.
- Reject pre-aborted execution before query work begins.
- Preserve existing behavior when no execution options are supplied.
- Document the synchronous cancellation limitation precisely.
- Release only repositories with behavior changes.

## Non-Goals

- Interrupting a synchronous JavaScript loop after it has started.
- Moving loaded-session queries into workers.
- Changing parser cancellation, file loading, renderer execution, or app state.
- Releasing Gerber, CircuitJSON, or PCB Scene3D packages without code changes.
- Patching installed `@mcp-b/global` files.

## Architecture

The invocation context travels separately from the JSON input:

```text
WebMCP execute(args, { signal })
    -> WebMcpAdapter tool.handler(args, { signal })
    -> WebMcpToolRegistry service method(args, { signal })
    -> app LoadedDesignNetlistService method(args, { signal })
    -> toolkit LoadedDesignNetlistService method(args, { signal })
```

`WebMcpAdapter` normalizes a missing or non-object callback-options value to an
empty execution context. It forwards only the optional `signal`; analytics
continues to record method, API form, and success/error status without payload
or cancellation details.

The registry defines handlers with a second optional execution-context
argument. The app service accepts the same context on every public tool method.
For toolkit-dispatched operations it forwards that context to the owning
Altium or KiCad service. App-owned inspection operations use the same guard at
their public boundary.

Each affected toolkit adds a focused `QueryExecution` utility. It validates an
optional signal through the platform `AbortSignal` getter, preserving the
repositories' established protection against lookalike objects and shadowed
`aborted` properties. `throwIfAborted()` throws the signal reason when present,
or a standard `AbortError` when the signal has no reason. Query methods call the
guard before accessing loaded documents.

## Cancellation Semantics

- A pre-aborted signal rejects before loaded-session query work.
- A genuine non-aborted signal leaves current synchronous results unchanged.
- An omitted signal preserves all existing callers and return types.
- A non-`AbortSignal` value fails with `TypeError` at the query boundary.
- Browser cancellation that happens while a synchronous query is already
  running cancels the WebMCP invocation, but the JavaScript computation can
  finish before the event loop observes cancellation. True mid-computation
  interruption requires an explicitly asynchronous or worker-based query API
  and is not claimed here.

## Testing

### ECAD Forge

- Prove the native object-form `execute` wrapper forwards the same signal to a
  registry handler.
- Prove a rejected cancellation retains error analytics behavior.
- Prove the registry forwards execution context to the app service.
- Prove app-owned and toolkit-dispatched service calls reject pre-aborted
  signals and remain compatible without options.

### Altium and KiCad toolkits

- Prove representative loaded-design queries reject a pre-aborted genuine
  signal.
- Prove lookalike signals are rejected.
- Prove existing no-options calls return the same observable results.
- Run each repository's full tests and formatting checks.

## Documentation

Update WebMCP documentation, architecture notes, and acceptance criteria to
describe signal propagation, query-boundary cancellation, and the synchronous
execution limitation. Update toolkit API documentation and release notes for
the new optional execution context.

## Release Sequence

1. Patch-version, verify, commit, push, tag, release, and publish
   `altium-toolkit`.
2. Patch-version, verify, commit, push, tag, release, and publish
   `kicad-toolkit`.
3. Install the published toolkit versions in ECAD Forge.
4. Patch-version ECAD Forge and synchronize structured-data HTML.
5. Run `npm test`, `npm run check:structured-data`, and
   `npm run build:static`.
6. Commit and push `main`, create the GitHub release, watch the deployment
   workflow through `success`, and verify production health.

## Success Criteria

- The exact WebMCP invocation signal reaches the owning query service.
- Pre-aborted calls do not perform loaded-session query work.
- Existing callers without execution options remain compatible.
- Only Altium Toolkit, KiCad Toolkit, and ECAD Forge receive release commits.
- Both library versions are verified on npm before the app dependency update.
- ECAD Forge deployment is not reported complete until GitHub Actions succeeds.
