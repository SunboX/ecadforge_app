# WebMCP

ECAD Forge loads the `@mcp-b/global` WebMCP runtime and registers read-only
WebMCP tools through `document.modelContext`. The runtime preserves native
browser WebMCP when available and provides the package runtime when native
support is unavailable. The tools query only designs that are already loaded in
the current browser session.

The production app shell includes the Chrome WebMCP origin-trial token for
`https://ecadforge.app/`. The local Express server and generated Apache deploy
artifact set `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`
so same-origin documents can register tools while cross-origin iframes remain
blocked unless a trusted host explicitly delegates `allow="tools"`.
The package runtime is configured before import with same-origin tab and iframe
transport allowlists, avoiding the package default wildcard origin policy.

## Privacy Model

WebMCP tools use derived session metadata from `AppState`. They do not upload
files, read local paths, scan folders, fetch remote resources, expose browser
file handles, or return raw file contents.

Design selectors refer only to loaded documents. A selector can be omitted,
`active`, a loaded document id, an exact loaded file name, or an unambiguous
loaded file base name.

ECAD Forge owns runtime configuration, tool registration, session snapshot
lookup, source-format dispatch, bounded response shaping, loaded-session
review, design audit, BOM lookup, component metadata search, focused net and
diagnostic inspection, pin summaries, BOM-to-PCB comparison, and
schematic-to-PCB cross-reference summaries. It also owns compact PCB placement,
PCB net, design-rule, board summary, and fabrication-readiness inspection.
Netlist extraction, regex validation, component grouping, and connectivity
traversal are delegated to the Altium and KiCad toolkit query APIs for the
selected loaded document.

Registered tool descriptors use the current object-form WebMCP API with an
`execute` function. They include `readOnlyHint: true` and
`untrustedContentHint: true` annotations because the tools do not mutate app
state and may summarize user-loaded ECAD data. Runtime loading completes before
tool registration, and registration awaits browser/package promises so failures
from cross-document tool publication are counted before startup continues.
Older positional browser APIs remain supported when exposed through
`document.modelContext` and receive MCP-style JSON text content.

Current object-form `execute(input, { signal })` callbacks keep the browser
execution options separate from JSON tool input and forward the genuine
`AbortSignal` through the registry and loaded-design service. A signal that is
already aborted stops both app-owned inspection and toolkit-backed queries
before synchronous work starts. Existing callers without execution options and
legacy positional registrations retain their prior behavior. Synchronous
queries do not claim mid-loop interruption after execution has started.

## Analytics

When the production analytics tracker is available, ECAD Forge records
privacy-safe WebMCP usage events:

- `webmcp_available`: WebMCP runtime support was detected and registration completed.
- `webmcp_tool_registration_failed`: one tool registration failed.
- `webmcp_tool_called`: one registered tool handler was called.

Only coarse metadata is sent: `method_name`, `api_form`, and `result_status`.
Tool arguments, tool results, loaded design names, file names, local paths, net
names, component identifiers, and raw error details are not sent.

## Supported Tools

| Tool                            | Purpose                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `list_designs`                  | List loaded browser-session documents.                       |
| `list_components`               | List components by reference-designator prefix.              |
| `list_nets`                     | List net names for one loaded design.                        |
| `review_design`                 | Summarize loaded design coverage, metadata, and diagnostics. |
| `audit_design`                  | Report parser, metadata, and connectivity issues.            |
| `crossref_net`                  | Compare one schematic net against matching PCB pads.         |
| `compare_schematic_pcb`         | Compare all schematic nets against matching PCB pads.        |
| `summarize_design`              | Return an agent-friendly loaded-design summary.              |
| `find_components`               | Search common component metadata fields.                     |
| `query_bom_item`                | Find BOM rows by refdes, MPN, or text pattern.               |
| `list_pin_connections`          | List compact pin-to-net rows for one component.              |
| `query_net`                     | Return direct pin membership for one schematic net.          |
| `list_component_types`          | Count components by reference-designator prefix.             |
| `list_diagnostics`              | Return parser diagnostics directly.                          |
| `compare_bom_pcb`               | Compare BOM rows against PCB components.                     |
| `list_single_pin_nets`          | List schematic nets with exactly one connected pin.          |
| `query_pcb_component`           | Return PCB placement, pads, and model metadata.              |
| `query_pcb_net`                 | Return physical PCB membership for one net.                  |
| `summarize_pcb`                 | Summarize board, placement, routing, and stackup data.       |
| `list_design_rules`             | List compact normalized PCB design rules.                    |
| `review_fabrication_readiness`  | Review PCB fabrication-readiness signals.                    |
| `search_nets`                   | Search loaded net names with a case-insensitive regex.       |
| `search_components_by_refdes`   | Search components by reference designator.                   |
| `search_components_by_mpn`      | Search components by part number metadata.                   |
| `search_component_descriptions` | Search components by description metadata.                   |
| `query_component`               | Return one component with known pin connections.             |
| `query_xnet_by_net_name`        | Trace connectivity starting from a net.                      |
| `query_xnet_by_pin_name`        | Trace connectivity starting from `REFDES.PIN`.               |

Search tools reject patterns that match every candidate so an agent does not
accidentally dump a large loaded design through a broad wildcard query.

`list_components` and `list_nets` accept optional `limit` and `offset`
arguments. `list_components` also accepts `compact: true`, which returns only
the component fields agents usually need for planning (`refdes`, `mpn`,
`value`, `count`, and `dns` when present) plus pagination metadata.

## Examples

List loaded documents:

```json
{
    "tool": "list_designs",
    "arguments": {}
}
```

List resistor groups in the active design:

```json
{
    "tool": "list_components",
    "arguments": {
        "type": "R"
    }
}
```

List a compact page of resistor groups:

```json
{
    "tool": "list_components",
    "arguments": {
        "type": "R",
        "compact": true,
        "limit": 10,
        "offset": 0
    }
}
```

Review loaded design coverage:

```json
{
    "tool": "review_design",
    "arguments": {}
}
```

Audit parser, metadata, and connectivity issues:

```json
{
    "tool": "audit_design",
    "arguments": {
        "max_issues": 25
    }
}
```

Compare a schematic net against PCB pads:

```json
{
    "tool": "crossref_net",
    "arguments": {
        "net_name": "I2C_SDA"
    }
}
```

Compare all schematic nets against PCB pads:

```json
{
    "tool": "compare_schematic_pcb",
    "arguments": {}
}
```

Summarize the loaded session:

```json
{
    "tool": "summarize_design",
    "arguments": {}
}
```

Find components across common metadata:

```json
{
    "tool": "find_components",
    "arguments": {
        "query": "0402",
        "limit": 10
    }
}
```

Find a BOM item:

```json
{
    "tool": "query_bom_item",
    "arguments": {
        "refdes": "R1"
    }
}
```

List component pin connections:

```json
{
    "tool": "list_pin_connections",
    "arguments": {
        "refdes": "U1"
    }
}
```

Query direct net membership:

```json
{
    "tool": "query_net",
    "arguments": {
        "net_name": "PP3V3"
    }
}
```

List component type counts:

```json
{
    "tool": "list_component_types",
    "arguments": {}
}
```

List parser diagnostics:

```json
{
    "tool": "list_diagnostics",
    "arguments": {}
}
```

Compare BOM rows against PCB components:

```json
{
    "tool": "compare_bom_pcb",
    "arguments": {}
}
```

List single-pin nets:

```json
{
    "tool": "list_single_pin_nets",
    "arguments": {}
}
```

Query a PCB component placement:

```json
{
    "tool": "query_pcb_component",
    "arguments": {
        "refdes": "U1"
    }
}
```

Query physical PCB membership for a net:

```json
{
    "tool": "query_pcb_net",
    "arguments": {
        "net_name": "PP3V3"
    }
}
```

Summarize the loaded PCB:

```json
{
    "tool": "summarize_pcb",
    "arguments": {}
}
```

List parsed PCB design rules:

```json
{
    "tool": "list_design_rules",
    "arguments": {}
}
```

Review fabrication readiness:

```json
{
    "tool": "review_fabrication_readiness",
    "arguments": {}
}
```

Search for I2C nets:

```json
{
    "tool": "search_nets",
    "arguments": {
        "pattern": "i2c"
    }
}
```

Query one component:

```json
{
    "tool": "query_component",
    "arguments": {
        "refdes": "U1"
    }
}
```

Trace from a component pin while skipping capacitors:

```json
{
    "tool": "query_xnet_by_pin_name",
    "arguments": {
        "pin_name": "U1.5",
        "skip_types": ["C"]
    }
}
```

## Connectivity Behavior

Extended-net tools traverse through two-pin series components with prefixes
`R`, `RS`, `FR`, `C`, `L`, and `FB`. Traversal stops at recognized power and
ground rails. DNS/DNP components are excluded by default and can be included
with `include_dns: true`.

PCB-only documents may not contain schematic connectivity. In that case,
connectivity tools return an error explaining that no schematic connectivity is
available for the loaded design.

`audit_design` reports parser diagnostics, duplicate reference designators,
missing metadata (`mpn`, description, value, footprint), schematic documents
without nets, and single-pin nets. `crossref_net` and
`compare_schematic_pcb` pair the selected schematic with a same-base-name PCB
when possible, fall back to another loaded PCB, and return matched pins or
missing schematic/PCB nodes. `query_bom_item`, `find_components`, and
`list_pin_connections` use normalized metadata and schematic connectivity only;
they do not expose raw native file records. `query_net` reports direct net
membership without traversal, while `compare_bom_pcb` compares normalized BOM
designators and footprint-like metadata against PCB component placements.
PCB-focused tools select a PCB document directly when `design` targets one. If
the active document is a schematic, they try a same-base-name loaded PCB before
falling back to another loaded PCB. `query_pcb_component`, `query_pcb_net`,
`summarize_pcb`, `list_design_rules`, and `review_fabrication_readiness` expose
compact normalized PCB facts only; they do not expose raw native rule streams,
primitive records, or source file contents.

## Unsupported In Browser WebMCP

The browser implementation intentionally does not:

- scan local directories from a tool call
- open arbitrary local filesystem paths
- run desktop EDA binaries
- export external CAD netlists
- mutate the loaded ECAD session

Use the normal ECAD Forge file picker, folder picker, drag-and-drop area, demo
buttons, or Git URL intake to load a design before calling WebMCP tools.
