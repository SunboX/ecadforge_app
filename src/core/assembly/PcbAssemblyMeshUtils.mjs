const FULL_CIRCLE_DEGREES = 360

/**
 * Shared mesh helpers for PCB assembly export.
 */
export class PcbAssemblyMeshUtils {
    /**
     * Builds a rectangular box mesh.
     * @param {string} name Mesh name.
     * @param {{ x?: number, y?: number, z?: number, width?: number, depth?: number, height?: number, color?: number[] }} options Box options in mils.
     * @returns {{ name: string, vertices: number[][], faces: number[][], color?: number[] }}
     */
    static box(name, options = {}) {
        const x = Number(options.x || 0)
        const y = Number(options.y || 0)
        const z = Number(options.z || 0)
        const halfWidth = Math.max(Number(options.width || 0), 0.001) / 2
        const halfDepth = Math.max(Number(options.depth || 0), 0.001) / 2
        const halfHeight = Math.max(Number(options.height || 0), 0.001) / 2

        return {
            name,
            vertices: [
                [x - halfWidth, y - halfDepth, z - halfHeight],
                [x + halfWidth, y - halfDepth, z - halfHeight],
                [x + halfWidth, y + halfDepth, z - halfHeight],
                [x - halfWidth, y + halfDepth, z - halfHeight],
                [x - halfWidth, y - halfDepth, z + halfHeight],
                [x + halfWidth, y - halfDepth, z + halfHeight],
                [x + halfWidth, y + halfDepth, z + halfHeight],
                [x - halfWidth, y + halfDepth, z + halfHeight]
            ],
            faces: [
                [0, 3, 2, 1],
                [4, 5, 6, 7],
                [0, 1, 5, 4],
                [1, 2, 6, 5],
                [2, 3, 7, 6],
                [3, 0, 4, 7]
            ],
            ...(Array.isArray(options.color) ? { color: options.color } : {})
        }
    }

    /**
     * Builds an extruded polygon mesh.
     * @param {string} name Mesh name.
     * @param {number[][]} points Polygon points in mils.
     * @param {number} z Center Z in mils.
     * @param {number} thickness Extrusion thickness in mils.
     * @param {number[] | undefined} color Optional RGB color.
     * @returns {{ name: string, vertices: number[][], faces: number[][], color?: number[] } | null}
     */
    static prism(name, points, z, thickness, color = undefined) {
        const loop = PcbAssemblyMeshUtils.cleanLoop(points)
        if (loop.length < 3) {
            return null
        }

        const halfThickness = Math.max(Number(thickness || 0), 0.001) / 2
        const bottomZ = Number(z || 0) - halfThickness
        const topZ = Number(z || 0) + halfThickness
        const vertices = [
            ...loop.map((point) => [point[0], point[1], bottomZ]),
            ...loop.map((point) => [point[0], point[1], topZ])
        ]
        const topOffset = loop.length
        const faces = [
            [...loop.keys()].reverse(),
            [...loop.keys()].map((index) => index + topOffset)
        ]

        for (let index = 0; index < loop.length; index += 1) {
            const nextIndex = (index + 1) % loop.length
            faces.push([
                index,
                nextIndex,
                nextIndex + topOffset,
                index + topOffset
            ])
        }

        return {
            name,
            vertices,
            faces,
            ...(Array.isArray(color) ? { color } : {})
        }
    }

    /**
     * Builds a cylinder mesh from polygonal rings.
     * @param {string} name Mesh name.
     * @param {{ x?: number, y?: number, z?: number, radius?: number, height?: number, segments?: number, color?: number[] }} options Cylinder options.
     * @returns {{ name: string, vertices: number[][], faces: number[][], color?: number[] }}
     */
    static cylinder(name, options = {}) {
        const radius = Math.max(Number(options.radius || 0), 0.001)
        const segments = Math.max(Number(options.segments || 24), 8)
        const points = PcbAssemblyMeshUtils.circlePoints(
            Number(options.x || 0),
            Number(options.y || 0),
            radius,
            segments
        )

        return PcbAssemblyMeshUtils.prism(
            name,
            points,
            Number(options.z || 0),
            Number(options.height || 0.001),
            options.color
        )
    }

    /**
     * Builds a capsule loop around a line segment.
     * @param {number} x1 Start X.
     * @param {number} y1 Start Y.
     * @param {number} x2 End X.
     * @param {number} y2 End Y.
     * @param {number} radius Stroke radius.
     * @param {number} segmentsPerCap Number of samples on each semicircle.
     * @returns {number[][]}
     */
    static capsulePoints(x1, y1, x2, y2, radius, segmentsPerCap = 12) {
        const startX = Number(x1 || 0)
        const startY = Number(y1 || 0)
        const endX = Number(x2 || 0)
        const endY = Number(y2 || 0)
        const capRadius = Math.max(Number(radius || 0), 0.001)
        const dx = endX - startX
        const dy = endY - startY
        const length = Math.hypot(dx, dy)
        if (length <= 0.001) {
            return PcbAssemblyMeshUtils.circlePoints(
                startX,
                startY,
                capRadius,
                Math.max(segmentsPerCap * 2, 8)
            )
        }

        const capSegments = Math.max(Number(segmentsPerCap || 12), 4)
        const normalAngle = Math.atan2(dx / length, -dy / length)
        const points = [
            [
                startX + Math.cos(normalAngle) * capRadius,
                startY + Math.sin(normalAngle) * capRadius
            ],
            [
                endX + Math.cos(normalAngle) * capRadius,
                endY + Math.sin(normalAngle) * capRadius
            ]
        ]

        for (let index = 1; index <= capSegments; index += 1) {
            const angle = normalAngle - (Math.PI * index) / capSegments
            points.push([
                endX + Math.cos(angle) * capRadius,
                endY + Math.sin(angle) * capRadius
            ])
        }

        points.push([
            startX - Math.cos(normalAngle) * capRadius,
            startY - Math.sin(normalAngle) * capRadius
        ])

        for (let index = 1; index <= capSegments; index += 1) {
            const angle =
                normalAngle + Math.PI - (Math.PI * index) / capSegments
            points.push([
                startX + Math.cos(angle) * capRadius,
                startY + Math.sin(angle) * capRadius
            ])
        }

        return PcbAssemblyMeshUtils.cleanLoop(points)
    }

    /**
     * Builds a hollow cylindrical sleeve mesh.
     * @param {string} name Mesh name.
     * @param {{ x?: number, y?: number, z?: number, outerRadius?: number, innerRadius?: number, height?: number, segments?: number, color?: number[] }} options Ring options.
     * @returns {{ name: string, vertices: number[][], faces: number[][], color?: number[] }}
     */
    static ringCylinder(name, options = {}) {
        const x = Number(options.x || 0)
        const y = Number(options.y || 0)
        const z = Number(options.z || 0)
        const outerRadius = Math.max(Number(options.outerRadius || 0), 0.001)
        const innerRadius = Math.max(
            Math.min(Number(options.innerRadius || 0), outerRadius - 0.001),
            0.001
        )
        const height = Math.max(Number(options.height || 0), 0.001)
        const halfHeight = height / 2
        const segments = Math.max(Number(options.segments || 24), 8)
        const outer = PcbAssemblyMeshUtils.circlePoints(
            x,
            y,
            outerRadius,
            segments
        )
        const inner = PcbAssemblyMeshUtils.circlePoints(
            x,
            y,
            innerRadius,
            segments
        )
        const vertices = [
            ...outer.map((point) => [point[0], point[1], z - halfHeight]),
            ...inner.map((point) => [point[0], point[1], z - halfHeight]),
            ...outer.map((point) => [point[0], point[1], z + halfHeight]),
            ...inner.map((point) => [point[0], point[1], z + halfHeight])
        ]
        const faces = []
        const innerBottom = segments
        const outerTop = segments * 2
        const innerTop = segments * 3

        for (let index = 0; index < segments; index += 1) {
            const next = (index + 1) % segments
            faces.push([index, next, next + outerTop, index + outerTop])
            faces.push([
                innerBottom + next,
                innerBottom + index,
                innerTop + index,
                innerTop + next
            ])
            faces.push([
                outerTop + index,
                outerTop + next,
                innerTop + next,
                innerTop + index
            ])
            faces.push([next, index, innerBottom + index, innerBottom + next])
        }

        return {
            name,
            vertices,
            faces,
            ...(Array.isArray(options.color) ? { color: options.color } : {})
        }
    }

    /**
     * Builds points around a circle.
     * @param {number} x Center X.
     * @param {number} y Center Y.
     * @param {number} radius Radius.
     * @param {number} segments Segment count.
     * @returns {number[][]}
     */
    static circlePoints(x, y, radius, segments = 24) {
        const count = Math.max(Number(segments || 24), 8)
        const points = []

        for (let index = 0; index < count; index += 1) {
            const angle = (Math.PI * 2 * index) / count
            points.push([
                Number(x || 0) + Math.cos(angle) * radius,
                Number(y || 0) + Math.sin(angle) * radius
            ])
        }

        return points
    }

    /**
     * Builds an arc-band polygon.
     * @param {{ x?: number, y?: number, radius?: number, width?: number, startAngle?: number, sweepAngle?: number, endAngle?: number }} arc Arc primitive.
     * @returns {number[][]}
     */
    static arcBandPoints(arc) {
        const centerX = Number(arc?.x || arc?.centerX || 0)
        const centerY = Number(arc?.y || arc?.centerY || 0)
        const width = Math.max(Number(arc?.width || 1), 0.001)
        const radius = Math.max(Number(arc?.radius || 0), width / 2)
        const outerRadius = radius + width / 2
        const innerRadius = Math.max(radius - width / 2, 0.001)
        const start = Number(arc?.startAngle || 0)
        const sweep = PcbAssemblyMeshUtils.resolveSweep(arc)
        const segments = Math.max(Math.ceil(Math.abs(sweep) / 6), 8)
        const outer = []
        const inner = []

        for (let index = 0; index <= segments; index += 1) {
            const angle = ((start + (sweep * index) / segments) * Math.PI) / 180
            outer.push([
                centerX + Math.cos(angle) * outerRadius,
                centerY + Math.sin(angle) * outerRadius
            ])
            inner.push([
                centerX + Math.cos(angle) * innerRadius,
                centerY + Math.sin(angle) * innerRadius
            ])
        }

        return [...outer, ...inner.reverse()]
    }

    /**
     * Resolves an arc sweep angle.
     * @param {{ sweepAngle?: number, startAngle?: number, endAngle?: number }} arc Arc primitive.
     * @returns {number}
     */
    static resolveSweep(arc) {
        if (Number.isFinite(Number(arc?.sweepAngle))) {
            const sweep = Number(arc.sweepAngle)
            return Math.abs(sweep) > 0.001 ? sweep : FULL_CIRCLE_DEGREES
        }

        if (Number.isFinite(Number(arc?.endAngle))) {
            const sweep = Number(arc.endAngle) - Number(arc?.startAngle || 0)
            return Math.abs(sweep) > 0.001 ? sweep : FULL_CIRCLE_DEGREES
        }

        return FULL_CIRCLE_DEGREES
    }

    /**
     * Removes duplicate and invalid polygon points.
     * @param {number[][]} points Candidate points.
     * @returns {number[][]}
     */
    static cleanLoop(points) {
        const loop = []

        for (const point of Array.isArray(points) ? points : []) {
            const x = Number(point?.[0])
            const y = Number(point?.[1])
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                continue
            }

            const previous = loop[loop.length - 1]
            if (
                previous &&
                Math.abs(previous[0] - x) < 0.001 &&
                Math.abs(previous[1] - y) < 0.001
            ) {
                continue
            }
            loop.push([x, y])
        }

        const first = loop[0]
        const last = loop[loop.length - 1]
        if (
            first &&
            last &&
            Math.abs(first[0] - last[0]) < 0.001 &&
            Math.abs(first[1] - last[1]) < 0.001
        ) {
            loop.pop()
        }

        return loop
    }

    /**
     * Applies a placement transform to one mesh.
     * @param {{ name: string, vertices: number[][], faces: number[][], color?: number[] }} mesh Source mesh.
     * @param {object} placement Placement metadata.
     * @returns {{ name: string, vertices: number[][], faces: number[][], color?: number[] }}
     */
    static transformMesh(mesh, placement = {}) {
        const rotationDeg = Number(placement?.rotationDeg || 0)
        const rotationRad = (rotationDeg * Math.PI) / 180
        const cos = Math.cos(rotationRad)
        const sin = Math.sin(rotationRad)
        const position = placement?.positionMil || {}
        const mountSide = String(placement?.mountSide || 'top').toLowerCase()
        const zSign = mountSide === 'bottom' ? -1 : 1

        return {
            ...mesh,
            vertices: mesh.vertices.map((vertex) => {
                const modelPoint = PcbAssemblyMeshUtils.#applyModelTransform(
                    vertex,
                    placement?.modelTransform
                )
                const z = modelPoint.z * zSign
                const rotatedX = modelPoint.x * cos - modelPoint.y * sin
                const rotatedY = modelPoint.x * sin + modelPoint.y * cos

                return [
                    rotatedX + Number(position.x || 0),
                    rotatedY + Number(position.y || 0),
                    z + Number(position.z || 0)
                ]
            })
        }
    }

    /**
     * Applies the source-model transform before footprint placement.
     * @param {number[]} vertex Source vertex.
     * @param {object | null | undefined} modelTransform Model transform.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #applyModelTransform(vertex, modelTransform) {
        const scale = PcbAssemblyMeshUtils.#resolveModelScale(modelTransform)
        const offset = PcbAssemblyMeshUtils.#resolveModelOffset(modelTransform)
        const rotated = PcbAssemblyMeshUtils.#rotateModelPoint(
            {
                x: Number(vertex?.[0] || 0) * scale.x,
                y: Number(vertex?.[1] || 0) * scale.y,
                z: Number(vertex?.[2] || 0) * scale.z
            },
            modelTransform?.rotationDeg || {}
        )

        return {
            x: rotated.x + offset.x,
            y: rotated.y + offset.y,
            z: rotated.z + offset.z
        }
    }

    /**
     * Resolves model-local offset fields.
     * @param {object | null | undefined} modelTransform Model transform.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolveModelOffset(modelTransform) {
        const offset = modelTransform?.offsetMil || {}

        return {
            x: Number(offset.x ?? modelTransform?.dxMil ?? 0),
            y: Number(offset.y ?? modelTransform?.dyMil ?? 0),
            z: Number(offset.z ?? modelTransform?.dzMil ?? 0)
        }
    }

    /**
     * Resolves model-local scale fields.
     * @param {object | null | undefined} modelTransform Model transform.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolveModelScale(modelTransform) {
        const scale = modelTransform?.scale || {}

        return {
            x: Number(scale.x ?? 1) || 1,
            y: Number(scale.y ?? 1) || 1,
            z: Number(scale.z ?? 1) || 1
        }
    }

    /**
     * Applies KiCad-compatible model rotation order to a point.
     * @param {{ x: number, y: number, z: number }} point Source point.
     * @param {{ x?: number, y?: number, z?: number }} rotationDeg Rotation angles.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #rotateModelPoint(point, rotationDeg) {
        const afterX = PcbAssemblyMeshUtils.#rotateX(
            point,
            -Number(rotationDeg?.x || 0)
        )
        const afterY = PcbAssemblyMeshUtils.#rotateY(
            afterX,
            -Number(rotationDeg?.y || 0)
        )
        return PcbAssemblyMeshUtils.#rotateZ(
            afterY,
            -Number(rotationDeg?.z || 0)
        )
    }

    /**
     * Rotates one point around X.
     * @param {{ x: number, y: number, z: number }} point Source point.
     * @param {number} angleDeg Rotation in degrees.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #rotateX(point, angleDeg) {
        const angle = (angleDeg * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        return {
            x: point.x,
            y: point.y * cos - point.z * sin,
            z: point.y * sin + point.z * cos
        }
    }

    /**
     * Rotates one point around Y.
     * @param {{ x: number, y: number, z: number }} point Source point.
     * @param {number} angleDeg Rotation in degrees.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #rotateY(point, angleDeg) {
        const angle = (angleDeg * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        return {
            x: point.x * cos + point.z * sin,
            y: point.y,
            z: -point.x * sin + point.z * cos
        }
    }

    /**
     * Rotates one point around Z.
     * @param {{ x: number, y: number, z: number }} point Source point.
     * @param {number} angleDeg Rotation in degrees.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #rotateZ(point, angleDeg) {
        const angle = (angleDeg * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        return {
            x: point.x * cos - point.y * sin,
            y: point.x * sin + point.y * cos,
            z: point.z
        }
    }

    /**
     * Sanitizes a mesh name token.
     * @param {string} value Source value.
     * @returns {string}
     */
    static safeName(value) {
        return String(value || 'mesh')
            .trim()
            .replace(/[^A-Za-z0-9_.-]+/gu, '-')
            .replace(/^-+|-+$/gu, '')
            .slice(0, 80)
    }
}
