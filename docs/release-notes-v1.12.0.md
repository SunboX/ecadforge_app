# ECAD Forge 1.12.0

Version 1.12.0 adopts CircuitJSON Toolkit 1.3.0 and reduces large-board PCB
render preparation without changing native renderer output or interaction
compatibility.

## CircuitJSON context preparation

- Parser-worker success results use CircuitJSON Toolkit's explicit
  structured-clone preparation API after the browser has completed the clone
  boundary.
- Only canonical documents from that proven worker boundary use the fast path.
  Direct service calls, main-thread fallback results, and retained native
  compatibility documents continue through exact preparation.
- Prepared contexts remain cached and reusable by rendering, interaction, BOM,
  query, and 3D consumers. Binary payload correctness remains the default for
  inputs without structured-clone provenance.

## PCB render performance

- The common default PCB path prepares no interaction primitive model while the
  viewport toolbar is hidden, neither measurement nor diagnostic focus is
  active, and component keys resolve from document rows.
- Active toolbar, measurement, and diagnostic-focus consumers share one
  prepared interaction model per render instead of rebuilding equivalent
  primitive data independently.
- Component-side tagging derives common keys from already resolved document
  components and completes them in one SVG pass. Unresolved source-native keys
  can request the generic interaction-model lookup and compatibility pass.

## Measured browser result

An adjacent browser run of the same large remote Altium PCB deep link,
including its GitHub transfer, reached the completed PCB SVG in 40.961 seconds
on the deployed 1.11 build and 15.771 seconds on local 1.12.0. That is about a
61.5% reduction in end-to-end time. Both runs produced the same native-renderer
structure with 25,729 SVG descendants; the optimized run reported no browser
errors.

## Compatibility and validation

- Existing top/bottom component filtering, measurement snap targets, trace
  length controls, diagnostic navigation, focused diagnostic previews, native
  aliases, and tolerant legacy wrapper inputs keep their prior behavior.
- Regression coverage pins the zero-build default path, one-build active path,
  prepared-model reuse, unresolved-key fallback, exact direct-input binary
  handling, and canonical worker-result adoption.
- The release remains on the converged Altium, Gerber, KiCad, and PCB Scene 3D
  package family and updates `circuitjson-toolkit` to 1.3.0.
