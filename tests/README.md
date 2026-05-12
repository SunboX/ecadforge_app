# Tests

## Current test suites

- `app-state.test.mjs`: state transitions and subscriptions
- `project-structure.test.mjs`: required project files and scripts
- `ui/renderers.test.mjs`: ECAD Forge 3D shell renderer coverage
- `mjs-line-limit.test.mjs`: source and test file size guardrail

## Add when extending

- Domain behavior tests for new modules
- Worker contract tests for message payloads and fallbacks
- i18n translation and locale-application tests

Parser, fixture, and deterministic schematic/PCB/BOM renderer tests live in the
shared `altium-toolkit` repository.
