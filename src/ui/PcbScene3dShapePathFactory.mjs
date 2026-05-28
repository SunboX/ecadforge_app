/**
 * Builds Three shape paths from Altium shape-based region contours.
 */
export class PcbScene3dShapePathFactory {
    static #ARC_SEGMENT_DEGREES = 12
    static #GEOMETRY_EPSILON = 0.001

    /**
     * Normalizes authored contour points while preserving arc metadata.
     * @param {{ x?: number, y?: number, isArc?: boolean, centerX?: number, centerY?: number, radius?: number, startAngle?: number, endAngle?: number }[]} points
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number, isArc?: boolean, centerX?: number, centerY?: number, radius?: number, startAngle?: number, endAngle?: number, arcYDirection?: number }[]}
     */
    static normalizeShapePoints(points, normalizeBoardPoint, mirrorY) {
        return (Array.isArray(points) ? points : [])
            .map((point) =>
                PcbScene3dShapePathFactory.#normalizeShapePoint(
                    point,
                    normalizeBoardPoint,
                    mirrorY
                )
            )
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
    }

    /**
     * Builds one filled shape from normalized contour points.
     * @param {any} THREE
     * @param {object[]} points
     * @returns {any}
     */
    static buildShape(THREE, points) {
        const shape = new THREE.Shape()
        PcbScene3dShapePathFactory.#appendClosedContour(shape, points)
        return shape
    }

    /**
     * Builds one hole path from normalized contour points.
     * @param {any} THREE
     * @param {object[]} points
     * @returns {any}
     */
    static buildPath(THREE, points) {
        const path = new THREE.Path()
        PcbScene3dShapePathFactory.#appendClosedContour(path, points)
        return path
    }

    /**
     * Normalizes one point and optional arc center.
     * @param {object} point
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {object}
     */
    static #normalizeShapePoint(point, normalizeBoardPoint, mirrorY) {
        const normalized = PcbScene3dShapePathFactory.#normalizePoint(
            normalizeBoardPoint,
            Number(point?.x || 0),
            Number(point?.y || 0),
            mirrorY
        )
        const output = {
            ...point,
            x: normalized.x,
            y: normalized.y
        }

        if (point?.isArc) {
            const center = PcbScene3dShapePathFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(point.centerX || 0),
                Number(point.centerY || 0),
                mirrorY
            )
            output.centerX = center.x
            output.centerY = center.y
            output.arcYDirection = mirrorY ? -1 : 1
        }

        return output
    }

    /**
     * Appends one closed contour to a shape or path.
     * @param {{ moveTo: Function, lineTo: Function, closePath: Function }} path
     * @param {object[]} points
     * @returns {void}
     */
    static #appendClosedContour(path, points) {
        const vertices =
            PcbScene3dShapePathFactory.#withoutClosingDuplicate(points)

        if (!vertices.length) {
            return
        }

        path.moveTo(vertices[0].x, vertices[0].y)
        for (let index = 0; index < vertices.length - 1; index += 1) {
            PcbScene3dShapePathFactory.#appendSegment(
                path,
                vertices[index],
                vertices[index + 1]
            )
        }
        if (vertices.at(-1)?.isArc) {
            PcbScene3dShapePathFactory.#appendArcSegment(
                path,
                vertices.at(-1),
                vertices[0]
            )
        }
        path.closePath()
    }

    /**
     * Trims a duplicated closing point emitted by shape-based region streams.
     * @param {object[]} points
     * @returns {object[]}
     */
    static #withoutClosingDuplicate(points) {
        if (!Array.isArray(points) || points.length < 2) {
            return Array.isArray(points) ? points : []
        }

        const first = points[0]
        const last = points[points.length - 1]

        return PcbScene3dShapePathFactory.#samePoint(first, last)
            ? points.slice(0, -1)
            : points
    }

    /**
     * Appends one line or arc segment.
     * @param {{ lineTo: Function }} path
     * @param {object} current
     * @param {object} next
     * @returns {void}
     */
    static #appendSegment(path, current, next) {
        if (current?.isArc && Number(current.radius) > 0) {
            PcbScene3dShapePathFactory.#appendArcSegment(path, current, next)
            return
        }

        path.lineTo(next.x, next.y)
    }

    /**
     * Appends a sampled circular arc matching Altium shape-region metadata.
     * @param {{ lineTo: Function }} path
     * @param {object} current
     * @param {object} next
     * @returns {void}
     */
    static #appendArcSegment(path, current, next) {
        const startAngle = Number(current.startAngle || 0)
        const deltaAngle = Number(current.endAngle || 0) - startAngle

        if (!Number.isFinite(deltaAngle) || Math.abs(deltaAngle) < 0.001) {
            path.lineTo(next.x, next.y)
            return
        }

        const segments = Math.max(
            4,
            Math.ceil(
                Math.abs(deltaAngle) /
                    PcbScene3dShapePathFactory.#ARC_SEGMENT_DEGREES
            )
        )

        for (let index = 1; index <= segments; index += 1) {
            const angle =
                ((startAngle + (deltaAngle * index) / segments) * Math.PI) / 180
            path.lineTo(
                Number(current.centerX) +
                    Number(current.radius) * Math.cos(angle),
                Number(current.centerY) +
                    Number(current.arcYDirection || 1) *
                        Number(current.radius) *
                        Math.sin(angle)
            )
        }
    }

    /**
     * Returns true when two points share the same coordinate.
     * @param {{ x?: number, y?: number }} first
     * @param {{ x?: number, y?: number }} second
     * @returns {boolean}
     */
    static #samePoint(first, second) {
        return (
            Math.abs(Number(first?.x) - Number(second?.x)) <=
                PcbScene3dShapePathFactory.#GEOMETRY_EPSILON &&
            Math.abs(Number(first?.y) - Number(second?.y)) <=
                PcbScene3dShapePathFactory.#GEOMETRY_EPSILON
        )
    }

    /**
     * Normalizes one board point and optionally mirrors underside primitives.
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {number} x
     * @param {number} y
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }}
     */
    static #normalizePoint(normalizeBoardPoint, x, y, mirrorY) {
        const point = normalizeBoardPoint(x, y)

        return { x: point.x, y: mirrorY ? -point.y : point.y }
    }
}
