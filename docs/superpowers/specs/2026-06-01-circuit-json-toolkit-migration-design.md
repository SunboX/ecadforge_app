<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Circuit JSON Toolkit Migration Design

## Goal

Change `altium-toolkit` and `kicad-toolkit` so their parser APIs use Circuit
JSON as the public and internal model for parsed documents. This is a breaking
change: `AltiumParser.parseArrayBuffer()` and `KicadParser.parseArrayBuffer()`
must return a Circuit JSON element array instead of the current ECAD Forge
normalized document object.

Both toolkits should expose the same API shape, behavior, naming style, and
documentation structure. ECAD Forge should adapt only where needed to keep its
viewer features working.

## Scope

- Add Circuit JSON conversion for parsed Altium schematic, PCB, PCB library,
  and project documents where supported by existing parser data.
- Add Circuit JSON conversion for parsed KiCad schematic, PCB, and project
  loads where supported by existing parser data.
- Preserve existing renderer behavior by adding explicit compatibility helpers
  that convert Circuit JSON back into the current renderer model when needed.
- Update workers, examples, docs, and tests for the breaking parser return
  value.
- Increase both toolkit package versions for the breaking change.
- Update ECAD Forge parser and rendering boundaries to work with the new parser
  API.

Out of scope for the first migration:

- Perfect bidirectional native-file generation.
- Replacing existing SVG or 3D renderers with Circuit JSON-native renderers.
- Adding network-backed dependencies or upload behavior.
- Special-casing fixture names, project identifiers, or source-derived strings.

## External Format Contract

Circuit JSON is represented as a JSON array of typed circuit elements. Elements
use prefixes such as `source_`, `schematic_`, and `pcb_`, and relationships are
linked with stable `*_id` fields. Numeric length values are emitted in
millimeters unless a string unit is explicitly required by the upstream schema.

Each toolkit should preserve native metadata that has no direct Circuit JSON
equivalent under additive metadata fields instead of dropping it. Metadata
fields must remain generic and source-safe.

## Public API

Both packages expose matching parser API:

```js
import { AltiumParser } from 'altium-toolkit/parser'
import { KicadParser } from 'kicad-toolkit/parser'

const circuitJson = AltiumParser.parseArrayBuffer(fileName, arrayBuffer)
const circuitJson2 = KicadParser.parseArrayBuffer(fileName, arrayBuffer)
```

Both parser classes also expose matching compatibility methods:

```js
const rendererModel = AltiumParser.parseArrayBufferToRendererModel(
    fileName,
    arrayBuffer
)

const rendererModel2 = KicadParser.parseArrayBufferToRendererModel(
    fileName,
    arrayBuffer
)
```

Both packages expose matching Circuit JSON helpers:

```js
import {
    CircuitJsonModelSchema,
    CircuitJsonModelAdapter
} from 'altium-toolkit/parser'

const circuitJson = CircuitJsonModelAdapter.fromRendererModel(rendererModel)
const rendererModel = CircuitJsonModelAdapter.toRendererModel(circuitJson)
```

`CircuitJsonModelSchema` provides stable constants for the API contract:

- `FORMAT_NAME`: `circuit-json`
- `CURRENT_SCHEMA_ID`: `https://github.com/tscircuit/circuit-json`
- `CURRENT_SCHEMA_VERSION`: package-pinned version or documented compatible
  upstream version

The KiCad toolkit exports the same names and methods from the same entrypoints.
The implementations can differ internally, but the API surface must match.

## Internal Architecture

The existing native parser pipelines remain responsible for decoding native
files because they already recover significantly more Altium and KiCad detail
than generic converters. The new flow is:

1. Native parser decodes the file into the current renderer model.
2. `CircuitJsonModelAdapter.fromRendererModel()` converts the renderer model
   into Circuit JSON.
3. `parseArrayBuffer()` returns only the Circuit JSON array.
4. Renderer-facing code calls `parseArrayBufferToRendererModel()` or
   `CircuitJsonModelAdapter.toRendererModel()` when it still needs the current
   renderer model.

This keeps the parser API clean while limiting renderer churn in the first
breaking release.

## Element Mapping

Common elements:

- One `source_project_metadata` element per parsed document or project where
  metadata exists.
- One `source_board` and `pcb_board` for PCB documents.
- One `source_component` per schematic component, PCB component, or footprint
  placement.
- One `source_port` per recoverable pin or pad.
- One `source_net` per recoverable net.
- One `source_trace` per recoverable net connection when ports or net names are
  known.

PCB elements:

- Components map to `pcb_component`.
- SMD pads map to `pcb_smtpad`.
- Through-hole pads map to `pcb_plated_hole`.
- Non-plated holes map to `pcb_hole`.
- Tracks and route segments map to `pcb_trace`.
- Vias map to `pcb_via` or route via points when grouped in a trace.
- Board outlines map to `pcb_board.outline`.
- Silkscreen, fabrication, courtyard, copper text, copper pours, and board
  graphics map to the closest Circuit JSON PCB element when supported.

Schematic elements:

- Symbols map to `schematic_component`.
- Pins map to `schematic_port`.
- Wires and recovered net paths map to `schematic_trace`.
- Labels, ports, power markers, graphical lines, rectangles, arcs, and text map
  to Circuit JSON schematic elements where supported.

Unsupported or loss-prone native data is preserved under metadata rather than
forcing invalid Circuit JSON elements.

## Toolkit-Specific Notes

### Altium Toolkit

`src/core/altium/AltiumParser.mjs` should keep the existing native parsing
implementation available through a private or compatibility path, then route
`parseArrayBuffer()` through the Circuit JSON adapter.

The Altium adapter must handle schematic, PCB, PCB library, and project parser
roots. PCB library and project roots may emit metadata-heavy Circuit JSON arrays
until richer upstream element mappings are available.

### KiCad Toolkit

`src/core/kicad/KicadParser.mjs` should keep `wrapBoard()` or equivalent
renderer-model construction for compatibility renderers, then route
`parseArrayBuffer()` through the Circuit JSON adapter.

`src/core/kicad/KicadProjectLoader.mjs` should return `documents` as Circuit
JSON arrays. If ECAD Forge or examples need renderer models, the loader should
also expose explicit compatibility fields or methods with matching names in both
toolkits where practical.

The KiCad adapter should borrow proven patterns from the ecosystem examples:
staged conversion, KiCad-to-Circuit-JSON coordinate transforms, layer mapping to
`top`, `bottom`, and `innerN`, and trace grouping by net or connectivity.

## ECAD Forge Integration

`EcadParserService` should treat toolkit parser output as Circuit JSON arrays.
It should store Circuit JSON as the parsed document payload and use adapter
helpers at renderer boundaries until ECAD Forge rendering becomes Circuit
JSON-native.

`EcadRendererService` and `EcadScene3dService` should not assume parser output
has top-level `schematic` or `pcb` fields. They should either receive renderer
models from the parser service or explicitly adapt Circuit JSON before calling
toolkit renderers.

`EcadFormatRegistry.sourceFormatForDocument()` should use Circuit JSON metadata
or parser-service wrapper metadata rather than defaulting missing
`sourceFormat` to Altium.

## Testing

Each toolkit should add focused tests for:

- `parseArrayBuffer()` returns an array of Circuit JSON elements.
- The array contains expected `source_`, `schematic_`, and `pcb_` elements for
  existing fake fixtures.
- IDs are stable and linked through `*_id` fields.
- Coordinates are converted to millimeters.
- `parseArrayBufferToRendererModel()` preserves existing renderer behavior.
- Public exports match across both packages.

ECAD Forge should update integration tests so parser-service output and renderer
service behavior stay observable through the app boundary.

All verification uses repo scripts:

- `npm test` in `altium-toolkit`
- `npm test` in `kicad-toolkit`
- `npm test` in `ecadforge_app`

## Versioning And Documentation

Both toolkit packages should use a breaking-version bump. Because both are
pre-1.0 today but this change intentionally breaks the main parser API, the
target version is `1.0.0` for both packages unless release policy requires a
different major line.

Documentation updates:

- Replace normalized-model parser examples with Circuit JSON examples.
- Add a compatibility section for renderer-model adapters.
- Update model-format docs to point at Circuit JSON as the parser contract.
- Keep legacy renderer-model documentation only for explicit compatibility
  helpers.

## Risks

- Circuit JSON may not represent every recovered Altium primitive yet. Preserve
  unmapped native detail in metadata and diagnostics.
- Existing renderers rely on the old document model. Keep adapter boundaries
  explicit and test them before changing renderer internals.
- Project and library files are not a perfect match for a flat Circuit JSON
  element array. Emit metadata and document the partial semantic mapping.
- Adding upstream packages may pull in TypeScript, Zod, or Bun-oriented
  dependency assumptions. Prefer local adapters and optional validation unless a
  dependency is proven compatible with the current Node ESM/browser package
  constraints.
