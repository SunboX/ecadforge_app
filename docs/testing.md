# Testing

## Strategy

- Unit-test normalized viewer state behavior
- Verify native parser output against repo-owned fake `.SchDoc` and `.PcbDoc` fixtures
- Verify pure renderers with deterministic synthetic models
- Validate required project structure and source file line limits

## Commands

```bash
npm test
```

## Current Coverage

- `tests/app-state.test.mjs`: state defaults, patching, subscriptions
- `tests/core/altium-parser.test.mjs`: fake fixture parsing for schematic and PCB documents
- `tests/ui/renderers.test.mjs`: schematic, PCB, BOM, and 3D renderer output
- `tests/project-structure.test.mjs`: required file presence
- `tests/mjs-line-limit.test.mjs`: source file length guard

## Rules

- Add/update tests for each parser behavior or renderer change
- Keep assertions focused on normalized outputs and user-visible markup
- When changing fixture expectations, verify them against the repo fixture corpus instead of weakening tests blindly
