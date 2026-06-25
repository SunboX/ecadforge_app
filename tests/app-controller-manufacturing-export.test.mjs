import assert from 'node:assert/strict'
import test from 'node:test'
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
 * Verifies manufacturing export formats are downloaded from parsed metadata
 * without invoking the 3D assembly export service.
 */
test('AppControllerPcbAssemblyExport downloads manufacturing metadata formats', async () => {
    const downloads = []
    const statuses = []
    let assemblyExportCalls = 0
    const documentModel = {
        fileName: 'metadata-board.json',
        manufacturing: {
            pickAndPlaceRows: [{ designator: 'U1', x: 1, y: 2 }],
            routingDsn: '(pcb metadata-board)',
            fabricationNotes: [{ type: 'text', id: 'fab_text_1' }]
        }
    }

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
    assert.equal(
        downloads[1].fileName,
        'metadata-board-fabrication-notes.json'
    )
    assert.equal(downloads[1].contentType, 'application/json;charset=utf-8')
    assert.match(decode(downloads[1].bytes), /fab_text_1/)
    assert.deepEqual(statuses, [
        'Exported metadata-board-pick-place.csv',
        'Exported metadata-board-fabrication-notes.json'
    ])
})
