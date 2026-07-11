# ECAD Forge

Browser-based viewer for Altium, KiCad, Gerber, and CircuitJSON design files.

Open schematics, inspect PCB layouts and Gerber fabrication layers, and explore interactive 3D boards directly in your browser. Altium `.SchDoc`/`.PcbDoc` files, KiCad `.kicad_pro`, `.kicad_sch`, `.kicad_pcb`, folder selections, KiCad ZIP projects, Gerber/Excellon files, Gerber ZIP archives, and CircuitJSON `.json` files are supported and parsed locally.

LIVE: [https://ecadforge.app/](https://ecadforge.app/)

## Features

- Client-side parsing for Altium, KiCad, Gerber/Excellon, and CircuitJSON files with no server-side preprocessing
- Bundled Altium and KiCad demo projects with preserved third-party license notices
- GitHub raw/blob URL loading for supported ECAD files, Gerber/Excellon files, CircuitJSON JSON, and KiCad project triplets
- Schematic SVG view derived from recovered record geometry, text, symbols, and highlightable nets
- PCB SVG view with recovered board outline, layer stack, fabrication layers, component placements, aligned and knockout PCB text, reset/fit viewport control, top/bottom component filters, in-board view settings, persistent diagnostic focus, optional rats-nest connectivity, trace-length budget labels, solder-mask/paste inspection layers, source-net group metadata, group/anchor-offset overlays, bounds measurement zoom/selection, clipped SVG/PNG bounds export, and highlightable nets where available
- BOM grouping from recovered component metadata
- Interactive 3D PCB viewer with pan, orbit, zoom, bare-board Gerber
  fabrication scenes with canonical plated-slot geometry, embedded STEP
  extraction, and companion-model lookup for
  STEP/STP, WRL/VRML, GLB/GLTF, STL, OBJ, and 3MF assets. Safe local GLTF BIN,
  OBJ MTL, and WRL texture companions resolve directly; remote model loading
  remains opt-in. Single-file PCB assembly export supports STEP, WRL, GLTF, or
  GLB with board, copper, silkscreen, pads, vias, resolved or fallback 3D
  components, material alpha/colors, and optional board-face artwork textures.
- WebMCP runtime and read-only tools for querying designs already loaded in the current session
- Worker-backed parse flow with main-thread fallback and a local SPICE simulation worker boundary that returns CircuitJSON experiment output
- KiCad browser workers accept the same public project entries as direct
  loading, including complete multi-file projects and binary companion assets;
  queued worker requests snapshot accepted input without app-side transport
  fields or compatibility adapters
- Runtime language switching with browser detection and Brazilian Portuguese support
- Converged parser, renderer, query, interaction, and scene APIs from
  `altium-toolkit`, `kicad-toolkit`, `gerber-toolkit`, and
  `circuitjson-toolkit`, with reusable CircuitJSON document contexts
- Normal intake calls the same common `Parser` and `ProjectLoader` contracts
  for every format; ZIP expansion, project context, and validation remain in
  the source libraries rather than app compatibility shims
- Independent toolkit project groups parse concurrently while their documents,
  diagnostics, and assets keep deterministic toolkit order
- Canonical Altium and KiCad schematic graphics—including paths, text frames,
  tables, hierarchy sheet symbols, and asset-backed images—render directly
  through the shared CircuitJSON renderer; app state never receives copied
  legacy `schematic` or `pcb` fields
- Altium project strings, image bytes, and hidden component designators are
  resolved by the toolkit projection; retained native extensions remain
  available only to callers that explicitly request source-specific APIs
- Canonical CAD model metadata and document/session assets flow directly into
  `pcb-scene3d-viewer` without URL-promotion or resolver wrappers in the app
- STEP rendering uses the installed `@sunbox/occt-import-js` JavaScript, WASM,
  and package-owned worker directly; local and static servers expose the same
  scoped package path without app-vendored copies or a custom worker
- Local and hosted Altium, KiCad, and CircuitJSON project parsing retains
  canonical model assets in full; directory companions and ZIP members keep
  their exact bytes, project-relative paths, and source identity
- KiCad `${KIPRJMOD}` model references arrive as canonical `cad_component`
  rows linked to exact project asset paths. Multiple visible models retain
  separate rows; parsed board thickness determines top/bottom surface height,
  while board placement stays separate from model-local transforms
- Gerber ZIP detection claims only real fabrication packages, leaving KiCad ZIP
  projects on the KiCad loader path
- Local, folder, project, and session intake recognizes 3MF and `.vrml` as
  first-class companion-model formats before handing exact source bytes to the
  viewer
- Exact source paths keep same-basename model assets distinct while repeated
  placements and explicitly fetched assets share viewer-owned caches
- Local Express dev server in `src/server.mjs`

## Project Structure

- `altium-toolkit`: printable-record extraction, normalized Altium parsers, schematic SVG, PCB SVG, BOM HTML, and complete non-interactive 3D scene-description utilities
- `kicad-toolkit`: KiCad 9 S-expression parsing, project loading, schematic/PCB normalization, BOM generation, renderers, and complete data-only 3D scene helpers
- `gerber-toolkit`: Gerber/Excellon project loading, ZIP expansion, fabrication-layer normalization, deterministic SVG rendering, bare-board 3D scene data, and PCB interaction helpers
- `circuitjson-toolkit`: CircuitJSON document loading plus local SPICE transient experiment helpers for standards-native board, assembly, and simulation data
- `src/ui/`: viewer shell and interaction controllers
- `src/core/ecad/`: app-owned format registry plus parser, renderer, and scene facades
- `src/core/simulation/`: app-owned simulation worker client and message handler
- `src/core/webmcp/`: read-only loaded-session WebMCP adapter, tool registry, and toolkit-backed netlist query dispatcher
- `src/demo/`: bundled demo project files plus source and license notices
- `src/workers/ecad-parser.worker.mjs`: off-main-thread native parsing
- `src/workers/spice-simulation.worker.mjs`: off-main-thread local SPICE transient simulation
- `scripts/build-static-deploy.mjs`: Apache/shared-hosting frontend artifact builder
- `tests/`: app state, server, interaction, and structure tests
- `docs/`: architecture, setup, testing, security, troubleshooting
- `spec/`: product scope and acceptance criteria

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Testing](docs/testing.md)
- [Security](docs/security.md)
- [WebMCP](docs/webmcp.md)
- [Troubleshooting](docs/troubleshooting.md)
- [1.10.3 release notes](docs/release-notes-v1.10.3.md)
- [1.10.2 release notes](docs/release-notes-v1.10.2.md)
- [1.10.1 release notes](docs/release-notes-v1.10.1.md)
- [1.10.0 release notes](docs/release-notes-v1.10.0.md)
- [Specification](spec/web-app-specification.md)

## Start

```bash
npm install
npm start
```

Open `http://localhost:3000/` and load one or more native Altium
`.SchDoc`/`.PcbDoc` files, KiCad `.kicad_pro`/`.kicad_sch`/`.kicad_pcb` files,
KiCad project ZIPs, Gerber/Excellon files, Gerber ZIP archives, CircuitJSON
`.json` files, or companion STEP/STP, WRL/VRML, GLB/GLTF, STL, OBJ, and 3MF
files. KiCad projects can also be selected as folders from the header.

Demo projects are available at `/demo/kicad`, `/demo/altium`, `/?demo=kicad`, and `/?demo=altium`. GitHub-hosted files can be opened with `/?url=<raw-or-github-blob-url>` or `/?github=owner/repo/path/to/file&ref=<optional-ref>` when the remote host allows browser fetching. Share links can also include `view=<tab>`, `document=<loaded-file-path>`, `component=<designator>`, and `net=<net-name>` to restore the active tab, document, selected component, and selected net.

Production deployment is available at [https://ecadforge.app/](https://ecadforge.app/).

## WebMCP

ECAD Forge loads the `@mcp-b/global` WebMCP runtime with same-origin transport
options, preserving native browser WebMCP when present and providing the
package runtime when native support is unavailable. It then registers read-only
tools for the designs already loaded in the current session. Agents can list
loaded designs, components, nets, search metadata, review coverage, audit
metadata/connectivity issues, cross-reference schematic nets against PCB pads,
compare schematic/PCB parity, query BOM rows, list component pins, query
direct nets, list diagnostics, compare BOM/PCB coverage, query component pins,
inspect PCB placements, PCB net geometry, board summaries, design rules, and
fabrication-readiness signals, and trace extended connectivity without
uploading files or scanning local paths. The adapter uses the current
`document.modelContext` API. The app shell carries the production WebMCP
origin-trial token for `https://ecadforge.app/`, and served/deployed responses
apply the same-origin `tools` permissions policy. Netlist extraction, search
validation, component grouping, and traversal rules are delegated to the Altium
and KiCad toolkit query APIs; the app WebMCP layer owns session-level review,
audit, BOM/component search, cross-reference, PCB inspection, focused
inspection summaries, and pagination summaries.

See [WebMCP](docs/webmcp.md) for tool names, arguments, examples, privacy
constraints, and unsupported browser-only operations.

## Deploy

```bash
npm run build:static
```

The static build writes `.deploy-src/` with versioned browser module URLs and an Apache cache policy. The FTP workflow uploads that artifact to the LIVE document root.

## Test

```bash
npm test
```

Parser, deterministic renderer, and non-interactive scene-data tests live in the shared toolkit repositories. This app test suite covers app state, server behavior, interaction controllers, and ECAD Forge integration.

Privacy-safe activation events are emitted through the optional centralized tracker when present. Event properties intentionally exclude file names, raw URLs, file contents, and other personal data.

## Formatting

```bash
npm run format
```

## License

This project is available under two licensing options.

### 1. Open-source license

GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`).

You may use, modify, and distribute this project under the AGPL. If you modify
the software and make it available to users over a network, the AGPL requires
that those users can access the corresponding source code of the modified
version.

### 2. Commercial/proprietary license

For use in closed-source, proprietary, or otherwise AGPL-incompatible products,
a separate commercial license is required.

Commercial licensing contact: https://github.com/SunboX

### Attribution / notices

Copyright (C) 2026 André Fiedler.

Copyright, license, attribution, and source-origin notices must be preserved as
required by the AGPL and the notice files in this repository.

Documentation and non-code media are licensed under Creative Commons
Attribution-ShareAlike 4.0 (`CC-BY-SA-4.0`) where marked in `.reuse/dep5`.
Package-manager dependencies retain their own licenses and notices. The
installed OCCT importer preserves its LGPL notices and Open CASCADE exception
under `node_modules/@sunbox/occt-import-js/dist/`; source links are recorded in
`NOTICE.md`.
