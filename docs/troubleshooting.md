# Troubleshooting

## Server does not start (EADDRINUSE)

Use a different port:

```bash
PORT=3100 npm start
```

## Browser loads a blank page

- Check console for module import errors.
- Verify `src/main.mjs` exists and matches the script tag in `src/index.html`.
- Confirm the browser supports module workers.
- If the console reports `Failed to resolve module specifier "fflate"`, confirm the import map in `src/index.html` includes `fflate` and the deployed site serves `/node_modules/fflate/esm/browser.js`.
- If the console reports `Failed to resolve module specifier "@sunbox/altium-toolkit"`, confirm `npm install` has installed the toolkit package and the deployed site serves `/node_modules/@sunbox/altium-toolkit/`.

## LIVE 3D tab returns `404` for Three.js or STEP assets

- Confirm the deployed page still contains the `importmap` block from `src/index.html`.
- Confirm LIVE serves `/node_modules/three/build/three.module.js`.
- Confirm LIVE serves `/node_modules/three/examples/jsm/controls/OrbitControls.js`.
- Confirm LIVE serves `/vendor/occt-import-js/dist/occt-import-js.js`.
- Confirm LIVE serves `/vendor/occt-import-js/dist/occt-import-js.wasm`.
- Ignore `runtime.lastError` messages from browser extensions unless the failing URL belongs to this app.

## All-Inkl LIVE returns `/api/app-meta` 404

- Confirm the FTP workflow has uploaded the repository `api/` directory to `/api/`.
- Verify the repository root `package.json` is present on LIVE and readable by the PHP runtime.
- If your host does not honor `api/.htaccess`, the browser will retry `/api/app-meta.php`.

## Native file shows little or no geometry

- Open the `Diagnostics` tab and inspect recovered record counts.
- Some Altium constructs are still parsed through printable-record recovery only.
- Start by checking whether the file still yields component placements, layer stack data, or text records.

## Drag-and-drop does nothing

- Confirm the file extension is `.SchDoc` or `.PcbDoc`.
- Try the explicit file picker in the header.
- Check the browser console for worker or module-loading errors.

## Tests fail after refactor

- Ensure moved files are reflected in test imports.
- Keep line-limit and structure tests updated with intentional layout changes.
- If parser sample tests fail, run the test suite in the `@sunbox/altium-toolkit` repository and inspect its obfuscated fixture loader.
