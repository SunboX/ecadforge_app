# Git Project Root URL Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load public GitHub and GitLab repository homepages and explicit repository-root tree URLs through the existing hosted ECAD project workflow.

**Architecture:** Keep `GitSourceUrlResolver` synchronous and provider-focused: it classifies homepage and tree URLs, builds metadata descriptors, and completes root-folder descriptors once a default branch is known. Add a small `GitProjectRootSourceLoader` network boundary that fetches and validates repository metadata through the injected fetcher, while `GitHubSourceLoader` continues to orchestrate the existing folder/project discovery pipeline.

**Tech Stack:** Browser JavaScript modules, Node.js test runner, injected Fetch API doubles, GitHub REST API, GitLab REST API.

## Global Constraints

- Support exact public GitHub repository home URLs and public GitLab project home URLs at any namespace depth.
- Resolve project-home URLs against the provider's real non-empty `default_branch`; never guess `main` or `master`.
- Accept explicit GitHub and GitLab tree URLs with a branch and an empty root directory path.
- Continue requiring non-empty paths for GitHub/GitLab blob and raw file URLs.
- Reuse existing folder, Altium manifest, KiCad project, companion asset, rate-limit, and HTTP failure behavior.
- Keep all behavior provider- and repository-generic; do not encode real project names, filenames, or identifiers in production or tests.
- Add JSDoc for every new function or method and keep source and test files below 1,000 lines.
- Format with four-space indentation, single quotes, no semicolons, and no trailing commas.
- Increment ECAD Forge from `1.13.25` to `1.13.26` and synchronize structured-data HTML.

---

### Task 1: Project-root URL resolution and loading

**Files:**

- Create: `src/GitProjectRootSourceLoader.mjs`
- Modify: `src/GitSourceUrlResolver.mjs`
- Modify: `src/GitHubSourceLoader.mjs`
- Test: `tests/github-source-loader.test.mjs`

**Interfaces:**

- Consumes: `GitSourceUrlResolver.normalizeTreeUrl(sourceUrl)` and the injected `(url: string) => Promise<Response>` fetcher already owned by `GitHubSourceLoader`.
- Produces: `GitProjectRootSourceLoader.resolve(source, fetcher): Promise<object>` and `GitSourceUrlResolver.resolveProjectRootSource(source, defaultBranch): object`.

- [ ] **Step 1: Write failing loader regression tests**

Add focused tests using generic `acme`/`demo` fixtures. The GitHub homepage test must expect metadata, rate-limit, root Contents API, and project file fetches in that order. The GitLab homepage test must use a nested group, expect metadata and root Repository Tree API requests, and prove a root `.PrjPCB` manifest loads its schematic and PCB documents. Add explicit GitHub and GitLab root-tree tests that assert no metadata URL is fetched. Use nonstandard refs such as `release-x` and `stable-y` so branch guessing cannot pass.

Representative assertions:

```js
assert.deepEqual(urls, [
    'https://api.github.com/repos/acme/demo',
    GITHUB_RATE_LIMIT_URL,
    'https://api.github.com/repos/acme/demo/contents?ref=release-x',
    'https://raw.githubusercontent.com/acme/demo/release-x/board.kicad_pro',
    'https://raw.githubusercontent.com/acme/demo/release-x/board.kicad_sch',
    'https://raw.githubusercontent.com/acme/demo/release-x/board.kicad_pcb'
])

assert.deepEqual(urls.slice(0, 2), [
    'https://gitlab.com/api/v4/projects/acme%2Fhardware%2Fdemo',
    'https://gitlab.com/api/v4/projects/acme%2Fhardware%2Fdemo/repository/tree?ref=stable-y&per_page=100'
])
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/github-source-loader.test.mjs
```

Expected: the new homepage and GitLab root-tree cases fail with the current URL validation errors, proving the regressions exercise missing behavior.

- [ ] **Step 3: Add synchronous URL descriptor support**

Extend `normalizeTreeUrl()` so a provider tree normalizer is tried first and a project-home normalizer second. Project-home descriptors carry `metadataApiUrl` plus provider identity and repository coordinates. Add the public completion method:

```js
static resolveProjectRootSource(source, defaultBranch) {
    const ref = String(defaultBranch || '').trim()
    if (!ref) {
        throw new Error(
            'The ' +
                GitSourceUrlResolver.getProviderLabel(source) +
                ' project does not expose a default branch.'
        )
    }

    if (source?.provider === 'github') {
        return {
            provider: 'github',
            providerLabel: 'GitHub',
            apiUrl: GitSourceUrlResolver.#buildGitHubContentsApiUrl(
                String(source.owner || ''),
                String(source.repositoryName || ''),
                ref,
                []
            )
        }
    }

    return {
        provider: 'gitlab',
        providerLabel: 'GitLab',
        apiUrl: GitSourceUrlResolver.#buildGitLabTreeApiUrl(
            String(source?.projectPath || ''),
            ref,
            ''
        ),
        projectPath: String(source?.projectPath || ''),
        ref,
        directoryPath: ''
    }
}
```

Build metadata URLs with the existing path encoders. Change GitLab worktree parsing so `tree` accepts an empty `path`, while `blob` and `raw` still return `null` without one. Preserve all existing non-root normalization output byte-for-byte.

- [ ] **Step 4: Add the metadata network boundary**

Create `GitProjectRootSourceLoader` as a single-class module. Its `resolve()` method returns descriptors without `metadataApiUrl` unchanged; otherwise it fetches metadata, reports provider-specific availability/network/HTTP/JSON errors, validates the payload is an object, and calls `GitSourceUrlResolver.resolveProjectRootSource(source, payload.default_branch)`.

Complete implementation:

```js
import { GitSourceUrlResolver } from './GitSourceUrlResolver.mjs'

/**
 * Resolves hosted Git repository metadata before root-folder discovery.
 */
export class GitProjectRootSourceLoader {
    /**
     * Resolves repository metadata into a concrete root-folder source.
     * @param {object} source Hosted Git source descriptor.
     * @param {(url: string) => Promise<Response>} fetcher Fetch dependency.
     * @returns {Promise<object>} Concrete folder source.
     */
    static async resolve(source, fetcher) {
        if (!source?.metadataApiUrl) return source

        const providerLabel = GitSourceUrlResolver.getProviderLabel(source)
        if (typeof fetcher !== 'function') {
            throw new Error(
                providerLabel + ' URL loading is not available here.'
            )
        }

        let response
        try {
            response = await fetcher(source.metadataApiUrl)
        } catch (_error) {
            throw new Error(
                'Could not fetch the ' +
                    providerLabel +
                    ' project metadata. The request may be blocked by the network or browser CORS policy.'
            )
        }

        if (!response?.ok) {
            throw new Error(
                providerLabel +
                    ' returned HTTP ' +
                    String(response?.status || 0) +
                    ' for the requested project.'
            )
        }

        let payload
        try {
            payload = await response.json()
        } catch (_error) {
            throw new Error(
                'Could not read the ' + providerLabel + ' project metadata.'
            )
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error(
                'The ' +
                    providerLabel +
                    ' project metadata response is invalid.'
            )
        }

        return GitSourceUrlResolver.resolveProjectRootSource(
            source,
            payload.default_branch
        )
    }
}
```

Import the helper in `GitHubSourceLoader` and resolve the descriptor immediately after `normalizeTreeUrl()` and before `#resolveTreeSource()`. Keep `GitHubSourceLoader.mjs` below 1,000 lines.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
node --test tests/github-source-loader.test.mjs
```

Expected: all hosted-source tests pass, including the new homepage and explicit root-tree regressions.

- [ ] **Step 6: Run formatting and structural checks**

Run:

```bash
npx prettier --write src/GitProjectRootSourceLoader.mjs src/GitSourceUrlResolver.mjs src/GitHubSourceLoader.mjs tests/github-source-loader.test.mjs
node --test tests/github-source-loader.test.mjs tests/project-structure.test.mjs
git diff --check
```

Expected: formatting completes, both suites pass, source/test line-limit checks remain green, and the diff has no whitespace errors.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/GitProjectRootSourceLoader.mjs src/GitSourceUrlResolver.mjs src/GitHubSourceLoader.mjs tests/github-source-loader.test.mjs
git commit -m "fix: load Git project root URLs"
```

---

### Task 2: Documentation, version, and release artifacts

**Files:**

- Modify: `docs/getting-started.md`
- Create: `docs/release-notes-v1.13.26.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: generated `src/*.html` files written by the structured-data synchronizer

**Interfaces:**

- Consumes: project-root URL behavior from Task 1.
- Produces: deployed application metadata and release notes for version `1.13.26`.

- [ ] **Step 1: Update user documentation and release notes**

Change the first-workflow intake text to state that users may paste a public GitHub/GitLab project homepage, blob/raw file URL, or tree folder URL. Add `docs/release-notes-v1.13.26.md` with sections for hosted project loading and verification, including project-home default-branch discovery, explicit root-tree support, and unchanged local browser parsing/privacy behavior.

- [ ] **Step 2: Bump the patch version through npm**

Run:

```bash
npm version 1.13.26 --no-git-tag-version
```

Expected: both `package.json` and the root package-lock entry report `1.13.26`.

- [ ] **Step 3: Synchronize and verify structured data**

Run:

```bash
npm run sync:structured-data
npm run check:structured-data
```

Expected: generated version metadata is synchronized and the drift check exits successfully.

- [ ] **Step 4: Run the full local release gates**

Run:

```bash
npm test
npm run check:structured-data
npm run build:static
git diff --check
```

Expected: all repository tests pass with zero failures, structured data is clean, static deployment builds successfully, and no whitespace errors are reported.

- [ ] **Step 5: Commit Task 2**

```bash
git add docs/getting-started.md docs/release-notes-v1.13.26.md package.json package-lock.json src/*.html
git commit -m "chore: release ECAD Forge 1.13.26"
```

---

### Task 3: Publish and verify release 1.13.26

**Files:**

- No repository files are modified after the verified release commit.
- Create temporary release notes: `/tmp/ecadforge-release-1.13.26.md`

**Interfaces:**

- Consumes: verified `main` commits and version `1.13.26` from Tasks 1 and 2.
- Produces: pushed `origin/main`, GitHub release/tag `v1.13.26`, successful deployment workflow, and live version/behavior evidence.

- [ ] **Step 1: Perform final repository and release review**

Verify the complete diff since `origin/main`, confirm only scoped files are included, check that no unmerged branches are being silently included, and confirm dependency versions were not changed by this scoped release.

- [ ] **Step 2: Push `main` and identify the exact workflow**

Run:

```bash
git push origin main
release_sha=$(git rev-parse HEAD)
gh run list --branch main --commit "$release_sha"
```

Expected: `origin/main` advances to the verified release SHA and the matching `Deploy to FTP (main)` workflow appears.

- [ ] **Step 3: Publish and verify the GitHub release**

Create release notes grounded in the committed diff, then run:

```bash
gh release create v1.13.26 --target main --title "ECAD Forge 1.13.26" --notes-file /tmp/ecadforge-release-1.13.26.md
gh release view v1.13.26 --json tagName,url,isDraft,isPrerelease,name,targetCommitish,publishedAt
git ls-remote --tags origin refs/tags/v1.13.26
```

Expected: a published, non-draft, non-prerelease release targets `main`, and the tag exists remotely.

- [ ] **Step 4: Wait for deployment success**

Run `gh run watch <run-id> --exit-status` for the exact release SHA. Do not call the release deployed unless its conclusion is `success`.

- [ ] **Step 5: Verify LIVE**

Confirm `https://ecadforge.app/api/app-meta` reports `1.13.26`. In a real browser, paste a public generic GitLab project homepage containing a supported ECAD project and verify it progresses beyond URL validation into project loading. Record the observed deployed version, URL behavior, workflow ID/conclusion, release URL, commit SHA, and final clean `git status -sb`.
