# PCB Rounded Outline Design

**Problem**

The PCB viewer currently shows stair-stepped rounded board corners for some `.PcbDoc` files. In the supplied `STM32_PCB_Design.PcbDoc`, the authored board route already contains four clean corner arcs, but `PcbOutlineRecovery` converts that simple contour into a raster-traced silhouette. The renderer then draws a 68-segment polygon instead of the original 9-segment arc-and-line path, which creates the visible pixel effect.

**Approaches Considered**

1. Prefer the authored board-route contour when it is already a simple closed shape with arc segments.
   This keeps the original Altium geometry, removes the stair-step artifact, and limits behavioral change to files whose board route is already suitable for direct rendering.

2. Keep silhouette recovery but add post-processing to fit arcs back onto stepped corners.
   This could smooth more recovered shapes, but it adds heuristic curve fitting on top of already lossy raster output and is more likely to mis-shape irregular outlines.

3. Increase raster resolution so traced silhouettes look smoother.
   This reduces the visible stepping but does not remove the underlying conversion loss, and it increases CPU and memory cost while still approximating authored arcs.

**Chosen Approach**

Prefer the authored board-route contour when it is already a simple, closed, arc-aware outline. Keep the current silhouette recovery path only for cases that actually need it, such as routed scallops, hole-bite cleanup, or more irregular high-complexity contours where the closing pass adds meaningful area.

**Recovery Strategy**

- Inspect the fallback board-route contour before raster recovery.
- Treat a contour as directly renderable when it forms a closed loop, includes authored arcs, and does not show the high segment complexity that motivated silhouette recovery.
- Return that authored contour unchanged instead of rasterizing and re-tracing it.
- Preserve the existing silhouette path for complex routed contours and keep the current area-safety checks there.

**Testing**

Regression coverage will verify:

- a simple rounded board-route contour with four corner arcs is preserved as arc segments instead of being expanded into stepped lines
- the rounded contour still survives vertical normalization for SVG output
- existing board-route scallop closure behavior remains intact for irregular routed cutouts
