# ECAD Forge 1.13.47

Agents can export schematic/PCB comparisons as local JSON artifacts with stable
loaded-session design and component identifiers. The export tool returns a
suggested filename, MIME type and JSON content, without feedback submission or
automatic invocation analytics.

MCP-B is updated from 4.0.0 to 6.0.0 so genuine request cancellation reaches
provider callbacks. Fallback responses preserve application failures through
`isError` and `structuredContent`; native callbacks retain direct object results.
Unknown, ambiguous, unloaded and incomplete design selections have stable error
codes. An explicitly selected PCB must contain PCB pad data.

The release is based on production 1.13.46. Toolkit versions and the production
deployment workflow are unchanged. Subscription, authentication, account and
private plugin candidates are excluded.

Validation covers the full app suite on Node 20, native provider/MCP-B transport
parity, cancellation, export identifiers and absence of export analytics or
feedback calls, plus structured-data freshness and the static deployment build.
The fallback runtime is also exercised in Chromium. This does not claim a live
native Chrome compatibility check or interruptible synchronous comparison loops.
