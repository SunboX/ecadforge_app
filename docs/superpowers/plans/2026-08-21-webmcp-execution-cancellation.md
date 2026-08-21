# WebMCP Execution Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagate Chrome's per-invocation WebMCP `AbortSignal` through ECAD Forge into the Altium and KiCad loaded-design query boundaries, then publish and deploy every affected repository.

**Architecture:** Keep WebMCP input arguments and execution context separate. The app adapter forwards `{ signal }` through registry handlers and the app dispatcher; each toolkit validates and checks the optional signal at its synchronous public query boundary while retaining current return types and no-options compatibility.

**Tech Stack:** Browser ESM, JavaScript private classes, `AbortController`/`AbortSignal`, Node `node:test`, npm packages, GitHub Releases and Actions.

## Global Constraints

- Preserve synchronous query return types and existing callers without execution options.
- Never put `AbortSignal` or execution metadata into JSON WebMCP arguments or analytics.
- Use genuine `AbortSignal` brand-state validation instead of trusting a shadowed `aborted` property.
- Do not claim mid-loop interruption for synchronous JavaScript.
- Use 4-space indentation, single quotes, no semicolons, and JSDoc for every function and method.
- Release only `altium-toolkit`, `kicad-toolkit`, and ECAD Forge.
- Do not publish before full tests, format checks, and npm dry-run succeed.
- Do not report ECAD Forge deployed until the pushed commit's deployment workflow concludes `success`.

---

### Task 1: Altium Query Cancellation Boundary

**Files:**
- Create: `../altium-toolkit/src/core/netlist-query/QueryExecution.mjs`
- Modify: `../altium-toolkit/src/core/netlist-query/LoadedDesignNetlistService.mjs`
- Modify: `../altium-toolkit/tests/core/netlist-query.test.mjs`
- Modify: `../altium-toolkit/docs/api.md`
- Create: `../altium-toolkit/docs/release-notes-v1.4.7.md`
- Modify: `../altium-toolkit/package.json`
- Modify: `../altium-toolkit/package-lock.json`

**Interfaces:**
- Produces: `QueryExecution.throwIfAborted(executionOptions?) -> void`.
- Produces: each public `LoadedDesignNetlistService` query accepts `(args = {}, executionOptions = {})`.
- Preserves: all existing synchronous result shapes.

- [ ] **Step 1: Write failing cancellation tests**

Add tests that call `listDesigns({}, { signal: controller.signal })` after aborting, assert the exact abort reason is thrown, reject `{ signal: { aborted: true } }` with `TypeError`, and confirm `listDesigns()` still returns the existing result.

```javascript
const controller = new AbortController()
const reason = new Error('query cancelled')
controller.abort(reason)
assert.throws(
    () => service.listDesigns({}, { signal: controller.signal }),
    (error) => error === reason
)
assert.throws(
    () => service.listDesigns({}, { signal: { aborted: true } }),
    /AbortSignal/
)
```

- [ ] **Step 2: Verify red**

Run: `node --test tests/core/netlist-query.test.mjs`

Expected: FAIL because the service ignores the second argument.

- [ ] **Step 3: Implement the minimal boundary**

Capture the platform `AbortSignal.prototype.aborted` getter once. Implement `QueryExecution.throwIfAborted()` so omitted/null signals are accepted, lookalikes throw `TypeError`, non-aborted signals return, and aborted signals throw `signal.reason` or `new DOMException('The operation was aborted.', 'AbortError')`. Import it and call it at the beginning of all ten public query methods.

- [ ] **Step 4: Verify green and full library gates**

Run: `node --test tests/core/netlist-query.test.mjs`

Run: `npm test`

Run: `npm run check:format`

Expected: all exit 0.

- [ ] **Step 5: Document, bump, and reverify**

Document the optional execution options and synchronous limitation, run `npm version patch --no-git-tag-version` to target `1.4.7`, then rerun `npm test`, `npm run check:format`, and `npm publish --dry-run --cache /private/tmp/altium-toolkit-npm-cache`.

### Task 2: KiCad Query Cancellation Boundary

**Files:**
- Create: `../kicad-toolkit/src/core/netlist-query/QueryExecution.mjs`
- Modify: `../kicad-toolkit/src/core/netlist-query/LoadedDesignNetlistService.mjs`
- Modify: `../kicad-toolkit/tests/core/netlist-query.test.mjs`
- Modify: `../kicad-toolkit/docs/api.md`
- Create: `../kicad-toolkit/docs/release-notes-v1.3.5.md`
- Modify: `../kicad-toolkit/package.json`
- Modify: `../kicad-toolkit/package-lock.json`

**Interfaces:**
- Produces: the same `QueryExecution.throwIfAborted(executionOptions?)` contract as Altium Toolkit.
- Produces: each public KiCad loaded-design query accepts `(args = {}, executionOptions = {})`.
- Preserves: all existing synchronous result shapes.

- [ ] **Step 1: Write failing cancellation tests**

Use the same observable cancellation, lookalike rejection, and no-options compatibility contract against the KiCad service.

- [ ] **Step 2: Verify red**

Run: `node --test tests/core/netlist-query.test.mjs`

Expected: FAIL because execution options are ignored.

- [ ] **Step 3: Implement the minimal boundary**

Add the focused utility and guard all ten public methods before loaded-document access.

- [ ] **Step 4: Verify green and full library gates**

Run: `node --test tests/core/netlist-query.test.mjs`

Run: `npm test`

Run: `npm run check:format`

Expected: all exit 0.

- [ ] **Step 5: Document, bump, and reverify**

Document the optional context and limitation, target `1.3.5`, and run full tests, format check, and `npm publish --dry-run --cache /private/tmp/kicad-toolkit-npm-cache`.

### Task 3: ECAD Forge Adapter And Registry Propagation

**Files:**
- Modify: `src/core/webmcp/WebMcpAdapter.mjs`
- Modify: `src/core/webmcp/WebMcpToolRegistry.mjs`
- Modify: `tests/core/webmcp/webmcp-adapter.test.mjs`
- Create: `tests/core/webmcp/webmcp-tool-registry.test.mjs`

**Interfaces:**
- Consumes: native `execute(args, { signal })`.
- Produces: registry `handler(args, { signal })`.
- Preserves: legacy positional handlers without execution options.

- [ ] **Step 1: Write failing adapter tests**

Capture the second handler argument and assert the native wrapper forwards the exact signal. Abort before execution and assert rejection is tracked as an error.

```javascript
const controller = new AbortController()
await fake.calls[0].tool.execute({}, { signal: controller.signal })
assert.equal(receivedExecutionOptions.signal, controller.signal)
```

- [ ] **Step 2: Verify adapter red**

Run: `node --test tests/core/webmcp/webmcp-adapter.test.mjs`

Expected: FAIL because `#toNativeTool()` discards its second argument.

- [ ] **Step 3: Implement adapter forwarding**

Accept an optional callback-options object, normalize it to `{ signal }`, and pass it through `#trackToolCall()` to `tool.handler(args, executionOptions)`. Keep legacy handlers compatible with an empty context.

- [ ] **Step 4: Write and verify registry red**

Use a fake service whose method captures its second argument. Call the registered handler with `{ signal }` and expect identity preservation.

Run: `node --test tests/core/webmcp/webmcp-tool-registry.test.mjs`

Expected: FAIL because registry lambdas accept only `args`.

- [ ] **Step 5: Implement registry forwarding and verify green**

Update all registry lambdas to `(args, executionOptions) => service.method(args, executionOptions)` and update JSDoc.

Run: `node --test tests/core/webmcp/webmcp-adapter.test.mjs tests/core/webmcp/webmcp-tool-registry.test.mjs`

Expected: PASS.

### Task 4: ECAD Forge Dispatcher Propagation And Documentation

**Files:**
- Modify: `src/core/webmcp/LoadedDesignNetlistService.mjs`
- Modify: `tests/core/webmcp/loaded-design-netlist-service.test.mjs`
- Modify: `tests/core/webmcp/loaded-design-pcb-service.test.mjs`
- Modify: `docs/webmcp.md`
- Modify: `docs/architecture.md`
- Modify: `spec/web-app-specification.md`

**Interfaces:**
- Consumes: every app service method `(args, executionOptions)`.
- Produces: toolkit calls with the same execution-options object.
- Preserves: app-owned synchronous analyzers and existing return shapes.

- [ ] **Step 1: Write failing dispatcher tests**

Inject a fake toolkit service, call a representative netlist query and PCB query with `{ signal }`, and assert the fake receives that same object. Add a pre-aborted app-owned query test.

- [ ] **Step 2: Verify red**

Run: `node --test tests/core/webmcp/loaded-design-netlist-service.test.mjs tests/core/webmcp/loaded-design-pcb-service.test.mjs`

Expected: FAIL because public methods and `#dispatch()` discard execution options.

- [ ] **Step 3: Implement dispatcher forwarding**

Add the optional second argument to all public methods, check `executionOptions.signal?.throwIfAborted()` at app-owned boundaries, and pass the object through `#dispatch()` to toolkit service calls.

- [ ] **Step 4: Verify focused app tests**

Run: `node --test tests/core/webmcp/*.test.mjs`

Expected: PASS.

- [ ] **Step 5: Update docs and acceptance criteria**

Document the callback signature, boundary propagation, validation ownership, privacy behavior, and synchronous limitation.

### Task 5: Publish Affected Toolkits

**Files:**
- Commit the intended files in each toolkit repository.
- Create GitHub releases `v1.4.7` and `v1.3.5`.

**Interfaces:**
- Produces: npm `altium-toolkit@1.4.7` and `kicad-toolkit@1.3.5` with matching `gitHead`.

- [ ] **Step 1: Fetch and reconcile release state**

In each repository run `git fetch --all --prune --tags`, inspect unmerged local/remote branches, verify registry version, and confirm only intended changes exist.

- [ ] **Step 2: Commit and push each library**

Use `fix: release <package> <version> WebMCP cancellation` style commits and push `main`.

- [ ] **Step 3: Create each GitHub release**

Create release notes grounded in the diff and verification commands, target the pushed SHA, and verify the tag/release metadata.

- [ ] **Step 4: Publish via npm web authentication**

Run each TTY command:

```bash
npm publish --auth-type=web --browser=/usr/bin/open --cache /private/tmp/<package>-npm-cache
```

Forward the exact browser authentication URL immediately, open it with Enter, and wait for completion.

- [ ] **Step 5: Verify registry state**

Confirm npm version, dist-tags, `gitHead`, GitHub release, remote tag, tests, formatting, and clean `main` for both packages.

### Task 6: ECAD Forge Dependency Update And Release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: generated `src/*.html` from structured-data sync
- Create: `/tmp/ecadforge-release-1.13.23.md`

**Interfaces:**
- Consumes: published `altium-toolkit@1.4.7` and `kicad-toolkit@1.3.5`.
- Produces: ECAD Forge `1.13.23` deployment.

- [ ] **Step 1: Install published dependencies**

Run `npm install altium-toolkit@latest kicad-toolkit@latest` and confirm registry semver ranges and lockfile integrity entries.

- [ ] **Step 2: Bump app metadata**

Run `npm version patch --no-git-tag-version` to target `1.13.23`, then `npm run sync:structured-data`.

- [ ] **Step 3: Run all app release gates**

Run: `npm test`

Run: `npm run check:structured-data`

Run: `npm run build:static`

Expected: all exit 0.

- [ ] **Step 4: Commit, push, and release**

Inspect staged content, commit `fix: release ECAD Forge 1.13.23 WebMCP cancellation`, push `main`, and create `v1.13.23` with notes grounded in the complete diff and test results.

- [ ] **Step 5: Monitor deployment and production**

Find the pushed commit's `Deploy to FTP (main)` run, watch it with `gh run watch --exit-status`, verify conclusion `success`, then perform cache-busted production health and asset/version checks.

- [ ] **Step 6: Final verification**

Re-run clean-status, release metadata, remote tags, package versions, dependency versions, structured-data check, and production version checks before reporting completion.
