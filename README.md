# ECAD Forge

Browser-based viewer for native Altium and KiCad schematics, PCB files, and KiCad projects.

Open schematics, inspect PCB layouts, and explore interactive 3D boards directly in your browser. Altium `.SchDoc`/`.PcbDoc` files and KiCad `.kicad_pro`, `.kicad_sch`, `.kicad_pcb`, folder selections, and ZIP projects are now supported and parsed locally.

LIVE: [https://ecadforge.app/](https://ecadforge.app/)

## Features

- Client-side parsing for native Altium and KiCad files with no server-side preprocessing
- Bundled Altium and KiCad demo projects with preserved third-party license notices
- GitHub raw/blob URL loading for supported native ECAD files and KiCad project triplets
- Schematic SVG view derived from recovered record geometry and text
- PCB SVG view with recovered board outline, layer stack, and component placements
- BOM grouping from recovered component metadata
- Interactive 3D PCB viewer with pan, orbit, zoom, embedded STEP extraction, and companion-model lookup
- Browser-native WebMCP tools for querying designs already loaded in the current session
- Worker-backed parse flow with main-thread fallback
- Shared parser, renderer, and non-interactive 3D scene-data cores from `altium-toolkit` and `kicad-toolkit`
- Local Express dev server in `src/server.mjs`

## Project Structure

- `altium-toolkit`: printable-record extraction, normalized Altium parsers, schematic SVG, PCB SVG, BOM HTML, and complete non-interactive 3D scene-description utilities
- `kicad-toolkit`: KiCad 9 S-expression parsing, project loading, schematic/PCB normalization, BOM generation, renderers, and complete data-only 3D scene helpers
- `src/ui/`: viewer shell and interaction controllers
- `src/core/ecad/`: app-owned format registry plus parser, renderer, and scene facades
- `src/core/webmcp/`: read-only loaded-session WebMCP adapter, tool registry, and toolkit-backed netlist query dispatcher
- `src/demo/`: bundled demo project files plus source and license notices
- `src/workers/ecad-parser.worker.mjs`: off-main-thread native parsing
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
- [Specification](spec/web-app-specification.md)

## Start

```bash
npm install
npm start
```

Open `http://localhost:3000/` and load one or more native Altium `.SchDoc`/`.PcbDoc` files, KiCad `.kicad_pro`/`.kicad_sch`/`.kicad_pcb` files, KiCad project ZIPs, companion `WRL`, or companion `STEP` files. KiCad projects can also be selected as folders from the header.

Demo projects are available at `/demo/kicad`, `/demo/altium`, `/?demo=kicad`, and `/?demo=altium`. GitHub-hosted files can be opened with `/?url=<raw-or-github-blob-url>` or `/?github=owner/repo/path/to/file&ref=<optional-ref>` when the remote host allows browser fetching.

Production deployment is available at [https://ecadforge.app/](https://ecadforge.app/).

## WebMCP

When the browser provides native WebMCP support, ECAD Forge registers read-only
tools for the designs already loaded in the current session. Agents can list
loaded designs, components, nets, search metadata, query component pins, and
trace extended connectivity without uploading files or scanning local paths.
Netlist extraction, search validation, component grouping, and traversal rules
are delegated to the Altium and KiCad toolkit query APIs.

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

Parser, deterministic renderer, and non-interactive scene-data tests live in the shared `altium-toolkit` and `kicad-toolkit` repositories. This app test suite covers app state, server behavior, interaction controllers, and ECAD Forge integration.

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
Vendored third-party artifacts and package-manager dependencies retain their
own licenses and notices.
