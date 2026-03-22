# Obfuscated Altium Shards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace checked-in native Altium fixture files with embedded obfuscated record shards while preserving parser and renderer regression coverage.

**Architecture:** The test loader will decode obfuscated printable-record shards and assemble minimal fake `.SchDoc` and `.PcbDoc` buffers in memory. Parser and renderer tests will be tightened to exact behaviors that those reduced fixtures exercise, and the native fixture directory will be removed.

**Tech Stack:** Node.js, native `node:test`, ECMAScript modules, test-owned Altium printable record streams

---

### Task 1: Lock the embedded-fixture contract

**Files:**
- Modify: `tests/core/altium-parser.test.mjs`
- Modify: `tests/ui/renderers.test.mjs`

**Step 1: Write the failing test**

Add assertions that the suite no longer depends on broad external native samples and instead targets exact parser behaviors from the reduced fixtures.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL until the reduced fixtures and updated expectations agree.

**Step 3: Write minimal implementation**

Rewrite or narrow the sample-sized assertions to match behavior-specific fake fixtures.

**Step 4: Run test to verify it passes**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS

### Task 2: Replace native fixture files with embedded obfuscated shards

**Files:**
- Modify: `tests/fixtures/AltiumFixtureLoader.mjs`
- Delete: `tests/fixtures/altium/Skylace-Dawn.SchDoc`
- Delete: `tests/fixtures/altium/Skylace-Moon.SchDoc`
- Delete: `tests/fixtures/altium/Skylace-Nova.SchDoc`
- Delete: `tests/fixtures/altium/Skylace-Cinder.SchDoc`
- Delete: `tests/fixtures/altium/Skylace-Forge.PcbDoc`

**Step 1: Write the failing test**

Make the loader contract rely on in-memory fixture assembly rather than disk-backed URLs.

**Step 2: Run test to verify it fails**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: FAIL once the disk-backed files are removed.

**Step 3: Write minimal implementation**

Embed only the required obfuscated record shards in the loader, decode them, and assemble the fake schematic/PCB buffers in memory.

**Step 4: Run test to verify it passes**

Run: `node --test tests/core/altium-parser.test.mjs tests/ui/renderers.test.mjs`
Expected: PASS

### Task 3: Align docs and repository guidance

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/getting-started.md`
- Modify: `package.json`

**Step 1: Write the failing test**

Use repo searches plus the full suite as the contract.

**Step 2: Run test to verify it fails**

Run: `rg -n "tests/fixtures/altium|native Altium fixture|fixture URL" AGENTS.md docs tests`
Expected: FAIL while active docs still point to deleted fixture files.

**Step 3: Write minimal implementation**

Update the active docs and guidance to describe embedded obfuscated test data, then bump the version.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS
