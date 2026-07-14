import assert from 'node:assert/strict'
import test from 'node:test'
import { Scene3dControllerFactory } from '../src/Scene3dControllerFactory.mjs'

/**
 * Minimal browser worker for lazy 3D factory tests.
 */
class FakeSceneWorker {
    #listeners

    static postedSessionAssets = []

    /**
     * Creates a fake worker.
     */
    constructor() {
        this.#listeners = new Map()
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Event listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        this.#listeners.set(type, listener)
    }

    /**
     * @param {{ requestId?: string, sessionAssets?: object[] }} message Worker request.
     * @returns {void}
     */
    postMessage(message) {
        FakeSceneWorker.postedSessionAssets = Array.isArray(
            message.sessionAssets
        )
            ? message.sessionAssets
            : []

        queueMicrotask(() => {
            this.#listeners.get('message')?.({
                data: {
                    type: 'scene3d:success',
                    requestId: message.requestId,
                    sceneDescription: {
                        components: [],
                        externalPlacements: []
                    }
                }
            })
        })
    }

    /**
     * @returns {void}
     */
    terminate() {}
}

/**
 * Creates a minimal viewport accepted by the controller.
 * @returns {object}
 */
function createViewport() {
    return {
        closest: () => ({
            querySelector: () => null,
            querySelectorAll: () => []
        })
    }
}

/**
 * Creates a minimal KiCad document with one project-relative missing model.
 * @returns {object}
 */
function createKicadDocument() {
    return {
        kind: 'pcb',
        metadata: { sourceFormat: 'kicad' },
        pcb: {
            components: [
                {
                    designator: 'J3',
                    pattern: 'LOCAL_LIB:USB_CONNECTOR_FAKE',
                    modelPath: '10103594.stp'
                }
            ]
        }
    }
}

/**
 * Waits until an assertion succeeds or the timeout expires.
 * @param {() => void} assertion Assertion callback.
 * @returns {Promise<void>}
 */
async function waitForAssertion(assertion) {
    let lastError = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
            assertion()
            return
        } catch (error) {
            lastError = error
            await new Promise((resolve) => {
                setTimeout(resolve, 25)
            })
        }
    }

    throw lastError
}

/**
 * Installs the browser globals needed by the lazy scene factory.
 * @param {(url: string, options?: object) => Promise<Response>} fetcher Fetch implementation.
 * @returns {() => void}
 */
function installBrowserGlobals(fetcher) {
    const previous = {
        document: globalThis.document,
        fetch: globalThis.fetch,
        HTMLElement: globalThis.HTMLElement,
        location: globalThis.location,
        window: globalThis.window,
        Worker: globalThis.Worker
    }

    const location = new URL('http://localhost:3000/view?view=3d')
    globalThis.location = location
    globalThis.window = {
        location,
        navigator: { language: 'en' }
    }
    globalThis.document = {
        createElement: () => ({
            click: () => {},
            remove: () => {}
        }),
        body: {
            appendChild: () => {}
        }
    }
    globalThis.HTMLElement = class {}
    globalThis.Worker = FakeSceneWorker
    globalThis.fetch = fetcher

    return () => {
        globalThis.document = previous.document
        globalThis.fetch = previous.fetch
        globalThis.HTMLElement = previous.HTMLElement
        globalThis.location = previous.location
        globalThis.window = previous.window
        globalThis.Worker = previous.Worker
    }
}

test('Scene3dControllerFactory resolves project-relative KiCad models through the app proxy', async () => {
    const requestedUrls = []
    const resolvedAssetReports = []
    const documentModel = createKicadDocument()
    FakeSceneWorker.postedSessionAssets = []
    const restore = installBrowserGlobals(async (url) => {
        requestedUrls.push(String(url))

        if (String(url).includes('/api/component-source/search?')) {
            return Response.json({
                results: [{ id: 'connector-a', name: 'Connector A' }]
            })
        }

        if (
            String(url).endsWith('/api/component-source/components/connector-a')
        ) {
            return Response.json({
                id: 'connector-a',
                models: [
                    {
                        name: 'connector.step',
                        format: 'step',
                        sourceUrl: 'models/connector.step'
                    }
                ]
            })
        }

        if (
            String(url).endsWith('/api/component-source/models/connector.step')
        ) {
            return new Response('ISO-10303-21;')
        }

        return new Response('missing', { status: 404 })
    })

    try {
        const createController = Scene3dControllerFactory.create(
            'http://localhost:3000/src/main.mjs',
            () => 'test'
        )

        createController(createViewport(), documentModel, {
            autoSearchMissingModels: true,
            onSessionAssetsResolved: (change) => {
                resolvedAssetReports.push(change)
            },
            createRuntime: () => ({ whenReady: async () => {} }),
            setLoadingVisible: () => {}
        })

        await waitForAssertion(() => {
            assert.equal(FakeSceneWorker.postedSessionAssets.length, 1)
        })
    } finally {
        restore()
    }

    assert.deepEqual(requestedUrls, [
        'http://localhost:3000/api/component-source/search?q=10103594&limit=1',
        'http://localhost:3000/api/component-source/components/connector-a',
        'http://localhost:3000/api/component-source/models/connector.step'
    ])
    assert.equal(FakeSceneWorker.postedSessionAssets[0].name, '10103594.stp')
    assert.equal(
        FakeSceneWorker.postedSessionAssets[0].relativePath,
        '10103594.stp'
    )
    assert.equal(resolvedAssetReports.length, 1)
    assert.equal(
        resolvedAssetReports[0].sessionAssets[0].relativePath,
        '10103594.stp'
    )
    assert.equal(resolvedAssetReports[0].documentModel, documentModel)
})

test('Scene3dControllerFactory filters scoped assets when model search is disabled', async () => {
    const documentModel = createKicadDocument()
    const resolutionCalls = []
    const localAsset = {
        name: 'Local.step',
        relativePath: 'project/Local.step',
        file: new Uint8Array([1]),
        format: 'step',
        source: 'project'
    }
    const modelSearchService = {
        /**
         * Records disabled resolution and returns only the current assets.
         * @param {object} nextDocumentModel Prepared document.
         * @param {{ enabled?: boolean, sessionAssets?: object[] }} options Resolution options.
         * @returns {Promise<object[]>}
         */
        async resolveSessionAssets(nextDocumentModel, options) {
            resolutionCalls.push({ documentModel: nextDocumentModel, options })
            return [localAsset]
        }
    }
    FakeSceneWorker.postedSessionAssets = []
    const restore = installBrowserGlobals(async () =>
        Promise.resolve(new Response('missing', { status: 404 }))
    )

    try {
        const createController = Scene3dControllerFactory.create(
            'http://localhost:3000/src/main.mjs',
            () => 'test',
            { modelSearchService }
        )
        createController(createViewport(), documentModel, {
            autoSearchMissingModels: false,
            sessionAssets: [
                localAsset,
                {
                    name: 'Foreign.step',
                    relativePath: 'download/Foreign.step',
                    file: new Uint8Array([2]),
                    format: 'step',
                    source: 'model-search',
                    documentScope: Object.freeze({})
                }
            ],
            createRuntime: () => ({ whenReady: async () => {} }),
            setLoadingVisible: () => {}
        })

        await waitForAssertion(() => {
            assert.equal(resolutionCalls.length, 1)
        })
    } finally {
        restore()
    }

    assert.equal(resolutionCalls[0].documentModel, documentModel)
    assert.equal(resolutionCalls[0].options.enabled, false)
    assert.deepEqual(FakeSceneWorker.postedSessionAssets, [localAsset])
})
