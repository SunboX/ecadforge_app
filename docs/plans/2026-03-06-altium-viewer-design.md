# ECAD Forge Design

**Date:** 2026-03-06

## Goal

Build a browser-based Altium viewer that can open native standalone `.SchDoc` and `.PcbDoc` files client-side, prioritize visual fidelity, and establish a foundation for schematic, PCB, 3D, and BOM views similar in spirit to Altium's hosted viewer.

## Scope

### In Scope

- Pure browser-side JavaScript runtime
- Standalone `.SchDoc` and `.PcbDoc` inputs
- Client-only parsing with no server-side preprocessing
- Visual fidelity ahead of advanced interactions
- Browser views for schematic, PCB, 3D, BOM, and parser diagnostics

### Out of Scope For Initial Delivery

- Full `.PrjPcb` project resolution
- Full Altium feature parity
- Full cross-probing, comments, or collaboration features
- Guaranteed support for every Altium record family

## Reference Surface

The target browser UX is based on Altium's public viewer surface: schematic, PCB, 3D, BOM, upload/open in browser, and interactive inspection workflows. The implementation here focuses first on opening native files and rendering a usable browser representation.

## Architecture

The application uses a layered decoder with a normalized intermediate model:

1. **File intake**
    - Accept dropped or selected `.SchDoc` and `.PcbDoc` files
    - Read file bytes in the browser
    - Prefer worker-based parsing for CPU-heavy decode steps

2. **Binary decode**
    - Parse OLE Compound File containers in pure JavaScript
    - Decode format-specific Altium record streams with a registry-driven parser
    - Keep each record family isolated in its own module

3. **Normalized document model**
    - Shared metadata, units, colors, parameters, and diagnostics
    - Schematic entities: sheets, symbols, pins, wires, labels, buses, graphics
    - PCB entities: board outline, layers, pads, vias, tracks, arcs, polygons, text, components
    - Stable component identities for BOM and future linking features

4. **View derivation**
    - Schematic renderer reads only the normalized model
    - PCB renderer reads only the normalized model
    - 3D renderer derives board and component geometry from normalized PCB entities
    - BOM panel derives rows from component instances and parameters

## Data Flow

1. User drops a native file into the browser
2. File buffer is handed to the parser pipeline
3. OLE container parsing discovers streams and storage structure
4. Altium stream decoders produce typed entities and diagnostics
5. A normalized document model is built even if some records remain unsupported
6. Renderers display the best-available representation
7. Diagnostics expose unsupported records and decode warnings for iterative improvement

## Error Handling

- If OLE parsing fails, the app marks the file unreadable
- If a record family is unknown, parsing continues where possible
- Unsupported content is recorded as diagnostics, not silently dropped
- The UI always distinguishes between:
    - unreadable file
    - partially decoded file
    - successfully decoded file with warnings

## Testing Strategy

- Unit tests for binary readers and OLE container parsing
- Fixture-driven decode tests against representative local sample files
- Normalized-model tests for recovered entities and metadata
- UI smoke tests for app boot, file loading, and view switching
- Visual tests for basic rendering consistency where feasible

## Delivery Strategy

The first implementation should establish:

- web app scaffold and local runtime
- client-side file upload UX
- binary/OLE parsing foundation
- normalized viewer state model
- parser diagnostics panel
- initial schematic and PCB summary render paths
- placeholders for 3D and BOM powered by normalized model extraction

After the foundation is stable, the parser can expand record coverage iteratively using real sample files without rewriting the renderer stack.
