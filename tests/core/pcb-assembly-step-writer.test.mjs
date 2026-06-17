import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PcbAssemblyMeshUtils } from '../../src/core/assembly/PcbAssemblyMeshUtils.mjs'
import { PcbAssemblyStepWriter } from '../../src/core/assembly/PcbAssemblyStepWriter.mjs'

const rootPath = fileURLToPath(new URL('../../', import.meta.url))

/**
 * Builds a simple closed board mesh for STEP writer tests.
 * @returns {{ name: string, vertices: number[][], faces: number[][] }}
 */
function createBoxMesh() {
    return PcbAssemblyMeshUtils.box('board', {
        width: 100,
        depth: 80,
        height: 10,
        color: [0.05, 0.32, 0.18]
    })
}

/**
 * Builds the source points for a notched board outline.
 * @returns {number[][]}
 */
function createNotchedBoardPoints() {
    return [
        [0, 0],
        [100, 0],
        [100, 100],
        [60, 100],
        [60, 40],
        [40, 40],
        [40, 100],
        [0, 100]
    ]
}

/**
 * Builds a notched board outline that fan triangulation cannot fill correctly.
 * @returns {{ name: string, vertices: number[][], faces: number[][] }}
 */
function createNotchedBoardMesh() {
    return PcbAssemblyMeshUtils.prism(
        'notched-board',
        createNotchedBoardPoints(),
        0,
        10,
        [0.05, 0.32, 0.18]
    )
}

/**
 * Adds enough tiny meshes to force AP242 tessellated STEP output.
 * @param {object} firstMesh Mesh that should remain first in the export.
 * @returns {object[]}
 */
function forceTessellatedMeshes(firstMesh) {
    return [
        firstMesh,
        ...Array.from({ length: 513 }, (_entry, index) => {
            const mesh = PcbAssemblyMeshUtils.box('dummy-' + index, {
                x: index * 2,
                width: 0.5,
                depth: 0.5,
                height: 0.5
            })
            return mesh
        })
    ]
}

/**
 * Extracts the first tessellated surface set for a named mesh.
 * @param {string} stepText STEP output.
 * @param {string} meshName Mesh name.
 * @returns {{ coordinates: number[][], triangles: number[][] }}
 */
function extractTessellatedSurface(stepText, meshName) {
    const escapedName = meshName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const pattern = new RegExp(
        "#\\d+=COORDINATES_LIST\\('',\\d+,\\(([\\s\\S]*?)\\)\\);\\n" +
            "#\\d+=TRIANGULATED_SURFACE_SET\\('" +
            escapedName +
            "',#\\d+,\\d+,\\(\\),\\(\\),\\(([\\s\\S]*?)\\)\\);",
        'u'
    )
    const match = stepText.match(pattern)

    assert.ok(match, 'Expected tessellated surface set for ' + meshName)
    return {
        coordinates: parseTupleList(match[1]),
        triangles: parseTupleList(match[2]).map((tuple) =>
            tuple.map((value) => Number(value) - 1)
        )
    }
}

/**
 * Parses STEP tuple lists into numeric arrays.
 * @param {string} text Tuple source.
 * @returns {number[][]}
 */
function parseTupleList(text) {
    return [...String(text || '').matchAll(/\(([-+0-9.Ee,\s]+)\)/gu)].map(
        (match) => match[1].split(',').map(Number)
    )
}

/**
 * Finds planar triangle centroids that fall outside the source board polygon.
 * @param {{ coordinates: number[][], triangles: number[][] }} surface Tessellated surface.
 * @param {number[][]} boardPolygon Source board polygon in exported coordinates.
 * @returns {number[][]}
 */
function outsideBoardTriangleCentroids(surface, boardPolygon) {
    const zValues = surface.coordinates.map((point) => point[1])
    const boardZ = Math.min(...zValues)

    return surface.triangles
        .filter((triangle) =>
            triangle.every(
                (index) =>
                    Math.abs(surface.coordinates[index][1] - boardZ) < 0.000001
            )
        )
        .map((triangle) => {
            const points = triangle.map((index) => surface.coordinates[index])
            return [
                points.reduce((sum, point) => sum + point[0], 0) / 3,
                points.reduce((sum, point) => sum + point[2], 0) / 3
            ]
        })
        .filter((point) => !isPointInPolygon(point, boardPolygon))
}

/**
 * Tests whether a point is inside a polygon.
 * @param {number[]} point Candidate point.
 * @param {number[][]} polygon Polygon points.
 * @returns {boolean}
 */
function isPointInPolygon(point, polygon) {
    let inside = false

    for (
        let index = 0, previous = polygon.length - 1;
        index < polygon.length;
        previous = index, index += 1
    ) {
        const currentPoint = polygon[index]
        const previousPoint = polygon[previous]
        const crosses =
            currentPoint[1] > point[1] !== previousPoint[1] > point[1]
        const xAtY =
            ((previousPoint[0] - currentPoint[0]) *
                (point[1] - currentPoint[1])) /
                (previousPoint[1] - currentPoint[1]) +
            currentPoint[0]

        if (crosses && point[0] < xAtY) {
            inside = !inside
        }
    }

    return inside
}

test('PcbAssemblyStepWriter writes displayable surface-backed B-rep topology', () => {
    const stepText = PcbAssemblyStepWriter.write({
        name: 'fake-board',
        meshes: [createBoxMesh()]
    })

    assert.match(stepText, /ADVANCED_BREP_SHAPE_REPRESENTATION\('/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('board'/)
    assert.match(stepText, /ADVANCED_FACE\('/)
    assert.match(stepText, /PLANE\('/)
    assert.match(stepText, /EDGE_LOOP\('/)
    assert.match(stepText, /ORIENTED_EDGE\('/)
    assert.match(stepText, /EDGE_CURVE\('/)
    assert.match(stepText, /COLOUR_RGB\('',0\.05,0\.32,0\.18\)/)
    assert.match(stepText, /STYLED_ITEM\('',\(#\d+\),#\d+\)/)
    assert.doesNotMatch(stepText, /FACETED_BREP\('/)
    assert.doesNotMatch(stepText, /#[0-9]+=FACE\('/)
    assert.doesNotMatch(stepText, /POLY_LOOP\('/)
})

test('PcbAssemblyStepWriter exports PCB thickness on the top-bottom axis', () => {
    const stepText = PcbAssemblyStepWriter.write({
        name: 'fake-board',
        meshes: [createBoxMesh()]
    })
    const points = [...stepText.matchAll(/CARTESIAN_POINT\('',\(([^)]*)\)\)/g)]
        .map((match) => match[1].split(',').map(Number))
        .filter((point) => point.length === 3)
    const spans = [0, 1, 2].map((axis) => {
        const values = points.map((point) => point[axis])
        return Math.max(...values) - Math.min(...values)
    })

    assert.equal(Number(spans[0].toFixed(3)), 2.54)
    assert.equal(Number(spans[1].toFixed(3)), 0.254)
    assert.equal(Number(spans[2].toFixed(3)), 2.032)
})

test('PcbAssemblyStepWriter uses compact tessellated STEP for dense detail', () => {
    const meshes = Array.from({ length: 1200 }, (_entry, index) => {
        const mesh = createBoxMesh()
        return {
            ...mesh,
            name: 'dense-copper-' + (index + 1),
            vertices: mesh.vertices.map((vertex) => [
                vertex[0] + index * 12,
                vertex[1],
                vertex[2]
            ])
        }
    })
    const stepText = PcbAssemblyStepWriter.write({
        name: 'dense-fake-board',
        meshes
    })

    assert.match(stepText, /AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF/)
    assert.match(stepText, /TESSELLATED_SHAPE_REPRESENTATION\('/)
    assert.match(stepText, /TRIANGULATED_SURFACE_SET\('/)
    assert.match(stepText, /COLOUR_RGB\('',0\.05,0\.32,0\.18\)/)
    assert.match(stepText, /STYLED_ITEM\('',\(#\d+\),#\d+\)/)
    assert.doesNotMatch(stepText, /MANIFOLD_SOLID_BREP\('/)
    assert.ok(stepText.length < 2_500_000)
})

test('PcbAssemblyStepWriter tessellates concave board outlines without fill chords', () => {
    const stepText = PcbAssemblyStepWriter.write({
        name: 'dense-notched-board',
        meshes: forceTessellatedMeshes(createNotchedBoardMesh())
    })
    const surface = extractTessellatedSurface(stepText, 'notched-board')
    const boardPolygon = createNotchedBoardPoints().map((point) => [
        point[0] * 0.0254,
        -point[1] * 0.0254
    ])

    assert.deepEqual(outsideBoardTriangleCentroids(surface, boardPolygon), [])
})

test('PcbAssemblyStepWriter output imports through the vendored OCCT STEP reader', () => {
    const script = `
import { readFile } from 'node:fs/promises'
import occtFactory from './src/vendor/occt-import-js/dist/occt-import-js.js'
import { PcbAssemblyMeshUtils } from './src/core/assembly/PcbAssemblyMeshUtils.mjs'
import { PcbAssemblyStepWriter } from './src/core/assembly/PcbAssemblyStepWriter.mjs'

try {
    const wasmBinary = await readFile('./src/vendor/occt-import-js/dist/occt-import-js.wasm')
    const occt = await occtFactory({ wasmBinary })
    const mesh = PcbAssemblyMeshUtils.cylinder('board', {
        radius: 50,
        height: 10,
        segments: 16
    })
    const stepText = PcbAssemblyStepWriter.write({
        name: 'fake-board',
        meshes: [mesh]
    })
    const result = occt.ReadFile(
        'step',
        new TextEncoder().encode(stepText),
        null
    )
    if (!result?.success || !Array.isArray(result.meshes) || !result.meshes.length) {
        console.error(JSON.stringify(result))
        process.exit(1)
    }
    console.log(JSON.stringify({
        success: result.success,
        meshCount: result.meshes.length
    }))
} catch (error) {
    console.error(String(error?.stack || error?.message || error))
    process.exit(1)
}
`
    const result = spawnSync(process.execPath, ['--input-type=module'], {
        cwd: rootPath,
        encoding: 'utf8',
        input: script,
        timeout: 20000
    })
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')

    assert.equal(result.status, 0, output)

    const summaryLine = result.stdout.trim().split('\n').at(-1)
    const summary = JSON.parse(summaryLine)
    assert.equal(summary.success, true)
    assert.ok(summary.meshCount > 0)
})
