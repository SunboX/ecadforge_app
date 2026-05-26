import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dInteractionHints } from '../../src/ui/PcbScene3dInteractionHints.mjs'

/**
 * Verifies mouse and touch gestures are explicitly mapped for the 3D viewer.
 */
test('PcbScene3dInteractionHints configures mouse and touch gestures', () => {
    const controls = {}
    const THREE = {
        MOUSE: {
            ROTATE: 'mouse-rotate',
            DOLLY: 'mouse-dolly',
            PAN: 'mouse-pan'
        },
        TOUCH: {
            ROTATE: 'touch-rotate',
            DOLLY_PAN: 'touch-dolly-pan'
        }
    }

    PcbScene3dInteractionHints.configureControls(controls, THREE)

    assert.deepEqual(controls.mouseButtons, {
        LEFT: 'mouse-rotate',
        MIDDLE: 'mouse-dolly',
        RIGHT: 'mouse-pan'
    })
    assert.deepEqual(controls.touches, {
        ONE: 'touch-rotate',
        TWO: 'touch-dolly-pan'
    })
})

/**
 * Verifies the default instruction copy reflects touch-first devices.
 */
test('PcbScene3dInteractionHints resolves mobile gesture copy', () => {
    const environment = {
        matchMedia(query) {
            return { matches: query === '(pointer: coarse)' }
        }
    }

    assert.equal(
        PcbScene3dInteractionHints.resolveDefaultMessage(environment),
        'Drag with one finger to orbit, pinch to zoom, and drag with two fingers to pan.'
    )
})
