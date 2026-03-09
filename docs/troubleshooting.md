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
- If parser sample tests fail, confirm the sample file paths in `tests/core/altium-parser.test.mjs`.
