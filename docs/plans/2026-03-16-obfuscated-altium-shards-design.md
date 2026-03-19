# Obfuscated Altium Shards Design

**Date:** 2026-03-16

## Goal

Remove the checked-in native Altium fixture files under `tests/fixtures/altium/` and replace them with only the minimum obfuscated record shards required by the parser and renderer regression tests.

## Selected Approach

Use small, test-owned printable-record fixtures assembled from obfuscated shard strings. Keep the fixture assembly in test code, not on disk as native `.SchDoc` / `.PcbDoc` files.

## Why This Approach

- It satisfies the repository rule that provided test files must not be committed directly.
- It keeps the parser exercised through the real `AsciiRecordParser` path because the parser only needs printable Altium-style record runs.
- It allows the suite to retain targeted regression coverage without carrying megabytes of unrelated native document data.

## Design

- Replace `tests/fixtures/altium/` with embedded test data in `tests/fixtures/AltiumFixtureLoader.mjs`.
- Store fixture data as obfuscated shard strings rather than readable record text.
- Assemble a small set of fake schematic and PCB documents from only the records each test needs.
- Narrow broad sample-sized assertions to exact behavior assertions that match the reduced fixtures.
- Update active docs and `AGENTS.md` to describe embedded obfuscated test data instead of checked-in native fixture files.

## Fixture Strategy

- Keep the current logical fixture roles where useful: dawn, moon, nova, cinder, and PCB.
- Each role becomes a composition of only the required records: sheet header, fonts, owner/component records, visible text, lines, pins, ports, note boxes, multipart records, and PCB outline/component records as needed.
- Obfuscation is lightweight and reversible in test code only, so the repo does not store readable source-derived record payloads.

## Risks

- Reducing the fixture set can silently drop coverage if tests keep asserting broad counts instead of exact regressions.
- Multipart and pin-orientation behaviors depend on a few subtle fields, so incomplete shard extraction can change parser output.

## Mitigations

- Convert broad “large sample” assertions into exact behavior assertions first.
- Keep each reduced fixture focused on one or a few related regressions.
- Verify with the focused parser/renderer suite and then `npm test`.
