import { PcbArcUtils } from 'altium-toolkit/renderers'

/**
 * Appends triangle geometry for PCB stroke-style tracks and arcs.
 */
export class PcbScene3dStrokeGeometryBuilder {
    static #DEFAULT_MIN_WIDTH = 1
    static #ROUND_CAP_SEGMENTS = 16

    /**
     * Appends one widened track with round end caps.
     * @param {number[]} positions Position buffer.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @param {number} width Stroke width.
     * @param {number} z Z position.
     * @param {{ minWidth?: number }} [options] Stroke options.
     * @returns {void}
     */
    static appendTrack(positions, start, end, width, z, options = {}) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        const halfWidth =
            PcbScene3dStrokeGeometryBuilder.#safeStrokeWidth(
                width,
                options.minWidth
            ) / 2

        if (length <= 0.001) {
            PcbScene3dStrokeGeometryBuilder.#appendDiscTriangles(
                positions,
                start,
                halfWidth,
                z
            )
            return
        }

        const normalX = (-dy / length) * halfWidth
        const normalY = (dx / length) * halfWidth

        PcbScene3dStrokeGeometryBuilder.#appendQuadTriangles(
            positions,
            { x: start.x + normalX, y: start.y + normalY },
            { x: end.x + normalX, y: end.y + normalY },
            { x: end.x - normalX, y: end.y - normalY },
            { x: start.x - normalX, y: start.y - normalY },
            z
        )
        PcbScene3dStrokeGeometryBuilder.#appendDiscTriangles(
            positions,
            start,
            halfWidth,
            z
        )
        PcbScene3dStrokeGeometryBuilder.#appendDiscTriangles(
            positions,
            end,
            halfWidth,
            z
        )
    }

    /**
     * Appends one widened arc band with round caps for open arcs.
     * @param {number[]} positions Position buffer.
     * @param {{ x: number, y: number }} center Arc center.
     * @param {{ radius?: number, width?: number, startAngle?: number, endAngle?: number }} arc
     * Arc primitive.
     * @param {number} z Z position.
     * @param {boolean} mirrorY Whether the arc is mirrored around the X axis.
     * @param {{ minWidth?: number, fullCircleEpsilon?: number }} [options]
     * Stroke options.
     * @returns {void}
     */
    static appendArc(positions, center, arc, z, mirrorY, options = {}) {
        const strokeWidth = PcbScene3dStrokeGeometryBuilder.#safeStrokeWidth(
            arc?.width,
            options.minWidth
        )
        const radius = Math.max(Number(arc?.radius || 0), strokeWidth / 2, 0.8)
        const outerRadius = radius + strokeWidth / 2
        const innerRadius = Math.max(radius - strokeWidth / 2, 0)
        const startAngleRad = (Number(arc?.startAngle || 0) * Math.PI) / 180
        const deltaAngleDeg = PcbArcUtils.resolveSweepDelta(
            Number(arc?.startAngle || 0),
            Number(arc?.endAngle || 0)
        )
        const epsilon = Number(options.fullCircleEpsilon ?? 0.001)
        const isFullCircle =
            Math.abs(deltaAngleDeg) <= epsilon ||
            Math.abs(deltaAngleDeg) >= 360 - epsilon
        const deltaAngleRad = isFullCircle
            ? Math.PI * 2
            : (deltaAngleDeg * Math.PI) / 180
        const segments = Math.max(
            isFullCircle ? 20 : 8,
            Math.ceil((Math.abs(deltaAngleRad) / Math.PI) * 18)
        )
        const yDirection = mirrorY ? -1 : 1

        for (let index = 0; index < segments; index += 1) {
            PcbScene3dStrokeGeometryBuilder.#appendArcSegmentTriangles(
                positions,
                center,
                {
                    innerRadius,
                    outerRadius,
                    startAngle:
                        startAngleRad + (deltaAngleRad * index) / segments,
                    endAngle:
                        startAngleRad +
                        (deltaAngleRad * (index + 1)) / segments,
                    yDirection
                },
                z
            )
        }

        if (!isFullCircle) {
            PcbScene3dStrokeGeometryBuilder.#appendArcCapTriangles(
                positions,
                center,
                radius,
                strokeWidth / 2,
                startAngleRad,
                yDirection,
                z
            )
            PcbScene3dStrokeGeometryBuilder.#appendArcCapTriangles(
                positions,
                center,
                radius,
                strokeWidth / 2,
                startAngleRad + deltaAngleRad,
                yDirection,
                z
            )
        }
    }

    /**
     * Appends one arc segment band.
     * @param {number[]} positions Position buffer.
     * @param {{ x: number, y: number }} center Arc center.
     * @param {{ innerRadius: number, outerRadius: number, startAngle: number, endAngle: number, yDirection: number }} segment
     * Arc segment geometry.
     * @param {number} z Z position.
     * @returns {void}
     */
    static #appendArcSegmentTriangles(positions, center, segment, z) {
        const outerStart = {
            x: center.x + Math.cos(segment.startAngle) * segment.outerRadius,
            y:
                center.y +
                Math.sin(segment.startAngle) *
                    segment.outerRadius *
                    segment.yDirection
        }
        const outerEnd = {
            x: center.x + Math.cos(segment.endAngle) * segment.outerRadius,
            y:
                center.y +
                Math.sin(segment.endAngle) *
                    segment.outerRadius *
                    segment.yDirection
        }

        if (segment.innerRadius <= 0.001) {
            PcbScene3dStrokeGeometryBuilder.#appendTriangle(
                positions,
                { x: center.x, y: center.y },
                outerStart,
                outerEnd,
                z
            )
            return
        }

        const innerStart = {
            x: center.x + Math.cos(segment.startAngle) * segment.innerRadius,
            y:
                center.y +
                Math.sin(segment.startAngle) *
                    segment.innerRadius *
                    segment.yDirection
        }
        const innerEnd = {
            x: center.x + Math.cos(segment.endAngle) * segment.innerRadius,
            y:
                center.y +
                Math.sin(segment.endAngle) *
                    segment.innerRadius *
                    segment.yDirection
        }

        PcbScene3dStrokeGeometryBuilder.#appendQuadTriangles(
            positions,
            outerStart,
            outerEnd,
            innerEnd,
            innerStart,
            z
        )
    }

    /**
     * Appends one rounded arc endpoint.
     * @param {number[]} positions Position buffer.
     * @param {{ x: number, y: number }} center Arc center.
     * @param {number} radius Centerline radius.
     * @param {number} capRadius Cap radius.
     * @param {number} angle Arc endpoint angle.
     * @param {number} yDirection Mirrored Y direction.
     * @param {number} z Z position.
     * @returns {void}
     */
    static #appendArcCapTriangles(
        positions,
        center,
        radius,
        capRadius,
        angle,
        yDirection,
        z
    ) {
        PcbScene3dStrokeGeometryBuilder.#appendDiscTriangles(
            positions,
            {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius * yDirection
            },
            capRadius,
            z
        )
    }

    /**
     * Appends one rectangle as two triangles.
     * @param {number[]} positions Position buffer.
     * @param {{ x: number, y: number }} a First corner.
     * @param {{ x: number, y: number }} b Second corner.
     * @param {{ x: number, y: number }} c Third corner.
     * @param {{ x: number, y: number }} d Fourth corner.
     * @param {number} z Z position.
     * @returns {void}
     */
    static #appendQuadTriangles(positions, a, b, c, d, z) {
        PcbScene3dStrokeGeometryBuilder.#appendTriangle(positions, a, b, c, z)
        PcbScene3dStrokeGeometryBuilder.#appendTriangle(positions, a, c, d, z)
    }

    /**
     * Appends one filled circle fan.
     * @param {number[]} positions Position buffer.
     * @param {{ x: number, y: number }} center Disc center.
     * @param {number} radius Disc radius.
     * @param {number} z Z position.
     * @returns {void}
     */
    static #appendDiscTriangles(positions, center, radius, z) {
        const safeRadius = Math.max(Number(radius || 0), 0)
        if (safeRadius <= 0) {
            return
        }

        for (
            let index = 0;
            index < PcbScene3dStrokeGeometryBuilder.#ROUND_CAP_SEGMENTS;
            index += 1
        ) {
            const startAngle =
                (Math.PI * 2 * index) /
                PcbScene3dStrokeGeometryBuilder.#ROUND_CAP_SEGMENTS
            const endAngle =
                (Math.PI * 2 * (index + 1)) /
                PcbScene3dStrokeGeometryBuilder.#ROUND_CAP_SEGMENTS

            PcbScene3dStrokeGeometryBuilder.#appendTriangle(
                positions,
                center,
                {
                    x: center.x + Math.cos(startAngle) * safeRadius,
                    y: center.y + Math.sin(startAngle) * safeRadius
                },
                {
                    x: center.x + Math.cos(endAngle) * safeRadius,
                    y: center.y + Math.sin(endAngle) * safeRadius
                },
                z
            )
        }
    }

    /**
     * Resolves a finite stroke width with a caller-specific minimum.
     * @param {unknown} width Authored stroke width.
     * @param {unknown} minWidth Minimum width.
     * @returns {number}
     */
    static #safeStrokeWidth(width, minWidth) {
        return Math.max(
            Number(width) || PcbScene3dStrokeGeometryBuilder.#DEFAULT_MIN_WIDTH,
            Number(minWidth) ||
                PcbScene3dStrokeGeometryBuilder.#DEFAULT_MIN_WIDTH
        )
    }

    /**
     * Appends one triangle into the position buffer.
     * @param {number[]} positions Position buffer.
     * @param {{ x: number, y: number }} a First point.
     * @param {{ x: number, y: number }} b Second point.
     * @param {{ x: number, y: number }} c Third point.
     * @param {number} z Z position.
     * @returns {void}
     */
    static #appendTriangle(positions, a, b, c, z) {
        positions.push(a.x, a.y, z, b.x, b.y, z, c.x, c.y, z)
    }
}
