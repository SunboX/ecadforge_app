# Testing

## Strategy

- Unit-test normalized viewer state behavior
- Verify integration with the shared `@sunbox/altium-toolkit` parser and non-interactive renderer package
- Validate required project structure and source/test file line limits

## Commands

```bash
npm test
```

## Current Coverage

- `tests/app-state.test.mjs`: state defaults, patching, subscriptions
- `tests/ui/renderers.test.mjs`: ECAD Forge 3D shell renderer coverage
- `tests/app-meta-loader.test.mjs`: browser metadata endpoint fallback behavior
- `tests/php-app-meta-endpoint.test.mjs`: deployable PHP metadata endpoint payloads
- `tests/deploy-ftp-workflow.test.mjs`: FTP workflow deployment coverage for `api/`
- `tests/project-structure.test.mjs`: required file presence
- `tests/mjs-line-limit.test.mjs`: source and test file length guard

## Rules

- Add/update app tests for ECAD Forge interaction, server, state, and package integration behavior
- Add parser and deterministic renderer tests in the `@sunbox/altium-toolkit` repository
- Keep fixture expectations in the toolkit repository and preserve the existing obfuscation rules
