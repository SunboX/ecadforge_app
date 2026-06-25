# Security

## Local-First Defaults

- Static app and metadata endpoints run locally
- Altium, KiCad, Gerber/Excellon, and CircuitJSON files are parsed in the browser and are not uploaded anywhere by this app
- Keep sensitive configuration in `.env` and out of Git

## Input Handling

- Validate file type before parsing
- Treat parsed native-record content as untrusted input
- Escape user-controlled text before injecting markup into the DOM
- Keep parser failures recoverable and visible through diagnostics

## Secrets

- Do not expose secrets in frontend code
- If AI/API endpoints are added later, keep keys server-side only

## Network Behavior

- The browser app does not make outbound network calls unless the user enables the optional 3D missing-model search checkbox or a host integration explicitly opts a programmatic assembly export into resolved model URL fetching
- The only runtime HTTP requests are local calls to `/api/app-meta`, with `/api/app-meta.php` as a PHP-host fallback for version metadata
- When 3D missing-model search is enabled, KiCad standard-library model paths can be fetched from the public KiCad 3D package library. If an exact KiCad package filename is missing, the app can read the same public package directory index and try a close same-folder package match. Component lookup terms/model ids can also be sent through the same-origin `/api/component-source/*` proxy to the configured component source; native design and fabrication files are not uploaded
- Programmatic assembly exports can resolve project-relative and package-style model paths to same-origin download URLs, but fetching those resolved URLs still requires an explicit fetch policy, timeout, optional auth headers, and cache; the default export path remains local-first and does not fetch model URLs by itself
