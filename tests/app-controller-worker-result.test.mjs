import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake exposing local file selection.
 */
class WorkerResultView {
    #fileSelection

    /** @returns {void} */
    constructor() {
        this.#fileSelection = null
    }

    /** @param {(files: object[]) => Promise<void>} callback File callback. @returns {void} */
    bindFileSelection(callback) {
        this.#fileSelection = callback
    }

    /** @param {() => void} _callback Unused callback. @returns {void} */
    bindDrop(_callback) {}

    /** @param {() => void} _callback Unused callback. @returns {void} */
    bindViewChange(_callback) {}

    /** @returns {boolean} Whether a locale selector exists. */
    hasLocaleSelect() {
        return false
    }

    /** @param {object} _snapshot State snapshot. @returns {void} */
    render(_snapshot) {}

    /** @param {string} _status Status text. @returns {void} */
    setStatus(_status) {}

    /** @param {object[]} files Selected files. @returns {Promise<void>} */
    async chooseFiles(files) {
        await this.#fileSelection(files)
    }
}

/**
 * Parser worker fake with explicit message delivery.
 */
class WorkerResultWorker {
    #listeners

    /** @returns {void} */
    constructor() {
        this.#listeners = new Map()
        this.messages = []
        this.terminated = false
    }

    /** @param {string} type Event type. @param {(event: object) => void} listener Listener. @returns {void} */
    addEventListener(type, listener) {
        this.#listeners.set(type, listener)
    }

    /** @param {object} payload Worker request. @returns {void} */
    postMessage(payload) {
        this.messages.push(payload)
    }

    /** @param {object} data Worker response. @returns {void} */
    emitMessage(data) {
        this.#listeners.get('message')?.({ data })
    }

    /** @returns {void} */
    terminate() {
        this.terminated = true
    }
}

/**
 * Browser file fake with an isolated payload.
 */
class WorkerResultFile {
    /** @param {string} name File name. */
    constructor(name) {
        this.name = name
        this.webkitRelativePath = ''
    }

    /** @returns {Promise<ArrayBuffer>} File bytes. */
    async arrayBuffer() {
        return new ArrayBuffer(8)
    }
}

/**
 * Builds one canonical worker-result document.
 * @param {string} fileName Source file name.
 * @returns {object} Canonical CircuitJSON document.
 */
function createCircuitJsonDocument(fileName) {
    return {
        schema: 'ecad-toolkit.document.v1',
        id: 'fake-worker-document',
        modelSchema: { name: 'circuit-json', version: '0.0.446' },
        model: [],
        source: { format: 'altium', fileName, fileType: 'pcbdoc' },
        extensions: {
            altium: {
                $meta: {
                    schema: 'ecad-toolkit.extension.v1',
                    completeness: 'native',
                    included: ['records'],
                    omitted: []
                },
                records: [{ id: 1 }]
            }
        },
        assets: [],
        diagnostics: [],
        statistics: {}
    }
}

/**
 * Builds one compact native compatibility document.
 * @param {string} fileName Source file name.
 * @returns {object} Native PCB document.
 */
function createNativeDocument(fileName) {
    return {
        fileName,
        kind: 'pcb',
        diagnostics: [],
        pcb: {
            boardOutline: null,
            layers: [],
            components: []
        },
        bom: []
    }
}

test('AppController cancels worker results still normalizing during disposal', async () => {
    const state = new AppState()
    const view = new WorkerResultView()
    const worker = new WorkerResultWorker()
    const controller = new AppController({
        state,
        view,
        workerFactory: () => worker
    })
    const schedulerDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'scheduler'
    )
    let releaseYield
    let yieldCalls = 0
    let snapshotBeforeDispose
    const blockedYield = new Promise((resolve) => {
        releaseYield = resolve
    })

    try {
        Object.defineProperty(globalThis, 'scheduler', {
            configurable: true,
            value: {
                yield: () => {
                    yieldCalls += 1
                    return blockedYield
                }
            }
        })
        await controller.init()
        const choosePromise = view.chooseFiles([
            new WorkerResultFile('async-board.PcbDoc')
        ])
        await new Promise((resolve) => setTimeout(resolve, 0))
        worker.emitMessage({
            type: 'parser:success',
            requestId: worker.messages[0].requestId,
            documents: [
                structuredClone(createCircuitJsonDocument('async-board.PcbDoc'))
            ]
        })
        await Promise.resolve()
        snapshotBeforeDispose = state.getSnapshot()
        controller.dispose()
        releaseYield()
        await choosePromise
        await new Promise((resolve) => setTimeout(resolve, 0))
    } finally {
        if (schedulerDescriptor) {
            Object.defineProperty(globalThis, 'scheduler', schedulerDescriptor)
        } else {
            delete globalThis.scheduler
        }
    }

    const snapshot = state.getSnapshot()
    assert.equal(worker.terminated, true)
    assert.deepEqual(snapshot.documents, snapshotBeforeDispose.documents)
    assert.equal(snapshot.parseStatus, snapshotBeforeDispose.parseStatus)
    assert.equal(snapshot.statusMessage, snapshotBeforeDispose.statusMessage)
    assert.equal(yieldCalls, 1)
})

test('AppController disposal invalidates a parse continuation already queued after worker settlement', async () => {
    const state = new AppState()
    const view = new WorkerResultView()
    const worker = new WorkerResultWorker()
    const controller = new AppController({
        state,
        view,
        workerFactory: () => worker
    })
    await controller.init()

    const choosePromise = view.chooseFiles([
        new WorkerResultFile('queued-board.PcbDoc')
    ])
    await new Promise((resolve) => setTimeout(resolve, 0))
    worker.emitMessage({
        type: 'parser:success',
        requestId: worker.messages[0].requestId,
        documents: [createNativeDocument('queued-board.PcbDoc')]
    })
    let snapshotAfterDispose
    queueMicrotask(() => {
        controller.dispose()
        snapshotAfterDispose = state.getSnapshot()
    })

    await choosePromise

    const snapshot = state.getSnapshot()
    assert.equal(worker.terminated, true)
    assert.deepEqual(snapshot.documents, snapshotAfterDispose.documents)
    assert.equal(snapshot.parseStatus, snapshotAfterDispose.parseStatus)
    assert.equal(snapshot.statusMessage, snapshotAfterDispose.statusMessage)
})

test('AppController disposal invalidates startup deep-link continuation state', async () => {
    const state = new AppState()
    const view = new WorkerResultView()
    const worker = new WorkerResultWorker()
    let releaseSource
    let signalSourceStarted
    const sourceStarted = new Promise((resolve) => {
        signalSourceStarted = resolve
    })
    const source = new Promise((resolve) => {
        releaseSource = resolve
    })
    const controller = new AppController({
        state,
        view,
        workerFactory: () => worker,
        githubSourceLoader: {
            loadUrl: () => {
                signalSourceStarted()
                return source
            }
        },
        startupSource: {
            type: 'url',
            url: 'https://example.test/fake-board.PcbDoc',
            panel: 'info'
        }
    })
    const initPromise = controller.init()
    await sourceStarted
    controller.dispose()
    const snapshotAfterDispose = state.getSnapshot()
    releaseSource({ entries: [] })

    await initPromise

    const snapshot = state.getSnapshot()
    assert.equal(
        snapshot.activeSidebarTab,
        snapshotAfterDispose.activeSidebarTab
    )
    assert.equal(snapshot.parseStatus, snapshotAfterDispose.parseStatus)
    assert.equal(snapshot.statusMessage, snapshotAfterDispose.statusMessage)
})

test('AppController ignores terminal duplicates after success normalization starts', async () => {
    const state = new AppState()
    const view = new WorkerResultView()
    const worker = new WorkerResultWorker()
    const controller = new AppController({
        state,
        view,
        workerFactory: () => worker
    })
    const schedulerDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'scheduler'
    )
    let releaseYield
    const blockedYield = new Promise((resolve) => {
        releaseYield = resolve
    })

    try {
        Object.defineProperty(globalThis, 'scheduler', {
            configurable: true,
            value: { yield: () => blockedYield }
        })
        await controller.init()
        const choosePromise = view.chooseFiles([
            new WorkerResultFile('claimed-board.PcbDoc')
        ])
        await new Promise((resolve) => setTimeout(resolve, 0))
        const requestId = worker.messages[0].requestId
        worker.emitMessage({
            type: 'parser:success',
            requestId,
            documents: [
                structuredClone(
                    createCircuitJsonDocument('claimed-board.PcbDoc')
                )
            ]
        })
        await Promise.resolve()
        worker.emitMessage({
            type: 'parser:error',
            requestId,
            message: 'late duplicate error'
        })
        releaseYield()
        await choosePromise
    } finally {
        if (schedulerDescriptor) {
            Object.defineProperty(globalThis, 'scheduler', schedulerDescriptor)
        } else {
            delete globalThis.scheduler
        }
    }

    const snapshot = state.getSnapshot()
    assert.equal(snapshot.parseStatus, 'ready')
    assert.equal(snapshot.documents.length, 1)
    assert.equal(snapshot.activeFileName, 'claimed-board.PcbDoc')
})

test('AppController never applies a stale nonempty id to the sole newer request', async () => {
    const state = new AppState()
    const view = new WorkerResultView()
    const worker = new WorkerResultWorker()
    const controller = new AppController({
        state,
        view,
        workerFactory: () => worker
    })
    await controller.init()

    const firstPromise = view.chooseFiles([
        new WorkerResultFile('first-board.PcbDoc')
    ])
    await new Promise((resolve) => setTimeout(resolve, 0))
    const firstRequestId = worker.messages[0].requestId
    worker.emitMessage({
        type: 'parser:success',
        requestId: firstRequestId,
        documents: [createNativeDocument('first-board.PcbDoc')]
    })
    await firstPromise

    const secondPromise = view.chooseFiles([
        new WorkerResultFile('second-board.PcbDoc')
    ])
    await new Promise((resolve) => setTimeout(resolve, 0))
    const secondRequestId = worker.messages[1].requestId
    worker.emitMessage({
        type: 'parser:success',
        requestId: firstRequestId,
        documents: [createNativeDocument('stale-board.PcbDoc')]
    })
    await Promise.resolve()
    await Promise.resolve()
    worker.emitMessage({
        type: 'parser:success',
        requestId: secondRequestId,
        documents: [createNativeDocument('second-board.PcbDoc')]
    })
    await secondPromise

    assert.deepEqual(
        state
            .getSnapshot()
            .documents.map((entry) => entry.documentModel.fileName),
        ['first-board.PcbDoc', 'second-board.PcbDoc']
    )
})

test('AppController never applies an id-less stale result to a newer request', async () => {
    const state = new AppState()
    const view = new WorkerResultView()
    const worker = new WorkerResultWorker()
    const controller = new AppController({
        state,
        view,
        workerFactory: () => worker
    })
    await controller.init()

    const firstPromise = view.chooseFiles([
        new WorkerResultFile('first-id-board.PcbDoc')
    ])
    await new Promise((resolve) => setTimeout(resolve, 0))
    worker.emitMessage({
        type: 'parser:success',
        requestId: worker.messages[0].requestId,
        documents: [createNativeDocument('first-id-board.PcbDoc')]
    })
    await firstPromise

    const secondPromise = view.chooseFiles([
        new WorkerResultFile('second-id-board.PcbDoc')
    ])
    await new Promise((resolve) => setTimeout(resolve, 0))
    worker.emitMessage({
        type: 'parser:success',
        documents: [createNativeDocument('stale-id-less-board.PcbDoc')]
    })
    await Promise.resolve()
    await Promise.resolve()
    worker.emitMessage({
        type: 'parser:success',
        requestId: worker.messages[1].requestId,
        documents: [createNativeDocument('second-id-board.PcbDoc')]
    })
    await secondPromise

    assert.deepEqual(
        state
            .getSnapshot()
            .documents.map((entry) => entry.documentModel.fileName),
        ['first-id-board.PcbDoc', 'second-id-board.PcbDoc']
    )
})
