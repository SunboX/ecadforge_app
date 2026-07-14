# ECAD Forge 1.11.0

Version 1.11.0 ships CircuitJSON Toolkit 1.2.1, the coordinated source-library
family, and PCB Scene 3D Viewer 1.3 without app-side format workarounds.

## Rendering fidelity

- Updates `circuitjson-toolkit` to 1.2.1, `gerber-toolkit` to 0.3.0,
  `altium-toolkit` to 1.3.0, `kicad-toolkit` to 1.2.0, and
  `pcb-scene3d-viewer` to 1.3.0.
- KiCad plated pads and drills retain their independent shape, dimensions,
  offset, corner radius, and rotation through CircuitJSON. Oval pads remain
  oval instead of becoming circles.
- Board- and footprint-owned silkscreen fills, source-layer artwork, copper
  text, mirrored text, and surface cutouts render through the canonical 3D
  path. Mask-covered copper stays under the lighter solder-mask surface while
  explicit openings remain exposed.
- Board edges use the viewer's light FR-4 substrate color consistently in the
  live scene and assembly exports.
- Altium schematic images recovered from unusable transparent 32-bit BMP data
  use the established missing-image placeholder. The source-native schematic
  renderer and frozen historical parser remain unchanged.

## Model resolution and performance

- Downloaded STEP substitutes retain every exact authored model-path alias, so
  a preferred STEP asset can satisfy its original WRL reference without
  basename or same-stem guessing.
- Session assets preserve aliases and provenance across state snapshots and
  merges. Exact path matching remains collision-safe when different folders,
  URL path casing, document identities, or conflicting payload sources would
  otherwise collide.
- Hosted companion-model payloads remain clone-safe byte arrays through the
  nested scene and STEP workers. Repeated project parses deduplicate exact
  same-path byte payloads while retaining genuinely conflicting content.
- Missing-model requests are deduplicated per document, repeated placements
  share one in-flight download, and rejected or empty transient results can be
  retried instead of being cached permanently.
- Filled surface artwork uses shared polygon and cutout builders, and repeated
  geometry/model work reuses viewer caches to keep the canonical path fast.
- ECAD Forge owns one outer project-parser worker and disables nested toolkit
  workers only at that worker boundary. Direct service and hero-preview parses
  retain the shared automatic worker policy, while bounded large
  multi-document project results can return native PCB fidelity data without
  failing worker transport.

## Compatibility

ECAD Forge consumes the released public package contracts directly. No parser,
renderer, geometry, or model-resolution behavior is duplicated in the app.
The installed OCCT 8.0.0.p2 and `@sunbox/occt-import-js` 0.0.28 artifacts were
audited and require no compatibility release for this update.
