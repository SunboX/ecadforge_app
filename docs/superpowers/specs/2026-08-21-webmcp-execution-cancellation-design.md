# WebMCP Execution Cancellation Design

## Context

Current object-form WebMCP browsers call registered tools as
`execute(input, { signal })`. ECAD Forge already registers through
`document.modelContext`, but its adapter previously accepted only the input
object and dropped the execution options.

The August WebMCP schema-object rollout was temporarily reverted. ECAD Forge
therefore keeps `@mcp-b/global` 4.0.0 and its existing schema compatibility
path until a stable package release supports both forms.

## Goals

- Preserve the browser's genuine `AbortSignal` separately from JSON tool input.
- Stop pre-aborted calls before any app inspection or toolkit query work starts.
- Keep legacy registrations, tool schemas, result shapes, and synchronous return
  behavior compatible.
- Change and deploy only repositories that require code changes.

## Constraints discovered during verification

Altium Toolkit and KiCad Toolkit freeze their historical
`LoadedDesignNetlistService` source and public callable contracts. Their full
conformance suites reject wrappers or signature changes as API drift. ECAD Forge
already owns the browser execution boundary and creates toolkit services only
after selecting a loaded document, so cancellation can be enforced completely
before toolkit work begins. The toolkit repositories therefore require no code
changes or releases.

## Execution flow

```text
WebMCP execute(input, { signal })
    -> WebMcpAdapter handler(input, { signal })
    -> WebMcpToolRegistry handler(input, { signal })
    -> app LoadedDesignNetlistService method(input, { signal })
       -> validate genuine AbortSignal
       -> throw abort reason when already aborted
       -> otherwise perform app inspection or dispatch toolkit query
```

The registry and app dispatcher continue passing the execution-options object
as a separate optional argument. Existing toolkit methods ignore extra
arguments under JavaScript compatibility rules; correctness does not depend on
that behavior because the app guard runs before service construction and query
dispatch.

## Signal validation

`WebMcpExecution` captures the platform `AbortSignal.prototype.aborted` and
`reason` getters. Applying the native getter brands the value without invoking
caller-controlled lookalike properties.

- Omitted or null signals are accepted.
- Genuine non-aborted signals continue normally.
- Genuine pre-aborted signals throw their exact reason, or an `AbortError`
  fallback when no reason is available.
- Lookalike objects throw `TypeError`.

All loaded-design entry methods invoke the guard synchronously before reading
the app snapshot. Synchronous JavaScript cannot be interrupted mid-loop without
yielding, so the contract intentionally guarantees entry-boundary cancellation
only.

## Compatibility

- Tool JSON schemas do not include `signal`.
- Object-form callbacks accept the browser's second options argument.
- Legacy positional callbacks still work and receive an empty execution context
  unless a compatible runtime supplies one.
- Analytics records the same privacy-safe method name, API form, and status;
  cancellation details and user input remain excluded.
- No toolkit dependency version changes are required.

## Verification

Regression coverage proves:

- the adapter preserves signal identity without mixing it into JSON input;
- the registry forwards execution context;
- app-owned design and PCB inspection reject pre-aborted calls;
- toolkit-backed dispatch receives the separate context after the app guard;
- invalid lookalikes are rejected;
- omitted execution options retain existing behavior.

Release verification uses the full ECAD Forge test suite, formatting check,
structured-data consistency check, static deployment build, GitHub Actions
deployment result, and production version/health checks.

## Release scope

Only ECAD Forge receives a code release. Altium Toolkit and KiCad Toolkit remain
unchanged because their frozen public query contracts do not need modification
for browser cancellation to be enforced before dispatch.
