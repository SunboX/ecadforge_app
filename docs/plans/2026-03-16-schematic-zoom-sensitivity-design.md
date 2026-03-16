# Schematic Zoom Sensitivity Design

## Goal

Make schematic mouse-wheel zoom feel calmer by reducing the per-tick zoom amount while keeping the existing cursor-centered behavior intact.

## Current State

The schematic viewport controller applies a fixed `10%` zoom step on each wheel event. That keeps the math simple and predictable, but on modern mouse wheels and trackpads it feels too aggressive for close inspection work.

## Decision

Keep the current interaction model and reduce only the fixed wheel sensitivity.

This preserves the existing controller architecture, drag-to-pan behavior, cursor anchoring, and lifecycle wiring in `AppView`. The only behavioral change is that each wheel event moves the camera by a smaller amount.

## Interaction Model

- Wheel zoom stays centered under the cursor.
- Drag panning stays unchanged.
- No easing, inertia, or animation is added.
- No user-facing zoom preference or setting is added.

## Testing

Update the focused viewport controller and `AppView` integration tests to assert the slower zoom step while preserving the same anchor point and reset behavior.
