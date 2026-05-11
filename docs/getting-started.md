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

## Analytics

- The app loads the centralized cookieless tracker from `https://analytics.andrefiedler.de/tracker.js`.
- The public site key is `ecadforge_app`.
- Register each deployed browser origin in the Analytics `analytics_sites` table or dashboard before expecting events. The production row should use the deployed app origin and public key `ecadforge_app`.

```sql
INSERT INTO analytics_sites (name, allowed_origin, public_key, active, created_at)
VALUES ('ECAD Forge', 'https://your-ecad-forge-origin.example', 'ecadforge_app', 1, UTC_TIMESTAMP());
```

## Test

```bash
npm test
```

## First Workflow

1. Open the app in the browser.
2. Drop a standalone native Altium `.SchDoc`/`.PcbDoc` file, a KiCad `.kicad_pro` project with its `.kicad_sch`/`.kicad_pcb` files, a standalone KiCad schematic or PCB file, or a KiCad project ZIP into the upload zone. KiCad project folders can also be opened from the header.
3. Wait for the worker-backed parser to finish.
4. Switch between `Schematic`, `PCB`, `3D`, `BOM`, and `Diagnostics`.
5. Use `Diagnostics` to inspect parser recovery details when a document is only partially understood.

## Sample Corpus

Parser and deterministic renderer tests are validated in the shared
`@sunbox/altium-toolkit` and `@sunbox/kicad-toolkit` repositories against
repo-owned fake fixture pieces. Update those packages when parser fixture
shards or expectations change.
