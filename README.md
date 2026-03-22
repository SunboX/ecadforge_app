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
- Local Express dev server in `src/server.mjs`
- Shared-hosting PHP metadata endpoint in `api/`

## Project Structure

- `src/core/altium/`: printable-record extraction and normalized Altium parsers
- `src/ui/`: viewer shell and markup renderers
- `src/workers/altium-parser.worker.mjs`: off-main-thread native parsing
- `api/`: deployable PHP metadata endpoint for FTP/shared-hosting deployments
- `tests/`: parser, renderer, state, and structure tests
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

## Test

```bash
npm test
```

The parser tests validate against embedded obfuscated fake fixture shards assembled in `tests/fixtures/AltiumFixtureLoader.mjs`.

## Formatting

```bash
npm run format
```

## License

The source code in this repository is licensed under the
PolyForm Noncommercial License 1.0.0. See [LICENSE](LICENSE)
for the full license text and [NOTICE](NOTICE) for the required
redistribution notices.
