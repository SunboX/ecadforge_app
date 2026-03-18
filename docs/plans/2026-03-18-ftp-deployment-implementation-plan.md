# FTP Deployment Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a GitHub Actions FTP deployment workflow for this repository that matches the existing `labelprinter_app` deployment pattern.

**Architecture:** Create one `main` branch workflow that detects dependency, source, and docs changes, then deploys only the affected directories to the expected FTP destinations. Keep the app version metadata in sync by incrementing both package manifests.

**Tech Stack:** GitHub Actions, YAML, npm, SamKirkland FTP Deploy Action, dorny paths-filter

---

### Task 1: Document the approved deployment design

**Files:**

- Create: `docs/plans/2026-03-18-ftp-deployment-design.md`
- Create: `docs/plans/2026-03-18-ftp-deployment-implementation-plan.md`

**Step 1: Write the approved design summary**

Describe the trigger, path filters, FTP target layout, secret names, and the decision to omit any `api` deployment step.

**Step 2: Save the implementation plan**

List the workflow file creation, version bump, and verification commands needed for this repository.

### Task 2: Add the FTP deployment workflow

**Files:**

- Create: `.github/workflows/deploy-ftp.yml`

**Step 1: Copy the reference workflow structure**

Use `labelprinter_app/.github/workflows/deploy-ftp.yml` as the template shape.

**Step 2: Remove unused deploy targets**

Keep `deps`, `src`, and `docs` filtering, but omit the `api` filter and deployment step because this repository has no `api/` directory.

**Step 3: Keep the FTP contract identical**

Use `FTP_SERVER`, `FTP_USERNAME`, and `FTP_PASSWORD`, deploy `src/` to `/`, `docs/` to `/docs/`, and `node_modules/` to `/node_modules/`.

### Task 3: Increment repository version metadata

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Increment the patch version**

Update `1.1.135` to `1.1.136` in `package.json`.

**Step 2: Mirror the version in the lockfile**

Update the top-level `version` fields in `package-lock.json` so deployment metadata stays consistent.

### Task 4: Verify the change

**Files:**

- Verify: `.github/workflows/deploy-ftp.yml`
- Verify: `package.json`
- Verify: `package-lock.json`

**Step 1: Run formatting verification**

Run: `npm run check:format -- .github/workflows/deploy-ftp.yml docs/plans/2026-03-18-ftp-deployment-design.md docs/plans/2026-03-18-ftp-deployment-implementation-plan.md package.json package-lock.json`

Expected: Prettier reports all listed files are formatted correctly.

**Step 2: Run the repository test suite**

Run: `npm test`

Expected: Existing tests pass with exit code `0`.
