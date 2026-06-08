import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dBoardShapeFactory } from '../../src/ui/PcbScene3dBoardShapeFactory.mjs'

test('PcbScene3dBoardShapeFactory cuts circular and slotted drills into the board shape', () => {
    const shape = PcbScene3dBoardShapeFactory.buildShape(
        THREE,
        {
            widthMil: 100,
            heightMil: 80,
            segments: []
        },
        {
            vias: [{ x: 50, y: 40, diameter: 20, holeDiameter: 12 }],
            pads: [
                {
                    x: 30,
                    y: 20,
                    holeDiameter: 18,
                    holeShape: null,
                    holeSlotLength: null,
                    holeRotation: null
                },
                {
                    x: 70,
                    y: 55,
                    holeDiameter: 12,
                    holeShape: 2,
                    holeSlotLength: 28,
                    holeRotation: 0,
                    rotation: 90
                }
            ]
        },
        (x, y) => ({ x: x - 50, y: y - 40 })
    )

    assert.equal(shape.holes.length, 3)

    const circularDrillBounds = shape.holes[1].getPoints(24).reduce(
        (bounds, point) => ({
            minX: Math.min(bounds.minX, point.x),
            maxX: Math.max(bounds.maxX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxY: Math.max(bounds.maxY, point.y)
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    )
    const slottedDrillBounds = shape.holes[2].getPoints(64).reduce(
        (bounds, point) => ({
            minX: Math.min(bounds.minX, point.x),
            maxX: Math.max(bounds.maxX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxY: Math.max(bounds.maxY, point.y)
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    )

    assert.ok(circularDrillBounds.maxX - circularDrillBounds.minX > 17)
    assert.ok(circularDrillBounds.maxY - circularDrillBounds.minY > 17)
    assert.ok(slottedDrillBounds.maxX - slottedDrillBounds.minX > 10)
    assert.ok(slottedDrillBounds.maxY - slottedDrillBounds.minY > 20)
    assert.ok(
        slottedDrillBounds.maxY - slottedDrillBounds.minY >
            slottedDrillBounds.maxX - slottedDrillBounds.minX + 6
    )
})

test('PcbScene3dBoardShapeFactory keeps board drill walls without filling the aperture', () => {
    const geometry = PcbScene3dBoardShapeFactory.buildGeometry(
        THREE,
        {
            widthMil: 100,
            heightMil: 80,
            thicknessMil: 12,
            segments: []
        },
        {
            vias: [{ x: 50, y: 40, diameter: 20, holeDiameter: 12 }],
            pads: []
        },
        (x, y) => ({ x: x - 50, y: y - 40 })
    )
    const materialIndices = new Set(
        geometry.groups.map((group) => group.materialIndex)
    )

    assert.ok(materialIndices.has(0), 'Expected board face material groups')
    assert.ok(materialIndices.has(1), 'Expected outer edge material groups')
    assert.equal(
        countCircularDrillFaceCapTriangles(geometry, 6),
        0,
        'Expected the drilled opening to remain uncapped'
    )
    assert.ok(
        countCircularDrillWallTriangles(geometry, 6),
        'Expected the drilled opening to keep a visible interior wall'
    )
})

test('PcbScene3dBoardShapeFactory cuts circular edge drills into the board substrate', () => {
    const geometry = PcbScene3dBoardShapeFactory.buildGeometry(
        THREE,
        {
            widthMil: 1000,
            heightMil: 500,
            thicknessMil: 62,
            segments: []
        },
        {
            pads: [],
            vias: [{ x: 0, y: 258, holeDiameter: 120 }]
        },
        (x, y) => ({ x, y })
    )

    assert.equal(
        countTopFaceTrianglesCoveringPoint(geometry, { x: 0, y: 200 }),
        0,
        'Expected the substrate face to leave the circular edge drill empty'
    )
    assert.ok(
        countTopFaceTrianglesCoveringPoint(geometry, { x: 60, y: 248 }) > 0,
        'Expected substrate outside the circular edge drill radius to remain present'
    )
})

test('PcbScene3dBoardShapeFactory colors plated drill walls as copper only', () => {
    const geometry = PcbScene3dBoardShapeFactory.buildGeometry(
        THREE,
        {
            widthMil: 120,
            heightMil: 100,
            thicknessMil: 12,
            segments: []
        },
        {
            vias: [{ x: 60, y: 50, diameter: 20, holeDiameter: 10 }],
            pads: [
                {
                    x: 30,
                    y: 30,
                    sizeTopX: 30,
                    sizeTopY: 30,
                    holeDiameter: 12
                },
                {
                    x: 90,
                    y: 30,
                    sizeTopX: 14,
                    sizeTopY: 14,
                    holeDiameter: 14
                }
            ]
        },
        (x, y) => ({ x: x - 60, y: y - 50 })
    )

    assert.ok(
        countCircularDrillWallTrianglesByMaterial(
            geometry,
            { centerX: 0, centerY: 0, radius: 5 },
            2
        ) > 0,
        'Expected via drill wall to use copper material'
    )
    assert.ok(
        countCircularDrillWallTrianglesByMaterial(
            geometry,
            { centerX: -30, centerY: -20, radius: 6 },
            2
        ) > 0,
        'Expected plated pad drill wall to use copper material'
    )
    assert.equal(
        countCircularDrillWallTrianglesByMaterial(
            geometry,
            { centerX: 30, centerY: -20, radius: 7 },
            2
        ),
        0,
        'Expected non-plated drill wall to avoid copper material'
    )
    assert.ok(
        countCircularDrillWallTrianglesByMaterial(
            geometry,
            { centerX: 30, centerY: -20, radius: 7 },
            1
        ) > 0,
        'Expected non-plated drill wall to keep edge material'
    )
})

/**
 * Counts side-wall triangles that lie on a circular drill contour.
 * @param {any} geometry
 * @param {number} radius
 * @returns {number}
 */
function countCircularDrillWallTriangles(geometry, radius) {
    const position = geometry.getAttribute('position')
    let count = 0

    for (const group of geometry.groups) {
        if (Number(group.materialIndex) === 0) {
            continue
        }

        const end = Number(group.start || 0) + Number(group.count || 0)
        for (let index = Number(group.start || 0); index < end; index += 3) {
            if (triangleMatchesCircularContour(position, index, radius)) {
                count += 1
            }
        }
    }

    return count
}

/**
 * Counts circular drill wall triangles assigned to one material.
 * @param {any} geometry
 * @param {{ centerX: number, centerY: number, radius: number }} drill
 * @param {number} materialIndex
 * @returns {number}
 */
function countCircularDrillWallTrianglesByMaterial(
    geometry,
    drill,
    materialIndex
) {
    let count = 0

    for (const group of geometry.groups) {
        if (Number(group.materialIndex) !== materialIndex) {
            continue
        }

        const end = Number(group.start || 0) + Number(group.count || 0)
        for (let index = Number(group.start || 0); index < end; index += 3) {
            if (triangleMatchesCircularDrill(geometry, index, drill)) {
                count += 1
            }
        }
    }

    return count
}

/**
 * Counts board face triangles whose centroid sits inside a circular drill.
 * @param {any} geometry
 * @param {number} radius
 * @returns {number}
 */
function countCircularDrillFaceCapTriangles(geometry, radius) {
    const position = geometry.getAttribute('position')
    let count = 0

    for (const group of geometry.groups) {
        if (Number(group.materialIndex) !== 0) {
            continue
        }

        const end = Number(group.start || 0) + Number(group.count || 0)
        for (let index = Number(group.start || 0); index < end; index += 3) {
            if (triangleCentroidRadius(position, index) < radius - 0.01) {
                count += 1
            }
        }
    }

    return count
}

/**
 * Counts board top-face triangles covering one XY point.
 * @param {any} geometry
 * @param {{ x: number, y: number }} point
 * @returns {number}
 */
function countTopFaceTrianglesCoveringPoint(geometry, point) {
    let count = 0

    for (const group of geometry.groups) {
        if (Number(group.materialIndex) !== 0) {
            continue
        }

        const end = Number(group.start || 0) + Number(group.count || 0)
        for (let index = Number(group.start || 0); index < end; index += 3) {
            if (
                isTopFaceTriangle(geometry, index) &&
                triangleContainsPoint(geometry, index, point)
            ) {
                count += 1
            }
        }
    }

    return count
}

/**
 * Checks whether one triangle lies on the board top face.
 * @param {any} geometry
 * @param {number} vertexIndex
 * @returns {boolean}
 */
function isTopFaceTriangle(geometry, vertexIndex) {
    const position = geometry.getAttribute('position')

    for (let offset = 0; offset < 3; offset += 1) {
        const index = resolveGeometryVertexIndex(geometry, vertexIndex + offset)
        if (Math.abs(position.getZ(index) - 31) > 0.001) {
            return false
        }
    }

    return true
}

/**
 * Checks whether one triangle covers one XY point.
 * @param {any} geometry
 * @param {number} vertexIndex
 * @param {{ x: number, y: number }} point
 * @returns {boolean}
 */
function triangleContainsPoint(geometry, vertexIndex, point) {
    const [a, b, c] = [0, 1, 2].map((offset) =>
        resolveGeometryPoint(geometry, vertexIndex + offset)
    )
    const area = resolveSignedArea(a, b, c)

    if (Math.abs(area) < 0.001) {
        return false
    }

    const first = resolveSignedArea(point, b, c) / area
    const second = resolveSignedArea(a, point, c) / area
    const third = resolveSignedArea(a, b, point) / area

    return first >= -0.001 && second >= -0.001 && third >= -0.001
}

/**
 * Resolves one geometry vertex as an XY point.
 * @param {any} geometry
 * @param {number} vertexIndex
 * @returns {{ x: number, y: number }}
 */
function resolveGeometryPoint(geometry, vertexIndex) {
    const position = geometry.getAttribute('position')
    const index = resolveGeometryVertexIndex(geometry, vertexIndex)

    return {
        x: position.getX(index),
        y: position.getY(index)
    }
}

/**
 * Resolves the signed area for three XY points.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {{ x: number, y: number }} c
 * @returns {number}
 */
function resolveSignedArea(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/**
 * Resolves the XY radius of one triangle centroid.
 * @param {any} position
 * @param {number} vertexIndex
 * @returns {number}
 */
function triangleCentroidRadius(position, vertexIndex) {
    let x = 0
    let y = 0

    for (let offset = 0; offset < 3; offset += 1) {
        const index = vertexIndex + offset
        x += position.getX(index)
        y += position.getY(index)
    }

    return Math.hypot(x / 3, y / 3)
}

/**
 * Checks whether one triangle is part of a circular drill wall.
 * @param {any} position
 * @param {number} vertexIndex
 * @param {number} radius
 * @returns {boolean}
 */
function triangleMatchesCircularContour(position, vertexIndex, radius) {
    let matchedVertices = 0

    for (let offset = 0; offset < 3; offset += 1) {
        const index = vertexIndex + offset
        const vertexRadius = Math.hypot(
            position.getX(index),
            position.getY(index)
        )
        if (Math.abs(vertexRadius - radius) < 0.01) {
            matchedVertices += 1
        }
    }

    return matchedVertices >= 2
}

/**
 * Checks whether one triangle is part of a circular drill wall.
 * @param {any} geometry
 * @param {number} vertexIndex
 * @param {{ centerX: number, centerY: number, radius: number }} drill
 * @returns {boolean}
 */
function triangleMatchesCircularDrill(geometry, vertexIndex, drill) {
    const position = geometry.getAttribute('position')
    let matchedVertices = 0

    for (let offset = 0; offset < 3; offset += 1) {
        const index = resolveGeometryVertexIndex(geometry, vertexIndex + offset)
        const vertexRadius = Math.hypot(
            position.getX(index) - drill.centerX,
            position.getY(index) - drill.centerY
        )
        if (Math.abs(vertexRadius - drill.radius) < 0.01) {
            matchedVertices += 1
        }
    }

    return matchedVertices >= 2
}

/**
 * Resolves one vertex index from indexed or non-indexed geometry.
 * @param {any} geometry
 * @param {number} index
 * @returns {number}
 */
function resolveGeometryVertexIndex(geometry, index) {
    return geometry.index?.getX?.(index) ?? index
}
