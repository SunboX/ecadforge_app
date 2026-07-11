# ECAD Forge 1.10.1

Version 1.10.1 completes the exact published API-layout parity promised by the
1.10.0 convergence release.

- Updates `kicad-toolkit` to 1.1.1.
- `kicad-toolkit/parser` now exposes the same ten exports as the CircuitJSON,
  Gerber, and Altium parser entrypoints, including
  `CircuitJsonDocumentContext`.
- `kicad-toolkit/project` now exposes the same five exports as the other
  project entrypoints, including `ZipArchiveInspector`.
- ECAD Forge now compares every public key and shared helper identity on every
  common toolkit subpath, preventing a locally linked package from masking a
  packed or registry-layout mismatch.

No parser behavior, document shape, project result, or native KiCad extension
was removed or changed by this patch.
