# WebMCP Execution Cancellation Implementation Plan

**Goal:** Preserve Chrome's per-invocation WebMCP `AbortSignal` through ECAD
Forge and stop pre-aborted calls before loaded-design work begins.

**Architecture:** Keep JSON tool arguments and execution context separate.
Forward `{ signal }` through the adapter and registry, validate it at every
app loaded-design entry boundary, and only then perform app inspection or
toolkit dispatch.

**Release scope:** ECAD Forge only. Toolkit conformance verified that Altium and
KiCad public query contracts are frozen and need no code change.

## Task 1: Browser adapter and registry

**Files**

- Modify: `src/core/webmcp/WebMcpAdapter.mjs`
- Modify: `src/core/webmcp/WebMcpToolRegistry.mjs`
- Modify: `tests/core/webmcp/webmcp-adapter.test.mjs`
- Create: `tests/core/webmcp/webmcp-tool-registry.test.mjs`

- [x] Add failing adapter coverage for `execute(input, { signal })`.
- [x] Forward only the optional signal as separate execution context.
- [x] Add failing registry coverage and forward context to app service handlers.
- [x] Preserve legacy callbacks and analytics behavior.
- [x] Run focused tests green.

## Task 2: App cancellation boundary

**Files**

- Create: `src/core/webmcp/WebMcpExecution.mjs`
- Modify: `src/core/webmcp/LoadedDesignNetlistService.mjs`
- Modify: `tests/core/webmcp/loaded-design-netlist-service.test.mjs`
- Modify: `tests/core/webmcp/loaded-design-pcb-service.test.mjs`

- [x] Add genuine `AbortSignal` brand validation and abort-reason propagation.
- [x] Guard every public loaded-design method before snapshot reads or dispatch.
- [x] Keep the optional context separate while dispatching toolkit-backed calls.
- [x] Cover app-owned inspection, PCB inspection, and toolkit handoff.
- [x] Run focused WebMCP tests green.

## Task 3: Confirm library scope

**Repositories**

- `../altium-toolkit`
- `../kicad-toolkit`

- [x] Prototype cancellation at toolkit public query boundaries.
- [x] Run repository conformance tests.
- [x] Observe immutable historical-source and callable-contract failures.
- [x] Move enforcement to the existing app-owned pre-dispatch boundary.
- [x] Restore both toolkit repositories to clean `main`.
- [x] Exclude all libraries from release because none require code changes.

## Task 4: Documentation and app version

**Files**

- Modify: `README.md`
- Modify: `docs/webmcp.md`
- Modify: `docs/architecture.md`
- Modify: `spec/web-app-specification.md`
- Create: `docs/release-notes-v1.13.23.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Generated: `src/*.html`

- [x] Document the entry-boundary cancellation guarantee and synchronous limit.
- [x] Record why toolkit releases are unnecessary.
- [x] Bump ECAD Forge to 1.13.23.
- [x] Run `npm run sync:structured-data`.

## Task 5: Verify and deploy ECAD Forge

- [x] Run `npm test`.
- [x] Run `npm run check:format`.
- [x] Run `npm run check:structured-data`.
- [x] Run `npm run build:static`.
- [ ] Inspect staged content and commit the release.
- [ ] Push `main` and create GitHub release `v1.13.23`.
- [ ] Watch the exact GitHub Actions deployment to success.
- [ ] Verify production version, headers, and health.
- [ ] Confirm the app and both untouched toolkit repositories are clean.
