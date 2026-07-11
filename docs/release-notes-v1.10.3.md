# ECAD Forge 1.10.3

Version 1.10.3 completes the browser-worker compatibility fix for released
KiCad projects while keeping the app on the common CircuitJSON-first API.

- Updates `circuitjson-toolkit` to 1.1.1 and `kicad-toolkit` to 1.1.3.
- KiCad `.kicad_pro`, `.kicad_sch`, and `.kicad_pcb` project entries now load
  through the worker with the same public `{ name, data, assets? }` shape used
  by direct loading.
- Full binary companion assets survive worker cloning, while `none`,
  `metadata`, and `full` asset modes keep identical archive-limit accounting.
- Accepted queued worker requests snapshot their inputs immediately, so later
  caller mutation cannot change the eventual parse. Explicit transfer mode
  still detaches the exact caller-owned buffers.
- The production KiCad demo no longer fails with `KiCad project entry asset
snapshots are invalid`.

No app-side adapter, private transport field, copied parser logic, or
source-specific workaround is used. ECAD Forge consumes the released toolkit
APIs directly.
