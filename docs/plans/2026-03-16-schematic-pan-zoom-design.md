# Schematic Pan And Zoom Design

## Goal

Add mouse-wheel zoom and mouse-drag panning to the schematic tab so users can inspect large recovered sheets without losing their place.

## Current State

The schematic tab renders one static SVG through `SchematicSvgRenderer.render()` and injects that markup into the main content area from `AppView.#renderContent()`. The SVG already uses a document-space `viewBox`, but no interaction layer updates that camera after render.

## Decision

Keep the existing schematic renderer output unchanged and add a lightweight UI-side interaction controller that updates the SVG `viewBox`.

This approach preserves the renderer's role as a pure markup builder, avoids rewriting schematic primitives around a new scene abstraction, and keeps zoom math aligned with the SVG's native coordinate system.

## Interaction Model

- Mouse-wheel zoom is active only while the pointer is over the schematic SVG.
- Zoom is anchored under the cursor, meaning the document point beneath the pointer remains stable while scaling in or out.
- Holding the primary mouse button and moving pans the schematic by translating the current `viewBox`.
- Cursor feedback should switch to `grab` when the surface is idle and `grabbing` while panning.
- Re-rendering the schematic, including loading a new file or returning to the schematic tab, resets the camera to the default full-sheet `viewBox`.

## Controller Shape

The interaction logic should live in a small dedicated UI helper attached from `AppView` after schematic content is rendered. The helper should:

- read and parse the SVG `viewBox`
- maintain transient interaction state such as drag origin and current camera window
- convert pointer positions from client coordinates into SVG document coordinates
- clamp zoom so users cannot zoom so far out that the sheet becomes unusably tiny or so far in that navigation becomes unstable
- stop panning cleanly on mouseup and pointer leave

The renderer continues to emit the same schematic markup structure, with any needed wrapper or data attributes kept minimal and presentation-focused.

## Testing

Add focused UI tests around the controller behavior instead of full-scene golden output. Cover:

- wheel zoom updates the `viewBox` size
- cursor-centered zoom preserves the same document point under the pointer
- drag panning updates the `viewBox` origin while the primary button is held
- interaction state resets correctly when schematic content is rendered again

## Non-Goals

- touch gestures or trackpad pinch support
- pan and zoom for PCB, BOM, diagnostics, or 3D views
- persistent per-file camera state across tab switches or reloads
