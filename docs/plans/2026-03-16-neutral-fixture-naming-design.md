# Neutral Fixture Naming Design

**Date:** 2026-03-16

## Goal

Remove the remaining legacy schematic identifier from the repository, replace the old sheet-G fixture with a neutral fake name, and make the project guidance explicit that parser behavior must stay universal rather than keyed to a specific `.SchDoc`.

## Scope

### In Scope

- Rename the repository-owned schematic fixture and its loader API to neutral fake names
- Update active tests and docs so they describe behaviors without mentioning the retired identifier
- Sanitize the renamed `.SchDoc` fixture if its raw payload still contains the retired identifier
- Update `AGENTS.md` to require fake schematics in tests and universal parser rules
- Verify the parser implementation does not rely on fixture-specific file-name branches

### Out Of Scope

- Broadly renaming the existing `AtlasControl` fake corpus
- Changing parser behavior that is already generic and structure-based
- Rewriting historical docs beyond removing the retired identifier

## Current State

The repository still exposes one retired schematic identifier in a sheet-G fixture file name, the shared fixture loader, active parser and renderer regressions, and several plan/design documents. The user also wants the repository guidance to forbid schematic-specific parser rules.

The current source scan does not show any parser branches keyed directly to fixture file names. The risk is therefore mostly around fixture naming, test language, and future contributor guidance rather than an obvious hard-coded runtime path.

## Approaches Considered

### Approach 1: Rename References Only

Rename the fixture file and update visible test/doc strings.

**Pros**

- Smallest change
- Likely sufficient if runtime code is already generic

**Cons**

- Does not guard against future fixture-specific parser changes
- Can leave the retired identifier embedded inside raw fixture payloads

### Approach 2: Neutral Rename Plus Repository Guardrails

Rename and sanitize the fixture, update tests/docs, and add guidance that parser fixes must remain structure-based and general.

**Pros**

- Removes the legacy name across both code and documentation
- Preserves current regression coverage
- Makes the universal-parser expectation explicit for future work

**Cons**

- Touches more files than a simple rename
- Requires careful edits because the worktree already has unrelated changes

## Selected Design

Use **Approach 2**.

Rename the remaining sheet-G schematic fixture to a neutral fake name within the existing fake corpus, update the shared fixture loader to expose neutral accessors, and rewrite test names/comments so they describe the behaviors under test instead of the old sample source. Search the parser source for fixture-specific logic and leave the existing generalized heuristics intact unless a truly fixture-bound branch is found.

Add explicit guidance to `AGENTS.md`: tests must use fake schematics only, and parser or renderer fixes must never special-case one schematic, file name, or project identifier. Any normalization rule must be justified by structural record patterns that can apply across valid `.SchDoc` inputs.

## Testing Strategy

- First update tests to use the neutral fixture API so they fail before implementation
- Rename/sanitize the fixture and loader paths, then update docs and guidance
- Run focused parser and renderer tests covering the renamed schematic
- Run `npm test`

## Risks

- The renamed fixture may still embed the retired identifier inside its raw binary payload
- Broad doc cleanup can miss plan/design files
- Dirty worktree edits in overlapping files can be accidentally overwritten

## Mitigations

- Search both text files and the raw fixture payload for the retired identifier after edits
- Use targeted patches only in the affected sections
- Re-run a repository-wide token search for the retired identifier before completion
