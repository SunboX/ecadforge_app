# ECAD Forge 1.13.45

Version 1.13.45 updates the browser app to the released parser and 3D worker
fixes for reported JavaScript errors.

- CircuitJSON Toolkit 1.4.4 forwards native worker failures when a browser
  dispatches a plain error event.
- PCB Scene3D Viewer 1.3.6 reports failed STEP worker results, permits a later
  retry, and requires the matching OCCT worker release.
- `@sunbox/occt-import-js` 0.0.29 sends importer and WASM fetch failures back
  to the current request instead of leaving an uncaught worker exception.

The app version moves from 1.13.44 to 1.13.45. Structured data is synchronized
with the new version. The 1.13.44 support and agent reporting features remain
available.

Validation: all 1,033 app tests pass; structured-data checking and the static
deployment build pass. npm resolves one shared OCCT 0.0.29 installation.
