import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { AppControllerPcbAssemblyExport } from '../src/AppControllerPcbAssemblyExport.mjs'

/**
 * Decodes UTF-8 download bytes.
 * @param {Uint8Array} bytes Download bytes.
 * @returns {string}
 */
function decode(bytes) {
    return new TextDecoder().decode(bytes)
}

/**
 * Verifies manufacturing export formats are downloaded from canonical data
 * without invoking the 3D assembly export service.
 */
test('AppControllerPcbAssemblyExport downloads canonical manufacturing formats', async () => {
    const downloads = []
    const statuses = []
    let assemblyExportCalls = 0
    const documentModel = Parser.parse({
        fileName: 'metadata-board.json',
        data: JSON.stringify([
            {
                type: 'pcb_board',
                pcb_board_id: 'board_1',
                center: { x: 0, y: 0 },
                width: 10,
                height: 5
            },
            {
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_chip'
            },
            {
                type: 'pcb_component',
                pcb_component_id: 'pcb_u1',
                source_component_id: 'source_u1',
                center: { x: 1, y: 2 },
                width: 3,
                height: 2,
                rotation: 0,
                layer: 'top'
            },
            {
                type: 'pcb_fabrication_note_text',
                pcb_fabrication_note_text_id: 'fab_text_1',
                pcb_component_id: 'pcb_u1',
                layer: 'top',
                text: 'Inspect assembly',
                anchor_position: { x: 1, y: 2 },
                font_size: 0.8
            }
        ])
    })

    await AppControllerPcbAssemblyExport.handle({
        change: { documentId: 'doc-1', format: 'pick-place-csv' },
        state: {
            getSnapshot: () => ({
                activeDocumentId: 'doc-1',
                documentModel,
                documents: [{ id: 'doc-1', documentModel }],
                sessionAssets: []
            })
        },
        view: {
            downloadBytes: (fileName, bytes, contentType) =>
                downloads.push({ fileName, bytes, contentType }),
            setStatus: (status) => statuses.push(status)
        },
        pcbAssemblyExportService: {
            export: async () => {
                assemblyExportCalls += 1
                return {
                    fileName: 'unused.step',
                    bytes: new Uint8Array(),
                    contentType: 'application/octet-stream'
                }
            }
        }
    })

    assert.equal(assemblyExportCalls, 0)
    assert.equal(downloads[0].fileName, 'metadata-board-pick-place.csv')
    assert.equal(downloads[0].contentType, 'text/csv;charset=utf-8')
    assert.match(decode(downloads[0].bytes), /U1/)
    assert.deepEqual(statuses, ['Exported metadata-board-pick-place.csv'])

    await AppControllerPcbAssemblyExport.handle({
        change: { documentId: 'doc-1', format: 'fabrication-notes-json' },
        state: {
            getSnapshot: () => ({
                activeDocumentId: 'doc-1',
                documentModel,
                documents: [{ id: 'doc-1', documentModel }],
                sessionAssets: []
            })
        },
        view: {
            downloadBytes: (fileName, bytes, contentType) =>
                downloads.push({ fileName, bytes, contentType }),
            setStatus: (status) => statuses.push(status)
        },
        pcbAssemblyExportService: {
            export: async () => {
                assemblyExportCalls += 1
                return {
                    fileName: 'unused.step',
                    bytes: new Uint8Array(),
                    contentType: 'application/octet-stream'
                }
            }
        }
    })

    assert.equal(assemblyExportCalls, 0)
    assert.equal(downloads[1].fileName, 'metadata-board-fabrication-notes.json')
    assert.equal(downloads[1].contentType, 'application/json;charset=utf-8')
    assert.match(decode(downloads[1].bytes), /fab_text_1/)
    assert.deepEqual(statuses, [
        'Exported metadata-board-pick-place.csv',
        'Exported metadata-board-fabrication-notes.json'
    ])
})
