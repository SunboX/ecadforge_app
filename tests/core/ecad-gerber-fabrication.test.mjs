import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadGerberFabrication } from '../../src/core/ecad/EcadGerberFabrication.mjs'

/**
 * Builds a minimal retained Gerber document with fabrication layer data.
 * @returns {object}
 */
function createRetainedGerberDocument() {
    return {
        sourceFormat: 'gerber',
        kind: 'pcb',
        pcb: {
            fabrication: {
                layers: [
                    {
                        id: 'copper-a',
                        primitives: [],
                        drills: []
                    }
                ]
            }
        }
    }
}

/**
 * Builds a canonical Gerber document with an optional native payload.
 * @param {object} [native] Retained native payload.
 * @returns {object}
 */
function createCanonicalGerberDocument(native) {
    const documentModel = {
        schema: 'ecad-toolkit.document.v1',
        model: [],
        source: { format: 'gerber', fileName: 'synthetic-fabrication' }
    }
    return native === undefined
        ? documentModel
        : { ...documentModel, extensions: { gerber: { native } } }
}

test('EcadGerberFabrication returns only usable retained fabrication documents', () => {
    const retained = createRetainedGerberDocument()

    assert.equal(
        EcadGerberFabrication.nativeDocument(createCanonicalGerberDocument()),
        null
    )
    assert.equal(
        EcadGerberFabrication.nativeDocument(createCanonicalGerberDocument({})),
        null
    )
    assert.equal(
        EcadGerberFabrication.nativeDocument(
            createCanonicalGerberDocument({
                pcb: { fabrication: { layers: [] } }
            })
        ),
        null
    )
    assert.equal(
        EcadGerberFabrication.nativeDocument(
            createCanonicalGerberDocument(retained)
        ),
        retained
    )
    assert.equal(EcadGerberFabrication.nativeDocument(retained), retained)
})
