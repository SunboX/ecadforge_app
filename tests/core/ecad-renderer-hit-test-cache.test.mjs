import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionIndex as AltiumPcbInteractionIndex } from 'altium-toolkit/renderers'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

test('EcadRendererService reuses PCB interaction indexes across hit tests', () => {
    const documentModel = {
        sourceFormat: 'altium',
        kind: 'pcb',
        pcb: {}
    }
    const originalBuild = AltiumPcbInteractionIndex.build
    const originalHitTest = AltiumPcbInteractionIndex.hitTest
    const hadHitTestItems = Object.hasOwn(
        AltiumPcbInteractionIndex,
        'hitTestItems'
    )
    const originalHitTestItems = AltiumPcbInteractionIndex.hitTestItems
    let buildCalls = 0
    let hitTestItemsCalls = 0

    AltiumPcbInteractionIndex.build = (receivedDocumentModel) => {
        assert.equal(receivedDocumentModel, documentModel)
        buildCalls += 1
        return [{ id: 'cached-index-item' }]
    }
    AltiumPcbInteractionIndex.hitTestItems = (items, point, options) => {
        hitTestItemsCalls += 1
        assert.deepEqual(items, [{ id: 'cached-index-item' }])
        assert.deepEqual(point, { x: 1, y: 2 })
        assert.equal(options.side, 'top')
        return [{ id: 'candidate-' + hitTestItemsCalls }]
    }
    AltiumPcbInteractionIndex.hitTest = () => {
        throw new Error('uncached hitTest path used')
    }

    try {
        assert.deepEqual(
            EcadRendererService.hitTestPcb(
                documentModel,
                { x: 1, y: 2 },
                { side: 'top' }
            ),
            [{ id: 'candidate-1' }]
        )
        assert.deepEqual(
            EcadRendererService.hitTestPcb(
                documentModel,
                { x: 1, y: 2 },
                { side: 'top' }
            ),
            [{ id: 'candidate-2' }]
        )
    } finally {
        AltiumPcbInteractionIndex.build = originalBuild
        AltiumPcbInteractionIndex.hitTest = originalHitTest
        if (hadHitTestItems) {
            AltiumPcbInteractionIndex.hitTestItems = originalHitTestItems
        } else {
            delete AltiumPcbInteractionIndex.hitTestItems
        }
    }

    assert.equal(buildCalls, 1)
    assert.equal(hitTestItemsCalls, 2)
})
