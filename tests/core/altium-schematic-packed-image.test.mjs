import assert from 'node:assert/strict'
import test from 'node:test'
import { zlibSync } from 'fflate'
import {
    AltiumExtensionResolver,
    OleCompoundDocumentWriter
} from 'altium-toolkit/extensions'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Creates a tiny generated OLE-backed schematic with one packed image payload.
 * @returns {ArrayBuffer}
 */
function createPackedImageSchematicBuffer() {
    const fileHeader = new TextEncoder().encode(
        [
            '|HEADER=Schematic Document',
            '|RECORD=31|CUSTOMX=120|CUSTOMY=120|VISIBLEGRIDSIZE=10' +
                '|SNAPGRIDSIZE=5|BORDERON=F|TITLEBLOCKON=F' +
                '|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
                '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F',
            '|RECORD=30|OWNERINDEX=10|INDEXINSHEET=1|OWNERPARTID=-1' +
                '|LOCATION.X=10|LOCATION.Y=10|CORNER.X=70|CORNER.Y=70' +
                '|KEEPASPECT=T|EMBEDIMAGE=T|FILENAME=C:\\neutral\\asset.png'
        ].join('\u0000')
    )
    const storage = createPackedStorageStream(
        'C:\\neutral\\asset.png',
        createBmpBytes()
    )
    const bytes = OleCompoundDocumentWriter.write({
        streams: new Map([
            ['FileHeader', fileHeader],
            ['Storage', storage]
        ])
    })

    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

/**
 * Creates a packed-storage stream using the path-before-compressed-payload
 * variant seen in Altium schematic image storage.
 * @param {string} fileName Packed image file path.
 * @param {Uint8Array} imageBytes Decoded image bytes.
 * @returns {Uint8Array}
 */
function createPackedStorageStream(fileName, imageBytes) {
    const header = new TextEncoder().encode('|HEADER=Icon storage|Weight=4\0')
    const pathBytes = new TextEncoder().encode(fileName)
    const compressedBytes = zlibSync(imageBytes)
    const entryLength = pathBytes.length + compressedBytes.length + 7
    const bytes = new Uint8Array(
        4 +
            header.length +
            3 +
            2 +
            pathBytes.length +
            4 +
            compressedBytes.length
    )
    const view = new DataView(bytes.buffer)
    let offset = 0

    view.setUint32(offset, header.length, true)
    offset += 4
    bytes.set(header, offset)
    offset += header.length
    bytes[offset] = entryLength & 0xff
    bytes[offset + 1] = (entryLength >> 8) & 0xff
    bytes[offset + 2] = (entryLength >> 16) & 0xff
    offset += 3
    bytes[offset] = 1
    bytes[offset + 1] = pathBytes.length
    offset += 2
    bytes.set(pathBytes, offset)
    offset += pathBytes.length
    view.setUint32(offset, compressedBytes.length, true)
    offset += 4
    bytes.set(compressedBytes, offset)

    return bytes
}

/**
 * Creates a minimal 2x2 24-bit BMP image.
 * @returns {Uint8Array}
 */
function createBmpBytes() {
    const width = 2
    const height = 2
    const rowSize = Math.ceil((width * 3) / 4) * 4
    const pixelBytes = rowSize * height
    const bytes = new Uint8Array(54 + pixelBytes)
    const view = new DataView(bytes.buffer)

    bytes[0] = 0x42
    bytes[1] = 0x4d
    view.setUint32(2, bytes.length, true)
    view.setUint32(10, 54, true)
    view.setUint32(14, 40, true)
    view.setInt32(18, width, true)
    view.setInt32(22, height, true)
    view.setUint16(26, 1, true)
    view.setUint16(28, 24, true)
    view.setUint32(34, pixelBytes, true)
    bytes.set([0xff, 0xff, 0xff, 0, 0, 0, 0, 0], 54)
    bytes.set([0, 0, 0xff, 0, 0xff, 0, 0, 0], 54 + rowSize)

    return bytes
}

test('EcadParserService resolves packed Altium schematic image payloads', () => {
    const documentModel = EcadParserService.parseArrayBuffer(
        'neutral-packed.SchDoc',
        createPackedImageSchematicBuffer()
    )
    const nativeModel = AltiumExtensionResolver.nativeModel(documentModel)
    const image = nativeModel.schematic.images[0]
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.equal(Object.hasOwn(documentModel, 'schematic'), false)
    assert.equal(image.diagnosticState, 'embedded')
    assert.equal(image.mimeType, 'image/bmp')
    assert.ok(image.dataBase64.length > 0)
    assert.doesNotMatch(
        JSON.stringify(documentModel.diagnostics || []),
        /payload could not be resolved/
    )
    assert.match(markup, /<image\b[^>]+href="data:image\/bmp;base64,/)
    assert.doesNotMatch(markup, /schematic-image-placeholder/)
})
