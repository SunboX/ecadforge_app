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

Static deployments route extensionless browser URLs to the app shell even when
the URL also matches an asset directory. This keeps direct demo routes such as
`/demo/kicad` and `/demo/altium` crawlable while their nested files continue to
be served as static assets.

Search Console setup is manual: verify `ecadforge.app`, submit
`https://ecadforge.app/sitemap.xml`, inspect the main URLs, and request
indexing after deployment.

Before deployment, run `npm run check:structured-data` to verify the generated
JSON-LD blocks match the current page titles, descriptions, canonical URLs, and
app version. After deployment, validate the live homepage and SEO landing pages
with Google's Rich Results Test and the Schema.org Validator, because local
tests only prove the committed markup shape and deployed validation proves the
pages are crawlable.

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
2. Open a bundled sample from `/demo/kicad`, `/demo/altium`, `/?demo=kicad`, or `/?demo=altium`; paste a public GitHub or GitLab project homepage, blob/raw file URL, or tree folder URL; or drop a standalone native Altium `.SchDoc`/`.PcbDoc` file, a KiCad `.kicad_pro` project with its `.kicad_sch`/`.kicad_pcb` files, a standalone KiCad schematic or PCB file, a KiCad project ZIP, Gerber/Excellon files, a Gerber ZIP archive, or a CircuitJSON `.json` file into the upload zone. KiCad project folders can also be opened from the header, and hosted project folders can include project-local STEP/STP, WRL/VRML, GLB/GLTF, STL, OBJ, and 3MF models for the `3D` view.
3. Wait for the worker-backed parser to finish.
4. Switch between `Schematic`, `PCB`, `3D`, `BOM`, and `Diagnostics`.
5. In the `PCB` view, use the view settings menu to toggle trace lengths, connectivity guides, manufacturing overlays, grouping overlays, and top/bottom components. Hidden component sides are also excluded from hover and bounds candidate previews.
6. Use `Diagnostics` to inspect parser recovery details when a document is only partially understood. PCB diagnostic focus remains visible while you inspect related primitives and moves the viewport to the focused issue.
7. In the `3D` view, Gerber/Excellon packages render as bare-board fabrication scenes. Enable missing-model search only when you want the app to fetch unresolved STEP or WRL models from known KiCad library paths, close same-folder KiCad package matches, or the configured component source.
8. The `3D` view accepts local STEP/STP, WRL/VRML, GLB/GLTF, STL, OBJ, and
   3MF models. GLTF BIN, OBJ MTL, and WRL texture companions resolve from safe
   project-relative document/session assets. Use the `Info` sidebar actions to
   export the whole PCB as one STEP, WRL, GLTF, or GLB assembly. The export
   includes board geometry, copper, silkscreen, pads, vias, supported resolved
   component meshes, fallback bodies, material/vertex colors, and alpha;
   GLTF/GLB downloads can also include rendered board-face artwork textures and
   default camera/light metadata. Mesh-derived exports preserve tessellated
   surfaces, not recovered analytic CAD surfaces.
9. When a board view is available, use the PCB Styler crosslink to continue with board styling in the companion app.

## Sample Corpus

Parser, deterministic renderer, and non-interactive scene-data tests are
validated in the shared toolkit repositories against repo-owned fake fixture
pieces. Update those packages when parser fixture shards or scene-data
expectations change.

The public bundled demos in `src/demo/` are separate from parser test fixtures.
They retain upstream license/source notices and are used only for product
activation and manual exploration.
