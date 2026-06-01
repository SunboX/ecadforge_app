# Testing

## Strategy

- Unit-test normalized viewer state behavior
- Verify integration with the shared `altium-toolkit` and `kicad-toolkit` parser, renderer, and non-interactive scene-data packages
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
- `tests/static-deploy-builder.test.mjs`: static Apache artifact cache-busting coverage
- `tests/deploy-ftp-workflow.test.mjs`: FTP workflow deployment coverage for static frontend, `api/`, and metadata
- `tests/project-structure.test.mjs`: required file presence
- `tests/mjs-line-limit.test.mjs`: source and test file length guard

## Rules

- Add/update app tests for ECAD Forge interaction, server, state, and package integration behavior
- Add parser, deterministic renderer, and non-interactive scene-data tests in the relevant toolkit repository
- Keep fixture expectations in the toolkit repository and preserve the existing obfuscation rules
