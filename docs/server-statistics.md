# Server statistics and consent boundaries

The basic page-load counter remains independent of consent. Expanded collection activates only when the root package manifest has `serverStatisticsEnabled: true`. The FTP workflow uploads that manifest after the revised frontend and privacy pages; an absent, old or invalid manifest leaves expanded collection disabled. Additional statistics reduce ordinary HTTP request metadata on the ECAD Forge PHP server; no browser script or extra request asks the device for information.

## Recorded categories

| Category | Stored value | Purpose |
| --- | --- | --- |
| Browser | Family; separate major-number decades | Maintain browser compatibility |
| OS and device | OS family; declared mobile/tablet/desktop-or-other class | Maintain supported delivery environments |
| Language | Primary two-letter language | Maintain language coverage |
| Country | Hosting-provided country code, otherwise unknown | Coarse regional capacity planning |
| Referrer | None, same-site, external, unknown | Understand entry-route mix without source URLs |
| Transport | HTTP/HTTPS; HTTP version visible to PHP | Delivery compatibility and transport maintenance |
| Automation | Bot/crawler/headless declaration or not-declared | Understand automated load; not reliable bot identification |
| HTML delivery | Uncompressed size bands; PHP delivery-time bands | Capacity and delivery diagnostics |

Values are inferred declarations, not verified device facts. Browser families and version-number decades are separate marginals and cannot be cross-filtered. Country is not inferred from language or an untrusted proxy header. There is no IP lookup, including no external lookup. The PHP timer covers HTML delivery, not application startup or browser rendering. Only successful viewer GET document deliveries contribute; legal overlays, assets, HEAD and local development do not.

IP addresses, IP hashes/prefixes, full User-Agents, exact versions, device models, screen/canvas/audio/fonts/WebGL, full referrers, URL paths/queries, cookies, tokens and exact request timestamps are excluded. There are no individual request rows, session/visitor IDs, profiles, cross-device links or joins to consented analytics.

## Aggregation and retention

`ServerRequestMetrics` derives bounded categories. `ServerStatistics` immediately increments separate marginal counters in a protected `.usage-data` directory. It never persists the feature tuple. Local daily counters have a seven-UTC-day working window; expired files are purged on the next statistics attempt. Both the generated root Apache policy and the directory's own access policy deny HTTP access. Static packaging excludes the directory.

At most one reporting attempt per UTC hour, triggered by a viewer request, batches up to seven days of cumulative histograms. Only buckets with at least five observations per site/day are exported. The analytics collector validates the vocabulary, dates, sample bounds and category totals before any writes. Cumulative snapshots merge by maximum, so retries and out-of-order arrival cannot double-count. The separate `analytics_server_statistics` table uses a 400-UTC-day window (a rolling year plus comparison margin), purged on new report ingestion. No exact request timestamp fields are retained in the statistics; the local throttle stores only an hour number.

Deletion is activity-driven: an idle installation can retain expired counters until another statistics attempt/report arrives; no independent scheduled deletion job is installed. Five observations is a risk-reduction threshold, not a legal proof of anonymisation. Buckets can be missing through low traffic, objections, failed storage, failed reports, or lack of future requests to trigger a final batch. The basic page-load counter and sampled deliveries are different measures and must not be added to detailed pageviews. The first category report may take an hour or further traffic to appear. Reporting failures do not interrupt viewing. `X-Server-Statistics: ready` confirms cURL and a writable protected ledger on a production GET response; `disabled` reflects an objection, and `unavailable` indicates missing prerequisites. This checks readiness, not remote report receipt. PHP needs cURL and write permission for the protected ledger; without those, category coverage can be incomplete.

The public site key is not a server authentication secret. As with existing collection endpoints, fabricated server requests can inflate operational statistics; they are unsuitable for billing, access control or security decisions. No browser CORS collection API is exposed. Dashboard summaries and JSON exports require the existing AppHub authorisation.

## Necessity, balancing and objections

The purposes are compatible, secure HTML delivery, technical maintenance and capacity planning. Raw request logging or persistent recognition is unnecessary for those purposes. Immediate reduction, separate marginals, batching, suppression, bounded values and retention substantially reduce the interference with visitors. No advertising, personalisation, profiling, sales attribution or cross-site recognition is performed by this path.

Where ordinary connection metadata is initially personal data, this implementation relies on the controller's documented Article 6(1)(f) assessment for that narrowly specified processing. Receiving data passively avoids extra device access, but does not by itself supply a GDPR legal basis. The assessment does not authorise collecting everything PHP exposes. A change in purpose, additional dimensions, joint filters, identifiers or raw-data retention needs a new assessment. Hosting/security logs are a separate processing activity; this feature neither configures them nor asserts that they are disabled.

`DNT: 1` and `Sec-GPC: 1` are treated as objections before any classification or ledger access. Those requests contribute only to the basic counter. The privacy policy explains those signals and the contact route for Article 21 objections. Declining the separate optional fingerprinting question does not enable any detailed tracker. Accepting starts the existing consented tracker independently, without retroactive linkage to server statistics.

Sources checked 27 October 2026: [GDPR Articles 5, 6 and 21](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679), [section 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html), [LfDI BW FAQ, server-side processing and legitimate-interest pitfalls](https://www.baden-wuerttemberg.datenschutz.de/faq-zu-cookies-und-tracking-2/) and [DSK 2024 guidance](https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/publikationen/DSK/orientierungshilfen/2024_DSK-OH_Digitale-Dienste.pdf). This is a documented technical configuration and balancing rationale, not a blanket legal exemption for server tracking.
