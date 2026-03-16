# Multipart Pin Numbering Design

**Date:** 2026-03-16

## Goal

Fix overlapping pin numbers on control-sheet multipart resistor-network symbols and make visible multipart designators match the reference output: `R92A`, `R92B`, `R92C`, `R92D`, while keeping the connector designator as `J4`.

## Scope

### In Scope

- Fix active multipart owner-part selection for left-anchored passive resistor-network symbols
- Remove overlapping multipart pin-number stacks by keeping only the active owner-part pins
- Narrow multipart designator suffix decoration so it only applies when multiple visible owners share the same base designator
- Cover the behavior with matcher, parser, and renderer regressions using the control-sheet fixture

### Out Of Scope

- Reworking general passive-pin label rules outside multipart owners
- Changing connector value annotations or Chinese text rendering
- Broad multipart naming changes for unrelated sheets without failing evidence
- Renderer-only overlap suppression that leaves parser data inconsistent

## Current State

The current parser already has multipart-owner filtering, but it misses this control-sheet resistor-network pattern.

1. The raw `YC124` owners for `R92` contain four `OwnerPartId` pin/body variants at the same symbol location.
2. `SchematicMultipartOwnerMatcher` only resolves owners whose component placement aligns with the visible part bounds corner.
3. These passive resistor-network component placements are anchored at the left pin endpoint, not at the part-bounds corner, so owners `4010`, `4050`, `4088`, and `4126` never get an active part match.
4. Because those owners stay unmatched, `AltiumParser.#isDrawableSchematicRecord()` keeps all four part-specific pin pairs, and the SVG renderer draws overlapping pin numbers like `1/2/3/4` and `5/6/7/8`.
5. Separately, `SchematicTextPostProcessor.decorateMultipartDesignators()` appends a suffix to any matched multipart owner, which incorrectly turns the connector designator `J4` into `J4A`.

## Approaches Considered

### Approach 1: Fix The Multipart Matcher And Tighten Suffix Decoration

Extend owner-part matching so it understands left-anchored passive symbols, then decorate multipart designators only when multiple active owners share the same base designator text.

**Pros**

- Fixes the root cause in normalized data
- Removes overlapping pin numbers before rendering
- Produces `R92A/B/C/D` while leaving the single visible `J4` untouched
- Keeps the SVG renderer simple

**Cons**

- Touches both owner matching and designator decoration
- Needs careful regression coverage to avoid changing other multipart symbols

### Approach 2: Dedupe Overlapping Pin Numbers In `SchematicPinParser`

Leave multipart matching unchanged and collapse stacked pins later by geometry.

**Pros**

- Smaller local change
- Can hide the immediate overlap symptom

**Cons**

- Treats symptoms instead of owner selection
- Risks dropping legitimate coincident pins on other symbols
- Does not solve the incorrect `J4A` suffix cleanly

### Approach 3: Suppress Duplicate Numbers Only In The SVG Renderer

Keep parser data as-is and prevent the renderer from emitting repeated numbers at the same coordinates.

**Pros**

- Fastest patch
- Minimal parser churn

**Cons**

- Leaves normalized schematic data wrong
- Hard-codes layout heuristics into rendering
- Does not address multipart designator naming semantics

## Selected Design

Use **Approach 1**.

The multipart owner matcher will be expanded so passive multipart symbols can match against the actual component anchor used in the source file, not just the part-bounds corner. For the control-sheet resistor networks, that means deriving bounds that include the outer pin endpoints and accepting a left-edge midpoint anchor for non-mirrored passive owners. Once those owners resolve to the active `OwnerPartId`, the existing drawable-record filtering can drop the inactive pin/body variants before pin normalization.

Multipart designator decoration will also become stricter. Instead of appending a suffix to every matched multipart owner, the post-processor will only append suffixes for active owners that share the same visible base designator with at least one other active owner. That keeps grouped multipart symbols like `R92` and `U2` suffixed, while preserving single visible multipart connectors such as `J4`.

## Data Flow

The schematic parsing pipeline stays in the parser layer:

1. Raw records are parsed from the `.SchDoc`.
2. `SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts()` resolves which `OwnerPartId` is active per owner.
3. `AltiumParser.#isDrawableSchematicRecord()` filters primitives to the active multipart owner part.
4. `SchematicPinParser.parseSchematicPins()` sees only the active pin pair for each resistor-network section, so no overlapping numbers survive normalization.
5. Text records are normalized and post-processed.
6. Multipart designator decoration groups active designator texts by base text and appends suffixes only when more than one active owner shares that base text.

## Testing Strategy

- Add a matcher unit test covering a left-anchored passive multipart owner whose component location sits on the outer pin endpoint instead of the part-bounds corner
- Add a control-sheet parser regression that asserts the `R92` sections resolve to suffixed designators and each section exposes only one visible left/right pin number pair
- Add a control-sheet renderer regression that checks for `R92A/B/C/D`, verifies `J4` is still rendered, and confirms `J4A` is absent
- Run the focused matcher/parser/renderer tests first, then the full test suite

## Risks

- Broadening anchor matching could accidentally bind the wrong multipart owner when two candidate bounds are nearby
- Grouping suffix decoration by base designator text must not accidentally suffix unrelated single-instance symbols

## Mitigations

- Include derived outer pin endpoints in multipart bounds so the correct passive owner can still match with a tight score threshold
- Keep corner-anchor matching for the existing mirrored and standard symbol cases
- Restrict suffix decoration to visible multipart designator texts whose base text appears on multiple active owners
- Lock the control-sheet behavior with both parser and renderer regressions before implementation
