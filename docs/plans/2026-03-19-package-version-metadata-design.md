# Package Version Metadata Design

**Problem**

The deployed app version is duplicated in both `package.json` and `api/app-version.json`. That duplicate metadata adds manual release work and creates drift risk whenever one file is updated without the other.

**Chosen Approach**

Make `package.json` the single source of truth for runtime version metadata. Both the local Node metadata endpoint and the PHP fallback endpoint should read only `package.json` and return its `version` field.

Remove `api/app-version.json` from the repository and from the expected deployment footprint so LIVE no longer depends on a separately maintained metadata file.

**Runtime Impact**

The browser will continue to load version metadata from `/api/app-meta` and fall back to `/api/app-meta.php` on PHP-only hosts. The response shape stays the same: `{ "version": "<package version>" }`.

Only the metadata source changes. No frontend consumer changes are required.

**Testing**

Regression coverage should verify:

- the project structure no longer requires `api/app-version.json`
- the PHP metadata endpoint returns the version from `package.json`
- the Node metadata endpoint still returns the deployed version through `/api/app-meta`
- documentation and specs describe `package.json` as the only version source
