import assert from 'node:assert/strict'
import test from 'node:test'
import { WorkerUrlBuilder } from '../src/WorkerUrlBuilder.mjs'

/**
 * Verifies parser worker URLs get a cache-busting query key on top of the
 * resolved module path.
 */
test('buildParserWorkerUrl appends a cache-busting key', () => {
    const workerUrl = WorkerUrlBuilder.buildParserWorkerUrl(
        'http://localhost:3000/main.mjs',
        '12345'
    )

    assert.equal(
        workerUrl.href,
        'http://localhost:3000/workers/altium-parser.worker.mjs?v=12345'
    )
})

/**
 * Verifies 3D scene worker URLs get the same cache-busting query key.
 */
test('buildScene3dWorkerUrl appends a cache-busting key', () => {
    const workerUrl = WorkerUrlBuilder.buildScene3dWorkerUrl(
        'http://localhost:3000/main.mjs',
        '12345'
    )

    assert.equal(
        workerUrl.href,
        'http://localhost:3000/workers/pcb-scene3d.worker.mjs?v=12345'
    )
})
