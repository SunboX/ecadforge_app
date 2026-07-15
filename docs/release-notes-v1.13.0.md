# ECAD Forge 1.13.0

Version 1.13.0 removes the multi-second browser stall that could follow a
large parser-worker result while preserving the native PCB renderer output and
the common CircuitJSON document contract.

## Responsive worker-result integration

- Canonical worker results now use CircuitJSON Toolkit's asynchronous
  structured-clone preparation API with explicit exclusive ownership transfer.
- The browser-owned native-extension graph is validated, protected, and deeply
  frozen in place instead of being copied and then rescanned repeatedly.
- Host scheduling boundaries divide large extension traversal and sealing and
  separate successive project documents and the first consumer render.
  Pointer, paint, and other queued browser work can therefore run throughout
  integration.
- Concurrent consumers of the same document share one pending preparation and
  then reuse the same cached CircuitJSON context. One consumer's cancellation
  does not reject another. Cancellation stops only that caller's wait while
  shared progressive sealing completes for current or later consumers.
- Rejected host schedulers fall back to a zero-delay task without interrupting
  shared preparation. Terminal structural failures remain cached for that
  document identity, and synchronous consumers cannot start a second context
  while asynchronous adoption is in progress.
- Parser-worker terminal messages must match the exact active request id.
  Stale, duplicate, and id-less replies cannot settle a newer request.
- Controller disposal invalidates its lifecycle generation before rejecting
  pending work, so already queued success or error continuations cannot publish
  documents or status afterward.

Direct parser calls, main-thread fallback, and compatibility inputs retain the
defensive exact-copy path. The optimization is selected only for canonical
documents received from the completed browser structured-clone boundary.

## Shared parser-toolkit contract

- ECAD Forge updates to CircuitJSON Toolkit 1.4.0, Altium Toolkit 1.4.0,
  KiCad Toolkit 1.3.0, and Gerber Toolkit 0.4.0.
- Toolkit-owned native extension graphs use the common
  `DocumentResult.createValidatedOwned(fields, runtime)` contract. The existing
  parameters and document return shape are unchanged; owned extensions retain
  identity and become deeply immutable.
- CircuitJSON remains the shared model for app state and common services while
  each source toolkit retains its native extension for exact source rendering.

## Measured browser result

In adjacent local traces of the exact large remote native-PCB deep link, the
1.12.0 path produced renderer-main tasks of 3.29 seconds and 2.17 seconds. The
final 1.13.0 candidate preserved the exact 25,729-descendant PCB SVG and view
box `3074.47 -6937.64 17022.82 12802.83`. A fresh open peaked at 17.7
milliseconds on the renderer main thread. A forced reload peaked at 404.4
milliseconds, entirely inside browser-owned message delivery: 196.8
milliseconds of structured-clone deserialization plus 205.3 milliseconds of
garbage collection. The largest scheduled parser-worker task in that reload
was 5.9 milliseconds. The PCB rendered without page errors; the only console
entry was the existing WebMCP deprecation warning.

## Validation

- CircuitJSON Toolkit's complete tests, feature-preservation audit, packed
  entrypoint check, and browser dependency audit cover clone adoption,
  extension ownership, binary isolation, validation proofs, and worker parity.
- Altium, KiCad, and Gerber retain their complete parser, renderer, feature, and
  performance suites.
- ECAD Forge tests cover cooperative document batches, context reuse, parser
  controller behavior, and the complete app integration suite. Structured-data
  and static-deployment gates remain part of the release check.
