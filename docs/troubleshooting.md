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
- If the console reports `Failed to resolve module specifier "fflate"`, confirm `src/vendor/fflate/browser.mjs` was deployed with the frontend files.

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
- If parser sample tests fail, confirm the sample file paths in `tests/fixtures/AltiumFixtureLoader.mjs`.
