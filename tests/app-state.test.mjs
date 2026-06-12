import assert from 'node:assert/strict'
import test from 'node:test'
import { AppState } from '../src/core/AppState.mjs'
import { PcbObjectVisibilityModel } from '../src/core/PcbObjectVisibilityModel.mjs'

/**
 * Verifies default state values are applied.
 */
test('AppState initializes with defaults', () => {
    const state = new AppState()
    const snapshot = state.getSnapshot()

    assert.equal(snapshot.activeView, 'schematic')
    assert.equal(snapshot.activeSidebarTab, 'project')
    assert.equal(snapshot.locale, 'en')
    assert.equal(snapshot.parseStatus, 'idle')
    assert.deepEqual(snapshot.documents, [])
    assert.deepEqual(snapshot.hiddenPcbObjects, {})
    assert.deepEqual(snapshot.pcbObjectOpacities, {})
    assert.deepEqual(snapshot.selectedPcbComponents, {})
    assert.equal(snapshot.autoSearchMissingModels, false)
    assert.equal(snapshot.documentModel, null)
})

/**
 * Verifies patch operations update both supported fields.
 */
test('AppState.patch updates multiple fields', () => {
    const state = new AppState({ activeView: 'pcb', locale: 'en' })
    const snapshot = state.patch({
        activeView: 'bom',
        activeSidebarTab: 'layers',
        autoSearchMissingModels: true,
        locale: 'de',
        parseStatus: 'ready',
        statusMessage: 'Loaded relic'
    })

    assert.equal(snapshot.activeView, 'bom')
    assert.equal(snapshot.activeSidebarTab, 'layers')
    assert.equal(snapshot.autoSearchMissingModels, true)
    assert.equal(snapshot.locale, 'de')
    assert.equal(snapshot.parseStatus, 'ready')
    assert.equal(snapshot.statusMessage, 'Loaded relic')
})

/**
 * Verifies unsupported sidebar tabs fall back to the default overview panel.
 */
test('AppState sanitizes unsupported sidebar tabs', () => {
    const state = new AppState({ activeSidebarTab: 'layers' })

    assert.equal(state.getSnapshot().activeSidebarTab, 'layers')

    const snapshot = state.setValue('activeSidebarTab', 'unknown')

    assert.equal(snapshot.activeSidebarTab, 'project')
})

/**
 * Verifies PCB layer visibility choices are normalized and retained by
 * document id.
 */
test('AppState stores hidden PCB layer keys by document', () => {
    const state = new AppState({
        hiddenPcbLayers: {
            'doc-1': ['F.Cu', 'F.Cu', 14],
            '': ['ignored'],
            'doc-2': 'ignored'
        }
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbLayers, {
        'doc-1': ['F.Cu', '14']
    })

    const snapshot = state.setValue('hiddenPcbLayers', {
        'doc-2': ['B.SilkS']
    })

    assert.deepEqual(snapshot.hiddenPcbLayers, {
        'doc-2': ['B.SilkS']
    })
})

/**
 * Verifies PCB object visibility choices are normalized by document id.
 */
test('AppState stores hidden PCB object keys by document', () => {
    const state = new AppState({
        hiddenPcbObjects: {
            'doc-1': ['tracks', 'tracks', 7],
            '': ['ignored'],
            'doc-2': 'ignored'
        }
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbObjects, {
        'doc-1': ['tracks', '7']
    })

    const snapshot = state.setValue('hiddenPcbObjects', {
        'doc-2': ['vias']
    })

    assert.deepEqual(snapshot.hiddenPcbObjects, {
        'doc-2': ['vias']
    })
})

/**
 * Verifies PCB object visibility exposes every virtual render-control layer.
 */
test('PcbObjectVisibilityModel exposes footprint text as a virtual object control', () => {
    assert.deepEqual(
        PcbObjectVisibilityModel.resolveObjectCategories().map(
            (category) => category.key
        ),
        [
            'tracks',
            'vias',
            'pads',
            'holes',
            'zones',
            'footprint-text',
            'grid',
            'page'
        ]
    )
    assert.deepEqual(
        PcbObjectVisibilityModel.withObjectVisibility(
            {},
            'doc-1',
            'footprint-text',
            false
        ),
        {
            'doc-1': ['footprint-text']
        }
    )
})

/**
 * Verifies PCB object opacity values are normalized by document id.
 */
test('AppState stores PCB object opacity by document', () => {
    const state = new AppState({
        pcbObjectOpacities: {
            'doc-1': {
                tracks: 45.4,
                vias: -5,
                pads: 140,
                zones: '30'
            },
            '': { tracks: 20 },
            'doc-2': 'ignored'
        }
    })

    assert.deepEqual(state.getSnapshot().pcbObjectOpacities, {
        'doc-1': {
            tracks: 45,
            vias: 0,
            pads: 100,
            zones: 30
        }
    })

    const snapshot = state.setValue('pcbObjectOpacities', {
        'doc-2': {
            page: 65
        }
    })

    assert.deepEqual(snapshot.pcbObjectOpacities, {
        'doc-2': {
            page: 65
        }
    })
})

/**
 * Verifies selected PCB components are normalized by document id.
 */
test('AppState stores selected PCB components by document', () => {
    const state = new AppState({
        selectedPcbComponents: {
            'doc-1': 'U1',
            '': 'ignored',
            'doc-2': ''
        }
    })

    assert.deepEqual(state.getSnapshot().selectedPcbComponents, {
        'doc-1': 'U1'
    })

    const snapshot = state.setValue('selectedPcbComponents', {
        'doc-2': 'R1'
    })

    assert.deepEqual(snapshot.selectedPcbComponents, {
        'doc-2': 'R1'
    })
})

/**
 * Verifies selected nets are normalized by document id.
 */
test('AppState stores selected nets by document', () => {
    const state = new AppState({
        selectedNets: {
            'doc-1': 'SENSE_A',
            '': 'ignored',
            'doc-2': ''
        }
    })

    assert.deepEqual(state.getSnapshot().selectedNets, {
        'doc-1': 'SENSE_A'
    })

    const snapshot = state.setValue('selectedNets', {
        'doc-2': 'RETURN'
    })

    assert.deepEqual(snapshot.selectedNets, {
        'doc-2': 'RETURN'
    })
})

/**
 * Verifies AppState stores multiple documents and derives the active one.
 */
test('AppState derives the active document from the session document list', () => {
    const alphaDocument = {
        fileName: 'alpha.SchDoc',
        kind: 'schematic',
        diagnostics: [],
        summary: {}
    }
    const betaDocument = {
        fileName: 'beta.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: {}
    }
    const state = new AppState()

    const snapshot = state.patch({
        documents: [
            { id: 'doc-1', documentModel: alphaDocument },
            { id: 'doc-2', documentModel: betaDocument }
        ],
        activeDocumentId: 'doc-2',
        activeView: '3d'
    })

    assert.equal(snapshot.documents.length, 2)
    assert.equal(snapshot.activeDocumentId, 'doc-2')
    assert.equal(snapshot.documentModel, betaDocument)
    assert.equal(snapshot.activeFileName, 'beta.PcbDoc')
    assert.equal(snapshot.activeView, '3d')
})

/**
 * Verifies AppState falls back to the first available document when the
 * requested active document id is unavailable.
 */
test('AppState falls back to the first document when selection is unavailable', () => {
    const alphaDocument = {
        fileName: 'alpha.SchDoc',
        kind: 'schematic',
        diagnostics: [],
        summary: {}
    }
    const state = new AppState({
        documents: [{ id: 'doc-1', documentModel: alphaDocument }],
        activeDocumentId: 'missing'
    })

    const snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'doc-1')
    assert.equal(snapshot.documentModel, alphaDocument)
    assert.equal(snapshot.activeFileName, 'alpha.SchDoc')
})

/**
 * Verifies subscribers are notified on updates.
 */
test('AppState.subscribe receives updates', () => {
    const state = new AppState({ activeView: 'schematic' })
    const received = []

    const unsubscribe = state.subscribe((snapshot) => {
        received.push(snapshot.activeView)
    })

    state.setValue('activeView', 'pcb')
    state.setValue('activeView', 'bom')
    unsubscribe()
    state.setValue('activeView', '3d')

    assert.deepEqual(received, ['schematic', 'pcb', 'bom'])
})

/**
 * Verifies session companion assets are retained alongside parsed documents.
 */
test('AppState stores companion assets without affecting the active document', () => {
    const alphaDocument = {
        fileName: 'alpha.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: {},
        pcb: {}
    }
    const state = new AppState({
        documents: [{ id: 'doc-1', documentModel: alphaDocument }],
        activeDocumentId: 'doc-1',
        activeView: '3d'
    })

    const snapshot = state.patch({
        sessionAssets: [
            {
                name: 'QFN32.wrl',
                relativePath: 'Models/QFN32.wrl',
                file: { name: 'QFN32.wrl' },
                format: 'wrl'
            }
        ]
    })

    assert.equal(snapshot.documentModel, alphaDocument)
    assert.equal(snapshot.activeDocumentId, 'doc-1')
    assert.equal(snapshot.sessionAssets.length, 1)
    assert.equal(snapshot.sessionAssets[0].relativePath, 'Models/QFN32.wrl')
})
