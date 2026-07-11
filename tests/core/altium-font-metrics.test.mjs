import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbFontMetricsParser } from 'altium-toolkit/extensions'

/**
 * Builds a minimal sfnt payload with the metric tables used by the parser.
 * @returns {Uint8Array}
 */
function buildMetricFontPayload() {
    const tableCount = 4
    const headerSize = 12 + tableCount * 16
    const tableLayout = [
        { tag: 'head', offset: headerSize, length: 54 },
        { tag: 'hhea', offset: headerSize + 54, length: 36 },
        { tag: 'OS/2', offset: headerSize + 54 + 36, length: 100 },
        { tag: 'hmtx', offset: headerSize + 54 + 36 + 100, length: 4 }
    ]
    const bytes = new Uint8Array(headerSize + 54 + 36 + 100 + 4)
    const view = new DataView(bytes.buffer)

    bytes.set([0x00, 0x01, 0x00, 0x00], 0)
    view.setUint16(4, tableCount, false)
    tableLayout.forEach((table, index) => {
        const directoryOffset = 12 + index * 16
        table.tag.split('').forEach((character, characterIndex) => {
            bytes[directoryOffset + characterIndex] = character.charCodeAt(0)
        })
        view.setUint32(directoryOffset + 8, table.offset, false)
        view.setUint32(directoryOffset + 12, table.length, false)
    })

    const headOffset = tableLayout[0].offset
    view.setUint16(headOffset + 18, 2048, false)

    const hheaOffset = tableLayout[1].offset
    view.setInt16(hheaOffset + 4, 1521, false)
    view.setInt16(hheaOffset + 6, -527, false)
    view.setInt16(hheaOffset + 8, 350, false)
    view.setUint16(hheaOffset + 34, 1, false)

    const os2Offset = tableLayout[2].offset
    view.setUint16(os2Offset, 3, false)
    view.setInt16(os2Offset + 2, 1126, false)
    view.setUint16(os2Offset + 4, 700, false)
    view.setUint16(os2Offset + 6, 5, false)
    view.setInt16(os2Offset + 68, 1521, false)
    view.setInt16(os2Offset + 70, -527, false)
    view.setInt16(os2Offset + 72, 350, false)
    view.setUint16(os2Offset + 74, 1884, false)
    view.setUint16(os2Offset + 76, 514, false)
    view.setInt16(os2Offset + 88, 1307, false)

    const hmtxOffset = tableLayout[3].offset
    view.setUint16(hmtxOffset, 1126, false)

    return bytes
}

test('PcbFontMetricsParser uses OS/2 Windows cell height for PCB TrueType scaling', () => {
    const metrics = PcbFontMetricsParser.parse(buildMetricFontPayload())

    assert.equal(metrics.unitsPerEm, 2048)
    assert.equal(metrics.windowsAscent, 1884)
    assert.equal(metrics.windowsDescent, 514)
    assert.equal(metrics.cellHeight, 2398)
    assert.equal(metrics.emScaleFromPcbHeight, 2048 / 2398)
})
