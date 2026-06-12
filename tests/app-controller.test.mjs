import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'
/**
 * Minimal view fake for controller integration tests.
 */
class FakeView {
    /** @type {((files: File[]) => void | Promise<void>) | null} */
    #fileSelectionCallback

    /** @type {((files: File[]) => void | Promise<void>) | null} */
    #dropCallback

    /** @type {((viewName: string) => void) | null} */
    #viewChangeCallback

    /** @type {((documentId: string) => void) | null} */
    #documentSelectionCallback

    /** @type {((demoId: string) => void | Promise<void>) | null} */
    #demoSelectionCallback

    /** @type {{ activeView: string, parseStatus: string, documents: { id: string, documentModel: object }[], activeDocumentId: string } | null} */
    latestSnapshot

    /** @type {{ activeView: string, parseStatus: string, documents: { id: string, documentModel: object }[], activeDocumentId: string }[]} */
    snapshots

    /** @type {string[]} */
    statuses

    constructor() {
        this.#fileSelectionCallback = null
        this.#dropCallback = null
        this.#viewChangeCallback = null
        this.#documentSelectionCallback = null
        this.#demoSelectionCallback = null
        this.latestSnapshot = null
        this.snapshots = []
        this.statuses = []
    }

    /**
     * @param {(files: File[]) => void | Promise<void>} callback
     * @returns {void}
     */
    bindFileSelection(callback) {
        this.#fileSelectionCallback = callback
    }

    /**
     * @param {(files: File[]) => void | Promise<void>} callback
     * @returns {void}
     */
    bindDrop(callback) {
        this.#dropCallback = callback
    }

    /**
     * @param {(viewName: string) => void} callback
     * @returns {void}
     */
    bindViewChange(callback) {
        this.#viewChangeCallback = callback
    }

    /**
     * @param {(documentId: string) => void} callback
     * @returns {void}
     */
    bindDocumentSelection(callback) {
        this.#documentSelectionCallback = callback
    }

    /**
     * @param {(demoId: string) => void | Promise<void>} callback
     * @returns {void}
     */
    bindDemoSelection(callback) {
        this.#demoSelectionCallback = callback
    }

    /**
     * @param {() => void} _callback
     * @returns {void}
     */
    bindLocalOpen(_callback) {}

    /**
     * @param {(url: string) => void | Promise<void>} _callback
     * @returns {void}
     */
    bindGitHubOpen(_callback) {}

    /**
     * @param {() => void} _callback
     * @returns {void}
     */
    bindPcbStylerClick(_callback) {}

    /**
     * @param {string} _url
     * @param {string} _mode
     * @returns {void}
     */
    setPcbStylerLink(_url, _mode) {}

    /**
     * @param {(locale: string) => void | Promise<void>} _callback
     * @returns {void}
     */
    bindLocaleChange(_callback) {}

    /**
     * @returns {boolean}
     */
    hasLocaleSelect() {
        return false
    }

    /**
     * @param {string} status
     * @returns {void}
     */
    setStatus(status) {
        this.statuses.push(status)
    }

    /**
     * @param {string} _version
     * @returns {void}
     */
    setVersion(_version) {}

    /**
     * @param {any} snapshot
     * @returns {void}
     */
    render(snapshot) {
        this.latestSnapshot = snapshot
        this.snapshots.push(snapshot)
    }

    /**
     * @param {File[]} files
     * @returns {Promise<void>}
     */
    async chooseFiles(files) {
        await this.#fileSelectionCallback?.(files)
    }

    /**
     * @param {string} demoId
     * @returns {Promise<void>}
     */
    async chooseDemo(demoId) {
        await this.#demoSelectionCallback?.(demoId)
    }

    /**
     * @param {string} viewName
     * @returns {void}
     */
    changeView(viewName) {
        this.#viewChangeCallback?.(viewName)
    }

    /**
     * @param {string} documentId
     * @returns {void}
     */
    selectDocument(documentId) {
        this.#documentSelectionCallback?.(documentId)
    }
}

/**
 * Minimal parser worker double for controller tests.
 */
class FakeWorker {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    /** @type {any[]} */
    messages

    /** @type {boolean} */
    terminated

    constructor() {
        this.#listeners = new Map()
        this.messages = []
        this.terminated = false
    }

    /**
     * Registers one worker event listener.
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
     * Records one worker request.
     * @param {any} payload
     * @param {Transferable[]} [transferList]
     * @returns {void}
     */
    postMessage(payload, transferList = []) {
        const clonedPayload = transferList.length
            ? structuredClone(payload, { transfer: transferList })
            : payload
        this.messages.push(clonedPayload)
    }

    /**
     * Emits a worker message response.
     * @param {any} data
     * @returns {void}
     */
    emitMessage(data) {
        this.#emit('message', { data })
    }

    /**
     * Emits a worker transport failure.
     * @param {string} message
     * @returns {void}
     */
    emitError(message) {
        this.#emit('error', {
            message,
            preventDefault() {}
        })
    }

    /**
     * Marks the worker as terminated.
     * @returns {void}
     */
    terminate() {
        this.terminated = true
    }

    /**
     * Emits one event to registered listeners.
     * @param {string} type
     * @param {any} event
     * @returns {void}
     */
    #emit(type, event) {
        ;[...(this.#listeners.get(type) || [])].forEach((listener) =>
            listener(event)
        )
    }
}

/**
 * Minimal file fake for controller parsing tests.
 */
class FakeFile {
    /** @type {string} */
    name

    /** @type {string} */
    webkitRelativePath

    /** @type {ArrayBuffer} */
    #buffer

    /**
     * @param {string} name
     * @param {ArrayBuffer} [buffer]
     * @param {string} [relativePath]
     */
    constructor(name, buffer = new ArrayBuffer(8), relativePath = '') {
        this.name = name
        this.webkitRelativePath = relativePath
        this.#buffer = buffer
    }

    /**
     * @returns {Promise<ArrayBuffer>}
     */
    async arrayBuffer() {
        return this.#buffer.slice(0)
    }
}

/**
 * Minimal parser double keyed by file name.
 */
class FakeParser {
    /** @type {Map<string, object | Error>} */
    #results

    /**
     * @param {Record<string, object | Error>} results
     */
    constructor(results) {
        this.#results = new Map(Object.entries(results))
    }

    /**
     * @param {string} fileName
     * @param {ArrayBuffer} _buffer
     * @returns {object}
     */
    parseArrayBuffer(fileName, _buffer) {
        const result = this.#results.get(fileName)

        if (result instanceof Error) {
            throw result
        }

        if (!result) {
            throw new Error('Missing fake parser result for ' + fileName)
        }

        return result
    }
}

/**
 * Parser double that asserts the fallback buffer was not detached.
 */
class BufferCheckingParser extends FakeParser {
    /**
     * @param {string} fileName
     * @param {ArrayBuffer} buffer
     * @returns {object}
     */
    parseArrayBuffer(fileName, buffer) {
        assert.equal(buffer.byteLength, 8)
        return super.parseArrayBuffer(fileName, buffer)
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
     * @param {string} name
     * @param {object} [properties]
     * @returns {void}
     */
    track(name, properties = {}) {
        this.events.push({ name, properties })
    }
}

/**
 * Builds a normalized schematic document model stub.
 * @param {string} fileName
 * @returns {object}
 */
function createSchematicDocument(fileName) {
    return {
        fileName,
        kind: 'schematic',
        diagnostics: [],
        summary: {
            title: fileName,
            componentCount: 1,
            lineCount: 1,
            textCount: 0,
            bomRowCount: 0
        },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        },
        bom: []
    }
}

/**
 * Builds a normalized PCB document model stub.
 * @param {string} fileName
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
 * Verifies multiple successful parses append into the session and allow
 * selecting the active file by document id.
 */
test('AppController appends multiple parsed documents and switches active selection', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser({
            'alpha.SchDoc': createSchematicDocument('alpha.SchDoc'),
            'beta.PcbDoc': createPcbDocument('beta.PcbDoc')
        })
    })

    await controller.init()
    await view.chooseFiles([
        new FakeFile('alpha.SchDoc'),
        new FakeFile('beta.PcbDoc')
    ])

    let snapshot = state.getSnapshot()

    assert.equal(snapshot.documents.length, 2)
    assert.equal(snapshot.activeFileName, 'beta.PcbDoc')
    assert.equal(snapshot.documentModel?.fileName, 'beta.PcbDoc')

    const firstDocumentId = snapshot.documents[0].id
    view.selectDocument(firstDocumentId)
    snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, firstDocumentId)
    assert.equal(snapshot.activeFileName, 'alpha.SchDoc')
})

/**
 * Verifies project-style parser results can append several KiCad documents
 * from one selected batch and keep archive assets available for 3D lookup.
 */
test('AppController accepts KiCad project batches with multiple returned documents', async () => {
    const state = new AppState()
    const view = new FakeView()
    const schematicDocument = createSchematicDocument('project.kicad_sch')
    const pcbDocument = createPcbDocument('project.kicad_pcb')
    const parser = new BatchParser({
        documents: [schematicDocument, pcbDocument],
        assets: [
            {
                name: 'part.step',
                relativePath: 'models/part.step',
                bytes: new Uint8Array([1, 2, 3])
            }
        ]
    })
    const controller = new AppController({
        state,
        view,
        parser
    })

    await controller.init()
    await view.chooseFiles([
        new FakeFile('project.kicad_pro'),
        new FakeFile('project.kicad_sch'),
        new FakeFile('project.kicad_pcb')
    ])

    const snapshot = state.getSnapshot()

    assert.deepEqual(parser.seenNames, [
        'project.kicad_pro',
        'project.kicad_sch',
        'project.kicad_pcb'
    ])
    assert.equal(snapshot.documents.length, 2)
    assert.equal(snapshot.activeFileName, 'project.kicad_pcb')
    assert.equal(snapshot.sessionAssets[0].relativePath, 'models/part.step')
})

/**
 * Verifies parser worker module failures fall back to direct parser execution
 * instead of leaving the UI in an unresolved loading state.
 */
test('AppController falls back to direct parsing when the parser worker fails to load', async () => {
    const state = new AppState()
    const view = new FakeView()
    const worker = new FakeWorker()
    const parser = new BufferCheckingParser({
        'fallback.PcbDoc': createPcbDocument('fallback.PcbDoc')
    })
    const controller = new AppController({
        state,
        view,
        parser,
        workerFactory: () => worker
    })

    await controller.init()
    const choosePromise = view.chooseFiles([new FakeFile('fallback.PcbDoc')])

    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(state.getSnapshot().parseStatus, 'loading')
    assert.equal(worker.messages.length, 1)

    worker.emitError(
        'Failed to resolve module specifier "altium-toolkit/parser"'
    )
    await choosePromise

    const snapshot = state.getSnapshot()

    assert.equal(worker.terminated, true)
    assert.equal(snapshot.parseStatus, 'ready')
    assert.equal(snapshot.activeFileName, 'fallback.PcbDoc')
    assert.equal(snapshot.documents.length, 1)
})

/**
 * Verifies oversized worker response failures fall back to direct parsing with
 * the original source buffer still available.
 */
test('AppController falls back to direct parsing when worker response cloning overflows', async () => {
    const state = new AppState()
    const view = new FakeView()
    const worker = new FakeWorker()
    const parser = new BufferCheckingParser({
        'large-board.PcbDoc': createPcbDocument('large-board.PcbDoc')
    })
    const controller = new AppController({
        state,
        view,
        parser,
        workerFactory: () => worker
    })

    await controller.init()
    const choosePromise = view.chooseFiles([new FakeFile('large-board.PcbDoc')])

    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(worker.messages.length, 1)

    worker.emitMessage({
        type: 'parser:error',
        requestId: worker.messages[0].requestId,
        message: 'Maximum call stack size exceeded'
    })
    await choosePromise

    const snapshot = state.getSnapshot()

    assert.equal(worker.terminated, true)
    assert.equal(snapshot.parseStatus, 'ready')
    assert.equal(snapshot.activeFileName, 'large-board.PcbDoc')
    assert.equal(snapshot.documents.length, 1)
})

/**
 * Verifies parse failures preserve already-open documents and keep the global
 * tab unchanged.
 */
test('AppController preserves existing documents when a later parse fails', async () => {
    const existingDocument = createSchematicDocument('existing.SchDoc')
    const state = new AppState({
        activeView: 'bom',
        documents: [{ id: 'doc-1', documentModel: existingDocument }],
        activeDocumentId: 'doc-1'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser({
            'broken.PcbDoc': new Error('Broken native payload')
        })
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('broken.PcbDoc')])

    const snapshot = state.getSnapshot()

    assert.equal(snapshot.documents.length, 1)
    assert.equal(snapshot.activeDocumentId, 'doc-1')
    assert.equal(snapshot.activeFileName, 'existing.SchDoc')
    assert.equal(snapshot.activeView, 'bom')
    assert.equal(snapshot.parseStatus, 'error')
    assert.equal(snapshot.statusMessage, 'Broken native payload')
})

/**
 * Verifies invalid files do not wipe the current document session.
 */
test('AppController rejects invalid files without clearing the open session', async () => {
    const existingDocument = createPcbDocument('board.PcbDoc')
    const state = new AppState({
        documents: [{ id: 'doc-1', documentModel: existingDocument }],
        activeDocumentId: 'doc-1'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser({})
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('notes.txt')])

    const snapshot = state.getSnapshot()

    assert.equal(snapshot.documents.length, 1)
    assert.equal(snapshot.activeFileName, 'board.PcbDoc')
    assert.equal(
        snapshot.statusMessage,
        'This file type is not supported yet. ECAD Forge currently supports selected Altium and KiCad design files. Try a sample project or open a supported board/schematic file.'
    )
})

/**
 * Verifies switching tabs moves the active file to a compatible open document
 * when the current one cannot render the selected view.
 */
test('AppController switches to a compatible document when the selected tab changes', async () => {
    const schematicDocument = createSchematicDocument('alpha.SchDoc')
    const pcbDocument = createPcbDocument('beta.PcbDoc')
    const state = new AppState({
        activeView: 'pcb',
        documents: [
            { id: 'doc-1', documentModel: schematicDocument },
            { id: 'doc-2', documentModel: pcbDocument }
        ],
        activeDocumentId: 'doc-2'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser({})
    })

    await controller.init()
    view.changeView('schematic')

    let snapshot = state.getSnapshot()

    assert.equal(snapshot.activeView, 'schematic')
    assert.equal(snapshot.activeDocumentId, 'doc-1')
    assert.equal(snapshot.activeFileName, 'alpha.SchDoc')

    view.changeView('pcb')
    snapshot = state.getSnapshot()

    assert.equal(snapshot.activeView, 'pcb')
    assert.equal(snapshot.activeDocumentId, 'doc-2')
    assert.equal(snapshot.activeFileName, 'beta.PcbDoc')
})

/**
 * Verifies supported companion assets are retained for 3D model resolution
 * without becoming top-level session documents.
 */
test('AppController stores companion model assets alongside parsed pcb documents', async () => {
    const state = new AppState()
    const view = new FakeView()
    const pcbDocument = createPcbDocument('board.PcbDoc')
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser({
            'board.PcbDoc': pcbDocument
        })
    })

    await controller.init()
    await view.chooseFiles([
        new FakeFile('board.PcbDoc'),
        new FakeFile('QFN32.wrl', new ArrayBuffer(8), 'Models/QFN32.wrl')
    ])

    const snapshot = state.getSnapshot()

    assert.equal(snapshot.documents.length, 1)
    assert.equal(snapshot.documentModel, pcbDocument)
    assert.equal(snapshot.sessionAssets.length, 1)
    assert.equal(snapshot.sessionAssets[0].format, 'wrl')
    assert.equal(snapshot.sessionAssets[0].relativePath, 'Models/QFN32.wrl')
})

/**
 * Verifies companion-only file intake reports a non-error session update.
 */
test('AppController reports companion-only loads without creating documents', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser({})
    })

    await controller.init()
    await view.chooseFiles([
        new FakeFile('Body.step'),
        new FakeFile('Project.PrjPcb')
    ])

    const snapshot = state.getSnapshot()

    assert.equal(snapshot.documents.length, 0)
    assert.equal(snapshot.sessionAssets.length, 2)
    assert.equal(
        snapshot.statusMessage,
        'Companion 3D assets added to the current session.'
    )
})

/**
 * Verifies bundled demo startup reuses the parser path and emits activation
 * events without requiring user files.
 */
test('AppController loads a bundled demo startup source through the parser', async () => {
    const state = new AppState()
    const view = new FakeView()
    const analytics = new RecordingAnalytics()
    const parser = new BatchParser({
        documents: [
            createSchematicDocument('RP2040_minimal.kicad_sch'),
            createPcbDocument('RP2040_minimal.kicad_pcb')
        ],
        assets: []
    })
    const controller = new AppController({
        state,
        view,
        parser,
        analytics,
        fetcher: async () => new Response('demo', { status: 200 }),
        startupSource: { type: 'demo', id: 'kicad' }
    })

    await controller.init()

    const snapshot = state.getSnapshot()

    assert.deepEqual(
        parser.seenNames,
        [
            'NODEMCU_ESP12.SchDoc',
            'NODEMCU_ESP12.PcbDoc',
            'RP2040_minimal.kicad_pro',
            'RP2040_minimal.kicad_sch',
            'RP2040_minimal.kicad_pcb'
        ].slice(2)
    )
    assert.equal(snapshot.documents.length, 2)
    assert.equal(snapshot.parseStatus, 'ready')
    assert.match(snapshot.statusMessage, /sample project is parsed locally/i)
    assert.deepEqual(
        analytics.events.map((event) => event.name),
        [
            'landing_view',
            'sample_kicad_clicked',
            'sample_loaded_success',
            'view_pcb_opened'
        ]
    )
})

/**
 * Verifies deep-linked demo startup sources render the requested view directly
 * instead of mounting the parser-preferred PCB view first.
 */
test('AppController applies demo startup view before the first ready render', async () => {
    const state = new AppState()
    const view = new FakeView()
    const parser = new BatchParser({
        documents: [
            createSchematicDocument('fixture.kicad_sch'),
            createPcbDocument('fixture.kicad_pcb')
        ],
        assets: []
    })
    const controller = new AppController({
        state,
        view,
        parser,
        analytics: new RecordingAnalytics(),
        fetcher: async () => new Response('demo', { status: 200 }),
        startupSource: {
            type: 'demo',
            id: 'kicad',
            view: '3d',
            document: 'fixture.kicad_pcb'
        }
    })

    await controller.init()

    const readyViews = view.snapshots
        .filter((snapshot) => snapshot.parseStatus === 'ready')
        .map((snapshot) => snapshot.activeView)

    assert.deepEqual(readyViews, ['3d'])
    assert.equal(state.getSnapshot().activeFileName, 'fixture.kicad_pcb')
})

/**
 * Verifies the browser fetch receiver stays bound when no test fetcher is
 * injected. Browser `window.fetch` rejects detached calls.
 */
test('AppController uses a bound browser fetch for bundled demo startup', async () => {
    const originalFetch = globalThis.fetch
    const seenUrls = []
    globalThis.fetch = async function boundFetch(url) {
        assert.equal(this, globalThis)
        seenUrls.push(String(url))
        return new Response('demo', { status: 200 })
    }

    try {
        const state = new AppState()
        const controller = new AppController({
            state,
            view: new FakeView(),
            parser: new BatchParser({
                documents: [createPcbDocument('RP2040_minimal.kicad_pcb')],
                assets: []
            }),
            analytics: new RecordingAnalytics(),
            startupSource: { type: 'demo', id: 'kicad' }
        })

        await controller.init()

        assert.equal(state.getSnapshot().parseStatus, 'ready')
        assert.equal(seenUrls.length, 3)
    } finally {
        globalThis.fetch = originalFetch
    }
})
