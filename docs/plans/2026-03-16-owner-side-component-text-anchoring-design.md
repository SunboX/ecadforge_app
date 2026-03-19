# Owner-Side Component Text Anchoring Design

**Date:** 2026-03-16

## Goal

Fix left-side stacked schematic designators such as `R51` so they align with the existing visible owner-side value text without shifting the value itself.

## Scope

### In Scope

- Fix non-rotated left-side designator anchoring when the designator shares a visible owner-side value/comment stack
- Keep owner-aware anchoring in the parser post-processing layer
- Cover the behavior with parser-backed tests using the cinder-sheet and nova fixtures

### Out Of Scope

- Rotated text rendering
- Recomputing text `x` or `y` coordinates from owner bounds
- General SVG text measurement or layout-box logic
- Changes to wire-label anchoring rules beyond preserving the current pipeline order

## Current State

The current post-processing pass anchors visible designators from owner geometry.

1. Raw Altium records can place both a component designator and its visible value on the same side of a vertical two-pin part.
2. For left-side cases, the current pass flips the `Designator` text to `anchor: 'end'`.
3. When a visible `VALUE` or `Comment` text already shares the same owner-side stack and `x` position, that flipped designator moves away from the already-correct stack.
4. This is visible in cinder-sheet `R51` and also appears in existing nova-sheet cases such as `R11` and `R319`.

## Approaches Considered

### Approach 1: Move The Whole Left-Side Stack

Detect left-side stacked owner text groups and mirror both `Designator` and `VALUE` anchors to `end`.

**Pros**

- Small local patch
- Produces one consistent left-edge anchor for the stack

**Cons**

- Changes value text the user already called correct
- Over-corrects the rendering by moving the whole stack left
- Breaks the intended source positioning of visible value/comment text

### Approach 2: Exempt Stacked Left-Side Designators

Keep value/comment texts untouched and only preserve a left-side designator's original anchor when it shares the same owner-side stack as a visible same-`x` value or comment.

**Pros**

- Matches the user feedback precisely
- Keeps the already-correct visible value/comment placement intact
- Leaves the older standalone-designator left/right rules in place

**Cons**

- Slightly narrower than a full owner-text-group model
- Still needs careful stack detection so horizontal resistor cases stay unchanged

### Approach 3: Recompute Text Positions From Owner Bounds

Ignore raw side-text anchors and place owner-side text from symbol bounds plus synthetic gaps.

**Pros**

- Maximum control over final layout
- Could normalize inconsistent source files later

**Cons**

- Larger change surface
- Higher regression risk
- Unnecessary without evidence that raw source coordinates are wrong

## Selected Design

Use **Approach 2**.

The parser post-processor will stay designator-focused, but it will stop flipping a left-side designator to `anchor: 'end'` when that designator already shares a visible same-`x` owner-side stack with a value or comment text. In those cases, the designator keeps its original `start` anchor so it aligns with the existing stack instead of pulling away from it.

This keeps the current raw coordinates intact, leaves visible value/comment text untouched, and only narrows the left-side designator override where the current heuristic is too aggressive. Top-side and bottom-side placement behavior remains unchanged.

## Data Flow

The existing schematic parsing pipeline stays intact:

1. Raw text records normalize into schematic text nodes.
2. Synthetic texts are added where needed.
3. Owner-aware text post-processing resolves final text anchors.
4. Wire-label anchoring still runs after component-text anchoring.

Within the component-text anchoring pass:

- owner bounds and pin counts still derive from normalized lines and pins
- visible `Designator` texts still drive the left/right anchor heuristic
- before applying `anchor: 'end'` to a left-side designator, the post-processor checks whether a visible same-owner `VALUE` or `Comment` already shares the same `x` position within the owner span
- if such a stacked text exists, the designator keeps its original `start` anchor
- designator-specific top padding remains in place for texts above the owner body

## Testing Strategy

- Add a control-sheet parser test that asserts `R51` and its visible `10K` both keep the original stacked `start` anchor while `R56` and its `10K` remain unchanged
- Add a nova parser regression test that asserts one pre-existing left-side stacked case such as `R11` also keeps the original stacked `start` anchor
- Keep the initial coverage at parser level because the renderer already honors `text-anchor`
- Run the focused parser tests first, then the full suite

## Risks

- The same-`x` stack detection could be too broad and exempt a designator that should still flip
- Left-side standalone designators must continue to behave as before

## Mitigations

- Restrict the new rule to non-rotated visible designators with a same-owner visible `VALUE` or `Comment` at the same `x` inside the owner span
- Preserve existing top padding, compact-owner, and wire-label logic for standalone designators
- Use fixture-backed regression tests for both control-sheet and secondary left-side stacked cases
