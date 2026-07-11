# Testing

## Strategy

- Unit-test normalized viewer state behavior
- Verify integration with the converged Altium, KiCad, Gerber, CircuitJSON,
  and PCB Scene3D package family
- Parse horizontal, diagonal, and vertical plated Gerber routed slots through
  the real project loader and assert canonical dimensions and board-space angle
  at viewer intake
- Preserve disjoint Gerber profiles as separate runtime/export substrates and
  route real KiCad ZIPs away from Gerber detection
- Retain exact STEP bytes for both KiCad ZIP and directory-upload companions
  under bounded `decodeAssets: 'full'` project loading
- Resolve KiCad `${KIPRJMOD}` to the canonical asset name and verify the real
  viewer receives exact bytes, board placement, and independent local model
  transforms without an app resolver
- Prove independent mixed-format project groups start concurrently while
  canonical results remain in deterministic toolkit order
- When overlapping project groups report the same canonical asset, retain the
  payload-bearing record instead of an earlier metadata-only duplicate
- Verify canonical envelope routing, context/index reuse, and retained native
  `/extensions` imports
- Verify explicit Altium native-model selection and resolver routing preserve
  free graphics, packed images, hidden labels, and canonical document identity
- Verify real project loading resolves native project strings and the
  toolkit-owned renderer suppresses hidden fallback labels without an app
  rewrite helper
- Verify direct files, folder trees, project companions, and session assets
  preserve 3MF format and exact source path through viewer intake
- Validate required project structure and source/test file line limits

## Commands

```bash
npm test
npm run check:structured-data
```

## Current Coverage

- `tests/app-state.test.mjs`: state defaults, patching, subscriptions
- `tests/ui/renderers.test.mjs`: ECAD Forge 3D shell renderer coverage
- `tests/app-meta-loader.test.mjs`: browser metadata endpoint fallback behavior
- `tests/php-app-meta-endpoint.test.mjs`: deployable PHP metadata endpoint payloads
- `tests/static-deploy-builder.test.mjs`: static Apache artifact cache-busting coverage
- `tests/server-startup.test.mjs` and `tests/static-deploy-builder.test.mjs`:
  installed OCCT ESM, WASM, worker, and license assets remain byte-exact at the
  scoped package path; removed vendored aliases stay unavailable
- `tests/deploy-ftp-workflow.test.mjs`: FTP workflow deployment coverage for static frontend, `api/`, and metadata
- `tests/seo-pages.test.mjs`: canonical SEO page metadata, JSON-LD graph shape, and structured-data drift tooling
- `tests/project-structure.test.mjs`: required file presence
- `tests/mjs-line-limit.test.mjs`: source and test file length guard
- `tests/toolkit-api-convergence.test.mjs`: converged dependency versions and
  extension-entrypoint enforcement, plus direct schema-valid KiCad parser and
  project-loader output for legacy values and transformed artwork
- `tests/core/ecad-format-registry-canonical.test.mjs`: canonical source
  identity, viewer compatibility, shared context reuse, render reuse, and BOM
  derivation
- Viewer-owned package tests cover all live model formats, safe companion
  resources, opt-in URL policy, exact cache identities, retry eviction, and raw
  ZIP format/payload parity; app integration tests verify the direct canonical
  document/session boundary without app resolver wrappers
- App intake coverage includes direct and folder-discovered 3MF assets and
  asserts the renderer service contains no native schematic rewrite path

## Rules

- Add/update app tests for ECAD Forge interaction, server, state, and package integration behavior
- Add parser, deterministic renderer, and non-interactive scene-data tests in the relevant toolkit repository
- Keep fixture expectations in the toolkit repository and preserve the existing obfuscation rules
