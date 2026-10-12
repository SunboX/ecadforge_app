# Local WebMCP comparison export

Agents can compare loaded schematic and PCB connectivity and save a versioned
machine-readable result using `export_schematic_pcb_comparison`.

Acceptance criteria:

- The tool queries loaded session data only and advertises read-only behavior.
- Explicit schematic and PCB selectors resolve the same pair on native and
  MCP-B provider paths. Existing automatic pairing remains available.
- The artifact contains JSON content, a suggested filename, a MIME type, schema
  version 1, selected document identities, logical component identities, and all
  comparison discrepancies. IDs are stable within the loaded session and are not
  claimed to persist across reloading documents.
- Unknown, ambiguous, unloaded, and incomplete selections return readable errors
  with stable codes. Selecting a schematic as the PCB cannot produce a report.
- MCP-B represents application errors with `isError: true` and preserves their
  structured payload. Native callbacks preserve their direct object results.
- Genuine cancellation is forwarded separately from JSON inputs. A pre-aborted
  native export performs no session read; MCP cancellation reaches an active
  provider callback. Synchronous computation does not promise mid-loop aborts.
- Export performs no feedback submission, network analytics, automatic download,
  or filesystem mutation. The caller saves the returned content locally.
- Tests use repository-owned fake data and the actual MCP-B server transport,
  without remote services or customer fixtures. Browser/runtime installation
  checks are reported separately from provider contract tests.
