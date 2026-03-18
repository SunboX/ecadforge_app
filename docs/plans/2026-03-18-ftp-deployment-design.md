# FTP Deployment Workflow Design

## Summary

Add a GitHub Actions workflow that deploys this repository to the same FTP target layout used by `labelprinter_app`.

## Goals

- Deploy frontend server and browser assets from `src/` to the FTP root on pushes to `main`
- Deploy project documentation from `docs/` to `/docs/`
- Deploy production runtime dependencies from `node_modules/` to `/node_modules/` when dependency metadata changes
- Reuse the same FTP GitHub secrets already used in the sibling app: `FTP_SERVER`, `FTP_USERNAME`, and `FTP_PASSWORD`

## Chosen Approach

Mirror the existing `labelprinter_app` workflow structure:

- trigger on `push` to `main`
- use `dorny/paths-filter` to detect `deps`, `src`, and `docs` changes
- deploy each target directory independently with `SamKirkland/FTP-Deploy-Action`
- install production dependencies with `npm ci --omit=dev` before uploading `node_modules/`
- serialize deploy runs with a workflow-level concurrency group

## Alternatives Considered

### Single full-tree FTP upload

Rejected because it would upload more than the existing deployment convention and remove selective deploy behavior.

### Add build or test gates inside the workflow

Rejected for now because the request was to match the already-working deployment setup from `labelprinter_app`, not to introduce a different CI policy.

## Deployment Layout

- `src/` -> `/`
- `docs/` -> `/docs/`
- `node_modules/` -> `/node_modules/`

## Notes

- This change is configuration-only, so no application test fixture or feature-specific TDD cycle is required.
- The workflow intentionally does not add an `api` deployment job because this repository has no `api/` directory.
