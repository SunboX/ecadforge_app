import assert from 'node:assert/strict'
import test from 'node:test'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Verifies default state values are applied.
 */
test('AppState initializes with defaults', () => {
    const state = new AppState()
    const snapshot = state.getSnapshot()

    assert.equal(snapshot.activeView, 'schematic')
    assert.equal(snapshot.locale, 'en')
    assert.equal(snapshot.parseStatus, 'idle')
    assert.deepEqual(snapshot.documents, [])
    assert.equal(snapshot.documentModel, null)
})

/**
 * Verifies patch operations update both supported fields.
 */
test('AppState.patch updates multiple fields', () => {
    const state = new AppState({ activeView: 'pcb', locale: 'en' })
    const snapshot = state.patch({
        activeView: 'bom',
        locale: 'de',
        parseStatus: 'ready',
        statusMessage: 'Loaded relic'
    })

    assert.equal(snapshot.activeView, 'bom')
    assert.equal(snapshot.locale, 'de')
    assert.equal(snapshot.parseStatus, 'ready')
    assert.equal(snapshot.statusMessage, 'Loaded relic')
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
