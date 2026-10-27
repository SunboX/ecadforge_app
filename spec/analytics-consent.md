# Minimal measurement and optional enrichment

- Production viewer HTML GET deliveries increment a daily server counter for every consent state, including an unanswered prompt and an explicit refusal.
- The reporting payload contains only the configured app key. Never forward visitor headers, IP, referrer, URL/query, cookies, identifiers, device information, file contents or event context.
- Persist only app, UTC date and count. Do not create or join sessions or individual event records; do not deduplicate people. Expire counts older than 400 days.
- Keep the baseline independent of browser JavaScript, storage and analytics consent. Do not use tracking pixels or a browser beacon for the baseline.
- Local development, HEAD, invalid methods, legal overlays and static assets do not increment the viewer count. Analytics failures cannot prevent viewing.
- Detail tracking/fingerprinting loads only after explicit acceptance. Pending/denied states and later withdrawal prevent detailed events; acceptance starts fresh without replay or retroactive enrichment.
- Explain the two levels in the popup and both privacy translations. Keep the existing green/orange choices and legal overlay language toggles.
- Expose baseline totals separately in the dashboard; identify reload/bot inclusion, UTC daily granularity and best-effort coverage. Never add them to detailed pageviews or call them unique visitors.
