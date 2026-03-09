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
        statusMessage: 'Loaded sample'
    })

    assert.equal(snapshot.activeView, 'bom')
    assert.equal(snapshot.locale, 'de')
    assert.equal(snapshot.parseStatus, 'ready')
    assert.equal(snapshot.statusMessage, 'Loaded sample')
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
