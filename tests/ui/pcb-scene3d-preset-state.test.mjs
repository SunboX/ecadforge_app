import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dPresetState } from '../../src/ui/PcbScene3dPresetState.mjs'

test('PcbScene3dPresetState remembers the last requested preset', () => {
    const state = new PcbScene3dPresetState()

    assert.equal(state.get(), 'isometric')
    assert.equal(state.set('top'), 'top')
    assert.equal(state.get(), 'top')
    assert.equal(state.set('bottom'), 'bottom')
    assert.equal(state.get(), 'bottom')
    assert.equal(state.set('reset'), 'reset')
    assert.equal(state.get(), 'reset')
})

test('PcbScene3dPresetState normalizes unsupported preset names', () => {
    const state = new PcbScene3dPresetState()

    assert.equal(state.set('unsupported'), 'isometric')
    assert.equal(state.get(), 'isometric')
})
