# Runtime Error Diagnostics Implementation Plan

1. Add failing `PrivacySafeAnalytics` tests for allowlisted context, numeric
   bounds, late tracker synchronization, and rejection of customer data.
2. Add failing loader and render-graph tests for the script load callback and a
   copied statistics snapshot.
3. Implement context storage/synchronization in `PrivacySafeAnalytics`, the
   optional callback in `AnalyticsTrackerLoader`, and statistics accessors in
   `AppViewRenderGraph` and `AppView`.
4. Wire app version and state-derived context in `src/main.mjs` after startup
   content is ready, preserving the current analytics loading order.
5. Run a repeated-propagation stress regression against the local
   `circuitjson-toolkit`; leave the library unchanged when counts remain bounded.
6. Bump ECAD Forge from 1.13.23 to 1.13.24, sync structured data, update
   architecture/release notes, then run `npm test`,
   `npm run check:structured-data`, and `npm run build:static`.
7. Review the complete diff and commit locally without pushing.
