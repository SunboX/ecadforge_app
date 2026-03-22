# Explicit Pin-Label Number Clearance Design

**Date:** 2026-03-18

## Goal

Keep synthetic left/right pin numbers clear of explicit owner pin-name labels after mirrored owner-text placement corrections move those labels onto the pin axis.

## Scope

### In Scope

- Preserve the current mirrored explicit owner pin-name placement for schematic free-text labels
- Move synthetic left/right pin numbers outward when an explicit owner pin-name label for the same pin already exists
- Base the number shift on the same horizontal correction already applied to the explicit owner label
- Cover the behavior with renderer-backed regression tests

### Out Of Scope

- New text measurement or collision-box layout code
- Top/bottom pin-number spacing changes
- Changes to non-explicit pin-name rendering
- Fixture-specific overrides tied to one SchDoc or component

## Current State

The renderer now snaps mirrored explicit owner pin-name labels such as `S`, `D`, and `G` to the matched pin axis.

1. The explicit owner `S` label for `SIGIL2` moves from authored `x=481` to rendered `x=489`.
2. The synthetic left-pin number `2` still renders from the old default lane at `x=487`.
3. That old number lane now overlaps the corrected explicit label lane.
4. The overlap is not unique to this one file; any left/right pin that hides its synthetic name because an explicit owner label exists can hit the same crowding after a horizontal label correction.

## Approaches Considered

### Approach 1: Shift Pin Numbers By The Same Label Correction

For left/right pins with explicit owner labels, compute the label's horizontal correction and move the synthetic number outward by the same amount.

**Pros**

- Generic and data-driven
- Preserves the original number-to-name gap from authored coordinates
- Reuses the same owner-label matching logic already needed for text placement

**Cons**

- Requires sharing explicit owner-label correction data between text and pin rendering

### Approach 2: Add A Fixed Extra Left/Right Gutter

Whenever an explicit owner label exists, move the number by one fixed padding constant.

**Pros**

- Very small patch
- Easy to reason about

**Cons**

- Brittle across fonts and authored label offsets
- Does not preserve the original source gap

### Approach 3: Add Collision Detection For Text Runs

Measure or estimate text boxes and resolve overlaps after all text placement is known.

**Pros**

- Could solve more classes of text overlap later

**Cons**

- Much larger change surface
- Unnecessary for the current one-axis clearance issue

## Selected Design

Use **Approach 1**.

The renderer will derive one explicit owner-pin label offset map from normalized text records plus matched pins. For each explicit owner label, the map stores the horizontal correction between the authored text `x` and the resolved rendered `x`. During left/right pin rendering, if the synthetic pin name is suppressed because an explicit owner label exists, the synthetic pin number will move outward by that same correction.

That means:

- left pin numbers move further left by the explicit label's positive `x` correction
- right pin numbers move further right by the explicit label's positive `x` correction
- top and bottom pin numbers stay unchanged because they do not share the same horizontal lane

## Data Flow

1. Free-text records still normalize as before.
2. The renderer still matches explicit owner pin-name labels to their pins.
3. A shared helper computes each explicit label's resolved placement and stores the `resolvedX - authoredX` delta by owner/pin key.
4. Text rendering uses the resolved placement directly.
5. Left/right pin-number rendering checks the same owner/pin key and moves the number outward by the stored delta when present.

## Testing Strategy

- Extend the existing synthetic mirrored-owner regression to assert the left and right pin numbers move outward with the same delta as the explicit `S` and `D` labels
- Keep the bottom pin number unchanged in that same regression
- Run the focused regression first, then the parser/renderer tests, then the full suite

## Risks

- Applying the clearance to the wrong pins could over-shift ordinary number lanes
- Duplicate owner/text keys could hide a mismatched offset

## Mitigations

- Only apply the outward number shift when the pin already has an explicit owner label for the same owner/name key
- Reuse the same matching logic used by explicit owner-label text placement
- Keep the offset map horizontal-only so unrelated vertical behaviors stay untouched
