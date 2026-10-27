# Minimal measurement and optional enrichment

- Production viewer HTML GET deliveries increment a daily server counter for every consent state, including an unanswered prompt and an explicit refusal.
- The basic counter payload contains only the configured app key. Never forward raw visitor headers, IP, referrer, URL/query, cookies, identifiers, active device information, file contents or event context. Expanded categories follow the separate batched histogram contract.
- For the basic counter persist only app, UTC date and count. Expanded statistics add independent bounded category/bucket counts, never feature tuples. Do not create or join sessions or individual event records; do not deduplicate people. Expire counts older than 400 days.
- Keep the baseline independent of browser JavaScript, storage and analytics consent. Do not use tracking pixels or a browser beacon for the baseline.
- Local development, HEAD, invalid methods, legal overlays and static assets do not increment the viewer count. Analytics failures cannot prevent viewing.
- Detail tracking/fingerprinting loads only after explicit acceptance. Pending/denied states and later withdrawal prevent detailed events; acceptance starts fresh without replay or retroactive enrichment.
- Explain the two levels in the popup and both privacy translations. Keep the existing green/orange choices and legal overlay language toggles.
- Expose baseline totals separately in the dashboard; identify reload/bot inclusion, UTC daily granularity and best-effort coverage. Never add them to detailed pageviews or call them unique visitors.

## Expanded passive statistics

- Derive only the categories in `docs/server-statistics.md` from ordinary request metadata and server delivery measurements. Never add browser probes or a browser beacon.
- Reduce each request immediately to separate daily marginal counters on the PHP app server. Never persist a request record or combined feature key.
- Respect DNT/GPC before classification. The basic counter remains unchanged.
- Protect the local ledger over HTTP and exclude it from static packages. Retain it at most seven days.
- At most hourly send cumulative batches for up to seven UTC days; omit buckets with fewer than five observations. Validate the full batch before writes, merge retries idempotently and retain central counters at most 400 days.
- Show independent categories and sampled-delivery coverage in the authenticated dashboard and JSON export. Explain batching delay, suppression, unreliable UA declarations and country availability.
- Keep optional fingerprinting, its refusal/withdrawal controls and the legal overlays independent of server statistics.
