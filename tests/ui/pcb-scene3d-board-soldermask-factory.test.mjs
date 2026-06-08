import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dBoardSolderMaskFactory } from '../../src/ui/PcbScene3dBoardSolderMaskFactory.mjs'

test('PcbScene3dBoardSolderMaskFactory builds coplanar drilled board-assembly mask faces', () => {
    const group = PcbScene3dBoardSolderMaskFactory.buildGroup(
        THREE,
        {
            board: {
                widthMil: 1000,
                heightMil: 500,
                thicknessMil: 62,
                centerX: 500,
                centerY: 250,
                surfaceColor: 0x17396b,
                segments: []
            },
            boardAssemblyModel: { name: 'assembly.step' },
            detail: {
                pads: [],
                vias: []
            }
        },
        (x, y) => ({ x: x - 500, y: 250 - y })
    )

    assert.equal(group.name, 'board-solder-mask')
    assert.equal(group.children.length, 2)
    assert.equal(group.children[0].geometry.type, 'ShapeGeometry')
    assert.equal(group.children[0].material.color.getHex(), 0x2a5f27)
    assert.equal(group.children[0].material.side, THREE.FrontSide)
    assert.equal(group.children[1].material.side, THREE.BackSide)
    assert.equal(group.children[0].position.z, 31)
    assert.equal(group.children[1].position.z, -31)
    assert.equal(group.children[0].material.polygonOffset, true)
    assert.equal(group.children[0].material.polygonOffsetFactor, -1)
    assert.equal(group.children[0].material.polygonOffsetUnits, -1)
    assert.equal(group.children[0].scale.x, 1)
    assert.equal(group.children[0].scale.y, 1)
    assert.equal(Math.round(resolveTransformedBounds(group.children[0]).width), 1000)
    assert.equal(Math.round(resolveTransformedBounds(group.children[0]).height), 500)
    assert.ok(
        countTrianglesCoveringPoint(group.children[0], { x: -495, y: 0 }) > 0,
        'Expected the mask surface to cover the board face up to the perimeter'
    )
    assert.equal(
        countTrianglesCoveringPoint(group.children[0], { x: -505, y: 0 }),
        0,
        'Expected the mask surface to avoid geometry outside the board perimeter'
    )
})

test('PcbScene3dBoardSolderMaskFactory keeps edge drill apertures anchored', () => {
    const group = PcbScene3dBoardSolderMaskFactory.buildGroup(
        THREE,
        {
            board: {
                widthMil: 1000,
                heightMil: 500,
                thicknessMil: 62,
                centerX: 500,
                centerY: 250,
                surfaceColor: 0x17396b,
                segments: []
            },
            boardAssemblyModel: { name: 'assembly.step' },
            detail: {
                pads: [],
                vias: [{ x: 80, y: 250, holeDiameter: 60 }]
            }
        },
        (x, y) => ({ x: x - 500, y: 250 - y })
    )

    assert.equal(countTrianglesCoveringPoint(group.children[0], { x: -420, y: 0 }), 0)
    assert.ok(
        countTrianglesCoveringPoint(group.children[0], { x: -385, y: 0 }) > 0,
        'Expected the mask surface beside the drilled opening to remain present'
    )
})

test('PcbScene3dBoardSolderMaskFactory cuts edge drills out of the mask surface', () => {
    const drillCenter = { x: -460, y: 0 }
    const group = PcbScene3dBoardSolderMaskFactory.buildGroup(
        THREE,
        {
            board: {
                widthMil: 1000,
                heightMil: 500,
                thicknessMil: 62,
                centerX: 500,
                centerY: 250,
                surfaceColor: 0x17396b,
                segments: []
            },
            boardAssemblyModel: { name: 'assembly.step' },
            detail: {
                pads: [],
                vias: [{ x: 40, y: 250, holeDiameter: 70 }]
            }
        },
        (x, y) => ({ x: x - 500, y: 250 - y })
    )

    assert.equal(
        countTrianglesCoveringPoint(group.children[0], drillCenter),
        0,
        'Expected the solder-mask mesh to leave the drilled opening empty'
    )
})

test('PcbScene3dBoardSolderMaskFactory preserves round edge drill apertures', () => {
    const group = PcbScene3dBoardSolderMaskFactory.buildGroup(
        THREE,
        {
            board: {
                widthMil: 1000,
                heightMil: 500,
                thicknessMil: 62,
                surfaceColor: 0x17396b,
                segments: []
            },
            boardAssemblyModel: { name: 'assembly.step' },
            detail: {
                pads: [],
                vias: [{ x: 0, y: 258, holeDiameter: 120 }]
            }
        },
        (x, y) => ({ x, y })
    )

    assert.equal(
        countTrianglesCoveringPoint(group.children[0], { x: 0, y: 200 }),
        0,
        'Expected the circular edge drill interior to stay empty'
    )
    assert.ok(
        countTrianglesCoveringPoint(group.children[0], { x: 60, y: 248 }) > 0,
        'Expected mask outside the circular edge drill radius to remain present'
    )
})

test('PcbScene3dBoardSolderMaskFactory keeps internal circular drills as arc holes', () => {
    const group = PcbScene3dBoardSolderMaskFactory.buildGroup(
        THREE,
        {
            board: {
                widthMil: 1000,
                heightMil: 500,
                thicknessMil: 62,
                centerX: 500,
                centerY: 250,
                surfaceColor: 0x17396b,
                segments: []
            },
            boardAssemblyModel: { name: 'assembly.step' },
            detail: {
                pads: [],
                vias: [{ x: 500, y: 250, holeDiameter: 40 }]
            }
        },
        (x, y) => ({ x: x - 500, y: 250 - y })
    )
    const holeCurves =
        group.children[0].geometry.parameters?.shapes?.holes?.[0]?.curves || []

    assert.ok(
        holeCurves.some((curve) => curve.type === 'EllipseCurve'),
        'Expected interior circular drills to stay arc-based instead of clipped polygons'
    )
    assert.equal(
        countTrianglesCoveringPoint(group.children[0], { x: 0, y: 0 }),
        0,
        'Expected the solder-mask mesh to leave the internal drill center empty'
    )
})

test('PcbScene3dBoardSolderMaskFactory skips non-assembly boards', () => {
    const group = PcbScene3dBoardSolderMaskFactory.buildGroup(
        THREE,
        {
            board: {
                widthMil: 1000,
                heightMil: 500,
                thicknessMil: 62,
                centerX: 500,
                centerY: 250,
                surfaceColor: 0x17396b,
                segments: []
            },
            detail: {}
        },
        (x, y) => ({ x: x - 500, y: 250 - y })
    )

    assert.equal(group.children.length, 0)
})

/**
 * Resolves XY bounds from a mesh after applying its transform scale.
 * @param {{ geometry?: any, scale?: { x?: number, y?: number } }} mesh
 * @param {((point: { x: number, y: number }) => boolean) | null} [filter]
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, width: number, height: number }}
 */
function resolveTransformedBounds(mesh, filter = null) {
    const position = mesh.geometry.getAttribute('position')
    const scaleX = Number(mesh.scale?.x || 1)
    const scaleY = Number(mesh.scale?.y || 1)
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    }

    for (let index = 0; index < position.count; index += 1) {
        const point = {
            x: position.getX(index) * scaleX,
            y: position.getY(index) * scaleY
        }

        if (filter && !filter(point)) {
            continue
        }

        bounds.minX = Math.min(bounds.minX, point.x)
        bounds.maxX = Math.max(bounds.maxX, point.x)
        bounds.minY = Math.min(bounds.minY, point.y)
        bounds.maxY = Math.max(bounds.maxY, point.y)
    }

    return {
        ...bounds,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY
    }
}

/**
 * Counts triangles whose projected XY area covers a point.
 * @param {{ geometry?: any, scale?: { x?: number, y?: number } }} mesh
 * @param {{ x: number, y: number }} point
 * @returns {number}
 */
function countTrianglesCoveringPoint(mesh, point) {
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.index
    const scaleX = Number(mesh.scale?.x || 1)
    const scaleY = Number(mesh.scale?.y || 1)
    const vertexCount = index ? index.count : position.count
    let count = 0

    for (let triangleIndex = 0; triangleIndex < vertexCount; triangleIndex += 3) {
        const vertices = [0, 1, 2].map((offset) => {
            const vertexIndex = index
                ? index.getX(triangleIndex + offset)
                : triangleIndex + offset
            return {
                x: position.getX(vertexIndex) * scaleX,
                y: position.getY(vertexIndex) * scaleY
            }
        })

        if (pointFallsInsideTriangle(point, vertices[0], vertices[1], vertices[2])) {
            count += 1
        }
    }

    return count
}

/**
 * Checks whether a point falls inside a triangle in XY space.
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {{ x: number, y: number }} c
 * @returns {boolean}
 */
function pointFallsInsideTriangle(point, a, b, c) {
    const v0 = { x: c.x - a.x, y: c.y - a.y }
    const v1 = { x: b.x - a.x, y: b.y - a.y }
    const v2 = { x: point.x - a.x, y: point.y - a.y }
    const dot00 = v0.x * v0.x + v0.y * v0.y
    const dot01 = v0.x * v1.x + v0.y * v1.y
    const dot02 = v0.x * v2.x + v0.y * v2.y
    const dot11 = v1.x * v1.x + v1.y * v1.y
    const dot12 = v1.x * v2.x + v1.y * v2.y
    const denominator = dot00 * dot11 - dot01 * dot01

    if (Math.abs(denominator) < Number.EPSILON) {
        return false
    }

    const inverseDenominator = 1 / denominator
    const u = (dot11 * dot02 - dot01 * dot12) * inverseDenominator
    const v = (dot00 * dot12 - dot01 * dot02) * inverseDenominator

    return u >= 0 && v >= 0 && u + v <= 1
}
