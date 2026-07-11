import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for GitHub startup controller tests.
 */
class FakeView {
    /** @type {any} */
    latestSnapshot

    /** @type {string[]} */
    statuses

    constructor() {
        this.latestSnapshot = null
        this.statuses = []
    }

    /**
     * @param {Function} _callback Callback.
     * @returns {void}
     */
    bindFileSelection(_callback) {}

    /**
     * @param {Function} _callback Callback.
     * @returns {void}
     */
    bindDrop(_callback) {}

    /**
     * @param {Function} _callback Callback.
     * @returns {void}
     */
    bindViewChange(_callback) {}

    /**
     * @returns {boolean}
     */
    hasLocaleSelect() {
        return false
    }

    /**
     * @param {string} status Status message.
     * @returns {void}
     */
    setStatus(status) {
        this.statuses.push(status)
    }

    /**
     * @param {string} _version Version text.
     * @returns {void}
     */
    setVersion(_version) {}

    /**
     * @param {any} snapshot App state snapshot.
     * @returns {void}
     */
    render(snapshot) {
        this.latestSnapshot = snapshot
    }
}

/**
 * Parser double that returns a full project result for batched entries.
 */
class BatchParser {
    /** @type {object} */
    #result

    /** @type {string[]} */
    seenNames

    /**
     * @param {object} result Batch result.
     */
    constructor(result) {
        this.#result = result
        this.seenNames = []
    }

    /**
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Source entries.
     * @returns {object}
     */
    parseEntries(entries) {
        this.seenNames = entries.map((entry) => entry.name)
        return this.#result
    }
}

/**
 * Analytics double that records emitted events.
 */
class RecordingAnalytics {
    /** @type {{ name: string, properties: object }[]} */
    events

    constructor() {
        this.events = []
    }

    /**
     * @param {string} name Event name.
     * @param {object} [properties] Event properties.
     * @returns {void}
     */
    track(name, properties = {}) {
        this.events.push({ name, properties })
    }
}

/**
 * Builds a normalized PCB document model stub.
 * @param {string} fileName File name.
 * @returns {object}
 */
function createPcbDocument(fileName) {
    return {
        fileName,
        kind: 'pcb',
        diagnostics: [],
        summary: {
            title: fileName,
            componentCount: 1,
            layerCount: 2,
            outlineSegmentCount: 4,
            boardWidthMil: 1000,
            boardHeightMil: 500
        },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            layers: [],
            components: []
        },
        bom: []
    }
}

/**
 * Verifies GitHub startup sources load through the URL loader, parse normally,
 * and retain only coarse activation properties.
 */
test('AppController loads GitHub startup sources through the parser', async () => {
    const state = new AppState()
    const analytics = new RecordingAnalytics()
    const parser = new BatchParser({
        documents: [createPcbDocument('board.kicad_pcb')],
        assets: []
    })
    const controller = new AppController({
        state,
        view: new FakeView(),
        parser,
        analytics,
        githubSourceLoader: {
            async loadUrl(_url) {
                return createGitHubBoardSource()
            }
        },
        startupSource: {
            type: 'url',
            url: 'https://github.com/a/b/blob/main/board.kicad_pcb'
        }
    })

    await controller.init()

    const snapshot = state.getSnapshot()

    assert.deepEqual(parser.seenNames, ['board.kicad_pcb'])
    assert.equal(snapshot.parseStatus, 'ready')
    assert.match(snapshot.statusMessage, /Design loaded locally/)
    assert.deepEqual(
        analytics.events.map((event) => event.name),
        [
            'landing_view',
            'github_url_open_attempted',
            'github_url_loaded_success',
            'view_pcb_opened'
        ]
    )
    assert.deepEqual(analytics.events[2].properties, {
        sourceType: 'github',
        formatFamily: 'kicad'
    })
})

/**
 * Verifies GitHub-sourced companion model assets and model references are
 * retained for the 3D scene resolver.
 */
test('AppController stores GitHub companion model assets and references', async () => {
    const state = new AppState()
    const boardDocument = createPcbDocument('board.kicad_pcb')
    boardDocument.sourceFormat = 'kicad'
    boardDocument.pcb.components = [
        {
            designator: 'U1',
            pattern: 'Fixture:Body'
        }
    ]
    const parser = new BatchParser({
        documents: [boardDocument],
        assets: []
    })
    const controller = new AppController({
        state,
        view: new FakeView(),
        parser,
        analytics: new RecordingAnalytics(),
        githubSourceLoader: {
            async loadUrl(_url) {
                return {
                    ...createGitHubBoardSource(),
                    assets: [
                        {
                            name: 'body.step',
                            relativePath: 'parts/body.step',
                            data: new Uint8Array([1, 2, 3]),
                            format: 'step'
                        }
                    ],
                    modelReferences: [
                        {
                            designator: 'U1',
                            modelName: 'body.step',
                            modelPath: '${KIPRJMOD}/parts/body.step',
                            relativePath: 'parts/body.step',
                            modelTransform: {
                                rotationDeg: { x: 0, y: 0, z: 90 },
                                dzMil: 12
                            }
                        }
                    ]
                }
            }
        },
        startupSource: {
            type: 'url',
            url: 'https://github.com/a/b/blob/main/board.kicad_pcb'
        }
    })

    await controller.init()

    const snapshot = state.getSnapshot()
    const component = snapshot.documentModel.pcb.components[0]

    assert.equal(snapshot.sessionAssets.length, 1)
    assert.equal(snapshot.sessionAssets[0].name, 'body.step')
    assert.equal(snapshot.sessionAssets[0].relativePath, 'parts/body.step')
    assert.equal(snapshot.sessionAssets[0].format, 'step')
    assert.deepEqual(
        [...new Uint8Array(await snapshot.sessionAssets[0].file.arrayBuffer())],
        [1, 2, 3]
    )
    assert.equal(component.modelName, 'body.step')
    assert.equal(component.modelPath, '${KIPRJMOD}/parts/body.step')
    assert.equal(component.modelTransform.rotationDeg.z, 90)
})

/**
 * Builds a fake GitHub board source payload.
 * @returns {object}
 */
function createGitHubBoardSource() {
    return {
        sourceType: 'github',
        formatFamily: 'kicad',
        boardUrl: 'https://raw.githubusercontent.com/a/b/main/board.kicad_pcb',
        entries: [
            {
                name: 'board.kicad_pcb',
                buffer: new ArrayBuffer(8)
            }
        ]
    }
}
