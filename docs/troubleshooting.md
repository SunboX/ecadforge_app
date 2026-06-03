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
- If the console reports `Failed to resolve module specifier "fflate"`, confirm the import map in `src/index.html` includes `fflate`, the deployed site serves `/node_modules/fflate/esm/browser.js`, and the local server is rewriting toolkit worker modules when testing through `npm start`.
- If the console reports `Failed to resolve module specifier "altium-toolkit"` or `kicad-toolkit`, confirm `npm install` has installed both toolkit packages and the deployed site serves their `/node_modules/altium-toolkit/` and `/node_modules/kicad-toolkit/` trees. Parser worker failures should fall back to direct parsing instead of leaving the viewer in a permanent loading state.

## LIVE works locally but not after deployment

- Run `npm run build:static` and verify `.deploy-src/index.html` contains `/main.mjs?v=<package version>`.
- Confirm the FTP workflow uploaded `.deploy-src/` to the LIVE document root instead of raw `src/`.
- Confirm LIVE serves `https://ecadforge.app/main.mjs?v=<package version>` and the response imports local modules with the same `?v=` key.
- Check one LIVE asset response, such as `/main.mjs?v=<package version>`, for `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`. If this header is missing, verify the generated root `.htaccess` was uploaded.

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
- Some Altium constructs are still parsed through printable-record recovery only, and unsupported advanced KiCad S-expression items are emitted as diagnostics where possible.
- Start by checking whether the file still yields component placements, layer stack data, or text records.

## Drag-and-drop does nothing

- Confirm the file extension is `.SchDoc`, `.PcbDoc`, `.kicad_pro`, `.kicad_sch`, `.kicad_pcb`, or `.zip`.
- Try the explicit file picker in the header.
- Check the browser console for worker or module-loading errors.

## GitHub folder URL reports an API rate limit

- GitHub tree folder URLs need a public GitHub API folder listing before the app can discover the supported ECAD file.
- If the public API quota is exhausted, wait for the reset time shown in the app or paste a direct GitHub blob/raw URL for the `.SchDoc`, `.PcbDoc`, `.kicad_pro`, `.kicad_sch`, or `.kicad_pcb` file.
- Direct raw/blob file URLs do not need the folder listing step.

## Tests fail after refactor

- Ensure moved files are reflected in test imports.
- Keep line-limit and structure tests updated with intentional layout changes.
- If parser sample tests fail, run the test suite in the relevant `altium-toolkit` or `kicad-toolkit` repository and inspect its repo-owned fake fixture coverage.
