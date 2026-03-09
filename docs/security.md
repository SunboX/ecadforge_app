# Security

## Local-First Defaults

- Static app and metadata endpoints run locally
- Native Altium files are parsed in the browser and are not uploaded anywhere by this app
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

- The browser app does not make outbound network calls
- The only runtime HTTP requests are local calls to `/api/app-meta` for version metadata
