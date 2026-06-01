# WebMCP

ECAD Forge registers read-only WebMCP tools when the browser exposes a native
`navigator.modelContext` API. The tools query only designs that are already
loaded in the current browser session.

If the browser does not provide native WebMCP support, ECAD Forge silently
continues as a normal viewer. No third-party widget or bridge is bundled.

## Privacy Model

WebMCP tools use derived session metadata from `AppState`. They do not upload
files, read local paths, scan folders, fetch remote resources, expose browser
file handles, or return raw file contents.

Design selectors refer only to loaded documents. A selector can be omitted,
`active`, a loaded document id, an exact loaded file name, or an unambiguous
loaded file base name.

## Supported Tools

| Tool                               | Purpose                                                |
| ---------------------------------- | ------------------------------------------------------ |
| `list_designs`                     | List loaded browser-session documents.                 |
| `list_components`                  | List components by reference-designator prefix.        |
| `list_nets`                        | List net names for one loaded design.                  |
| `search_nets`                      | Search loaded net names with a case-insensitive regex. |
| `search_components_by_refdes`      | Search components by reference designator.             |
| `search_components_by_mpn`         | Search components by part number metadata.             |
| `search_components_by_description` | Search components by description metadata.             |
| `query_component`                  | Return one component with known pin connections.       |
| `query_xnet_by_net_name`           | Trace connectivity starting from a net.                |
| `query_xnet_by_pin_name`           | Trace connectivity starting from `REFDES.PIN`.         |

Search tools reject patterns that match every candidate so an agent does not
accidentally dump a large loaded design through a broad wildcard query.

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

## Unsupported In Browser WebMCP

The browser implementation intentionally does not:

- scan local directories from a tool call
- open arbitrary local filesystem paths
- run desktop EDA binaries
- export external CAD netlists
- mutate the loaded ECAD session

Use the normal ECAD Forge file picker, folder picker, drag-and-drop area, demo
buttons, or GitHub URL intake to load a design before calling WebMCP tools.
