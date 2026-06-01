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

## Search Indexing

The production origin is [https://ecadforge.app/](https://ecadforge.app/).
The app publishes canonical URLs and OpenGraph metadata in the HTML shell and
SEO landing pages, allows crawling through `/robots.txt`, and exposes
`/sitemap.xml` for the app shell, public view URLs, and ECAD-specific landing
pages.

Search Console setup is manual: verify `ecadforge.app`, submit
`https://ecadforge.app/sitemap.xml`, inspect the main URLs, and request
indexing after deployment.

## Analytics

- The browser entrypoint loads the centralized cookieless tracker from `https://analytics.andrefiedler.de/tracker.js` only on deployed HTTP(S) origins. Localhost, file URLs, and private-network dev origins do not load the production tracker.
- The public site key is `ecadforge_app`.
- Register each deployed browser origin in the Analytics `analytics_sites` table or dashboard before expecting events. The production row should use the deployed app origin and public key `ecadforge_app`.
- Activation events are privacy-safe and only send coarse properties such as source type, format family, active view, and error bucket.

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
2. Open a bundled sample from `/demo/kicad`, `/demo/altium`, `/?demo=kicad`, or `/?demo=altium`; paste a supported GitHub raw/blob file URL or GitHub tree folder URL; or drop a standalone native Altium `.SchDoc`/`.PcbDoc` file, a KiCad `.kicad_pro` project with its `.kicad_sch`/`.kicad_pcb` files, a standalone KiCad schematic or PCB file, or a KiCad project ZIP into the upload zone. KiCad project folders can also be opened from the header, and GitHub project folders can include project-local KiCad `STEP`/`WRL` models for the `3D` view.
3. Wait for the worker-backed parser to finish.
4. Switch between `Schematic`, `PCB`, `3D`, `BOM`, and `Diagnostics`.
5. Use `Diagnostics` to inspect parser recovery details when a document is only partially understood.
6. When a board view is available, use the PCB Styler crosslink to continue with board styling in the companion app.

## Sample Corpus

Parser, deterministic renderer, and non-interactive scene-data tests are validated in the shared
`altium-toolkit` and `kicad-toolkit` repositories against
repo-owned fake fixture pieces. Update those packages when parser fixture
shards or scene-data expectations change.

The public bundled demos in `src/demo/` are separate from parser test fixtures.
They retain upstream license/source notices and are used only for product
activation and manual exploration.
