# ECAD Forge

Browser-based viewer for standalone native Altium `.SchDoc` and `.PcbDoc` files.

Open schematics, inspect PCB layouts, and explore interactive 3D boards directly in your browser. The 3D tab works from a lone `.PcbDoc`, including embedded STEP payloads stored inside the board file, and can also resolve companion `WRL` and `STEP` models when you load additional matching files.

LIVE: [https://ecadforge.app/](https://ecadforge.app/)

## Features

- Client-side parsing for native Altium files with no server-side preprocessing
- Schematic SVG view derived from recovered record geometry and text
- PCB SVG view with recovered board outline, layer stack, and component placements
- BOM grouping from recovered component metadata
- Interactive 3D PCB viewer with pan, orbit, zoom, embedded STEP extraction, and companion-model lookup
- Worker-backed parse flow with main-thread fallback
- Shared Altium parser and non-interactive renderer core from `@sunbox/altium-toolkit`
- Local Express dev server in `src/server.mjs`
- Shared-hosting PHP metadata endpoint in `api/`

## Project Structure

- `@sunbox/altium-toolkit`: printable-record extraction, normalized Altium parsers, schematic SVG, PCB SVG, BOM HTML, and non-interactive 3D scene-description utilities
- `src/ui/`: viewer shell and interaction controllers
- `src/workers/altium-parser.worker.mjs`: off-main-thread native parsing
- `scripts/build-static-deploy.mjs`: Apache/shared-hosting frontend artifact builder
- `api/`: deployable PHP metadata endpoint for FTP/shared-hosting deployments
- `tests/`: app state, server, interaction, and structure tests
- `docs/`: architecture, setup, testing, security, troubleshooting
- `spec/`: product scope and acceptance criteria

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Testing](docs/testing.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Specification](spec/web-app-specification.md)

## Start

```bash
npm install
npm start
```

Open `http://localhost:3000/` and load one or more native `.SchDoc`, `.PcbDoc`, companion `WRL`, or companion `STEP` files. The 3D view will use any STEP payloads embedded in the `.PcbDoc` itself, and you can also load matching companion model files in the same selection to improve model fidelity further.

Production deployment is available at [https://ecadforge.app/](https://ecadforge.app/).

## Deploy

```bash
npm run build:static
```

The static build writes `.deploy-src/` with versioned browser module URLs and an Apache cache policy. The FTP workflow uploads that artifact to the LIVE document root.

## Test

```bash
npm test
```

Parser and deterministic renderer tests live in the shared `@sunbox/altium-toolkit` repository. This app test suite covers app state, server behavior, interaction controllers, and ECAD Forge integration.

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
