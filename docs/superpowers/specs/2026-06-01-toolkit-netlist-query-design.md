<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Toolkit Netlist Query Design

## Goal

Move the reusable loaded-design query logic out of ECAD Forge and into the
Altium and KiCad toolkit packages. ECAD Forge should keep the browser-session
and native WebMCP registration boundary, while each toolkit owns the netlist
query behavior for documents it parses.

The result should keep the WebMCP feature native API first, avoid bundled
third-party widgets, and make the toolkit libraries independently useful for
component search, net search, and circuit traversal.

## Scope

- Add a matching netlist-query API to `altium-toolkit` and `kicad-toolkit`.
- Move reusable query utilities into both toolkit packages:
  - regex parsing and broad-match rejection
  - component grouping by MPN
  - DNS/DNP filtering
  - natural reference-designator sorting
  - stop-net classification
  - two-pin passive traversal
  - stable circuit hash generation
  - document-model-to-query-netlist extraction
  - component, net, and pin query response shaping
- Keep ECAD Forge responsible for loaded-session document selection and native
  WebMCP tool registration.
- Update docs, package exports, package versions, and tests in all affected
  repositories.

Out of scope:

- Native-file writeback.
- Circuit JSON-native renderer replacement.
- Network-backed query services.
- Bundling a WebMCP widget or polyfill.
- Special-casing fixture names, customer identifiers, or source-derived labels.

## Public Toolkit API

Both toolkit packages should expose a matching subpath:

```js
import {
    LoadedDesignNetlistService,
    QueryNetlistBuilder,
    CircuitTraversal,
    ComponentGrouping,
    RegexPattern
} from 'altium-toolkit/netlist-query'
```

The KiCad package exposes the same names from `kicad-toolkit/netlist-query`.

`LoadedDesignNetlistService` accepts a document provider rather than browser
state:

```js
const service = new LoadedDesignNetlistService({
    getDocuments: () => [
        {
            id: 'doc-1',
            documentModel,
            active: true
        }
    ]
})

const nets = service.listNets({ design: 'active' })
```

The service API should match the current ECAD Forge WebMCP tool behavior:

- `listDesigns({ pattern, max_results })`
- `listComponents({ design, type, include_dns })`
- `listNets({ design })`
- `searchNets({ design, pattern })`
- `searchComponentsByRefdes({ design, pattern, include_dns })`
- `searchComponentsByMpn({ design, pattern, include_dns })`
- `searchComponentsByDescription({ design, pattern, include_dns })`
- `queryComponent({ design, refdes })`
- `queryXnetByNetName({ design, net_name, skip_types, include_dns })`
- `queryXnetByPinName({ design, pin_name, skip_types, include_dns })`

Responses should remain plain JSON-compatible objects with structured `error`
messages when a query cannot be answered.

## Internal Architecture

Each toolkit gets a `src/netlist-query.mjs` public entrypoint and focused
implementation modules under `src/core/netlist-query/`.

The toolkit-owned query engine has three layers:

1. `QueryNetlistBuilder` converts one toolkit document model into the compact
   query netlist shape:

   ```js
   {
       nets: {
           I2C_SDA: {
               U1: '5',
               R1: '2'
           }
       },
       components: {
           U1: {
               mpn: 'MCU-FAKE-48',
               description: 'IC MCU fake',
               value: 'controller',
               pins: {
                   5: { name: 'SDA', net: 'I2C_SDA' }
               }
           }
       }
   }
   ```

2. Query helpers operate only on the compact netlist shape. These modules
   should not depend on DOM APIs, browser globals, app state, or package-local
   parser internals beyond the normalized document model.

3. `LoadedDesignNetlistService` provides the user-facing query methods and
   design selector behavior.

ECAD Forge keeps:

- `WebMcpAdapter`
- `WebMcpToolRegistry`
- session snapshot reading
- native `navigator.modelContext.registerTool()` handling
- MCP text-content formatting

ECAD Forge removes or shrinks local copies of reusable query logic. Its local
adapter should choose the toolkit query service by loaded document
`sourceFormat`, falling back to a clear unsupported-document error when the
format is not handled.

## Altium Toolkit Behavior

The Altium query builder should support current renderer-compatibility document
models from parsed schematic and PCB documents:

- Schematic components provide designators, values, descriptions, owner indexes,
  and pins.
- Schematic nets provide net names and pin references.
- PCB components and BOM rows enrich component metadata when present.
- PCB-only documents should list designs and components, but net traversal
  methods should return a clear no-connectivity error unless schematic
  connectivity exists.

The implementation must stay generic. It should derive connectivity from the
normalized model shape, not from fixture file names or source-specific strings.

## KiCad Toolkit Behavior

The KiCad query builder should expose the same API and response shape for KiCad
schematic, PCB, and project summary document models:

- Schematic components and nets drive connectivity.
- BOM rows and PCB components enrich component metadata when present.
- Project-loaded documents are queried one loaded document at a time; ECAD Forge
  remains responsible for selecting which loaded document is active.
- PCB-only documents should behave like Altium PCB-only documents: design and
  component metadata can be listed, but schematic connectivity queries return a
  no-connectivity error.

The KiCad implementation should reuse the same query module shape and test
coverage as the Altium implementation so consumers can switch packages without
changing query code.

## ECAD Forge Integration

`src/core/webmcp` should become a thin host adapter:

- `WebMcpAdapter` keeps native browser API detection and registration.
- `WebMcpToolRegistry` keeps tool names, schemas, and MCP descriptions.
- A small app-local service maps `AppState.getSnapshot()` to toolkit
  `LoadedDesignNetlistService` inputs.
- The app-local service selects `altium-toolkit/netlist-query` or
  `kicad-toolkit/netlist-query` using the loaded document format.

The app should not duplicate traversal, grouping, regex, or netlist-building
logic after the migration.

## Error Handling

Errors should remain explicit and query-oriented:

- no loaded design
- ambiguous design selector
- unmatched design selector
- invalid regex
- broad regex that matches every candidate
- missing component
- missing pin
- missing net
- unsupported source format
- no schematic connectivity
- blocked power or ground traversal start

Errors are returned as `{ error: string }`; they are not thrown for normal user
query failures.

## Documentation

Toolkit docs should add a `Netlist Query` section to `docs/api.md` and mention
the new `./netlist-query` subpath in package entrypoints.

ECAD Forge docs should describe the split:

- toolkit libraries own document-query semantics
- ECAD Forge owns loaded-session selection and WebMCP registration
- no third-party WebMCP widget is bundled

The root README and architecture/spec docs should be updated only where needed
to keep the feature discoverable.

## Testing

Each toolkit should add focused tests for:

- public `./netlist-query` exports
- design listing and selector aliases
- net listing and regex search
- component search by reference designator, MPN, and description
- MPN grouping and missing-MPN notes
- DNS filtering
- pin and net traversal
- stop-net blocking
- PCB-only no-connectivity behavior

ECAD Forge should update existing WebMCP tests so they prove:

- tools still register through the native adapter
- tool handlers call toolkit-backed services
- loaded app documents are converted into toolkit service inputs
- Altium and KiCad documents dispatch to their matching toolkit services

Verification commands:

```bash
npm test
```

Run that command in each changed repository:

- `/Users/afiedler/Documents/privat/Andrés_Werkstatt/altium-toolkit`
- `/Users/afiedler/Documents/privat/Andrés_Werkstatt/kicad-toolkit`
- `/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app`

## Versioning

Both toolkit package versions should be incremented because they gain a new
public subpath export. ECAD Forge should also increment its package version
because the WebMCP implementation boundary changes.

## Risks

- The two toolkit implementations may drift. Keep file names, exported class
  names, method names, and tests intentionally parallel.
- Some document models may have partial metadata. Query responses should omit
  unknown fields rather than inventing values.
- Circuit traversal should remain conservative. Only recognized two-pin
  passives should extend traversal; power and ground rails should stop it.
- Browser consumers rely on package `exports`. Add the new subpath explicitly
  and test it through package imports.
