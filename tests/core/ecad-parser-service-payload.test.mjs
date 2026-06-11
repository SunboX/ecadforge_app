import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'

/**
 * Verifies app parser results omit heavy raw PCB sidecars that the viewer does
 * not render or query after parsing.
 */
test('EcadParserService strips raw Altium PCB records from app documents', async () => {
    const service = new EcadParserService({
        altiumParser: {
            parseArrayBuffer(fileName) {
                return {
                    sourceFormat: 'altium',
                    kind: 'pcb',
                    fileName,
                    summary: { rawRecordCount: 1 },
                    pcb: {
                        pads: [{ id: 'pad-1' }],
                        rawRecords: [
                            {
                                registryId: 'pcbdoc:Tracks6/Data:0',
                                rawBase64: 'A'.repeat(4096)
                            }
                        ]
                    }
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'board.PcbDoc', buffer: new ArrayBuffer(1) }
    ])
    const directDocument = service.parseArrayBuffer(
        'board.PcbDoc',
        new ArrayBuffer(1)
    )

    assert.equal(result.documents[0].pcb.rawRecords, undefined)
    assert.deepEqual(result.documents[0].pcb.pads, [{ id: 'pad-1' }])
    assert.equal(result.documents[0].summary.rawRecordCount, 1)
    assert.equal(directDocument.pcb.rawRecords, undefined)
})
