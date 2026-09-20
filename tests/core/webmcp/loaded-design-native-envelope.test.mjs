import assert from 'node:assert/strict'
import test from 'node:test'
import { LoadedDesignNetlistService } from '../../../src/core/webmcp/LoadedDesignNetlistService.mjs'

/**
 * Builds the retained-model envelope supplied by the app's parser options.
 * @param {string} format Source format.
 * @param {string} fileName Fake source name.
 * @returns {object} Fake canonical document with its explicit native extension.
 */
function createDocument(format, fileName) {
    const native = {
        sourceFormat: format,
        fileName,
        kind: 'schematic',
        summary: { title: 'Query Sheet' },
        schematic: {
            components: [{ designator: 'U1', value: 'controller' }],
            nets: [
                {
                    name: 'SIGNAL',
                    pins: [{ refdes: 'U1', designator: '1', name: 'IN' }]
                }
            ]
        }
    }
    return {
        schema: 'ecad-toolkit.document.v1',
        source: { format, fileName },
        model: [],
        extensions: { [format]: { native } }
    }
}

for (const [format, fileName] of [
    ['altium', 'query-sheet.SchDoc'],
    ['kicad', 'query-sheet.kicad_sch']
]) {
    /** Verifies real toolkit dispatch for the retained native envelope. */
    test(`LoadedDesignNetlistService queries ${format} document envelopes`, () => {
        const documentModel = createDocument(format, fileName)
        const service = new LoadedDesignNetlistService({
            getSnapshot: () => ({
                activeDocumentId: 'doc-1',
                documents: [{ id: 'doc-1', documentModel }]
            })
        })

        assert.deepEqual(service.listDesigns(), [
            {
                id: 'doc-1',
                name: 'Query Sheet',
                fileName,
                kind: 'schematic',
                active: true,
                hasConnectivity: true
            }
        ])
        assert.deepEqual(service.listNets({ design: 'query-sheet' }), {
            nets: ['SIGNAL']
        })
        assert.equal(
            service.queryComponent({ refdes: 'u1' }).pins[1].net,
            'SIGNAL'
        )
        assert.equal(
            service.listComponents({ type: 'U' }).components[0].refdes,
            'U1'
        )
    })
}
