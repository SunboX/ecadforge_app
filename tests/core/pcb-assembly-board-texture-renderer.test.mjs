import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbAssemblyBoardTextureRenderer } from '../../src/core/PcbAssemblyBoardTextureRenderer.mjs'

/**
 * Builds a compact element-array PCB document with distinct top and bottom
 * render classes.
 * @returns {object[]}
 */
function createCircuitJsonPcbDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 10,
            height: 6
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_top',
            x1: -3,
            y1: 0,
            x2: 3,
            y2: 0,
            width: 0.35,
            layer: 'top',
            net: 'SIG'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'texture-board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Decodes a base64 SVG data URI.
 * @param {string} uri Data URI.
 * @returns {string}
 */
function decodeSvgDataUri(uri) {
    const prefix = 'data:image/svg+xml;base64,'
    assert.ok(uri.startsWith(prefix))
    return Buffer.from(uri.slice(prefix.length), 'base64').toString('utf8')
}

test('PcbAssemblyBoardTextureRenderer renders top and bottom SVG texture data URIs', async () => {
    const textures = await PcbAssemblyBoardTextureRenderer.render(
        createCircuitJsonPcbDocument()
    )

    assert.equal(typeof textures.top, 'string')
    assert.equal(typeof textures.bottom, 'string')
    assert.match(decodeSvgDataUri(textures.top), /pcb-svg--top/)
    assert.match(decodeSvgDataUri(textures.bottom), /pcb-svg--bottom/)
    assert.notEqual(textures.top, textures.bottom)
})

test('PcbAssemblyBoardTextureRenderer renders opt-in PNG texture data URIs', async () => {
    const conversions = []
    const textures = await PcbAssemblyBoardTextureRenderer.render(
        createCircuitJsonPcbDocument(),
        {
            imageFormat: 'png',
            resolution: 512,
            svgToPng(markup, options) {
                conversions.push({ markup, options })
                return (
                    'data:image/png;base64,' +
                    Buffer.from('png-' + options.side).toString('base64')
                )
            }
        }
    )

    assert.equal(conversions.length, 2)
    assert.deepEqual(
        conversions.map((conversion) => conversion.options.side),
        ['top', 'bottom']
    )
    assert.equal(conversions[0].options.width, 512)
    assert.equal(conversions[0].options.height, 512)
    assert.ok(textures.top.startsWith('data:image/png;base64,'))
    assert.ok(textures.bottom.startsWith('data:image/png;base64,'))
})

test('PcbAssemblyBoardTextureRenderer forwards note visibility to PCB renders', async () => {
    const renderCalls = []
    const textures = await PcbAssemblyBoardTextureRenderer.render(
        createCircuitJsonPcbDocument(),
        {
            showNotes: true,
            renderer: {
                renderPcb(documentModel, options) {
                    renderCalls.push({ documentModel, options })
                    return `<svg class="pcb-svg--${options.side}"></svg>`
                }
            }
        }
    )

    assert.equal(renderCalls.length, 2)
    assert.deepEqual(
        renderCalls.map((call) => call.options),
        [
            { side: 'top', showNotes: true },
            { side: 'bottom', showNotes: true }
        ]
    )
    assert.match(decodeSvgDataUri(textures.top), /pcb-svg--top/)
    assert.match(decodeSvgDataUri(textures.bottom), /pcb-svg--bottom/)
})

test('PcbAssemblyBoardTextureRenderer falls back to SVG when PNG conversion fails', async () => {
    const textures = await PcbAssemblyBoardTextureRenderer.render(
        createCircuitJsonPcbDocument(),
        {
            imageFormat: 'png',
            svgToPng() {
                throw new Error('conversion unavailable')
            }
        }
    )

    assert.match(decodeSvgDataUri(textures.top), /pcb-svg--top/)
    assert.match(decodeSvgDataUri(textures.bottom), /pcb-svg--bottom/)
})
