import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for local load selection tests.
 */
class FakeView {
    /** @type {((files: File[]) => void | Promise<void>) | null} */
    #fileSelectionCallback

    constructor() {
        this.#fileSelectionCallback = null
    }

    /**
     * @param {(files: File[]) => void | Promise<void>} callback File callback.
     * @returns {void}
     */
    bindFileSelection(callback) {
        this.#fileSelectionCallback = callback
    }

    /**
     * @param {(files: File[]) => void | Promise<void>} _callback Drop callback.
     * @returns {void}
     */
    bindDrop(_callback) {}

    /**
     * @param {(viewName: string) => void} _callback View callback.
     * @returns {void}
     */
    bindViewChange(_callback) {}

    /**
     * @param {() => void} _callback Open callback.
     * @returns {void}
     */
    bindLocalOpen(_callback) {}

    /**
     * @param {(url: string) => void | Promise<void>} _callback GitHub callback.
     * @returns {void}
     */
    bindGitHubOpen(_callback) {}

    /**
     * @param {() => void} _callback Link callback.
     * @returns {void}
     */
    bindPcbStylerClick(_callback) {}

    /**
     * @param {string} _url URL.
     * @param {string} _mode Mode.
     * @returns {void}
     */
    setPcbStylerLink(_url, _mode) {}

    /**
     * @returns {boolean}
     */
    hasLocaleSelect() {
        return false
    }

    /**
     * @param {string} _status Status message.
     * @returns {void}
     */
    setStatus(_status) {}

    /**
     * @param {object} _snapshot App state snapshot.
     * @returns {void}
     */
    render(_snapshot) {}

    /**
     * @param {File[]} files Selected files.
     * @returns {Promise<void>}
     */
    async chooseFiles(files) {
        await this.#fileSelectionCallback?.(files)
    }
}

/**
 * Minimal file fake for local parser entry tests.
 */
class FakeFile {
    /** @type {string} */
    name

    /** @type {string} */
    webkitRelativePath

    /** @type {ArrayBuffer} */
    #buffer

    /**
     * @param {string} name File basename.
     * @param {ArrayBuffer} [buffer] File bytes.
     * @param {string} [relativePath] Folder-relative path.
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
 * Parser double that returns one project parse result.
 */
class BatchParser {
    /** @type {object} */
    #result

    /** @type {string[]} */
    seenNames

    /**
     * @param {object} result Parser result.
     */
    constructor(result) {
        this.#result = result
        this.seenNames = []
    }

    /**
     * @param {{ name: string }[]} entries Parser entries.
     * @returns {object}
     */
    parseEntries(entries) {
        this.seenNames = (entries || []).map((entry) => entry.name)
        return this.#result
    }
}

/**
 * Analytics double that suppresses browser-global dependencies.
 */
class NoopAnalytics {
    /**
     * @returns {void}
     */
    track() {}
}

/**
 * Builds a normalized schematic document model stub.
 * @param {string} fileName Source filename.
 * @returns {object}
 */
function createSchematicDocument(fileName) {
    return {
        fileName,
        sourceFormat: 'kicad',
        kind: 'schematic',
        diagnostics: [],
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
 * @param {string} fileName Source filename.
 * @param {string} sourceFormat Source family.
 * @returns {object}
 */
function createPcbDocument(fileName, sourceFormat = 'kicad') {
    return {
        fileName,
        sourceFormat,
        kind: 'pcb',
        diagnostics: [],
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
 * Builds a normalized KiCad library document model stub.
 * @param {string} fileName Source filename.
 * @returns {object}
 */
function createLibraryDocument(fileName) {
    return {
        fileName,
        sourceFormat: 'kicad',
        kind: fileName.endsWith('.kicad_mod')
            ? 'footprint-library'
            : 'symbol-library',
        diagnostics: [],
        bom: []
    }
}

/**
 * Restores a global property descriptor after a test override.
 * @param {string} key Global property name.
 * @param {PropertyDescriptor | undefined} descriptor Original descriptor.
 * @returns {void}
 */
function restoreGlobalProperty(key, descriptor) {
    if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor)
        return
    }

    delete globalThis[key]
}

/**
 * Verifies folder loads prefer editable source board documents over generated
 * fabrication archives when both can render PCB/3D views.
 */
test('AppController prefers KiCad source boards over Gerber archives in folder batches', async () => {
    const state = new AppState()
    const view = new FakeView()
    const parser = new BatchParser({
        documents: [
            createPcbDocument('Project/production/fab.zip', 'gerber'),
            createSchematicDocument('Project/main.kicad_sch'),
            createPcbDocument('Project/main.kicad_pcb')
        ],
        assets: []
    })
    const controller = new AppController({
        state,
        view,
        parser,
        analytics: new NoopAnalytics()
    })

    await controller.init()
    await view.chooseFiles([
        new FakeFile(
            'fab.zip',
            new ArrayBuffer(1),
            'Project/production/fab.zip'
        ),
        new FakeFile(
            'main.kicad_sch',
            new ArrayBuffer(1),
            'Project/main.kicad_sch'
        ),
        new FakeFile(
            'main.kicad_pcb',
            new ArrayBuffer(1),
            'Project/main.kicad_pcb'
        )
    ])

    const snapshot = state.getSnapshot()

    assert.equal(snapshot.activeView, 'pcb')
    assert.equal(snapshot.activeFileName, 'Project/main.kicad_pcb')
})

/**
 * Verifies newly loaded PCB documents start with mechanical documentation
 * hidden while ordinary electrical and overlay layers remain visible.
 */
test('AppController hides mechanical drawings for newly loaded PCBs', async () => {
    const state = new AppState()
    const view = new FakeView()
    const documentModel = createPcbDocument('Project/board.PcbDoc', 'altium')
    documentModel.pcb.layers = [{ name: 'Top Layer', layerId: 1 }]
    documentModel.pcb.primitiveLayers = [
        { name: 'TopOverlay', layerId: 33, role: 'overlay' },
        { name: 'Mechanical1', layerId: 57, role: 'mechanical' },
        { name: 'Notes', layerId: 60, role: 'documentation' }
    ]
    documentModel.pcb.tracks = [
        { x1: 0, y1: 0, x2: 1, y2: 0, width: 1, layerId: 57 },
        { x1: 0, y1: 1, x2: 1, y2: 1, width: 1, layerId: 60 }
    ]
    documentModel.pcb.pads = []
    documentModel.pcb.vias = []
    documentModel.pcb.regions = []
    documentModel.pcb.texts = []
    const controller = new AppController({
        state,
        view,
        parser: new BatchParser({ documents: [documentModel], assets: [] }),
        analytics: new NoopAnalytics()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('board.PcbDoc')])

    const snapshot = state.getSnapshot()
    assert.deepEqual(snapshot.hiddenPcbLayers[snapshot.activeDocumentId], [
        'Mechanical1',
        'Notes'
    ])
})

/**
 * Verifies empty mechanical layer declarations do not create hidden drawing
 * state for a newly loaded PCB.
 */
test('AppController leaves empty mechanical drawing layers without hidden state', async () => {
    const state = new AppState()
    const view = new FakeView()
    const documentModel = createPcbDocument(
        'Project/compact-board.PcbDoc',
        'altium'
    )
    documentModel.pcb.layers = [{ name: 'Top Layer', layerId: 1 }]
    documentModel.pcb.primitiveLayers = [
        { name: 'Mechanical1', layerId: 57, role: 'mechanical' },
        { name: 'Notes', layerId: 60, role: 'documentation' }
    ]
    documentModel.pcb.tracks = []
    documentModel.pcb.arcs = []
    documentModel.pcb.fills = []
    documentModel.pcb.regions = []
    documentModel.pcb.shapeBasedRegions = []
    documentModel.pcb.polygons = []
    documentModel.pcb.texts = []
    documentModel.pcb.dimensions = []
    const controller = new AppController({
        state,
        view,
        parser: new BatchParser({ documents: [documentModel], assets: [] }),
        analytics: new NoopAnalytics()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('compact-board.PcbDoc')])

    const snapshot = state.getSnapshot()
    assert.deepEqual(snapshot.hiddenPcbLayers, {})
})

/**
 * Verifies standalone KiCad library files are parsed as local documents.
 */
test('AppController opens standalone KiCad library files from local selection', async () => {
    const state = new AppState()
    const view = new FakeView()
    const parser = new BatchParser({
        documents: [createLibraryDocument('Project/libs/R_0603.kicad_mod')],
        assets: []
    })
    const controller = new AppController({
        state,
        view,
        parser,
        analytics: new NoopAnalytics()
    })

    await controller.init()
    await view.chooseFiles([
        new FakeFile(
            'R_0603.kicad_mod',
            new ArrayBuffer(1),
            'Project/libs/R_0603.kicad_mod'
        )
    ])

    const snapshot = state.getSnapshot()

    assert.deepEqual(parser.seenNames, ['Project/libs/R_0603.kicad_mod'])
    assert.equal(snapshot.documents.length, 1)
    assert.equal(snapshot.activeFileName, 'Project/libs/R_0603.kicad_mod')
    assert.equal(snapshot.activeView, 'diagnostics')
})

/**
 * Verifies local loads replace stale document URL state from an earlier
 * browser session.
 */
test('AppController syncs local load URLs to the active parsed document', async () => {
    const originalHistory = Object.getOwnPropertyDescriptor(
        globalThis,
        'history'
    )
    const originalLocation = Object.getOwnPropertyDescriptor(
        globalThis,
        'location'
    )
    let replacedUrl = ''
    Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: {
            href: 'https://ecadforge.app/?view=pcb&document=.history%2Fold.kicad_pcb'
        }
    })
    Object.defineProperty(globalThis, 'history', {
        configurable: true,
        value: {
            state: null,
            replaceState(_state, _title, url) {
                replacedUrl = String(url)
            }
        }
    })

    try {
        const state = new AppState()
        const view = new FakeView()
        const controller = new AppController({
            state,
            view,
            parser: new BatchParser({
                documents: [createPcbDocument('Project/main.kicad_pcb')],
                assets: []
            }),
            analytics: new NoopAnalytics()
        })

        await controller.init()
        await view.chooseFiles([
            new FakeFile(
                'main.kicad_pcb',
                new ArrayBuffer(1),
                'Project/main.kicad_pcb'
            )
        ])

        const syncedUrl = new URL(replacedUrl)

        assert.equal(syncedUrl.searchParams.get('view'), 'pcb')
        assert.equal(
            syncedUrl.searchParams.get('document'),
            'Project/main.kicad_pcb'
        )
    } finally {
        restoreGlobalProperty('history', originalHistory)
        restoreGlobalProperty('location', originalLocation)
    }
})
