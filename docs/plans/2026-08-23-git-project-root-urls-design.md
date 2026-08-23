# Git Project Root URL Support Design

## Goal

Allow users to paste a public GitHub or GitLab repository homepage, or an
explicit tree URL for the repository root, and load the supported ECAD project
from that root through the existing hosted-folder workflow.

## Scope

- Accept exact GitHub repository home URLs in `https://github.com/owner/repo`
  form.
- Accept exact GitLab project home URLs with any valid namespace depth, such as
  `https://gitlab.com/group/subgroup/project`.
- Accept explicit GitHub and GitLab tree URLs whose branch is present but whose
  folder path is empty.
- Resolve project-home URLs against the provider's real default branch instead
  of assuming `main` or `master`.
- Preserve existing blob, raw, and non-root tree URL behavior.
- Keep private or inaccessible repositories subject to the existing public API
  and browser-fetch constraints.
- Do not add repository-specific filenames, branches, or project identifiers.

## Architecture

`GitSourceUrlResolver` remains responsible for classifying hosted Git URLs and
building provider API descriptors. For explicit tree URLs, it produces the
existing folder descriptor immediately, including an empty root directory path.
For repository home URLs, it produces a descriptor that points to the provider
repository metadata endpoint and identifies the repository path.

`GitHubSourceLoader` remains responsible for network orchestration. When a
descriptor requires default-branch discovery, the loader fetches the metadata,
validates the provider-specific default-branch field, and asks the resolver to
complete a root-folder descriptor. It then passes that descriptor into the
existing folder listing, Altium project-manifest, companion-asset, and source
selection pipeline.

This keeps URL parsing synchronous and deterministic while keeping HTTP work in
the loader's existing injected-fetch boundary.

## Provider Data Flow

For GitHub project homes:

1. Recognize exactly two decoded path segments: owner and repository.
2. Fetch `https://api.github.com/repos/{owner}/{repo}`.
3. Read the non-empty `default_branch` value.
4. Build the root Contents API URL with that ref.
5. Continue through existing GitHub folder discovery and rate-limit checks.

For GitLab project homes:

1. Treat the complete decoded pathname as the namespaced project path.
2. Fetch `https://gitlab.com/api/v4/projects/{encoded-project-path}`.
3. Read the non-empty `default_branch` value.
4. Build the root Repository Tree API URL with an empty `path` and the resolved
   ref.
5. Continue through existing GitLab folder and Altium project discovery.

Explicit tree URLs skip metadata discovery because the ref is already present.

## Validation and Errors

- Blob and raw URLs still require a non-empty file path.
- Tree URLs require a provider, repository/project path, action, and ref, but an
  empty folder path is valid.
- GitHub paths with more or fewer than two homepage segments are not classified
  as project homes.
- GitLab worktree URLs continue to use the `/-/` separator, while project-home
  URLs must not contain that separator.
- Missing or empty default-branch metadata produces a clear provider-specific
  error before folder discovery.
- Existing HTTP failure reporting is reused for missing, private, or inaccessible
  repositories.

## Tests

Regression tests use only generic fake repository names and injected fetch
responses. They cover:

- GitHub project-home loading with a nonstandard default branch.
- GitLab nested-group project-home loading with a nonstandard default branch.
- GitHub and GitLab explicit root-tree URL loading without metadata requests.
- Root-level Altium project-manifest discovery through the existing project
  loader.
- Continued rejection of malformed worktree URLs and blob/raw URLs without a
  file path.
- Continued behavior for existing file URLs and non-root folder URLs.

The release also runs the complete repository suite, structured-data drift
check, and static deployment build.

## Release

Increment the patch version from `1.13.25` to `1.13.26`, synchronize generated
structured data, commit the implementation and generated HTML, push `main`,
publish GitHub release `v1.13.26`, wait for the matching deployment workflow,
and verify the live version and representative GitLab project-home load.
