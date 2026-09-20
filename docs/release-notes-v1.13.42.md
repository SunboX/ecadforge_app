# ECAD Forge 1.13.42

Version 1.13.42 preserves the browser's native WebMCP API and restores
toolkit-backed queries for loaded Altium and KiCad document envelopes.

## WebMCP compatibility

- Keep a working native `document.modelContext` intact so Chrome can expose
  object schemas, accept optional object execution arguments, and deliver
  cancellation context without an older package wrapper.
- Mark all 28 read-only tools with `consequentialHint: false` alongside their
  read-only and untrusted-content annotations.
- Load the existing MCP-B runtime only when native registration is unavailable.
  MCP-B tab and iframe transports are therefore available only on the fallback
  path; native browsers use native WebMCP clients. The fallback retains its
  older string-based input contract.

## Loaded-design queries

- Update Altium Toolkit from 1.4.17 to 1.4.18 and KiCad Toolkit from 1.3.5 to
  1.3.6. Their loaded-design query services now resolve explicitly retained
  native models inside canonical envelopes. This restores design names, net
  queries, component pins, and traversal without app-side document conversion.
- Gerber Toolkit 0.4.4, CircuitJSON Toolkit 1.4.3, and PCB Scene3D Viewer 1.3.4
  remain unchanged. No development branches required merging.

## Validation

- App tests: 1,011 passed.
- KiCad Toolkit: 482 passed. Altium Toolkit: 953 passed, one existing skip.
- Formatting, structured-data freshness, and static deployment build passed.
- Chrome for Testing 156.0.8066.0 verified native context identity, all 28
  descriptors, object and omitted execution arguments, invalid-input rejection,
  cancellation, and loaded-project design/net/component queries.
- With native WebMCP disabled, the packaged fallback still registers and
  executes its 28 tools using its legacy string argument format.
