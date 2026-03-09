# Getting Started

## Prerequisites

- Node.js 20+
- npm

## Install

```bash
npm install
```

## Start

```bash
npm start
```

Open [http://localhost:3000/](http://localhost:3000/).

## Test

```bash
npm test
```

## First Workflow

1. Open the app in the browser.
2. Drop a standalone native `.SchDoc` or `.PcbDoc` file into the upload zone.
3. Wait for the worker-backed parser to finish.
4. Switch between `Schematic`, `PCB`, `3D`, `BOM`, and `Diagnostics`.
5. Use `Diagnostics` to inspect parser recovery details when a document is only partially understood.

## Sample Corpus

The current parser tests are validated against the files you provided:

- `/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01A.SchDoc`
- `/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.08.PcbDoc`

If these files move, update `tests/core/altium-parser.test.mjs`.
