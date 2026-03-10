# Schematic Pin Label Alignment Design

**Date:** 2026-03-09

## Goal

Make schematic symbol pin labeling match the Altium-style layout shown in the provided screenshots:

- `U6` pin numbers must align cleanly in the external number column
- `U6` internal labels must align consistently inside the symbol body
- `U29` and `U31` must render both pin names and pin numbers
- `U29` and `U31` internal labels must align consistently inside the symbol body

## Scope

### In Scope

- Fix the normalized pin label mode for small logic gates like `U29` and `U31`
- Fix horizontal pin label placement in the SVG schematic renderer
- Add tests that cover the provided `AtlasControl-A1.01.01E.SchDoc` case directly
- Increment the app version in `package.json`

### Out Of Scope

- General symbol-body extraction from arbitrary line geometry
- Reworking unrelated text anchoring behavior
- Broad parser refactors beyond the label-mode bug

## Current State

The parsed source file shows two distinct issues:

1. `U29` and `U31` are normalized with `labelMode: 'name-only'`, so the renderer never receives instructions to draw pin numbers.
2. `U6` uses `labelMode: 'name-and-number'`, but the current renderer places horizontal pin numbers with side-dependent offsets that do not match the intended outside-number / inside-name layout.

## Approaches Considered

### Approach 1: Renderer-Only Override

Force small symbols to show numbers during rendering without changing normalized pin data.

**Pros**

- Smallest parser change
- Fastest local fix

**Cons**

- Hides the real root cause in the parser
- Makes renderer behavior depend on symbol heuristics it should not own

### Approach 2: Parser + Renderer Split Fix

Fix pin label mode selection in the parser, then make the renderer place names inside the body and numbers outside the body for horizontal pins.

**Pros**

- Fixes the actual missing-number cause
- Keeps responsibilities clean
- Matches the normalized data model better

**Cons**

- Slightly larger change surface
- Needs both parser and renderer tests

### Approach 3: Full Symbol-Bounds Aware Layout

Infer symbol body bounds from owner geometry and compute all pin text placement from that box.

**Pros**

- Strongest general layout model
- Could improve more symbols later

**Cons**

- Much more work than needed for this bug
- Higher regression risk

## Selected Design

Use **Approach 2**.

The parser will stop classifying the five-pin `SN74LVC1G00DCKR` gate symbols as `name-only`, so their numeric designators remain available to the renderer. The renderer will then use a consistent horizontal-pin layout:

- left pins: number outside, name inside
- right pins: number outside, name inside

This matches the visual structure in the supplied screenshots and keeps the data model and presentation logic separated cleanly.

## Testing Strategy

- Add a parser-backed renderer test that loads `tests/fixtures/altium/AtlasControl-A1.01.01E.SchDoc`
- Assert that `U29` and `U31` produce visible numeric pin labels
- Assert that `U6` renders pin numbers in the outer column and names in the inner column
- Run the focused renderer/parser tests first, then the full `npm test` suite

## Risks

- Broadening label-mode rules could surface numbers on symbols that intentionally hide them
- Horizontal pin offset changes could regress existing layout snapshots

## Mitigations

- Keep the parser rule change narrow and tied to the observed gate pattern
- Add tests that verify both the previous generic behavior and the real file behavior
