import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for cross-view component selection tests.
 */
class FakeView {
    /** @type {((viewName: string) => void) | null} */
    #viewChangeCallback
    /** @type {((change: { documentId: string, componentKey: string, source?: string }) => void) | null} */
    #componentSelectionCallback
    /** @type {((change: { documentId: string, netName: string, source?: string }) => void) | null} */
    #netSelectionCallback

    constructor() {
        this.#viewChangeCallback = null
        this.#componentSelectionCallback = null
        this.#netSelectionCallback = null
    }

    /** @param {() => void} _callback @returns {void} */
    bindFileSelection(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindDrop(_callback) {}

    /** @param {(viewName: string) => void} callback @returns {void} */
    bindViewChange(callback) {
        this.#viewChangeCallback = callback
    }

    /** @param {() => void} _callback @returns {void} */
    bindDocumentSelection(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindDemoSelection(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindLocalOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindGitHubOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindPcbStylerClick(_callback) {}

    /**
     * @param {(change: { documentId: string, componentKey: string, source?: string }) => void} callback
     * @returns {void}
     */
    bindPcbComponentSelectionChange(callback) {
        this.#componentSelectionCallback = callback
    }

    /**
     * @param {(change: { documentId: string, netName: string, source?: string }) => void} callback
     * @returns {void}
     */
    bindPcbNetSelectionChange(callback) {
        this.#netSelectionCallback = callback
    }

    /** @returns {boolean} */
    hasLocaleSelect() {
        return false
    }

    /** @returns {void} */
    setStatus() {}

    /** @returns {void} */
    render() {}

    /** @param {string} viewName @returns {void} */
    changeView(viewName) {
        this.#viewChangeCallback?.(viewName)
    }

    /**
     * @param {{ documentId: string, componentKey: string, source?: string }} change
     * @returns {void}
     */
    selectComponent(change) {
        this.#componentSelectionCallback?.(change)
    }

    /**
     * @param {{ documentId: string, netName: string, source?: string }} change
     * @returns {void}
     */
    selectNet(change) {
        this.#netSelectionCallback?.(change)
    }
}

/**
 * Builds a schematic document with one shared component designator.
 * @param {string[]} [nets] Schematic net names.
 * @param {string} [designator] Component designator.
 * @param {string} [fileName] Document file name.
 * @returns {object}
 */
function createSchematicDocument(
    nets = ['SENSE_A'],
    designator = 'U1',
    fileName = 'demo.SchDoc'
) {
    return {
        fileName,
        kind: 'schematic',
        diagnostics: [],
        summary: { title: fileName },
        schematic: {
            sheet: { width: 200, height: 100 },
            components: [{ designator, libraryReference: 'MCU' }],
            pins: [],
            ports: [],
            nets: nets.map((name) => ({ name }))
        },
        bom: []
    }
}

/**
 * Builds a PCB document with shared component designators.
 * @param {string[]} [designators] Component designators.
 * @returns {object}
 */
function createPcbDocument(designators = ['U1']) {
    return {
        fileName: 'demo.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: { title: 'demo.PcbDoc' },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            components: designators.map((designator) => ({
                designator,
                pattern: 'SOP-16'
            })),
            nets: [{ name: 'SENSE_A' }]
        },
        bom: []
    }
}

/**
 * Builds a PCB document whose net names use KiCad hierarchical prefixes.
 * @returns {object}
 */
function createSlashPrefixedPcbDocument(nets = ['/SENSE_A']) {
    return {
        fileName: 'demo.kicad_pcb',
        kind: 'pcb',
        diagnostics: [],
        summary: { title: 'demo.kicad_pcb' },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            components: [{ designator: 'U1', pattern: 'SOP-16' }],
            nets: nets.map((name) => ({ name }))
        },
        bom: []
    }
}

test('AppController preserves selected component when switching schematic, PCB, and 3D views', async () => {
    const state = new AppState({
        activeView: 'schematic',
        documents: [
            { id: 'schematic-doc', documentModel: createSchematicDocument() },
            { id: 'pcb-doc', documentModel: createPcbDocument() }
        ],
        activeDocumentId: 'schematic-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {}
    })

    await controller.init()
    view.selectComponent({
        documentId: 'schematic-doc',
        componentKey: 'U1',
        source: 'schematic'
    })

    view.changeView('pcb')
    let snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'pcb-doc')
    assert.equal(snapshot.selectedPcbComponents['pcb-doc'], 'U1')

    view.changeView('3d')
    snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'pcb-doc')
    assert.equal(snapshot.selectedPcbComponents['pcb-doc'], 'U1')

    view.changeView('schematic')
    snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'schematic-doc')
    assert.equal(snapshot.selectedPcbComponents['schematic-doc'], 'U1')

    view.selectComponent({
        documentId: 'schematic-doc',
        componentKey: 'U1',
        source: 'schematic'
    })

    assert.deepEqual(state.getSnapshot().selectedPcbComponents, {})
})

test('AppController opens the schematic document containing a PCB-selected component', async () => {
    const state = new AppState({
        activeView: 'pcb',
        documents: [
            {
                id: 'sheet-a',
                documentModel: createSchematicDocument(
                    ['SENSE_A'],
                    'U1',
                    'sheet-a.SchDoc'
                )
            },
            {
                id: 'sheet-b',
                documentModel: createSchematicDocument(
                    ['SENSE_A'],
                    'U2',
                    'sheet-b.SchDoc'
                )
            },
            { id: 'pcb-doc', documentModel: createPcbDocument(['U1', 'U2']) }
        ],
        activeDocumentId: 'pcb-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {}
    })

    await controller.init()
    view.selectComponent({
        documentId: 'pcb-doc',
        componentKey: 'U2',
        source: 'pcb-board'
    })
    view.changeView('schematic')

    const snapshot = state.getSnapshot()
    assert.equal(snapshot.activeDocumentId, 'sheet-b')
    assert.equal(snapshot.selectedPcbComponents['sheet-b'], 'U2')
})

test('AppController restores startup selected component state', async () => {
    const state = new AppState({
        activeView: 'schematic',
        documents: [
            { id: 'schematic-doc', documentModel: createSchematicDocument() },
            { id: 'pcb-doc', documentModel: createPcbDocument() }
        ],
        activeDocumentId: 'schematic-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {},
        startupSource: {
            type: 'state',
            component: 'U1'
        }
    })

    await controller.init()

    const snapshot = state.getSnapshot()
    assert.deepEqual(snapshot.selectedPcbComponents, {
        'schematic-doc': 'U1',
        'pcb-doc': 'U1'
    })
    assert.equal(snapshot.activeSidebarTab, 'components')
})

test('AppController preserves selected net when switching schematic and PCB views', async () => {
    const state = new AppState({
        activeView: 'schematic',
        documents: [
            { id: 'schematic-doc', documentModel: createSchematicDocument() },
            { id: 'pcb-doc', documentModel: createPcbDocument() }
        ],
        activeDocumentId: 'schematic-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {}
    })

    await controller.init()
    view.selectNet({
        documentId: 'schematic-doc',
        netName: 'SENSE_A',
        source: 'schematic'
    })

    view.changeView('pcb')
    let snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'pcb-doc')
    assert.equal(snapshot.selectedNets['pcb-doc'], 'SENSE_A')

    view.changeView('schematic')
    snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'schematic-doc')
    assert.equal(snapshot.selectedNets['schematic-doc'], 'SENSE_A')

    view.selectNet({
        documentId: 'schematic-doc',
        netName: 'SENSE_A',
        source: 'schematic'
    })

    assert.deepEqual(state.getSnapshot().selectedNets, {})
})

test('AppController maps slash-prefixed PCB net selections to schematic nets', async () => {
    const state = new AppState({
        activeView: 'pcb',
        documents: [
            { id: 'schematic-doc', documentModel: createSchematicDocument() },
            {
                id: 'pcb-doc',
                documentModel: createSlashPrefixedPcbDocument()
            }
        ],
        activeDocumentId: 'pcb-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {}
    })

    await controller.init()
    view.selectNet({
        documentId: 'pcb-doc',
        netName: '/SENSE_A',
        source: 'pcb-board'
    })

    view.changeView('schematic')
    const snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'schematic-doc')
    assert.equal(snapshot.selectedNets['schematic-doc'], 'SENSE_A')
})

test('AppController maps schematic net selections to slash-prefixed PCB nets', async () => {
    const state = new AppState({
        activeView: 'schematic',
        documents: [
            { id: 'schematic-doc', documentModel: createSchematicDocument() },
            {
                id: 'pcb-doc',
                documentModel: createSlashPrefixedPcbDocument()
            }
        ],
        activeDocumentId: 'schematic-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {}
    })

    await controller.init()
    view.selectNet({
        documentId: 'schematic-doc',
        netName: 'SENSE_A',
        source: 'schematic'
    })

    view.changeView('pcb')
    const snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'pcb-doc')
    assert.equal(snapshot.selectedNets['pcb-doc'], '/SENSE_A')
})

test('AppController clears stale PCB net selections when a schematic net has no PCB match', async () => {
    const state = new AppState({
        activeView: 'schematic',
        documents: [
            {
                id: 'schematic-doc',
                documentModel: createSchematicDocument(['SENSE_A', 'SENSE_B'])
            },
            {
                id: 'pcb-doc',
                documentModel: createSlashPrefixedPcbDocument(['/SENSE_A'])
            }
        ],
        activeDocumentId: 'schematic-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {}
    })

    await controller.init()
    view.selectNet({
        documentId: 'schematic-doc',
        netName: 'SENSE_A',
        source: 'schematic'
    })
    view.selectNet({
        documentId: 'schematic-doc',
        netName: 'SENSE_B',
        source: 'schematic'
    })

    view.changeView('pcb')
    const snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'pcb-doc')
    assert.equal(snapshot.selectedNets['schematic-doc'], 'SENSE_B')
    assert.equal(snapshot.selectedNets['pcb-doc'], undefined)
})

test('AppController restores startup selected net state', async () => {
    const state = new AppState({
        activeView: 'schematic',
        documents: [
            { id: 'schematic-doc', documentModel: createSchematicDocument() },
            { id: 'pcb-doc', documentModel: createPcbDocument() }
        ],
        activeDocumentId: 'schematic-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {},
        startupSource: {
            type: 'state',
            net: 'SENSE_A'
        }
    })

    await controller.init()

    const snapshot = state.getSnapshot()
    assert.deepEqual(snapshot.selectedNets, {
        'schematic-doc': 'SENSE_A',
        'pcb-doc': 'SENSE_A'
    })
    assert.equal(snapshot.activeSidebarTab, 'nets')
})

test('AppController ignores startup net state that is missing from the active document', async () => {
    const state = new AppState({
        activeView: 'schematic',
        documents: [
            { id: 'schematic-doc', documentModel: createSchematicDocument() },
            { id: 'pcb-doc', documentModel: createPcbDocument() }
        ],
        activeDocumentId: 'schematic-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {},
        startupSource: {
            type: 'state',
            net: 'MISSING_NET'
        }
    })

    await controller.init()

    const snapshot = state.getSnapshot()
    assert.deepEqual(snapshot.selectedNets, {})
    assert.equal(snapshot.activeSidebarTab, 'project')
})

test('AppController writes selected component state into the URL', async () => {
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location
    const replaceCalls = []

    try {
        Object.defineProperty(globalThis, 'history', {
            configurable: true,
            value: {
                state: { active: true },
                replaceState(...args) {
                    replaceCalls.push(args)
                }
            }
        })
        Object.defineProperty(globalThis, 'location', {
            configurable: true,
            value: {
                href: 'https://ecadforge.app/?view=schematic&document=demo.SchDoc'
            }
        })

        const state = new AppState({
            activeView: 'schematic',
            documents: [
                {
                    id: 'schematic-doc',
                    documentModel: createSchematicDocument()
                }
            ],
            activeDocumentId: 'schematic-doc'
        })
        const view = new FakeView()
        const controller = new AppController({
            state,
            view,
            parser: {}
        })

        await controller.init()
        view.selectComponent({
            documentId: 'schematic-doc',
            componentKey: 'U1',
            source: 'schematic'
        })

        assert.equal(replaceCalls.length, 1)
        let writtenUrl = new URL(replaceCalls.at(-1)[2])
        assert.equal(writtenUrl.searchParams.get('component'), 'U1')

        view.selectComponent({
            documentId: 'schematic-doc',
            componentKey: 'U1',
            source: 'schematic'
        })

        writtenUrl = new URL(replaceCalls.at(-1)[2])
        assert.equal(writtenUrl.searchParams.has('component'), false)
    } finally {
        restoreGlobalProperty('history', originalHistory)
        restoreGlobalProperty('location', originalLocation)
    }
})

test('AppController writes selected net state into the URL', async () => {
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location
    const replaceCalls = []

    try {
        Object.defineProperty(globalThis, 'history', {
            configurable: true,
            value: {
                state: { active: true },
                replaceState(...args) {
                    replaceCalls.push(args)
                }
            }
        })
        Object.defineProperty(globalThis, 'location', {
            configurable: true,
            value: {
                href: 'https://ecadforge.app/?view=schematic&document=demo.SchDoc'
            }
        })

        const state = new AppState({
            activeView: 'schematic',
            documents: [
                {
                    id: 'schematic-doc',
                    documentModel: createSchematicDocument()
                }
            ],
            activeDocumentId: 'schematic-doc'
        })
        const view = new FakeView()
        const controller = new AppController({
            state,
            view,
            parser: {}
        })

        await controller.init()
        view.selectNet({
            documentId: 'schematic-doc',
            netName: 'SENSE_A',
            source: 'schematic'
        })

        assert.equal(replaceCalls.length, 1)
        let writtenUrl = new URL(replaceCalls.at(-1)[2])
        assert.equal(writtenUrl.searchParams.get('net'), 'SENSE_A')

        view.selectNet({
            documentId: 'schematic-doc',
            netName: 'SENSE_A',
            source: 'schematic'
        })

        writtenUrl = new URL(replaceCalls.at(-1)[2])
        assert.equal(writtenUrl.searchParams.has('net'), false)
    } finally {
        restoreGlobalProperty('history', originalHistory)
        restoreGlobalProperty('location', originalLocation)
    }
})

/**
 * Restores or deletes a patched global property.
 * @param {string} propertyName Global property name.
 * @param {unknown} originalValue Original property value.
 * @returns {void}
 */
function restoreGlobalProperty(propertyName, originalValue) {
    if (originalValue === undefined) {
        delete globalThis[propertyName]
        return
    }

    Object.defineProperty(globalThis, propertyName, {
        configurable: true,
        value: originalValue
    })
}
