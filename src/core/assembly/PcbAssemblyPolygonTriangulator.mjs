const EPSILON = 1e-9

/**
 * Triangulates simple planar polygon faces for tessellated assembly export.
 */
export class PcbAssemblyPolygonTriangulator {
    /**
     * Triangulates one mesh face without assuming the polygon is convex.
     * @param {number[]} indexes Face vertex indexes.
     * @param {number[][]} vertices Mesh vertices.
     * @returns {number[][]}
     */
    static triangulateFace(indexes, vertices) {
        const projected = PcbAssemblyPolygonTriangulator.#projectFace(
            indexes,
            vertices
        )
        if (!projected.length) {
            return PcbAssemblyPolygonTriangulator.#fanTriangulate(indexes)
        }

        const nodes = indexes.map((sourceIndex, index) => ({
            sourceIndex,
            x: projected[index][0],
            y: projected[index][1]
        }))
        const signedArea = PcbAssemblyPolygonTriangulator.#signedArea(nodes)
        if (Math.abs(signedArea) <= EPSILON) {
            return PcbAssemblyPolygonTriangulator.#fanTriangulate(indexes)
        }

        return (
            PcbAssemblyPolygonTriangulator.#earClip(
                signedArea < 0 ? [...nodes].reverse() : [...nodes],
                signedArea < 0
            ) || PcbAssemblyPolygonTriangulator.#fanTriangulate(indexes)
        )
    }

    /**
     * Ear-clips one counter-clockwise projected polygon.
     * @param {{ sourceIndex: number, x: number, y: number }[]} nodes Polygon nodes.
     * @param {boolean} reverseOutput Whether output must be reversed to match source winding.
     * @returns {number[][] | null}
     */
    static #earClip(nodes, reverseOutput) {
        const remaining = [...nodes]
        const triangles = []
        let guard = remaining.length * remaining.length

        while (remaining.length > 3 && guard > 0) {
            guard -= 1
            const earIndex = PcbAssemblyPolygonTriangulator.#findEar(remaining)
            if (earIndex < 0) {
                return null
            }

            triangles.push(
                PcbAssemblyPolygonTriangulator.#triangleAt(
                    remaining,
                    earIndex,
                    reverseOutput
                )
            )
            remaining.splice(earIndex, 1)
        }

        if (remaining.length === 3) {
            triangles.push(
                PcbAssemblyPolygonTriangulator.#triangleFromNodes(
                    remaining[0],
                    remaining[1],
                    remaining[2],
                    reverseOutput
                )
            )
        }

        return triangles
    }

    /**
     * Finds the next removable ear.
     * @param {{ sourceIndex: number, x: number, y: number }[]} nodes Polygon nodes.
     * @returns {number}
     */
    static #findEar(nodes) {
        for (let index = 0; index < nodes.length; index += 1) {
            if (PcbAssemblyPolygonTriangulator.#isEar(nodes, index)) {
                return index
            }
        }

        return -1
    }

    /**
     * Returns true when the node at index forms a valid ear.
     * @param {{ sourceIndex: number, x: number, y: number }[]} nodes Polygon nodes.
     * @param {number} index Candidate index.
     * @returns {boolean}
     */
    static #isEar(nodes, index) {
        const previous = nodes[(index - 1 + nodes.length) % nodes.length]
        const current = nodes[index]
        const next = nodes[(index + 1) % nodes.length]

        if (
            PcbAssemblyPolygonTriangulator.#cross2d(previous, current, next) <=
            EPSILON
        ) {
            return false
        }

        return !nodes.some((node, nodeIndex) => {
            if (
                nodeIndex === index ||
                nodeIndex === (index - 1 + nodes.length) % nodes.length ||
                nodeIndex === (index + 1) % nodes.length
            ) {
                return false
            }

            return PcbAssemblyPolygonTriangulator.#pointInsideTriangle(
                node,
                previous,
                current,
                next
            )
        })
    }

    /**
     * Builds the triangle around one ear index.
     * @param {{ sourceIndex: number, x: number, y: number }[]} nodes Polygon nodes.
     * @param {number} index Ear index.
     * @param {boolean} reverseOutput Whether output must be reversed.
     * @returns {number[]}
     */
    static #triangleAt(nodes, index, reverseOutput) {
        return PcbAssemblyPolygonTriangulator.#triangleFromNodes(
            nodes[(index - 1 + nodes.length) % nodes.length],
            nodes[index],
            nodes[(index + 1) % nodes.length],
            reverseOutput
        )
    }

    /**
     * Builds one source-index triangle.
     * @param {{ sourceIndex: number }} first First node.
     * @param {{ sourceIndex: number }} second Second node.
     * @param {{ sourceIndex: number }} third Third node.
     * @param {boolean} reverseOutput Whether output must be reversed.
     * @returns {number[]}
     */
    static #triangleFromNodes(first, second, third, reverseOutput) {
        return reverseOutput
            ? [first.sourceIndex, third.sourceIndex, second.sourceIndex]
            : [first.sourceIndex, second.sourceIndex, third.sourceIndex]
    }

    /**
     * Projects a 3D face onto its dominant 2D plane.
     * @param {number[]} indexes Face vertex indexes.
     * @param {number[][]} vertices Mesh vertices.
     * @returns {number[][]}
     */
    static #projectFace(indexes, vertices) {
        const points = indexes
            .map((index) => vertices[index])
            .filter((point) => Array.isArray(point) && point.length >= 3)
        const normal = PcbAssemblyPolygonTriangulator.#newellNormal(points)
        const dominantAxis =
            Math.abs(normal[0]) >= Math.abs(normal[1]) &&
            Math.abs(normal[0]) >= Math.abs(normal[2])
                ? 0
                : Math.abs(normal[1]) >= Math.abs(normal[2])
                  ? 1
                  : 2

        if (
            Math.abs(normal[0]) <= EPSILON &&
            Math.abs(normal[1]) <= EPSILON &&
            Math.abs(normal[2]) <= EPSILON
        ) {
            return []
        }

        return points.map((point) =>
            dominantAxis === 0
                ? [Number(point[1] || 0), Number(point[2] || 0)]
                : dominantAxis === 1
                  ? [Number(point[0] || 0), Number(point[2] || 0)]
                  : [Number(point[0] || 0), Number(point[1] || 0)]
        )
    }

    /**
     * Computes a polygon normal with Newell's method.
     * @param {number[][]} points Face points.
     * @returns {number[]}
     */
    static #newellNormal(points) {
        const normal = [0, 0, 0]

        for (let index = 0; index < points.length; index += 1) {
            const current = points[index]
            const next = points[(index + 1) % points.length]
            normal[0] +=
                (Number(current[1] || 0) - Number(next[1] || 0)) *
                (Number(current[2] || 0) + Number(next[2] || 0))
            normal[1] +=
                (Number(current[2] || 0) - Number(next[2] || 0)) *
                (Number(current[0] || 0) + Number(next[0] || 0))
            normal[2] +=
                (Number(current[0] || 0) - Number(next[0] || 0)) *
                (Number(current[1] || 0) + Number(next[1] || 0))
        }

        return normal
    }

    /**
     * Computes signed polygon area in projected coordinates.
     * @param {{ x: number, y: number }[]} nodes Polygon nodes.
     * @returns {number}
     */
    static #signedArea(nodes) {
        let area = 0

        for (let index = 0; index < nodes.length; index += 1) {
            const current = nodes[index]
            const next = nodes[(index + 1) % nodes.length]
            area += current.x * next.y - next.x * current.y
        }

        return area / 2
    }

    /**
     * Computes the 2D cross product for three points.
     * @param {{ x: number, y: number }} first First point.
     * @param {{ x: number, y: number }} second Second point.
     * @param {{ x: number, y: number }} third Third point.
     * @returns {number}
     */
    static #cross2d(first, second, third) {
        return (
            (second.x - first.x) * (third.y - first.y) -
            (second.y - first.y) * (third.x - first.x)
        )
    }

    /**
     * Returns true when a point lies strictly inside a triangle.
     * @param {{ x: number, y: number }} point Candidate point.
     * @param {{ x: number, y: number }} first First triangle point.
     * @param {{ x: number, y: number }} second Second triangle point.
     * @param {{ x: number, y: number }} third Third triangle point.
     * @returns {boolean}
     */
    static #pointInsideTriangle(point, first, second, third) {
        const firstCross = PcbAssemblyPolygonTriangulator.#cross2d(
            first,
            second,
            point
        )
        const secondCross = PcbAssemblyPolygonTriangulator.#cross2d(
            second,
            third,
            point
        )
        const thirdCross = PcbAssemblyPolygonTriangulator.#cross2d(
            third,
            first,
            point
        )

        return (
            firstCross > EPSILON &&
            secondCross > EPSILON &&
            thirdCross > EPSILON
        )
    }

    /**
     * Falls back to simple fan triangles for degenerate faces.
     * @param {number[]} indexes Face vertex indexes.
     * @returns {number[][]}
     */
    static #fanTriangulate(indexes) {
        const triangles = []

        for (let index = 1; index < indexes.length - 1; index += 1) {
            triangles.push([indexes[0], indexes[index], indexes[index + 1]])
        }

        return triangles
    }
}
