# Testing

## Strategy

- Unit-test normalized viewer state behavior
- Verify native parser output against embedded obfuscated fake schematic and PCB fixture data
- Verify pure renderers with deterministic synthetic models
- Validate required project structure and source/test file line limits

## Commands

```bash
npm test
```

## Current Coverage

- `tests/app-state.test.mjs`: state defaults, patching, subscriptions
- `tests/core/altium-parser.test.mjs`: parser entrypoint importing split suites in `tests/core/altium-parser/`
- `tests/ui/renderers.test.mjs`: renderer entrypoint importing split suites in `tests/ui/renderers/`
- `tests/project-structure.test.mjs`: required file presence
- `tests/mjs-line-limit.test.mjs`: source and test file length guard

## Rules

- Add/update tests for each parser behavior or renderer change
- Keep assertions focused on normalized outputs and user-visible markup
- When changing fixture expectations, verify them against the embedded obfuscated fixture loader instead of weakening tests blindly
