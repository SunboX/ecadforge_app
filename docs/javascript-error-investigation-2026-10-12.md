# JavaScript error investigation — October 12, 2026

The four supplied analytics exports cover September 12 to October 12, 2026
(UTC), despite their September 12 filenames. They contain 17 errors across
ECAD Forge, Labelprinter, EggBot, and Rotary Dial Tester. Their contents were
treated as diagnostic data. No supplied recordings or identifying session,
visitor, document, or project data were added to tests.

## Findings and local changes

| Error group                                   | Count | Result                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECAD STEP worker `Failed to fetch`            |     5 | Already handled by OCCT 0.0.29 and the existing Scene3D worker fix. Repository tests verify error results and retry after failed initialization. These changes cannot prevent a network outage.                                                                                                                                                                                                                            |
| ECAD native parser `Illegal invocation`       |     4 | Already fixed by catching the ErrorEvent getter failure when the host dispatches an ordinary Event. The existing regression test passes.                                                                                                                                                                                                                                                                                   |
| ECAD KiCad worker import syntax error         |     1 | Added native module-worker option detection in CircuitJSON Toolkit 1.4.5. A host ignoring `WorkerOptions.type` is terminated during construction; existing request-scoped `worker: 'auto'` fallback then parses directly. Explicit worker requests still report failure. A real Chromium test models this host behavior. The historical Firefox version is absent, so the original browser's exact cause remains unproven. |
| EggBot ResizeObserver delivery loop           |     1 | Deferred canvas drawing buffer writes into the existing render loop and skipped unchanged sizes. The real browser regression failed before the fix and passes afterward. Ordinary viewport resizing did not reproduce the historical loop error; the test verifies removal of the synchronous observer/write feedback path.                                                                                                |
| ECAD disconnected extension port              |     1 | The recording's stack is entirely in `chrome-extension://` scripts. No owned app patch or blanket suppression was added.                                                                                                                                                                                                                                                                                                   |
| ECAD `zaloJSV2` reference                     |     2 | No corresponding symbol exists in the app source. The anonymous line-one stack and Zalo referral context suggest injected integration code, but do not prove its source. Left unresolved rather than adding a global stub.                                                                                                                                                                                                 |
| Labelprinter main module failed to load       |     2 | The named resource currently returns HTTP 200 with a JavaScript content type. The export lacks status, response, and blocking details; the historical cause remains unresolved.                                                                                                                                                                                                                                            |
| Rotary Dial Tester main module failed to load |     1 | The named resource currently returns HTTP 200 with a JavaScript content type. The export lacks evidence identifying the historical failure.                                                                                                                                                                                                                                                                                |

## Release scope and verification

The library patch is based on published CircuitJSON Toolkit 1.4.4; the app
patch is based on public ECAD Forge 1.13.47. The dependency is fixed to 1.4.5
so unrelated future candidates are not selected. Account, subscription, private
plugin and PDF work remain on development branches. Previously published
WebMCP comparison exports are retained.

The real Chromium consumer regression models a host that ignores module-worker
options, imports the installed KiCad parser, and parses a small fake schematic.
It fails with the old dependency and passes with the patched dependency.
Forced worker execution still fails rather than silently changing its contract.

The toolkit regression also covers native host event forwarding and result
isolation. Toolkit tests require Node 20.17.0 for the retained historical
benchmark identity. Browser checks run with the repo test command when
`WORKER_BROWSER_MODULE` selects a Playwright ESM entrypoint and
`WORKER_BROWSER_EXECUTABLE` selects a Chromium binary.

EggBot 1.4.8 independently contains the ResizeObserver correction and its
browser regression tests. No Labelprinter, Rotary Dial Tester, AppHub, Analytics,
or private-plugin changes are part of these error-fix releases.
