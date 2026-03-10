# Altium Viewer

Browser-based viewer for standalone native Altium `.SchDoc` and `.PcbDoc` files.

## Features

- Client-side parsing for native Altium files with no server-side preprocessing
- Schematic SVG view derived from recovered record geometry and text
- PCB SVG view with recovered board outline, layer stack, and component placements
- BOM grouping from recovered component metadata
- 3D-style board summary view and parser diagnostics tab
- Worker-backed parse flow with main-thread fallback
- Local Express dev server in `src/server.mjs`

## Project Structure

- `src/core/altium/`: printable-record extraction and normalized Altium parsers
- `src/ui/`: viewer shell and markup renderers
- `src/workers/altium-parser.worker.mjs`: off-main-thread native parsing
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

Open `http://localhost:3000/` and load a native `.SchDoc` or `.PcbDoc` file.

## Test

```bash
npm test
```

The parser tests validate against the repo-owned fake fixtures in `tests/fixtures/altium/`.

## Formatting

```bash
npm run format
```
