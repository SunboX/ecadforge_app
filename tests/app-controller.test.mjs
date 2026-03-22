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

    /** @type {{ activeView: string, parseStatus: string, documents: { id: string, documentModel: object }[], activeDocumentId: string } | null} */
    latestSnapshot

    /** @type {string[]} */
    statuses

    constructor() {
        this.#fileSelectionCallback = null
        this.#dropCallback = null
        this.#viewChangeCallback = null
        this.#documentSelectionCallback = null
        this.latestSnapshot = null
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
    }

    /**
     * @param {File[]} files
     * @returns {Promise<void>}
     */
    async chooseFiles(files) {
        await this.#fileSelectionCallback?.(files)
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
        'Please choose a .SchDoc, .PcbDoc, .PrjPcb, .WRL, or .STEP file.'
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
