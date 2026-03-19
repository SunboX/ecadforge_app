# Mutated Altium Fixture Corpus Design

**Date:** 2026-03-16

## Goal

Replace the current native `.SchDoc` and `.PcbDoc` fixture payloads with materially different fake content while preserving the existing parser and renderer regression coverage as closely as possible.

## Scope

### In Scope

- Rewrite the repository-owned Altium fixture corpus under `tests/fixtures/altium/`
- Change visible and metadata content across the schematic and PCB fixtures, not just the file names
- Keep the existing behavior classes covered by the current parser-backed and renderer-backed tests
- Update fixture-backed assertions when the new fake corpus changes exact visible labels or coordinates
- Preserve the rule that parser behavior must remain universal and must not special-case one fixture

### Out Of Scope

- Building native Altium binary files from scratch
- Replacing the current five-file corpus with dozens of tiny synthetic files
- Expanding parser behavior beyond what is needed to keep the current regressions covered

## Current State

The current tests depend on five large native Altium fixtures totaling about 6.2 MB. Those files drive exact assertions for coordinates, rotations, port directions, multipart owner filtering, note/callout bounds, title-block output, PCB outline parsing, and rendered SVG text.

That means a full from-scratch fixture rewrite would be high-risk. The parser is reading real native binary record payloads, and the test suite is intentionally verifying exact normalized output in many places.

## Approaches Considered

### Approach 1: Rebuild Every Fixture From Scratch

Create an entirely new native Altium corpus with unrelated content and port the tests to it.

**Pros**

- Strongest separation from the current payloads
- Cleanest long-term fake-data story

**Cons**

- High risk of losing broad parser coverage
- Native Altium binary authoring is not realistically available inside this repo
- Would require large-scale test rewrites

### Approach 2: Light Sanitization Only

Rename files and patch a small number of visible labels inside the existing files.

**Pros**

- Safest for current tests
- Smallest edit surface

**Cons**

- Does not make the payloads materially different enough
- Leaves too much of the current corpus intact

### Approach 3: Structural Mutation Pass Over The Existing Corpus

Keep the native container structure and behavior-bearing record patterns, but broadly mutate visible labels, metadata, library references, hierarchical paths, room names, titles, and selected geometry groupings so the files are materially different while the same regression classes remain testable.

**Pros**

- Best balance between fixture replacement and regression preservation
- Allows the files to stay valid native inputs for the parser
- Keeps the current exact-behavior net mostly intact

**Cons**

- Requires careful fixture surgery and coordinated test updates
- Some exact assertions will need to move with the new fake content

## Selected Design

Use **Approach 3**.

Treat each native fixture as a mutation target rather than a template to leave mostly untouched. Rewrite high-signal visible content and metadata across all five files: titles, document labels, component designators where practical, library references, room and hierarchy names, source descriptions, and selected text labels that the tests currently assert. Preserve the structural record classes that exercise the parser: rotated texts, style-4 ports, multipart passive owners, note boxes, dashed callouts, bus labels, connector pin columns, PCB board-outline primitives, and component placements.

The tests will stay parser-backed. Where a test currently depends on a specific string such as `Q12`, `WYRN`, `Q24`, `GLYPH_0`, `GLYPH_1`, `AURA_IRQ`, `AURA_CS`, `GLYPH_CS`, `Q92A`, or `P4`, update both the fixture payload and the assertion together. Keep exact coordinate and rotation assertions where they are the regression contract; only relax selectors when the name itself is incidental to the behavior.

## Data Strategy

- Keep the five current file roles: dawn sheet, moon sheet, nova sheet, cinder sheet, and PCB
- Introduce a new fake naming vocabulary shared across all files so the corpus reads like one coherent synthetic project
- Mutate record content in-place when safe to preserve binary structure
- If a mutation changes text width enough to shift rendered coordinates, update the exact assertions to the new observed values
- Prefer broad metadata rewrites over geometry rewrites first, then adjust selected geometry only where needed to make the files materially different

## Testing Strategy

- Add explicit tests that confirm the mutated corpus exposes the new fake identifiers and no longer exposes the current visible labels chosen for replacement
- Run focused parser and renderer tests after each fixture role is mutated
- Re-run `npm test` after the full corpus migration
- Re-run repo-wide searches for the old visible fixture vocabulary to make sure the new corpus actually replaced it

## Risks

- In-place binary mutation can corrupt a native file if lengths or delimiters are disturbed
- Large label changes can move rendered anchors and break many exact assertions at once
- The PCB file carries many embedded hierarchical references to the schematic sheets, so inconsistent renaming could leave the corpus internally incoherent

## Mitigations

- Prefer same-length or length-neutral replacements when editing raw payloads
- Mutate one fixture role at a time and keep focused tests tight
- Use repo scripts plus direct fixture-string searches after each mutation batch
