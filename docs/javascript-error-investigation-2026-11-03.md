# JavaScript error investigation — November 3, 2026

The three supplied analytics exports cover October 27 to November 3, 2026
(UTC), despite their October 27 filenames. All 15 recordings, from two
Chrome/Android sessions on November 2, share the same renderer stack. The
analysis export groups these into 13 messages with an `Uncaught` prefix and
two without it; they are one underlying defect. Usage metadata adds context,
not another error group. Exports were treated as diagnostic data, and no raw
recordings, document names, visitor IDs, or session IDs were retained here or
in tests.

## Cause and local correction

`altium-toolkit` passed every PCB coordinate as a separate argument to
`Math.min` and `Math.max` in `PcbSvgRenderer.#buildViewBox`. Large primitive
collections exceed the JavaScript engine's argument limit and throw
`RangeError: Maximum call stack size exceeded`. The recorded view switches
all reach this same SVG generation path; they do not establish separate
schematic or 3D failures.

The toolkit now calculates extrema iteratively through a shared
`PcbCoordinateBounds` utility. The same correction covers adjacent region
bounds, interaction polygon bounds, copper surface-layer selection, and
native overlay knockout bounds. It preserves every input primitive and the
existing padding, layer rules, invalid-point filtering, and numeric extrema
semantics. No board-specific exceptions or app renderer overrides were added.

Regression tests use generated fake boards: 75,000 tracks exercise complete
SVG output, exact fitted bounds, top/bottom views and app render caching;
150,000-point contours and primitive collections exercise region holes,
interaction bounds, copper splitting, and native knockout detection. The
original viewBox, region and interaction regressions all failed with the
unmodified toolkit and pass with the correction. The app regression likewise
failed at the recorded viewBox calculation before the local package install.

## Release integration

ECAD Forge 1.13.54 integrates the correction through the registry dependency
`altium-toolkit@^1.4.20`, with 1.4.20 resolved in the lockfile. The initial
investigation used a locally packed sibling toolkit; release validation uses
a clean registry install, so no local package replacement is needed.

To recreate the release checks from the app directory:

```sh
npm ci
npm test
npm run check:structured-data
npm run build:static
```

The pending account, registration, payment and subscription implementations
remain on their feature branches. Mixed private-plugin and PDF feature
branches were not merged into this fix release. The other four toolkit
dependencies already match their latest registry versions and remain unchanged.
The static build remains an ignored output artifact.

## Verification

- Toolkit `npm test`: 965 passed, zero failures, one skipped.
- App `npm test`: 1,072 passed, zero failures, one skipped.
- Structured data regenerated for the app version and checked successfully.
- Static deployment build completed locally.

No original PCB document was supplied, so verification uses structural
synthetic reproductions rather than replaying that document on the affected
Android device. This establishes the reported failure mechanism and its
correction, not physical-device validation.
