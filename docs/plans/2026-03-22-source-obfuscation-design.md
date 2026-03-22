# Source Obfuscation Design

**Date:** 2026-03-22

## Goal

Remove the remaining source-derived names from repo documentation and the repo-owned test fixture layer without renaming generic technical test vocabulary.

## Scope

### In Scope

- Remove lingering board-specific doc references
- Replace source-derived fake file names, labels, and designators exposed by `tests/fixtures/AltiumFixtureLoader.mjs`
- Update parser and renderer tests so they assert the new fantasy labels instead of the source-derived ones
- Bump the app version in `package.json`

### Out Of Scope

- Renaming generic technical test file names such as `schematic-parity`
- Renaming production parser APIs or normalized field names
- Reworking fixture structure beyond the obfuscation surface

## Current State

The repo already contains an obfuscation layer for imported fixture content, but it is incomplete. Historical plan docs still reference specific source files and boards. The fake fixture loader still emits source-derived file names, title text, power labels, bus labels, and component designators. Several tests and design docs therefore still mention raw labels from the imported material.

## Approaches Considered

### Approach 1: Documentation-Only Cleanup

Replace the visible names in docs and leave the fixture output unchanged.

**Pros**

- Smallest edit surface

**Cons**

- Leaves raw labels in the actual test layer
- Does not satisfy the request to obfuscate test files

### Approach 2: Extend the Existing Fixture Obfuscation Path

Keep the current repo-owned fake fixture setup, expand its replacement coverage, and update tests/docs to match the fantasy output.

**Pros**

- Fixes the actual leak point
- Keeps obfuscation centralized
- Avoids changing production parsing behavior

**Cons**

- Requires coordinated updates across tests and docs

### Approach 3: Broad Mechanical Renaming Across All Test Vocabulary

Rename generic test modules and helpers along with source-derived labels.

**Pros**

- Maximum cosmetic obfuscation

**Cons**

- Much larger change set
- Higher regression risk
- Not required for the chosen scope

## Selected Design

Use **Approach 2**.

The fixture loader will continue to own imported-sample obfuscation. It will gain a few additional exact string replacements for known source labels and a bounded designator rewrite pass for fixture-derived designator text. Repo docs and test assertions will be updated to use the new fantasy names and fake file names. Production parser behavior stays generic; only the repo-owned fake data and its references change.

## Testing Strategy

- First update the relevant parser and renderer tests to expect the new fantasy labels
- Run a focused parser/renderer slice and confirm it fails before changing the fixture obfuscation code
- Update the fixture loader and remaining docs
- Run `npm test`

## Risks

- Broad designator replacement could accidentally rewrite non-fixture strings if applied too widely
- Some historical docs may still reference old sample names after the main pass

## Mitigations

- Keep the new rewrite logic inside the existing fixture obfuscation path
- Verify with targeted `rg` searches after the edit
- Run the full repo test suite after the focused red-green step
