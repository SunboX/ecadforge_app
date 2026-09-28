# WebMCP net-name failure investigation

The supplied analytics exports cover September 21–28, 2026 (UTC), despite the
September 21 filename suffix. The WebMCP report contains six completed calls:
five successes and one `list_nets` failure in ECAD Forge 1.13.45. The failure used
the native runtime, object-form API, an explicit design selector, and first-page
pagination. It completed in 1 ms with `error_bucket: missing_data`. No tool
registration failures or unfinished calls are reported.

The reported transition sequence is `list_designs` → `summarize_pcb` →
`list_nets` → `list_diagnostics`. This suggests the agent was inspecting a PCB.
The exports deliberately exclude tool arguments, selected document identity,
and raw returned errors. They therefore cannot establish which document was
selected or whether that particular document contained declared nets. The
separate JavaScript error recordings concern older 1.13.43 worker failures;
they do not establish a WebMCP runtime crash.

## Reproduced cause and correction

Both Altium and KiCad `LoadedDesignNetlistService.listNets()` previously required
a nonempty schematic pin graph. That graph ignores PCB net tables and only
includes schematic nets with resolvable component pins. Consequently, a PCB
with declared nets returned `No schematic connectivity is available for this
loaded design.`, classified by the app as `missing_data`. Named schematic nets
without pins were also omitted. `searchNets()` had the same restriction.

The correction is in the sibling toolkit repositories. Listing and searching
read the selected native document's declared schematic and PCB net tables,
including retained native envelopes. Names are trimmed and deduplicated before
existing sorting, regex filtering, and app pagination. Schematic traversal and
`hasConnectivity` retain their pin-graph semantics. Missing designs, ambiguous
selectors, and missing net data remain errors.

Regression tests use only synthetic data. They cover raw and retained PCB
models, named schematic nets without pins, duplicate/blank names, selector
isolation, regex handling, pagination, cancellation, and privacy-safe telemetry
through the registered ECAD Forge tools. The tests reproduced the old failure
before the implementation was changed.

## Release integration

ECAD Forge 1.13.46 incorporates the correction through registry releases
`altium-toolkit@1.4.19` and `kicad-toolkit@1.3.7`. The package lock must resolve
those released artifacts; local tarballs and sibling-directory links are not
release dependencies.

The app release starts from v1.13.45 and includes only the WebMCP fix,
regression tests, documentation, version metadata, and these two dependency
updates. The plugin system, account registration/login, and PDF-export work on
`codex/plugins-apphub-pdf-20260925` is excluded. No branches are merged.

## Verification

- Altium `npm test`: 959 passed, 1 skipped, 0 failed.
- KiCad `npm test`: 488 passed, 0 failed, including packed API compatibility.
- ECAD Forge `npm test` with the released toolkit packages: 1,035 passed, 0 failed.
- `npm run check:structured-data` and `npm run build:static`: passed; the static
  output contains both corrected toolkit services.
- Formatting of changed JavaScript and `git diff --check` in all three
  repositories: passed.
