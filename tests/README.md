# Tests

## Current test suites

- `app-state.test.mjs`: state transitions and subscriptions
- `project-structure.test.mjs`: required project files and scripts
- `core/altium-parser.test.mjs`: parser entrypoint importing the split suites in `tests/core/altium-parser/`
- `ui/renderers.test.mjs`: renderer entrypoint importing the split suites in `tests/ui/renderers/`
- `mjs-line-limit.test.mjs`: source and test file size guardrail

## Add when extending

- Domain behavior tests for new modules
- Worker contract tests for message payloads and fallbacks
- i18n translation and locale-application tests
