# Package Version Metadata Implementation Plan

**Goal:** Remove `api/app-version.json` and make both runtime metadata endpoints return the app version directly from `package.json`.

**Architecture:** Keep the existing `/api/app-meta` and `/api/app-meta.php` routes and response payload unchanged, but simplify both backend readers to parse only the repository root `package.json`. Remove the duplicated JSON metadata file, update structure checks, and document the new LIVE deployment expectation.

**Tech Stack:** Node.js, PHP, native `node:test`, JSON metadata endpoints

---

### Task 1: Lock the new package.json-only behavior in tests

**Files:**
- Modify: `tests/project-structure.test.mjs`
- Modify: `tests/php-app-meta-endpoint.test.mjs`
- Modify: `tests/server-startup.test.mjs`

**Step 1: Write the failing tests**

Update the structure test so `api/app-version.json` is no longer required and add an assertion that the file does not exist. Update the PHP endpoint test to read the expected version from `package.json`. Update the server startup test to assert `/api/app-meta` returns the version from `package.json`.

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/project-structure.test.mjs tests/php-app-meta-endpoint.test.mjs tests/server-startup.test.mjs`

Expected: FAIL because the endpoints and repository still reference `api/app-version.json`.

**Step 3: Write the minimal implementation**

Simplify the Node and PHP metadata readers so they only parse `package.json`, then remove `api/app-version.json`.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/project-structure.test.mjs tests/php-app-meta-endpoint.test.mjs tests/server-startup.test.mjs`

Expected: PASS.

### Task 2: Update docs and bump the version

**Files:**
- Modify: `docs/troubleshooting.md`
- Modify: `spec/web-app-specification.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Update docs**

Replace the remaining LIVE guidance that tells operators to upload `api/app-version.json` with guidance that `package.json` must be present for the metadata endpoints.

**Step 2: Increment the app version**

Update `package.json` and `package-lock.json` to the next patch version required by the repo instructions.

**Step 3: Run the full test suite**

Run: `npm test`

Expected: PASS with exit code `0`.

**Step 4: Review the diff**

Run: `git diff -- package.json package-lock.json src/server.mjs api/app-meta.php tests/project-structure.test.mjs tests/php-app-meta-endpoint.test.mjs tests/server-startup.test.mjs docs/troubleshooting.md spec/web-app-specification.md`

Expected: Only the package-version metadata cleanup, tests, docs, and version bump appear.
