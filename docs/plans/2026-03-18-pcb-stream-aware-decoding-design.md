# PCB Stream-Aware Decoding Design

## Goal

Recover higher-fidelity PCB primitives from native `.PcbDoc` files by parsing compound-document streams before printable-record extraction, then render those primitives with PCB-specific CSS variables similar to the existing schematic theming model.

## Problem

The current PCB pipeline treats the entire file as one printable byte soup. That works well enough for board outline, layer stack metadata, and component placements, but it is not sufficient for Altium-style board fidelity on compound-document PCB files.

For `GXDT_SN00_V11.PcbDoc`, the current app recovers:

- board outline geometry
- layer stack entries
- 240 component placements
- a limited set of polygon pours

It does not recover the pad, via, and track detail visible in the Altium reference image, so the renderer can only draw a board silhouette plus footprint placeholders.

## Evidence

- The supplied file is an OLE/Compound Document (`Composite Document File V2 Document`).
- The current parser reports `4031` printable PCB records, but almost all of them arrive without schematic-style `RECORD=` tags.
- [AltiumParser.mjs](/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/core/altium/AltiumParser.mjs) currently normalizes only `boardOutline`, `layers`, and `components` for PCB documents.
- Stream-like polygon records already expose layer, net, and geometry fields, which shows the renderer gap is partly upstream of rendering and partly in the current normalized model.

## Approaches Considered

### 1. Heuristic-Only Extension

Keep the current whole-file printable scan and add more PCB field-signature heuristics.

Pros:

- smallest code change
- low short-term risk

Cons:

- does not address the observed extraction boundary
- unlikely to expose hidden stream-scoped PCB primitives for this file
- risks growing more special cases around incomplete data

### 2. OLE Stream-Aware Printable Extraction

Parse the compound-document container first, then run the existing printable-field extraction on relevant PCB streams instead of on the full file blob.

Pros:

- targets the root-cause boundary directly
- preserves the current field-based parser architecture
- keeps future binary decoding optional instead of mandatory

Cons:

- requires a new low-level OLE reader
- adds one more decode stage before the existing parser

### 3. Full Binary PCB Primitive Decoder

Add compound-document parsing and then decode binary stream payloads straight into typed PCB primitives.

Pros:

- highest ceiling for fidelity
- best long-term path if printable records remain incomplete

Cons:

- largest scope increase
- too risky as the first move before proving whether stream-aware printable extraction already exposes the missing geometry

## Decision

Use approach `2`.

Add a small in-repo OLE reader, inventory PCB-relevant streams, and feed their content through the existing printable-record parser with stream provenance attached. Expand the normalized PCB model to carry recovered polygons, texts, tracks, pads, and vias when they are available. Keep the existing whole-file printable path as a fallback so current behavior does not regress on simpler fixtures.

If stream-aware printable extraction still does not surface enough primitives, the next iteration should be a targeted binary PCB decoder. That follow-up should build on the same OLE foundation rather than replacing it.

## Architecture

### Low-Level Container Layer

Add a pure-JavaScript compound-document reader under `src/core/ole/` plus a small binary helper in `src/core/`.

Responsibilities:

- validate the OLE header
- read sector allocation tables
- decode directory entries
- resolve named streams
- read both standard and short streams

This layer should know nothing about Altium beyond stream names and bytes.

### PCB Stream Extraction Layer

Add a PCB-specific extractor under `src/core/altium/` that:

- opens the compound document
- inventories available streams
- selects candidate PCB content streams
- runs printable-run extraction per stream
- tags recovered records with `sourceStream`
- falls back to the current whole-file scan if OLE parsing fails or yields no candidate streams

This preserves the current field parser while making the extraction boundary explicit and debuggable.

### PCB Primitive Normalization Layer

Extend the normalized `pcb` model so the renderer can consume real board primitives instead of inferred rectangles.

Target shape:

- `boardOutline`
- `layers`
- `components`
- `polygons`
- `texts`
- `tracks`
- `pads`
- `vias`

Recovered primitive families should be derived from structural field signatures, not from fixture names or project-specific identifiers.

### Renderer And Theme Layer

Once the normalized PCB model is richer, update [PcbSvgRenderer.mjs](/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/ui/PcbSvgRenderer.mjs) to render whichever primitive families are present. Replace PCB literal colors in [20-viewer.css](/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/styles/20-viewer.css) with PCB CSS variables similar to the schematic token model.

Expected initial PCB theme surface:

- `--pcb-board-fill`
- `--pcb-board-outline`
- `--pcb-top-copper-fill`
- `--pcb-bottom-copper-fill`
- `--pcb-top-overlay-color`
- `--pcb-bottom-overlay-color`
- `--pcb-pad-fill`
- `--pcb-via-fill`
- `--pcb-hole-fill`
- `--pcb-text-color`
- `--pcb-component-body-fill`

The renderer must never invent pads or traces from component metadata. It should render only recovered geometry.

## Data Flow

1. Browser hands `ArrayBuffer` to [AltiumParser.mjs](/Users/afiedler/Documents/privat/Andrés_Werkstatt/ecadforge_app/src/core/altium/AltiumParser.mjs).
2. File type sniffing chooses the PCB path.
3. PCB decode tries OLE stream extraction first.
4. Candidate stream bytes are scanned for printable record runs.
5. Printable runs are parsed into field objects with stream provenance.
6. PCB primitive normalization derives richer `pcb` entity families.
7. Renderer consumes the normalized model and emits theme-token-based SVG.
8. Diagnostics report container state, stream discovery, and recovered primitive families.

## Diagnostics And Failure Modes

The parser should make the recovery boundary explicit:

- If compound-document parsing fails, keep the current unreadable-file behavior.
- If OLE parsing succeeds but no useful PCB streams are found, emit a diagnostic that stream discovery succeeded but primitive streams were not recoverable.
- If stream-aware printable extraction yields only partial data, report exactly which primitive families were recovered.
- If stream records exist but do not match known primitive signatures yet, keep per-signature diagnostics so support can expand without re-debugging the file boundary.
- The renderer must never guess missing board geometry.

That creates three PCB states:

- unreadable container
- readable container with limited primitive recovery
- readable container with detailed primitive recovery

## Testing Strategy

### Automated Tests

- unit tests for binary reads and bounds checks
- synthetic OLE container tests for header parsing, directory entry decoding, and stream extraction
- parser tests for stream-aware printable extraction with repo-owned obfuscated PCB shards
- normalized-model tests for recovered `polygons`, `texts`, `tracks`, `pads`, and `vias`
- renderer tests for PCB SVG primitive output and CSS variable tokens

### Local Verification

During implementation, use the user-supplied PCB file for local manual verification only. Do not commit the native file or any project-specific extracted payload into the repository.

## Non-Goals

- full binary PCB primitive decoding in the first pass
- customer-specific fixture names, parser branches, or renderer special cases
- inferred traces, pads, or vias based only on placement metadata

## Follow-Up Trigger

If stream-aware printable extraction still fails to expose pad, via, and track families on representative PCB files, the next plan should add a focused binary PCB stream decoder on top of the same OLE infrastructure.
