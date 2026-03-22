import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dFallbackVisibility } from '../../src/ui/PcbScene3dFallbackVisibility.mjs'

/**
 * Verifies fallback bodies hide only when a matching external model is both
 * loaded and currently visible.
 */
test('PcbScene3dFallbackVisibility hides duplicate fallback bodies only while external models are shown', () => {
    const fallbackRoots = new Map()
    const loadedDesignators = new Set()
    const duplicateFallback = { visible: true }
    const unmatchedFallback = { visible: true }

    PcbScene3dFallbackVisibility.registerFallbackRoot(
        fallbackRoots,
        'J17',
        duplicateFallback
    )
    PcbScene3dFallbackVisibility.registerFallbackRoot(
        fallbackRoots,
        'R5',
        unmatchedFallback
    )
    PcbScene3dFallbackVisibility.markExternalModelLoaded(
        loadedDesignators,
        'J17'
    )

    PcbScene3dFallbackVisibility.applyVisibility(
        fallbackRoots,
        loadedDesignators,
        {
            'fallback-bodies': true,
            'external-models': true
        }
    )

    assert.equal(duplicateFallback.visible, false)
    assert.equal(unmatchedFallback.visible, true)

    PcbScene3dFallbackVisibility.applyVisibility(
        fallbackRoots,
        loadedDesignators,
        {
            'fallback-bodies': true,
            'external-models': false
        }
    )

    assert.equal(duplicateFallback.visible, true)
    assert.equal(unmatchedFallback.visible, true)

    PcbScene3dFallbackVisibility.applyVisibility(
        fallbackRoots,
        loadedDesignators,
        {
            'fallback-bodies': false,
            'external-models': false
        }
    )

    assert.equal(duplicateFallback.visible, false)
    assert.equal(unmatchedFallback.visible, false)
})
