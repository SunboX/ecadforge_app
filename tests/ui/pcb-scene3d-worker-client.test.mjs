import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dWorkerClient } from '../../src/ui/PcbScene3dWorkerClient.mjs'

/**
 * Minimal worker fake for the 3D worker client tests.
 */
class FakeWorker {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    /** @type {any[]} */
    postedMessages

    /** @type {boolean} */
    terminated

    constructor() {
        this.#listeners = new Map()
        this.postedMessages = []
        this.terminated = false
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
     * @param {any} message
     * @returns {void}
     */
    postMessage(message) {
        this.postedMessages.push(message)
    }

    /**
     * @returns {void}
     */
    terminate() {
        this.terminated = true
    }

    /**
     * @param {any} data
     * @returns {void}
     */
    emitMessage(data) {
        ;[...(this.#listeners.get('message') || [])].forEach((listener) =>
            listener({ data })
        )
    }
}

/**
 * Verifies the worker client posts a prep job and resolves the response.
 */
test('PcbScene3dWorkerClient resolves scene prep responses', async () => {
    const worker = new FakeWorker()
    const client = new PcbScene3dWorkerClient(() => worker)
    const pendingPrepare = client.prepareScene(
        { pcb: { boardOutline: {}, components: [] } },
        [{ name: 'body.step', relativePath: 'Models/body.step', format: 'step' }]
    )

    assert.equal(worker.postedMessages.length, 1)
    assert.equal(worker.postedMessages[0].type, 'scene3d:prepare')

    worker.emitMessage({
        type: 'scene3d:success',
        requestId: worker.postedMessages[0].requestId,
        sceneDescription: {
            board: {},
            components: [],
            externalPlacements: [],
            detail: {}
        }
    })

    await assert.doesNotReject(pendingPrepare)
})

/**
 * Verifies the worker client terminates its worker on dispose.
 */
test('PcbScene3dWorkerClient terminates the worker on dispose', () => {
    const worker = new FakeWorker()
    const client = new PcbScene3dWorkerClient(() => worker)

    client.dispose()

    assert.equal(worker.terminated, true)
})
