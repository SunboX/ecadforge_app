# WebMCP observability and agent feedback

The requested change extends ECAD Forge's existing telemetry and Analytics dashboard. Push and deployment of both repositories are authorized. No toolkit dependency changes are needed.

## Contract and acceptance

Keep WebMCP input/output and native cancellation semantics unchanged. Automatic telemetry must never include argument values, returned content, design names, paths, URLs, component/net identifiers, or raw errors. A returned `{ error }` or `isError: true` is a failed call, even without an exception. Telemetry failures must not alter tool results or exceptions.

Use existing Analytics `/v1/collect` storage; no schema migration. New authenticated dashboard endpoint: `GET /v1/dashboard/webmcp?site_id=...&from=...&to=...`, response `{ principal, webmcp: report }`. Include old terminal events in counts; leave absent historical dimensions unknown.

Events: `webmcp_available`, `webmcp_unavailable`, `webmcp_tool_registration_failed`, `webmcp_tool_started`, `webmcp_tool_called`, `webmcp_feedback`.

Automatic event properties (snake case on the wire):
- `method_name`, `api_form` (object/legacy_positional/legacy_descriptor), `runtime_source` (native/fallback/unavailable/unknown), `result_status` (success/error/cancelled/started/unavailable), `error_bucket` (none/no_design/design_not_found/unsupported_format/missing_data/invalid_input/not_found/cancelled/tool_error/exception/registration_failed/runtime_unavailable).
- `app_version`, `page_session_id` (random page-lifetime UUID, never persisted), `call_sequence` (increasing integer per page).
- `duration_ms` (integer 0..3600000), `result_count` (optional bounded array/known count), `result_shape` (empty/list/object/error/unknown), `registered_count`, `failed_count`, `document_count` (bounded integers).
- `design_selector` (default/active/selected), `query_mode` (default/compact), `pagination` (none/first_page/later_page), `has_filter` (yes/no), `include_dns` (yes/no/default), `has_limit` (yes/no).

Each call emits start then exactly one terminal event. Page/session + sequence correlate them. Dashboard can show starts lacking a terminal event as uncompleted, never assert they crashed. Times and transitions reflect observed provider callbacks, not the agent's private conversation or intent. No claim of authenticated agent identity; bots/referrers are separate existing attribution.

Agent feedback is deliberate, separate outbound data: tool `submit_agent_feedback`, annotations readOnlyHint=false and consequentialHint=true. Input schema: `kind` feature_request/bug_report, `area` discovery/search/connectivity/bom/pcb/performance/output/other, `summary` 10..500 characters, optional `related_tool` from registered tool names. Description instructs agents to send only a generic capability need or reproducible limitation, with no source data, project identifiers, prompts, personal data, or secrets. Unknown fields rejected. Do not automatically generate or send feedback. The production-origin-only submission uses the same collector with `event_name=webmcp_feedback` and properties `feedback_kind`, `feedback_area`, `feedback_summary`, `related_method`, `app_version`. Require exact allowed Origin for feedback, validate server-side, and bound submissions per site/IP/time window. Return success only after collector acknowledgement; expose unavailable/network/rejected outcomes honestly. Deduplicate successful identical feedback per page.

## Implementation sequence

1. Analytics service, collector validation, repository reporting and dashboard. Build fake-data tests first for returned statuses, legacy rows, per-site/range filtering, latency sample denominator, workflow transitions, malformed fields, bounded report coverage, feedback validation/rate limit, escaped output and empty/error UI states. Report usage by tool/runtime/version/query pattern, outcomes and latency, frequent errors, observed transitions, and feedback inbox. Existing bot filtering must not remove WebMCP activity.
2. ECAD adapter telemetry helper, safe property validation, bounded early-event queue, runtime source wiring and feedback tool. Add tests before implementation for semantic errors, cancellation, telemetry exceptions, query privacy, delayed tracker loading and feedback acknowledgements. Reuse current collector directly for explicit feedback so a beacon enqueue cannot masquerade as delivery.
3. Integration and release. Update docs/privacy/spec, bump ECAD patch and Analytics minor or patch as appropriate; synchronize ECAD structured data. Run repo-owned full tests, PHP lint, structured data check and static build. Review cross-repo wire contract and browser screenshot with fake data. Commit and push both main branches, deploy Analytics before ECAD, follow each exact workflow to terminal success, verify live metadata/assets and read-only authenticated dashboard when available.
