# Rotated Text Orientation Design

**Date:** 2026-03-16

## Goal

Fix schematic rotated-text rendering globally so Altium texts that use different source orientations no longer collapse into the same SVG placement.

## Scope

### In Scope

- Preserve Altium source orientation metadata for visible schematic text
- Fix SVG rendering for rotated schematic text so opposite Altium orientations produce opposite vertical flow
- Cover the bug with parser-backed tests using the aether and bastion-sheet fixtures

### Out Of Scope

- Full text measurement or general text bounding-box layout
- Component-specific resistor or diode heuristics
- Changes to non-rotated text placement, note rendering, or power-port glyph geometry

## Current State

The current pipeline loses an important piece of Altium text metadata.

1. The parser resolves visible text rotation into a generic `rotation` value.
2. Distinct Altium text orientations such as `Orientation=1` and `Orientation=3` both normalize to `rotation: 90` in the current implementation.
3. The SVG renderer then emits the same clockwise `rotate(-90 ...)` transform for both cases.
4. This works for texts such as `D16` and `JTAG`, but it breaks control-sheet resistor labels because their source coordinates assume the opposite vertical baseline direction.

## Approaches Considered

### Approach 1: Renderer-Only Heuristics

Flip or offset selected rotated labels during rendering based on text name, owner geometry, or fixture-specific patterns.

**Pros**

- Smallest local patch
- Fastest path to a visual change

**Cons**

- Hides the real data-loss bug
- Will not generalize cleanly to other rotated texts
- Couples renderer behavior to symbol-specific heuristics

### Approach 2: Preserve Orientation End-to-End

Carry the raw Altium text orientation through normalization and let the renderer derive signed SVG rotation from both the text rotation and the preserved source orientation.

**Pros**

- Fixes the actual root cause
- Applies globally to all rotated schematic text
- Keeps parser and renderer responsibilities clean

**Cons**

- Requires coordinated parser and renderer changes
- Needs broader fixture-backed tests

### Approach 3: Full Layout Model

Add measured text boxes and compute rotated placement from owner bounds and text extents rather than source anchor points.

**Pros**

- Strongest long-term layout model
- Could improve more text-placement cases later

**Cons**

- Much larger change surface than this bug needs
- Higher regression risk
- Unnecessary without evidence of broader text-box failures

## Selected Design

Use **Approach 2**.

The parser will preserve the raw Altium text orientation on normalized schematic text records. The renderer will then resolve the final signed SVG transform from that preserved orientation instead of assuming every rotated label should use the same clockwise transform.

This design keeps the existing normalized `rotation` field for generic text behavior while adding enough source metadata to distinguish otherwise identical `90` degree cases. Horizontal text stays unchanged. Rotated text with `Orientation=1` should preserve the current readable direction used by the aether fixture, while `Orientation=3` text should render with the opposite vertical flow expected by the bastion-sheet resistor cluster.

## Data Flow

The normalized schematic text model gains one extra field for the raw Altium text orientation when present. Existing consumers can ignore it unless they render rotated text.

The renderer keeps the current non-rotated placement flow:

- header-like text still recenters from sheet metadata
- notes still route through the note renderer
- power-port text still routes through the power-port renderer

For ordinary schematic labels, the renderer will:

- keep `rotation` as the general rotation magnitude
- derive signed SVG rotation from `rotation` plus the preserved source orientation
- centralize the rotated-text transform rule in one helper instead of scattering special cases across call sites

## Testing Strategy

- Extend parser tests to verify rotated texts preserve source orientation metadata
- Use the aether fixture to assert `Q12` and `WYRN` keep the expected orientation metadata
- Use the control-sheet fixture to assert resistor labels such as `R24` and `10K` keep their opposite orientation metadata
- Extend renderer tests to assert the emitted SVG uses opposite signed rotations for `Orientation=1` and `Orientation=3`
- Run focused parser and renderer tests first, then run the full suite

## Risks

- Existing fixtures may implicitly depend on the current collapsed rotation behavior
- Some rotated texts might require anchor adjustments in addition to signed rotation

## Mitigations

- Keep the parser change additive by preserving `rotation` and adding source orientation alongside it
- Add fixture-backed tests for both current-working and currently-broken rotated texts
- Limit the renderer change to rotated free-text labels first so unrelated glyph rendering stays stable
