# PCB 3D Rendering Design

**Problem**

The current `3D` tab is only a presentational summary card. It does not render the parsed PCB in 3D, cannot orbit/pan/zoom, and cannot use external footprint models. The target experience is an interactive board viewer closer to Altium-style output: real board thickness, visible package bodies, richer perspective, and companion `WRL` or `STEP` model support when those files are available.

**Chosen Approach**

Implement a hybrid `three`-based 3D renderer behind the existing `3D` tab.

- When only a `.PcbDoc` is loaded, build the scene from the normalized PCB model already produced by the parser.
- When companion files or a whole project are also loaded, resolve external 3D models and place them on top of the procedural board scene.
- Keep the renderer local-first and generic: no board-specific rules, no dependency on a backend conversion service, and graceful fallback whenever model references cannot be resolved.

**Architecture**

The 3D view should keep the current app-level state and tab flow intact.

- `Scene3dRenderer` becomes the HTML shell for the 3D panel, controls, diagnostics, and mount node.
- A new imperative `PcbScene3dController` owns the `three` renderer, camera, controls, lighting, resize handling, and disposal.
- A new scene-description builder converts the normalized PCB model into board, copper, pad, via, overlay, and component instance geometry.
- A companion-file index resolves project-relative or basename-matched `WRL` and `STEP` assets when the user loads more than the lone `.PcbDoc`.

This keeps `AppController` responsible for parsing and state updates while `AppView` attaches or disposes the 3D controller only when the `3D` tab is active.

**Rendering Strategy**

The scene is layered in this order:

1. Board substrate extruded from the parsed board outline with real thickness.
2. Top and bottom surface detail derived from copper, pads, vias, fills, arcs, and selected authored footprint primitives.
3. Procedural package bodies generated from footprint names, pad extents, and explicit component height when available.
4. External package models loaded from session companion files when a component reference can be resolved.

Procedural bodies remain essential even when external models are supported, because lone `.PcbDoc` files must still render a complete scene. Procedural geometry should use a small catalog of package families such as chips, SOT, SOIC, QFN, cans, radial capacitors, pin headers, test points, and simple connector blocks. Unknown packages should fall back to a generic box sized from local pad extents and component height.

**Companion Model Resolution**

The browser cannot crawl arbitrary local folders, so model resolution can only use files explicitly loaded into the session. The viewer should therefore support two modes:

- lone `.PcbDoc`: render immediately with procedural geometry only
- multi-file session: index loaded files and attempt model resolution for each component

Resolution order:

1. explicit project-relative reference if it can be recovered from loaded project metadata
2. normalized basename matching against loaded `WRL` files
3. normalized basename matching against loaded `STEP` files
4. procedural fallback

`WRL` should be the first external target because it is practical to parse in-browser. `STEP` support should be staged behind the same resolution pipeline so the UI and controller architecture do not need to change later.

**Interaction**

The 3D viewer should support:

- orbit rotation
- pan
- zoom
- reset view
- quick top, bottom, and isometric camera presets
- optional toggles for external models, fallback bodies, copper detail, and silkscreen/detail overlays

The default camera should open in an isometric fit-to-board view with soft directional lighting, ambient fill light, and visible board shadowing.

**Error Handling**

Failure modes should remain non-fatal.

- no PCB model: show the existing empty-state guidance
- no WebGL: show a 3D-unavailable panel instead of a broken canvas
- unresolved external model: keep the procedural body and record a lightweight 3D diagnostic
- malformed external model: ignore the model, keep the board visible, and surface a diagnostic
- very large board detail: cap fine-grain scene detail when needed to preserve responsiveness

**Testing**

Coverage should focus on deterministic scene inputs and UI integration rather than pixel-perfect rendering.

- `Scene3dRenderer` tests should verify the interactive panel shell and controls markup.
- `AppView` tests should verify that a real 3D controller is attached for the `3D` tab and disposed when content changes.
- Scene-description tests should verify board thickness inputs, procedural package classification, and fallback behavior.
- Companion-model resolution tests should verify generic basename and reference matching without using source-descriptive fixtures.
- Stylesheet tests should verify the new 3D panel classes and interactive affordances.

**Recommendation**

Ship the first implementation with:

- `three`
- interactive orbit/pan/zoom
- board extrusion plus procedural package bodies
- session-scoped external `WRL` resolution
- staged hooks for later `STEP` support

This delivers a meaningful 3D viewer now, works from a lone `.PcbDoc`, and leaves room to improve package fidelity as richer model metadata becomes available.
