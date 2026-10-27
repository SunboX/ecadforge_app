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

- The Request support link opens GitHub Issues only when activated. The
  `prepare_issue_report` WebMCP tool prepares public report text and a GitHub
  URL locally; submission uses the user's or agent's authenticated GitHub
  session. No design files, page URLs, session data or logs are attached.
- The viewer consumes embedded/document/session model bytes and companion GLTF
  BIN, OBJ MTL, and WRL texture assets locally. URL-backed models and resources
  are fetched only when the user enables missing-model search or an export/host
  caller supplies an explicit model fetch policy; WRL parsing cannot trigger an
  implicit texture request.
- Version metadata uses same-origin `/api/app-meta`, with `/api/app-meta.php` as a PHP-host fallback.
- Optional analytics loads from `analytics.andrefiedler.de` only after explicit permission. The tracker includes device fingerprint signals; cookieless does not mean anonymous. Withdrawal stops sends through the Analytics 1.3.11 companion. Pre-consent activity is discarded. Local/private origins never load the production tracker.
- Explicit agent feedback is a separate user-initiated outbound submission to Analytics. See [Legal disclosures](legal-disclosures.md) and the public `/privacy.html` policy for purpose, data categories and controls.
- When 3D missing-model search is enabled, KiCad standard-library model paths can be fetched from the public KiCad 3D package library. If an exact KiCad package filename is missing, the app can read the same public package directory index and try a close same-folder package match. Component lookup terms/model ids can also be sent through the same-origin `/api/component-source/*` proxy to the configured component source; native design and fabrication files are not uploaded
- Programmatic assembly exports can resolve project-relative and package-style model paths to same-origin download URLs, but fetching those resolved URLs still requires an explicit fetch policy, timeout, optional auth headers, and cache; the default export path remains local-first and does not fetch model URLs by itself

Minimal usage counts are server-to-server constant app-key signals. They never forward visitor request headers or join to fingerprints. The viewer remains available if reporting fails. The aggregate collector rejects extra body fields and browser Origin/Sec-Fetch headers, and exposes no cross-origin browser API. Like the public detailed collection key, the site key is not a secret; totals are approximate operational measurements, unsuitable for billing or security decisions. Network infrastructure may log the app server's connection; it receives no viewer connection identity.

Expanded server histograms follow the separate [server-statistics policy](server-statistics.md). The `.usage-data` directory must stay inaccessible over HTTP and out of deployment packages. It contains independent daily counters, not request records. DNT/GPC bypass this classification. Do not add raw headers, IP-derived identifiers, joint feature keys or individual timestamps to either the local ledger or its reports.
