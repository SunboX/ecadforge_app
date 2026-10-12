# ECAD Forge 1.13.48

This patch updates CircuitJSON Toolkit from 1.4.4 to exactly 1.4.5. Browsers that
expose classic workers but ignore module-worker options now use the existing
direct parser fallback in automatic mode. Explicit worker requests still report
an error when module workers are unavailable.

A real Chromium regression uses a small fake KiCad schematic and the installed
parser packages. It failed with 1.4.4 and passes with 1.4.5. The existing OCCT
0.0.29 and ErrorEvent handling fixes remain in place.

The release is based on public 1.13.47 and retains its already-published WebMCP
comparison exports. This release adds only error investigation, parser
compatibility coverage, and dependency/version updates. In-progress account,
subscription, private-plugin, and PDF work remain on development branches.
