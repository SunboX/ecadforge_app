# Loaded-Session WebMCP Design

## Goal

Expose the currently loaded ECAD session to browser-native WebMCP tools so an
agent can query designs, components, nets, and circuit connectivity without
leaving the browser privacy boundary. The implementation must be local-first,
read-only, and based only on designs already loaded into `AppState`.

## Scope

The first implementation registers native browser WebMCP tools when the browser
provides a compatible `navigator.modelContext` API. If that API is unavailable,
the adapter no-ops and the viewer keeps working normally.

Supported tools:

- `list_designs`
- `list_components`
- `list_nets`
- `search_nets`
- `search_components_by_refdes`
- `search_components_by_mpn`
- `search_components_by_description`
- `query_component`
- `query_xnet_by_net_name`
- `query_xnet_by_pin_name`

Out of scope for this pass:

- scanning local directories from WebMCP tools
- loading arbitrary local paths from tool input
- exporting external CAD netlists
- running native desktop EDA utilities
- adding a third-party WebMCP widget or bridge dependency
- exposing raw uploaded file contents

## Architecture

Add an app-owned WebMCP layer under `src/core/webmcp/`.

`WebMcpAdapter.mjs` detects native browser support, registers tools at startup,
and formats tool responses in MCP-style text content. It depends on a read-only
snapshot provider rather than the controller internals.

`WebMcpToolRegistry.mjs` owns tool descriptors, input schemas, argument
normalization, and tool dispatch. This keeps browser API specifics out of the
domain services and makes registration testable with a fake model context.

`LoadedDesignNetlistService.mjs` resolves the `design` argument against loaded
session documents and converts normalized schematic/BOM data into a compact
query model. It never reads files by path. `design` may be omitted or set to
`active`, a loaded document id, an exact loaded file name, or an unambiguous
loaded file base name.

`CircuitTraversal.mjs`, `ComponentGrouping.mjs`, and `RegexPattern.mjs` contain
pure helpers for net classification, DNS filtering, natural sorting, component
grouping, regex validation, two-pin passive traversal, and stable circuit
hashing.

`main.mjs` wires the adapter after `AppController` is created:

1. create `AppState`
2. create `AppController`
3. create `WebMcpAdapter` with `state.getSnapshot()`
4. initialize controller and adapter during bootstrap

## Data Model

The WebMCP query model is derived from loaded document models:

```text
LoadedNetlist
  designs: LoadedDesign[]
  nets: { [netName]: { [refdes]: pin | pin[] } }
  components: { [refdes]: ComponentDetails }
```

Component details include optional `mpn`, `description`, `comment`, `value`,
`dns`, and a `pins` map where each pin is either a net string or an object with
`name` and `net`.

For schematic documents, the service uses normalized schematic connectivity when
available and enriches component metadata from BOM rows and schematic component
records. For PCB-only documents without schematic connectivity, tools that need
nets return a clear error. Component search can still operate when component or
BOM metadata is available.

## Tool Behavior

`list_designs` returns loaded document metadata only. It accepts optional
`pattern` and `max_results`, and ignores filesystem-oriented path scanning.

`list_components` filters by reference-designator prefix, groups populated
components by MPN when available, and lists no-MPN components individually with
a note.

`list_nets` returns sorted net names for the resolved loaded design.

`search_nets` and component search tools use case-insensitive regex matching.
They reject patterns that match every candidate, such as broad wildcard
patterns, and return notes for empty matches.

`query_component` returns one component with all known pin-to-net mappings and
metadata. Reference designator lookup is case-insensitive.

`query_xnet_by_net_name` starts from a named net and traverses through two-pin
series components with prefixes `R`, `RS`, `FR`, `C`, `L`, and `FB`.

`query_xnet_by_pin_name` starts from `REFDES.PIN`, resolves the connected net,
and then performs the same traversal.

Traversal stops at ground and power rails, supports `skip_types`, excludes DNS
components unless `include_dns` is true, returns visited nets, aggregates
components by MPN/description and orientation, and includes a stable topology
hash.

## Error Handling

Tool errors are returned as structured JSON objects with an `error` field rather
than thrown through the browser integration. Expected errors include:

- WebMCP called before a design is loaded
- requested design cannot be resolved
- design name is ambiguous
- design has no schematic connectivity
- regex pattern is invalid or too broad
- component, net, or pin is not found
- traversal starts on a blocked ground or power rail

## Privacy And Security

The tools expose derived session metadata only. They must not include raw file
contents, absolute local paths, browser file handles, GitHub raw URLs, or local
directory listings. Tool results use loaded document ids and display file names
already visible in the UI.

No WebMCP tool mutates app state, changes active views, uploads files, fetches
remote resources, or executes external commands.

## Documentation

Add a WebMCP section to `README.md` and a dedicated `docs/webmcp.md` page
covering:

- native browser support requirement
- loaded-session-only behavior
- supported tools and arguments
- privacy model
- unsupported browser-only operations
- example calls and result shapes

Update `docs/architecture.md` with the adapter and query-service flow, and
update `spec/web-app-specification.md` with the new functional requirement and
acceptance criteria.

## Tests

Add focused tests before implementation:

- tool adapter no-ops when native browser support is unavailable
- adapter registers all supported tools with a fake model context
- design resolution handles active, id, exact file name, base name, ambiguous
  names, and no loaded designs
- component grouping compacts single refdes values and preserves missing-MPN
  notes
- DNS filtering applies to MPN, value, description, and comment fields
- regex searches are case-insensitive and reject too-broad matches
- net traversal follows two-pin passives, honors skip types, blocks ground and
  power start nets, and produces stable hashes
- PCB-only documents return connectivity errors without crashing

Run `npm test` after each implementation slice and before final delivery.

## Versioning

Increment `package.json` with the implementation change, keeping the lockfile in
sync.
