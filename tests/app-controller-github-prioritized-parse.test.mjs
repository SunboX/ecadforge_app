import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake that records state snapshots from controller renders.
 */
class FakeView {
    /** @type {any[]} */
    snapshots = []

    /** @type {((documentId: string) => void) | null} */
    #documentSelectionCallback = null

    /** @returns {void} */
    bindFileSelection() {}

    /** @returns {void} */
    bindDrop() {}

    /** @returns {void} */
    bindViewChange() {}

    /**
     * @param {(documentId: string) => void} callback Document callback.
     * @returns {void}
     */
    bindDocumentSelection(callback) {
        this.#documentSelectionCallback = callback
    }

    /** @returns {void} */
    bindDemoSelection() {}

    /** @returns {void} */
    bindGitHubOpen() {}

    /** @returns {void} */
    bindLocalOpen() {}

    /** @returns {void} */
    bindPcbStylerClick() {}

    /** @returns {void} */
    setPcbStylerLink() {}

    /** @returns {boolean} */
    hasLocaleSelect() {
        return false
    }

    /** @returns {void} */
    setStatus() {}

    /** @returns {void} */
    setVersion() {}

    /**
     * @param {any} snapshot Rendered app state.
     * @returns {void}
     */
    render(snapshot) {
        this.snapshots.push(snapshot)
    }

    /**
     * @param {string} documentId Selected document id.
     * @returns {void}
     */
    chooseDocument(documentId) {
        this.#documentSelectionCallback?.(documentId)
    }
}

/**
 * Parser double with a resolved first parse and controlled deferred parse.
 */
class DeferredBatchParser {
    /** @type {string[][]} */
    calls = []

    /** @type {(() => void) | null} */
    #resolveDeferred = null

    /** @type {Promise<void>} */
    #deferredSettled

    constructor() {
        this.#deferredSettled = new Promise((resolve) => {
            this.#resolveDeferred = resolve
        })
    }

    /**
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Parser entries.
     * @returns {Promise<object>}
     */
    async parseEntries(entries) {
        const names = entries.map((entry) => entry.name)
        this.calls.push(names)

        if (this.calls.length === 1) {
            return {
                documents: [
                    createSchematicDocument('Schematics/Target.SchDoc')
                ],
                assets: []
            }
        }

        await this.#deferredSettled
        return {
            documents: [
                createSchematicDocument('Schematics/Other.SchDoc'),
                createPcbDocument('PCB/Main.PcbDoc')
            ],
            assets: []
        }
    }

    /**
     * Resolves the deferred background parser response.
     * @returns {Promise<void>}
     */
    async resolveDeferred() {
        this.#resolveDeferred?.()
        await this.#deferredSettled
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

/**
 * Parser double that returns a fixed batch result.
 */
class StaticBatchParser {
    /** @type {object} */
    #result

    /** @type {string[][]} */
    calls = []

    /**
     * @param {object} result Parser result.
     */
    constructor(result) {
        this.#result = result
    }

    /**
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Parser entries.
     * @returns {object}
     */
    parseEntries(entries) {
        this.calls.push(entries.map((entry) => entry.name))
        return this.#result
    }
}

/**
 * Parser double that returns one configured result per parse call.
 */
class SequencedBatchParser {
    /** @type {object[]} */
    #results

    /** @type {string[][]} */
    calls = []

    /**
     * @param {object[]} results Parser results in call order.
     */
    constructor(results) {
        this.#results = results
    }

    /**
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Parser entries.
     * @returns {object}
     */
    parseEntries(entries) {
        this.calls.push(entries.map((entry) => entry.name))
        return this.#results[this.calls.length - 1]
    }
}

/**
 * Analytics fake that accepts emitted events.
 */
class RecordingAnalytics {
    /** @returns {void} */
    track() {}
}

/**
 * Builds a normalized schematic document model stub.
 * @param {string} fileName Source file name.
 * @returns {object}
 */
function createSchematicDocument(fileName) {
    return {
        fileName,
        kind: 'schematic',
        diagnostics: [],
        summary: { title: fileName, componentCount: 1 },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [],
            texts: [],
            components: [],
            pins: []
        },
        bom: []
    }
}

/**
 * Builds a normalized PCB document model stub.
 * @param {string} fileName Source file name.
 * @returns {object}
 */
function createPcbDocument(fileName) {
    return {
        fileName,
        kind: 'pcb',
        diagnostics: [],
        summary: { title: fileName, componentCount: 1 },
        pcb: {
            boardOutline: { minX: 0, minY: 0, widthMil: 100, heightMil: 50 },
            layers: [],
            components: []
        },
        bom: []
    }
}

/**
 * Builds a normalized Altium project document model stub.
 * @param {string} fileName Source file name.
 * @returns {object}
 */
function createProjectDocument(fileName) {
    const documentModel = [
        {
            type: 'source_file',
            source_file_id: 'project-source'
        }
    ]

    return Object.assign(documentModel, {
        fileName,
        kind: 'project',
        fileType: 'PrjPcb',
        diagnostics: [],
        summary: { title: fileName, documentCount: 1 },
        project: {},
        bom: []
    })
}

/**
 * Builds one fake parser entry.
 * @param {string} name Entry name.
 * @returns {{ name: string, buffer: ArrayBuffer }}
 */
function createEntry(name) {
    return { name, buffer: new ArrayBuffer(8) }
}

test('AppController prioritizes startup GitHub document parsing and defers background project parsing until idle', async () => {
    const state = new AppState()
    const view = new FakeView()
    const parser = new DeferredBatchParser()
    const originalRequestIdleCallback = globalThis.requestIdleCallback
    const idleCallbacks = []
    const controller = new AppController({
        state,
        view,
        parser,
        analytics: new RecordingAnalytics(),
        githubSourceLoader: {
            async loadUrl() {
                return {
                    sourceType: 'github',
                    formatFamily: 'altium',
                    boardUrl:
                        'https://raw.githubusercontent.com/a/b/main/PCB/Main.PcbDoc',
                    entries: [
                        createEntry('Demo.PrjPcb'),
                        createEntry('Schematics/Other.SchDoc'),
                        createEntry('Schematics/Target.SchDoc'),
                        createEntry('PCB/Main.PcbDoc')
                    ]
                }
            }
        },
        startupSource: {
            type: 'url',
            url: 'https://github.com/a/b/tree/main/hardware',
            view: 'schematic',
            document: 'Schematics/Target.SchDoc'
        }
    })

    try {
        globalThis.requestIdleCallback = (callback) => {
            idleCallbacks.push(callback)
            return idleCallbacks.length
        }

        await controller.init()
    } finally {
        if (originalRequestIdleCallback === undefined) {
            delete globalThis.requestIdleCallback
        } else {
            globalThis.requestIdleCallback = originalRequestIdleCallback
        }
    }

    let snapshot = state.getSnapshot()
    assert.deepEqual(parser.calls[0], [
        'Demo.PrjPcb',
        'Schematics/Target.SchDoc'
    ])
    assert.equal(parser.calls.length, 1)
    assert.equal(idleCallbacks.length, 1)
    assert.equal(snapshot.documents.length, 1)
    assert.equal(snapshot.activeFileName, 'Schematics/Target.SchDoc')
    assert.equal(snapshot.activeView, 'schematic')

    idleCallbacks[0]({
        didTimeout: false,
        timeRemaining: () => 50
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.deepEqual(parser.calls[1], [
        'Demo.PrjPcb',
        'Schematics/Other.SchDoc',
        'PCB/Main.PcbDoc'
    ])

    await parser.resolveDeferred()

    snapshot = state.getSnapshot()
    assert.deepEqual(
        snapshot.documents.map((entry) => entry.documentModel.fileName),
        [
            'Schematics/Target.SchDoc',
            'Schematics/Other.SchDoc',
            'PCB/Main.PcbDoc'
        ]
    )
    assert.equal(snapshot.activeFileName, 'Schematics/Target.SchDoc')
})

test('AppController links deferred GitHub models without re-appending source assets', async () => {
    const state = new AppState()
    const initialDocument = createPcbDocument('Target.kicad_pcb')
    const deferredDocument = createPcbDocument('Other.kicad_pcb')
    initialDocument.pcb.components = [{ designator: 'U1' }]
    deferredDocument.pcb.components = [{ designator: 'U2' }]
    const parser = new SequencedBatchParser([
        { documents: [initialDocument], assets: [] },
        { documents: [deferredDocument], assets: [] }
    ])
    const originalRequestIdleCallback = globalThis.requestIdleCallback
    const idleCallbacks = []
    let assetReadCount = 0
    const source = {
        sourceType: 'github',
        formatFamily: 'kicad',
        boardUrl: 'https://raw.githubusercontent.com/a/b/main/Target.kicad_pcb',
        entries: [
            createEntry('Demo.kicad_pro'),
            createEntry('Target.kicad_pcb'),
            createEntry('Other.kicad_pcb')
        ],
        modelReferences: [
            {
                designator: 'U1',
                modelName: 'body.step',
                modelPath: '${KIPRJMOD}/parts/body.step'
            },
            {
                designator: 'U2',
                modelName: 'body.step',
                modelPath: '${KIPRJMOD}/parts/body.step'
            }
        ],
        /**
         * Returns source-wide assets while recording linker reads.
         * @returns {object[]}
         */
        get assets() {
            assetReadCount += 1
            return [
                {
                    name: 'body.step',
                    relativePath: 'parts/body.step',
                    data: new Uint8Array([1, 2, 3]),
                    format: 'step'
                }
            ]
        }
    }
    const controller = new AppController({
        state,
        view: new FakeView(),
        parser,
        analytics: new RecordingAnalytics(),
        githubSourceLoader: {
            async loadUrl() {
                return source
            }
        },
        startupSource: {
            type: 'url',
            url: 'https://github.com/a/b/tree/main/hardware',
            view: '3d',
            document: 'Target.kicad_pcb'
        }
    })

    try {
        globalThis.requestIdleCallback = (callback) => {
            idleCallbacks.push(callback)
            return idleCallbacks.length
        }

        await controller.init()
        assert.equal(assetReadCount, 1)
        assert.equal(state.getSnapshot().sessionAssets.length, 1)

        await idleCallbacks[0]({
            didTimeout: false,
            timeRemaining: () => 50
        })
    } finally {
        if (originalRequestIdleCallback === undefined) {
            delete globalThis.requestIdleCallback
        } else {
            globalThis.requestIdleCallback = originalRequestIdleCallback
        }
    }

    const deferredComponent = state
        .getSnapshot()
        .documents.find(
            (entry) => entry.documentModel.fileName === 'Other.kicad_pcb'
        )?.documentModel.pcb.components[0]

    assert.equal(assetReadCount, 1)
    assert.equal(deferredComponent.modelName, 'body.step')
    assert.equal(deferredComponent.modelPath, '${KIPRJMOD}/parts/body.step')
})

test('AppController ignores non-renderable project document selections in 3D view', async () => {
    const state = new AppState()
    const view = new FakeView()
    const parser = new StaticBatchParser({
        documents: [
            createProjectDocument('Demo.PrjPcb'),
            createPcbDocument('PCB/Main.PcbDoc')
        ],
        assets: []
    })
    const controller = new AppController({
        state,
        view,
        parser,
        analytics: new RecordingAnalytics(),
        githubSourceLoader: {
            async loadUrl() {
                return {
                    sourceType: 'github',
                    formatFamily: 'altium',
                    boardUrl:
                        'https://raw.githubusercontent.com/a/b/main/PCB/Main.PcbDoc',
                    entries: [
                        createEntry('Demo.PrjPcb'),
                        createEntry('PCB/Main.PcbDoc')
                    ]
                }
            }
        },
        startupSource: {
            type: 'url',
            url: 'https://github.com/a/b/tree/main/hardware',
            view: '3d'
        }
    })

    await controller.init()

    const projectId = state
        .getSnapshot()
        .documents.find(
            (entry) => entry.documentModel.fileName === 'Demo.PrjPcb'
        )?.id

    assert.equal(state.getSnapshot().activeFileName, 'PCB/Main.PcbDoc')

    view.chooseDocument(projectId)

    assert.equal(state.getSnapshot().activeFileName, 'PCB/Main.PcbDoc')
    assert.equal(state.getSnapshot().activeView, '3d')
})
