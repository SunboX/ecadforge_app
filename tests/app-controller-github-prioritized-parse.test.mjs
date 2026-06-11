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

    /** @returns {void} */
    bindFileSelection() {}

    /** @returns {void} */
    bindDrop() {}

    /** @returns {void} */
    bindViewChange() {}

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
 * Builds one fake parser entry.
 * @param {string} name Entry name.
 * @returns {{ name: string, buffer: ArrayBuffer }}
 */
function createEntry(name) {
    return { name, buffer: new ArrayBuffer(8) }
}

test('AppController prioritizes startup GitHub document parsing before background project parsing', async () => {
    const state = new AppState()
    const view = new FakeView()
    const parser = new DeferredBatchParser()
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

    await controller.init()

    let snapshot = state.getSnapshot()
    assert.deepEqual(parser.calls[0], [
        'Demo.PrjPcb',
        'Schematics/Target.SchDoc'
    ])
    assert.deepEqual(parser.calls[1], [
        'Demo.PrjPcb',
        'Schematics/Other.SchDoc',
        'PCB/Main.PcbDoc'
    ])
    assert.equal(snapshot.documents.length, 1)
    assert.equal(snapshot.activeFileName, 'Schematics/Target.SchDoc')
    assert.equal(snapshot.activeView, 'schematic')

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
