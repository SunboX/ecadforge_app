import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for CircuitJSON controller tests.
 */
class CircuitJsonViewFake {
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
     * @param {(documentId: string) => void} _callback Document callback.
     * @returns {void}
     */
    bindDocumentSelection(_callback) {}

    /**
     * @param {(demoId: string) => void | Promise<void>} _callback Demo callback.
     * @returns {void}
     */
    bindDemoSelection(_callback) {}

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
     * @param {() => void} _callback PCB Styler callback.
     * @returns {void}
     */
    bindPcbStylerClick(_callback) {}

    /**
     * @param {string} _url PCB Styler URL.
     * @param {string} _mode Link mode.
     * @returns {void}
     */
    setPcbStylerLink(_url, _mode) {}

    /**
     * @param {(locale: string) => void | Promise<void>} _callback Locale callback.
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
     * @param {string} _status Status text.
     * @returns {void}
     */
    setStatus(_status) {}

    /**
     * @param {string} _version App version.
     * @returns {void}
     */
    setVersion(_version) {}

    /**
     * @param {any} _snapshot App snapshot.
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
 * Minimal browser File replacement.
 */
class CircuitJsonFileFake {
    /** @type {ArrayBuffer} */
    #buffer

    /**
     * @param {string} name File name.
     * @param {ArrayBuffer} [buffer] File bytes.
     */
    constructor(name, buffer = new ArrayBuffer(8)) {
        this.name = name
        this.webkitRelativePath = ''
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
 * Parser double keyed by file name.
 */
class CircuitJsonParserFake {
    /** @type {object[]} */
    #documentModel

    /**
     * @param {object[]} documentModel Parsed document model.
     */
    constructor(documentModel) {
        this.#documentModel = documentModel
    }

    /**
     * @param {string} fileName File name.
     * @param {ArrayBuffer} _buffer Source bytes.
     * @returns {object[]}
     */
    parseArrayBuffer(fileName, _buffer) {
        assert.equal(fileName, 'board.json')
        return this.#documentModel
    }
}

/**
 * Builds a standalone CircuitJSON PCB model stub.
 * @param {string} fileName File name.
 * @returns {object[]}
 */
function createCircuitJsonDocument(fileName) {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 10,
            height: 5
        }
    ]
    Object.defineProperties(documentModel, {
        fileName: {
            enumerable: false,
            value: fileName
        },
        kind: {
            enumerable: false,
            value: 'pcb'
        },
        sourceFormat: {
            enumerable: false,
            value: 'circuitjson'
        }
    })
    return documentModel
}

/**
 * Verifies standalone CircuitJSON files open on the PCB path.
 */
test('AppController opens standalone CircuitJSON documents in PCB view', async () => {
    const state = new AppState()
    const view = new CircuitJsonViewFake()
    const controller = new AppController({
        state,
        view,
        parser: new CircuitJsonParserFake(
            createCircuitJsonDocument('board.json')
        )
    })

    await controller.init()
    await view.chooseFiles([new CircuitJsonFileFake('board.json')])

    const snapshot = state.getSnapshot()

    assert.equal(snapshot.documents.length, 1)
    assert.equal(snapshot.activeFileName, 'board.json')
    assert.equal(snapshot.activeView, 'pcb')
    assert.equal(snapshot.documentModel.sourceFormat, 'circuitjson')
})
