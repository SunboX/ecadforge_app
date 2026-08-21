# ECAD Forge 1.13.23

Version 1.13.23 propagates the current browser WebMCP cancellation context from
object-form tool execution into app-owned and toolkit-backed loaded-design
queries.

## WebMCP cancellation

- `execute(input, { signal })` keeps the browser callback options separate from
  tool JSON input.
- The adapter, registry, and app loaded-design service preserve the same
  genuine `AbortSignal` instance to the pre-dispatch execution boundary.
- Pre-aborted calls throw their abort reason before synchronous query or
  inspection work starts.
- Invalid signal lookalikes are rejected at execution boundaries.
- Legacy positional APIs, calls without execution options, tool schemas, and
  result shapes remain compatible.

The cancellation guarantee applies at synchronous entry boundaries; it does
not claim interruption in the middle of an already-running synchronous loop.

## Library scope

- No library release is required. ECAD Forge owns and validates the browser
  execution boundary before it constructs or calls an Altium/KiCad query
  service.
- Altium Toolkit and KiCad Toolkit retain their frozen public query contracts;
  all other ECAD Forge libraries are also unchanged.

## Verification

- Focused regressions cover browser callback forwarding, registry forwarding,
  app-owned inspection cancellation, toolkit dispatch, genuine signal branding,
  and compatibility without execution options.
- Release gates include the complete app suite, structured-data consistency,
  and the static deployment build.
