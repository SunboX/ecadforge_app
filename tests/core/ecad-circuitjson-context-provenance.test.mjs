import assert from 'node:assert/strict'
import test from 'node:test'
import { AppControllerParserData } from '../../src/AppControllerParserData.mjs'
import { EcadCircuitJsonContext } from '../../src/core/ecad/EcadCircuitJsonContext.mjs'

/**
 * Builds one compact canonical document with extension payload data.
 * @param {unknown} payload Extension payload.
 * @returns {Record<string, any>} Canonical document.
 */
function createDocument(payload) {
    return {
        schema: 'ecad-toolkit.document.v1',
        id: 'document-context-provenance',
        modelSchema: { name: 'circuit-json', version: '0.0.446' },
        model: [],
        source: {
            format: 'altium',
            fileName: 'fake-board.PcbDoc',
            fileType: 'pcb'
        },
        extensions: {
            altium: {
                $meta: {
                    schema: 'ecad-toolkit.extension.v1',
                    completeness: 'native',
                    included: ['payload'],
                    omitted: []
                },
                payload
            }
        },
        assets: [],
        diagnostics: [],
        statistics: {}
    }
}

test('generic app contexts preserve altered-prototype extension buffers', () => {
    const payload = new ArrayBuffer(4)
    new Uint8Array(payload).set([11, 22, 33, 44])
    Object.setPrototypeOf(payload, Object.prototype)

    const context = EcadCircuitJsonContext.prepare(createDocument(payload))

    assert.deepEqual(
        [...new Uint8Array(context.extensions.altium.payload)],
        [11, 22, 33, 44]
    )
})

test('worker-cloned documents can adopt and reuse a prepared app context', () => {
    const document = structuredClone(createDocument(new Uint8Array([3, 1, 4])))

    const adopted = EcadCircuitJsonContext.adoptStructuredClone(document)

    assert.strictEqual(EcadCircuitJsonContext.prepare(document), adopted)
    assert.deepEqual([...adopted.extensions.altium.payload], [3, 1, 4])
})

test('worker-result normalization adopts only canonical cloned documents', () => {
    const canonical = structuredClone(
        createDocument(new Uint8Array([2, 7, 1, 8]))
    )
    const nativeCompatibilityDocument = {
        fileName: 'legacy-board.PcbDoc',
        kind: 'pcb',
        pcb: { boardOutline: null, layers: [], components: [] }
    }

    const result = AppControllerParserData.normalizeStructuredCloneParseResult({
        documents: [canonical, nativeCompatibilityDocument]
    })

    assert.deepEqual(result.documents, [canonical, nativeCompatibilityDocument])
    assert.deepEqual(
        [
            ...EcadCircuitJsonContext.prepare(canonical).extensions.altium
                .payload
        ],
        [2, 7, 1, 8]
    )
})
