import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbViewportPreservation } from '../../src/ui/PcbViewportPreservation.mjs'

/**
 * Builds a minimal content node with one mutable PCB viewBox.
 * @returns {object}
 */
function createContentNode() {
    const attributes = new Map([['viewBox', '10 20 30 40']])
    return {
        querySelector() {
            return {
                getAttribute(name) {
                    return attributes.get(name) || ''
                },
                setAttribute(name, value) {
                    attributes.set(name, String(value))
                }
            }
        }
    }
}

/**
 * Builds a generic PCB with one mechanical layer.
 * @returns {object}
 */
function createDocumentModel() {
    return {
        kind: 'pcb',
        pcb: {
            layers: [{ name: 'Top Layer', layerId: 1, role: 'copper' }],
            primitiveLayers: [
                { name: 'Mechanical1', layerId: 57, role: 'mechanical' }
            ],
            tracks: [{ x1: 0, y1: 0, x2: 1, y2: 1, width: 1, layerId: 57 }]
        }
    }
}

/**
 * Verifies preserved pan and zoom is restored only while fitted drawing-layer
 * bounds remain unchanged.
 */
test('PcbViewportPreservation resets when drawing visibility changes', () => {
    const contentNode = createContentNode()
    const documentModel = createDocumentModel()
    const hiddenKey = PcbViewportPreservation.boundsKey(documentModel, [
        'Mechanical1'
    ])

    PcbViewportPreservation.capture(contentNode, {
        documentModel,
        side: 'top',
        selectedComponentKey: '',
        boundsKey: hiddenKey
    })
    const changed = PcbViewportPreservation.restore(contentNode, {
        documentModel,
        side: 'top',
        boundsKey: PcbViewportPreservation.boundsKey(documentModel, [])
    })

    assert.equal(changed.restored, false)

    PcbViewportPreservation.capture(contentNode, {
        documentModel,
        side: 'top',
        selectedComponentKey: '',
        boundsKey: hiddenKey
    })
    const unchanged = PcbViewportPreservation.restore(contentNode, {
        documentModel,
        side: 'top',
        boundsKey: hiddenKey
    })

    assert.equal(unchanged.restored, true)
})
