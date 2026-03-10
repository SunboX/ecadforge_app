# Schematic Multipart Rendering Design

**Date:** 2026-03-09

## Goal

Restore `AtlasControl-A1.01.01F.SchDoc` so the rendered schematic matches the supplied Altium screenshot instead of collapsing multipart symbols, omitting body geometry, and oversizing the page.

## Scope

### In Scope

- Filter multipart schematic owner primitives to the active `CurrentPartId`
- Parse record type `6` schematic polylines so symbol body outlines render
- Recompute sheet size from corrected geometry for `AtlasControl-A1.01.01F.SchDoc`
- Add parser and renderer regression tests for the real sheet F file
- Increment the app version in `package.json`

### Out Of Scope

- Rewriting schematic ownership resolution for every record type
- Reworking unrelated text anchoring or PCB rendering
- Adding image snapshot infrastructure

## Current State

The current parser renders sheet F incorrectly for three related reasons:

1. Multipart symbol owners such as `U2` carry primitives for many `OwnerPartId` values, but the parser groups pins and texts by `OwnerIndex` alone. This merges the power, USB, NAND, MIDI, and other subparts into one symbol body.
2. The symbol body outlines for these parts are stored as record type `6` polylines, but the parser only expands record `27` polylines and record `7` polygons. The visible rectangles and section dividers are therefore missing.
3. The sheet-size resolver runs on that corrupted geometry, so it infers an oversized custom page instead of the expected standard page.

## Approaches Considered

### Approach 1: Renderer-Only Heuristics

Detect crowded symbols in SVG generation and hide extra pins or fake missing boxes.

**Pros**

- Small initial code change

**Cons**

- Treats symptoms, not cause
- Leaves normalized data incorrect
- High regression risk for other files

### Approach 2: Parser-Centric Multipart Fix

Use the component record `CurrentPartId` to select the active `OwnerPartId`, parse record `6` outlines, and let the existing renderer consume corrected normalized data.

**Pros**

- Fixes the root cause in the normalized model
- Reuses current renderer behavior
- Scales to other multipart schematic sheets

**Cons**

- Needs owner-to-component matching logic
- Touches parser and layout inference together

### Approach 3: Full Ownership Refactor

Model Altium owner graphs explicitly and rebuild schematic normalization around that graph.

**Pros**

- Strong long-term foundation

**Cons**

- Much larger than this bug requires
- Slower, riskier, and unnecessary for the observed failure

## Selected Design

Use **Approach 2**.

The parser will build a multipart owner selection map from component records that expose `CurrentPartId`. For each owner group, only primitives belonging to the selected `OwnerPartId` will remain drawable, while owner-wide metadata (`OwnerPartId=-1`) will still pass through. Record `6` will be parsed as schematic polyline geometry alongside the existing line and polygon support. Once the filtered lines, pins, and texts are correct, the existing layout resolver should snap sheet F back to the correct standard page dimensions.

## Testing Strategy

- Add a parser test that loads `AtlasControl-A1.01.01F.SchDoc` and asserts:
  - `U2` renders as separate active parts rather than merged pin clouds
  - sheet F resolves to the expected standard page size
- Add a renderer test that loads the same file and asserts:
  - the `USB port`, `Power`, and `System / MIDI` section labels appear once
  - the multipart body rectangles render from record `6`
  - expected sheet chrome such as `A3` and `Sheet 5 of 6` remains visible

## Risks

- Owner-to-component matching could accidentally hide primitives for other multipart parts
- Parsing record `6` broadly could duplicate geometry already emitted elsewhere

## Mitigations

- Match active parts using concrete part-bounds near the component placement
- Keep record `6` expansion in the same normalized line pipeline and cover it with file-backed tests
