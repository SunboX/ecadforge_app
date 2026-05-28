import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dStepLoader } from '../../src/ui/PcbScene3dStepLoader.mjs'

/**
 * Minimal worker fake for STEP loader lifecycle tests.
 */
class FakeStepWorker {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    /** @type {any[]} */
    postedMessages

    /** @type {number} */
    terminateCalls

    constructor() {
        this.#listeners = new Map()
        this.postedMessages = []
        this.terminateCalls = 0
    }

    /**
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }

        this.#listeners.get(type)?.add(listener)
    }

    /**
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }

    /**
     * @param {{ buffer?: ArrayBuffer }} message
     * @returns {void}
     */
    postMessage(message) {
        this.postedMessages.push(message)
        queueMicrotask(() => {
            const byteLength = Number(message?.buffer?.byteLength || 0)
            this.#emitMessage({
                success: true,
                meshes: [
                    {
                        name: 'body-' + this.postedMessages.length,
                        color: [0.4, 0.5, 0.6],
                        attributes: {
                            position: {
                                array: [0, 0, 0, byteLength || 1, 0, 0, 0, 1, 0]
                            },
                            normal: {
                                array: [0, 0, 1, 0, 0, 1, 0, 0, 1]
                            }
                        },
                        index: { array: [0, 1, 2] }
                    }
                ]
            })
        })
    }

    /**
     * @returns {void}
     */
    terminate() {
        this.terminateCalls += 1
    }

    /**
     * @param {any} data
     * @returns {void}
     */
    #emitMessage(data) {
        ;[...(this.#listeners.get('message') || [])].forEach((listener) =>
            listener({ data })
        )
    }
}

/**
 * Verifies repeated STEP loads reuse the cached importer result.
 */
test('PcbScene3dStepLoader caches parsed STEP payloads by model identity', async () => {
    let importerCalls = 0
    const loader = new PcbScene3dStepLoader({
        importerLoader: async () => ({
            ReadStepFile(content, params) {
                importerCalls += 1

                assert.equal(content instanceof Uint8Array, true)
                assert.equal(params.linearUnit, 'inch')

                return {
                    success: true,
                    meshes: [
                        {
                            name: 'body',
                            color: [0.5, 0.5, 0.5],
                            brep_faces: [
                                {
                                    first: 1,
                                    last: 1,
                                    color: [0.9, 0.8, 0.7]
                                }
                            ],
                            attributes: {
                                position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] },
                                normal: { array: [0, 0, 1, 0, 0, 1, 0, 0, 1] }
                            },
                            index: { array: [0, 1, 2] }
                        }
                    ]
                }
            }
        })
    })
    const model = {
        origin: 'embedded',
        name: 'SOT-23_Y.stp',
        format: 'step',
        payloadText: 'ISO-10303-21;',
        sourceStream: 'Models/0'
    }

    const firstLoad = await loader.loadModel(model)
    const secondLoad = await loader.loadModel(model)

    assert.equal(importerCalls, 1)
    assert.equal(firstLoad, secondLoad)
    assert.equal(firstLoad.meshPayloads.length, 1)
    assert.deepEqual(firstLoad.meshPayloads[0].positions, [0, 0, 0, 1, 0, 0, 0, 1, 0])
    assert.deepEqual(firstLoad.meshPayloads[0].indices, [0, 1, 2])
    assert.deepEqual(firstLoad.meshPayloads[0].faceColors, [
        {
            first: 1,
            last: 1,
            color: [0.9, 0.8, 0.7]
        }
    ])
})

/**
 * Verifies importer failures reject cleanly with a descriptive STEP error.
 */
test('PcbScene3dStepLoader rejects invalid STEP payloads cleanly', async () => {
    const loader = new PcbScene3dStepLoader({
        importerLoader: async () => ({
            ReadStepFile() {
                return {
                    success: false
                }
            }
        })
    })

    await assert.rejects(
        loader.loadModel({
            origin: 'embedded',
            name: 'broken.stp',
            format: 'step',
            payloadText: 'not a real step file',
            sourceStream: 'Models/9'
        }),
        /STEP import failed for broken\.stp/
    )
})

/**
 * Verifies STEP payloads with obviously baked-in XY world offsets are
 * normalized back around the local origin.
 */
test('PcbScene3dStepLoader normalizes large baked-in XY model offsets', async () => {
    const loader = new PcbScene3dStepLoader({
        importerLoader: async () => ({
            ReadStepFile() {
                return {
                    success: true,
                    meshes: [
                        {
                            name: 'body',
                            color: [0.5, 0.5, 0.5],
                            attributes: {
                                position: {
                                    array: [
                                        1000, 10, 0,
                                        1001, 10, 0,
                                        1000, 11, 0
                                    ]
                                },
                                normal: {
                                    array: [
                                        0, 0, 1,
                                        0, 0, 1,
                                        0, 0, 1
                                    ]
                                }
                            },
                            index: { array: [0, 1, 2] }
                        }
                    ]
                }
            }
        })
    })

    const load = await loader.loadModel({
        origin: 'embedded',
        name: 'shifted.stp',
        format: 'step',
        payloadText: 'ISO-10303-21;',
        sourceStream: 'Models/1'
    })

    assert.deepEqual(load.meshPayloads[0].positions, [
        -0.5, -0.5, 0,
        0.5, -0.5, 0,
        -0.5, 0.5, 0
    ])
})

/**
 * Verifies project-local STEP models keep their authored origin because KiCad
 * applies footprint model transforms against that raw coordinate frame.
 */
test('PcbScene3dStepLoader preserves session STEP model origins', async () => {
    const loader = new PcbScene3dStepLoader({
        importerLoader: async () => ({
            ReadStepFile() {
                return {
                    success: true,
                    meshes: [
                        {
                            name: 'body',
                            color: [0.5, 0.5, 0.5],
                            attributes: {
                                position: {
                                    array: [
                                        1000, 10, 0,
                                        1001, 10, 0,
                                        1000, 11, 0
                                    ]
                                },
                                normal: {
                                    array: [
                                        0, 0, 1,
                                        0, 0, 1,
                                        0, 0, 1
                                    ]
                                }
                            },
                            index: { array: [0, 1, 2] }
                        }
                    ]
                }
            }
        })
    })

    const load = await loader.loadModel({
        origin: 'session',
        name: 'project-local.step',
        format: 'step',
        payloadText: 'ISO-10303-21;',
        relativePath: 'parts/project-local.step'
    })

    assert.deepEqual(load.meshPayloads[0].positions, [
        1000, 10, 0,
        1001, 10, 0,
        1000, 11, 0
    ])
})

/**
 * Verifies worker-backed STEP imports reuse one persistent worker across
 * distinct model loads.
 */
test('PcbScene3dStepLoader reuses one STEP worker across distinct model loads', async () => {
    const createdWorkers = []
    const loader = new PcbScene3dStepLoader({
        stepWorkerFactory: () => {
            const worker = new FakeStepWorker()
            createdWorkers.push(worker)
            return worker
        }
    })

    const firstLoad = await loader.loadModel({
        origin: 'embedded',
        name: 'alpha.step',
        format: 'step',
        payloadText: 'ISO-10303-21;ALPHA',
        sourceStream: 'Models/10'
    })
    const secondLoad = await loader.loadModel({
        origin: 'embedded',
        name: 'beta.step',
        format: 'step',
        payloadText: 'ISO-10303-21;BETA',
        sourceStream: 'Models/11'
    })

    assert.equal(createdWorkers.length, 1)
    assert.equal(createdWorkers[0].postedMessages.length, 2)
    assert.equal(createdWorkers[0].terminateCalls, 0)
    assert.equal(firstLoad.meshPayloads.length, 1)
    assert.equal(secondLoad.meshPayloads.length, 1)

    loader.dispose?.()
})

/**
 * Verifies STEP loader disposal tears down the persistent worker exactly once.
 */
test('PcbScene3dStepLoader dispose terminates its persistent STEP worker', async () => {
    const worker = new FakeStepWorker()
    const loader = new PcbScene3dStepLoader({
        stepWorkerFactory: () => worker
    })

    await loader.loadModel({
        origin: 'embedded',
        name: 'gamma.step',
        format: 'step',
        payloadText: 'ISO-10303-21;GAMMA',
        sourceStream: 'Models/12'
    })

    loader.dispose()
    loader.dispose()

    assert.equal(worker.terminateCalls, 1)
})
