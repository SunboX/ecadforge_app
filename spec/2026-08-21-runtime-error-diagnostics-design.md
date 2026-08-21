# Runtime Error Diagnostics Design

## Goal

Provide enough bounded, privacy-safe ECAD Forge state to distinguish startup,
parsing, and rendering failures without retaining customer design data. The
central Analytics tracker owns generic error resilience and recording; ECAD
Forge owns only application context.

## Host contract

`PrivacySafeAnalytics` retains a sanitized context containing app version,
parse/runtime phase, active view, source and format families, open-document
count, and `AppViewRenderGraph` computation/dependency/reader-edge counts. It
publishes that context through the tracker's `setContext()` API whenever the
tracker becomes available and whenever app state changes.

`AnalyticsTrackerLoader` accepts an optional load callback so context can be
synchronized before later host events. The existing boolean return contract and
deployed-origin checks remain unchanged.

## Render graph and memory boundary

`AppViewRenderGraph` exposes the toolkit's bounded statistics through a copied
diagnostic object; callers cannot mutate the computation. The toolkit itself is
changed only if a repeated-propagation stress test shows growing trace counts or
retained replaced inputs.

## Privacy

Runtime context never includes file names, URLs, document contents, identifiers,
component/net names, or error text. Strings use explicit allowlists and short
normalized values; counts are finite non-negative integers.

## Verification

Unit tests cover context sanitization and delayed tracker availability, loader
callbacks, render-statistic exposure, and browser-entry wiring. Full app tests,
structured-data checks, and static build run after the version bump.
