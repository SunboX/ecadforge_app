import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dSilkscreenFactory } from '../../src/ui/PcbScene3dSilkscreenFactory.mjs'

/**
 * Builds axis-aligned bounds from one flattened position buffer.
 * @param {ArrayLike<number>} positions
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number }}
 */
function resolveBounds(positions) {
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity
    }

    for (let index = 0; index < positions.length; index += 3) {
        bounds.minX = Math.min(bounds.minX, positions[index])
        bounds.maxX = Math.max(bounds.maxX, positions[index])
        bounds.minY = Math.min(bounds.minY, positions[index + 1])
        bounds.maxY = Math.max(bounds.maxY, positions[index + 1])
        bounds.minZ = Math.min(bounds.minZ, positions[index + 2])
        bounds.maxZ = Math.max(bounds.maxZ, positions[index + 2])
    }

    return bounds
}

test('PcbScene3dSilkscreenFactory overlaps dense sub-mil hatch tracks', () => {
    const tracks = Array.from({ length: 180 }, (_, index) => ({
        x1: 10 + index * 0.58,
        y1: 20,
        x2: 10 + index * 0.58,
        y2: 80,
        width: 0.57
    }))
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [],
                tracks,
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
        },
        12,
        -12,
        (x, y) => ({ x, y })
    )

    const trackMesh = group.children[0].children[0]
    const positions = trackMesh.geometry.getAttribute('position').array
    const firstTrackBounds = resolveBounds(positions.slice(0, 18))

    assert.equal(
        Number((firstTrackBounds.maxX - firstTrackBounds.minX).toFixed(2)),
        1.2
    )
})

test('PcbScene3dSilkscreenFactory offsets same-color strokes above fills', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fillColor: 0xebebeb,
                strokeColor: 0xebebeb,
                fills: [
                    {
                        points: [
                            { x: 10, y: 20 },
                            { x: 80, y: 20 },
                            { x: 80, y: 90 },
                            { x: 10, y: 90 }
                        ]
                    }
                ],
                tracks: [{ x1: 10, y1: 20, x2: 80, y2: 20, width: 8 }],
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const topGroup = group.children[0]
    const trackMesh = topGroup.children[0]
    const fillMesh = topGroup.children[1]
    const trackZ = trackMesh.geometry.getAttribute('position').array[2]

    assert.ok(trackZ > fillMesh.position.z)
})
