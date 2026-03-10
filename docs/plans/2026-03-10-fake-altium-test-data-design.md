# Fake Altium Test Data Design

**Date:** 2026-03-10

## Goal

Remove every legacy vendor-specific identifier from the repository and replace the current external test corpus with repo-owned fake Altium sample data.

## Scope

### In Scope

- Replace legacy vendor-specific references across tests, README, setup docs, testing docs, and historical plan documents
- Move parser-backed tests from `/Users/afiedler/Downloads/...` to repo-local fixtures under `tests/fixtures/`
- Keep the existing parser and renderer regression coverage wherever practical
- Update test assertions to use fake file names and fake title-block values
- Increment the app version in `package.json`

### Out Of Scope

- Reworking parser behavior unrelated to fixture ownership or naming
- Redesigning the current regression suite beyond what is needed to support fake fixtures
- Removing generic technical labels such as `Bluetooth Module` or `USB port` that are not vendor-specific references

## Current State

The current parser-backed tests depend on native `.SchDoc` and `.PcbDoc` files stored outside the repository in a user-specific Downloads path. Those tests and several docs reference a retired vendor name directly, including file names, title-block values, and plan history.

That creates two problems:

1. The test suite is not self-contained because it depends on private local files.
2. The repository still exposes retired vendor-specific references in active and historical material.

## Approaches Considered

### Approach 1: Rename References Only

Update the visible strings in tests and docs but keep reading the same external files.

**Pros**

- Smallest edit surface
- Fastest change

**Cons**

- Does not actually switch tests to fake data
- Keeps the private external dependency in place

### Approach 2: Repo-Owned Sanitized Fixture Corpus

Create fake `.SchDoc` and `.PcbDoc` fixtures inside the repo by extracting printable Altium record runs from the current sample files, sanitizing project-specific names, and updating tests to use those local fixtures.

**Pros**

- Makes tests self-contained
- Preserves broad parser and renderer regression coverage
- Removes retired vendor-specific references from file names, titles, and docs

**Cons**

- Larger change than a text-only rename
- Requires fixture generation and broad assertion updates

### Approach 3: Replace End-To-End Parser Tests With Small Unit Fixtures

Drop most parser-backed regression coverage and replace it with smaller synthetic record fragments.

**Pros**

- Cleanest fake-data story
- Small fixtures are easy to inspect

**Cons**

- Weakens the current regression net significantly
- Requires re-authoring many tests

## Selected Design

Use **Approach 2**.

The repository will gain a local fake Altium corpus under `tests/fixtures/altium/`. Those files will keep the printable Altium record structure needed by `PrintableTextDecoder` and `AsciiRecordParser`, but the project names, file names, and title-block strings will be sanitized to fake names. Parser and renderer tests will be updated to load those local fixtures through a shared test helper instead of a user-specific Downloads path.

Documentation and historical plan docs will also be scrubbed so no retired vendor-specific reference remains anywhere in the repository.

## Testing Strategy

- First repoint parser and renderer tests to fake local fixture paths so they fail without the fixtures
- Add the fake fixture corpus and update assertions for fake file names and fake title values
- Run focused parser and renderer tests during the red/green cycle
- Run the full `npm test` suite after the fixture migration is complete

## Risks

- Sanitizing fixture content could accidentally remove record data the parser currently depends on
- Broad search-and-replace across historical docs could miss case variants or file-name references
- Repo-local fixture creation could drift from the current regression expectations if the sanitized copies are incomplete

## Mitigations

- Preserve the existing printable record structure and only sanitize the identifying strings needed for fake data
- Use a full-repo search for the retired vendor string after edits
- Keep the parser-backed assertions largely intact so fixture regressions surface immediately
