import assert from 'node:assert/strict'
import test from 'node:test'
import { zipSync, strToU8 } from 'fflate'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'

/**
 * Builds an ArrayBuffer for a generated ZIP archive.
 * @param {Record<string, string>} entries Archive text entries.
 * @returns {ArrayBuffer}
 */
function createArchiveBuffer(entries) {
    const bytes = zipSync(
        Object.fromEntries(
            Object.entries(entries).map(([name, text]) => [name, strToU8(text)])
        )
    )

    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

test('EcadParserService filters hidden KiCad archive entries before project loading', async () => {
    const loadedEntryNames = []
    const service = new EcadParserService({
        gerberProjectLoader: {
            canLoadEntries() {
                return false
            }
        },
        kicadProjectLoader: {
            loadEntries(entries) {
                loadedEntryNames.push(...entries.map((entry) => entry.name))
                return {
                    documents: [
                        {
                            sourceFormat: 'kicad',
                            kind: 'pcb',
                            fileName: 'active-board.kicad_pcb',
                            pcb: {}
                        }
                    ],
                    assets: [],
                    diagnostics: []
                }
            }
        }
    })
    const archiveBuffer = createArchiveBuffer({
        'active-board.kicad_pro': '{}',
        'active-board.kicad_pcb': '(kicad_pcb)',
        '.history/stale-board.kicad_pcb': '(kicad_pcb)',
        '.git/config': '[core]',
        '__MACOSX/._active-board.kicad_pcb': ''
    })

    await service.parseEntries([
        {
            name: 'source-bundle.zip',
            buffer: archiveBuffer
        }
    ])

    assert.deepEqual(loadedEntryNames.sort(), [
        'active-board.kicad_pcb',
        'active-board.kicad_pro'
    ])
})
