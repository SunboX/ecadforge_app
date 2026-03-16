# Control-Sheet Multipart Pin Labels Design

**Date:** 2026-03-16

## Goal

Restore the visible `R92` pin numbers on the bastion sheet and keep the `R92A`, `R92B`, `R92C`, and `R92D` designators aligned like the source reference, while leaving `J4` unchanged.

## Scope

### In Scope

- Keep the active multipart owner filtering already in place for the control-sheet `R92` sections
- Restore visible pin-number labels for the active `R92` pin pairs
- Re-anchor the `R92` designator texts so all visible sections align consistently on the left side of the resistor bodies
- Cover the behavior with parser-backed and renderer-backed regressions

### Out Of Scope

- Redesigning general passive-pin label rules across unrelated symbols
- Changing connector numbering or `J4` naming
- Broad renderer heuristics for arbitrary text repositioning without control-sheet evidence

## Current State

The current multipart-owner fix resolved the overlapping inactive owners, but it exposed two narrower follow-up issues on the bastion sheet:

1. The active `R92` owners now keep only the correct pin pairs (`1/8`, `2/7`, `3/6`, `4/5`).
2. Those active two-pin resistor sections still pass through the generic passive-pin normalization rule that hides labels on small passive groups, so the visible pin numbers disappear entirely.
3. The `R92B` designator sits one unit above the owner row in the source data, which triggers the current "above owner" preservation heuristic in `SchematicTextPostProcessor`.
4. Because that heuristic preserves the raw `start` anchor for `R92B`, it renders left-to-right into the resistor body instead of aligning like `R92A`, `R92C`, and `R92D`.

## Approaches Considered

### Approach 1: Narrow Parser And Text-Heuristic Fixes

Keep the existing multipart-owner filtering, then make two targeted follow-up changes:

- preserve visible number labels for non-canonical passive two-pin groups such as the `R92` sections
- treat near-row left-side multipart designators as side labels instead of top labels when they only sit marginally above the owner row

**Pros**

- Fixes both regressions at the normalization layer
- Keeps SVG rendering simple
- Limits scope to the observed control-sheet behavior

**Cons**

- Requires care not to broaden passive-pin or text-anchor behavior for unrelated symbols

### Approach 2: Special-Case `R92` In The Renderer

Patch the SVG output so the `R92` numbers and label anchors are forced into place during rendering.

**Pros**

- Fast local patch

**Cons**

- Leaves parser data inconsistent with rendered output
- Hard-codes control-sheet behavior in the renderer
- Makes future parser-backed tests less trustworthy

## Selected Design

Use **Approach 1**.

`SchematicPinParser` will keep the existing active pin-pair filtering, but it will no longer hide labels for every passive two-pin group unconditionally. Instead, passive two-pin groups whose visible designators are not the canonical `1/2` pair will stay `number-only`, which preserves the `R92` numbers while leaving ordinary two-pin resistor symbols unchanged.

`SchematicTextPostProcessor` will also narrow its "above owner" preservation rule. A left-side designator that sits only slightly above a compact horizontal owner should still be treated as a left-side owner label and pass through the usual side-anchor logic. That allows `R92B` to right-align toward the resistor body just like the other `R92` sections, while keeping genuinely above-body labels on their original top placement path.

## Testing Strategy

- Extend the control-sheet parser regressions to assert the four `R92` owner pin pairs stay visible as `number-only`
- Extend the control-sheet parser regressions to assert all four `R92` designators resolve to `anchor: 'end'`
- Extend the control-sheet renderer regression to assert the rendered markup includes the expected `R92` pin numbers and the `R92B` label renders with `text-anchor="end"`
- Run focused parser and renderer tests first, then run the full suite

## Risks

- Broadening the passive two-pin rule too far could make ordinary resistor symbols show extra numbers again
- Narrowing the above-owner heuristic too far could re-anchor genuine top labels that should stay above a part

## Mitigations

- Restrict the passive two-pin exception to non-canonical number pairs rather than all two-pin passive groups
- Restrict the anchor change to labels that are only slightly above the owner row and still geometrically read like side labels
- Lock the exact control-sheet cases with parser and renderer regressions before changing production code
