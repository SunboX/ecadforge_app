import assert from 'node:assert/strict'
import test from 'node:test'
import { KicadParser } from 'kicad-toolkit/parser'
import { KicadStrokeFont } from 'kicad-toolkit/renderers'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Creates a minimal KiCad schematic document for renderer behavior tests.
 * @returns {object}
 */
function createKicadSchematicDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'schematic',
        fileName: 'fake-alignment.kicad_sch',
        summary: { title: 'Fake alignment' },
        schematic: {
            sheet: {
                width: 60,
                height: 40,
                borderOn: false,
                titleBlockOn: false
            },
            lines: [],
            components: [],
            rectangles: [],
            pins: [
                {
                    x: 20,
                    y: 14,
                    length: 2.54,
                    orientation: 'right',
                    designator: '1',
                    numberFontSize: 1.27,
                    numberVisible: true,
                    endpointVisible: true
                },
                {
                    x: 30,
                    y: 14,
                    length: 2.54,
                    orientation: 'left',
                    designator: '2',
                    numberFontSize: 1.27,
                    numberVisible: true,
                    endpointVisible: true
                }
            ],
            texts: [
                {
                    x: 18,
                    y: 10,
                    text: 'JP1',
                    fontSize: 1.27,
                    font: {
                        width: 1.27,
                        height: 1.27,
                        hAlign: 'center',
                        vAlign: 'bottom'
                    }
                },
                {
                    x: 16,
                    y: 14,
                    text: 'E1',
                    labelKind: 'local',
                    fontSize: 1.27,
                    font: {
                        width: 1.27,
                        height: 1.27,
                        hAlign: 'right',
                        vAlign: 'center'
                    }
                },
                {
                    x: 42,
                    y: 10,
                    text: 'VCC',
                    ownerIndex: 'power:vcc',
                    symbolKind: 'power',
                    fontSize: 1.27,
                    font: {
                        width: 1.27,
                        height: 1.27,
                        hAlign: 'left',
                        vAlign: 'bottom'
                    }
                },
                {
                    x: 42,
                    y: 24,
                    text: 'GND',
                    ownerIndex: 'power:gnd',
                    symbolKind: 'power',
                    fontSize: 1.27,
                    font: {
                        width: 1.27,
                        height: 1.27,
                        hAlign: 'left',
                        vAlign: 'bottom'
                    }
                }
            ]
        },
        bom: []
    }
}

/**
 * Extracts the rendered stroke text group for one aria-label.
 * @param {string} markup Rendered SVG markup.
 * @param {string} label Text label.
 * @returns {string}
 */
function renderedTextGroup(markup, label) {
    const pattern = new RegExp(
        `<g class="[^"]*schematic[^"]*"[^>]*aria-label="${label}"[^>]*>[\\s\\S]*?<\\/g>`
    )
    return markup.match(pattern)?.[0] || ''
}

/**
 * Formats a test number the same way the SVG renderer formats coordinates.
 * @param {number} value Number.
 * @returns {string}
 */
function formatSvgNumber(value) {
    return value.toFixed(3).replace(/\.?0+$/, '')
}

/**
 * Verifies schematic text uses KiCad stroke-font origins instead of browser
 * font anchoring.
 */
test('KiCad schematic renderer aligns labels with stroke-font line origins', () => {
    const markup = EcadRendererService.renderSchematic(
        createKicadSchematicDocument()
    )
    const labelWidth = KicadStrokeFont.measureLine('E1', 1.27)
    const renderedLabel = renderedTextGroup(markup, 'E1')

    assert.match(renderedLabel, /class="schematic-text schematic-label"/)
    assert.match(renderedLabel, /class="schematic-text-line"/)
    assert.match(renderedLabel, /class="schematic-text-stroke"/)
    assert.match(renderedLabel, /data-line="E1"/)
    assert.match(
        renderedLabel,
        new RegExp(`data-x="${formatSvgNumber(16 - labelWidth)}"`)
    )
    assert.match(markup, /class="schematic-pin-number"[^>]*aria-label="1"/)
    assert.doesNotMatch(markup, /<text class="schematic-text/)
})

/**
 * Verifies KiCad power symbol labels are centered on the symbol anchor.
 */
test('KiCad schematic renderer centers power symbol labels', () => {
    const markup = EcadRendererService.renderSchematic(
        createKicadSchematicDocument()
    )
    const vccLabel = renderedTextGroup(markup, 'VCC')
    const gndLabel = renderedTextGroup(markup, 'GND')
    const vccWidth = KicadStrokeFont.measureLine('VCC', 1.27)
    const gndWidth = KicadStrokeFont.measureLine('GND', 1.27)

    assert.match(
        vccLabel,
        new RegExp(`data-x="${formatSvgNumber(42 - vccWidth / 2)}"`)
    )
    assert.match(
        gndLabel,
        new RegExp(`data-x="${formatSvgNumber(42 - gndWidth / 2)}"`)
    )
})

/**
 * Verifies KiCad connector pin numbers are placed away from the pin-line side.
 */
test('KiCad schematic renderer offsets pin numbers away from connector lines', () => {
    const markup = EcadRendererService.renderSchematic(
        createKicadSchematicDocument()
    )
    const rightFacingPinNumber = renderedTextGroup(markup, '1')
    const leftFacingPinNumber = renderedTextGroup(markup, '2')
    const pinNumberWidth = KicadStrokeFont.measureLine('2', 1.27)

    assert.match(rightFacingPinNumber, /data-x="20\.35"/)
    assert.match(
        leftFacingPinNumber,
        new RegExp(`data-x="${formatSvgNumber(30 - 0.35 - pinNumberWidth)}"`)
    )
})

/**
 * Verifies connector-style KiCad pins expose the circular body endpoint marker
 * visible in native KiCad schematic rendering.
 */
test('KiCad schematic renderer draws circular pin endpoint markers', () => {
    const markup = EcadRendererService.renderSchematic(
        createKicadSchematicDocument()
    )

    assert.match(
        markup,
        /<circle class="schematic-pin-endpoint" cx="20" cy="14" r="0\.42" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-power-color\)" stroke-width="0\.12"\/>/
    )
})

/**
 * Verifies parsed KiCad text keeps independent horizontal and vertical font
 * sizes for stroke-font alignment.
 */
test('KiCad schematic parser preserves non-square text font dimensions', () => {
    const document = KicadParser.parseArrayBuffer(
        'fake-font-size.kicad_sch',
        new TextEncoder().encode(`(kicad_sch
            (version 20250114)
            (paper "A4")
            (label "WIDE" (at 10 10 90)
                (effects (font (size 1.7 1.1)) (justify center top))
            )
        )`)
    )
    const text = document.schematic.texts[0]

    assert.equal(text.fontSize, 1.1)
    assert.equal(text.font.width, 1.7)
    assert.equal(text.font.height, 1.1)
})

/**
 * Verifies unrotated fields on rotated symbols inherit the placed symbol
 * orientation, matching KiCad's display for auto-placed symbol properties.
 */
test('KiCad schematic parser rotates symbol fields with rotated symbols', () => {
    const document = KicadParser.parseArrayBuffer(
        'fake-rotated-field.kicad_sch',
        new TextEncoder().encode(`(kicad_sch
            (version 20250114)
            (paper "A4")
            (lib_symbols
                (symbol "Device:R"
                    (pin passive line (at 0 -2.54 90) (length 2.54)
                        (name "~" (effects (font (size 1.27 1.27))))
                        (number "1" (effects (font (size 1.27 1.27))))
                    )
                    (pin passive line (at 0 2.54 270) (length 2.54)
                        (name "~" (effects (font (size 1.27 1.27))))
                        (number "2" (effects (font (size 1.27 1.27))))
                    )
                )
            )
            (symbol "Device:R"
                (at 40 30 90)
                (property "Reference" "R2" (at 38 30 0)
                    (effects (font (size 1.27 1.27)) (justify center bottom))
                )
                (property "Value" "8.2K" (at 42 30 0)
                    (effects (font (size 1.27 1.27)) (justify center bottom))
                )
                (uuid "fake-rotated-field")
            )
        )`)
    )
    const reference = document.schematic.texts.find(
        (text) => text.propertyName === 'Reference'
    )
    const value = document.schematic.texts.find(
        (text) => text.propertyName === 'Value'
    )

    assert.equal(reference.rotation, 90)
    assert.equal(value.rotation, 90)
})

/**
 * Verifies fields with omitted vertical justification stay centered like
 * KiCad's schematic editor.
 */
test('KiCad schematic parser centers fields with omitted vertical justification', () => {
    const document = KicadParser.parseArrayBuffer(
        'fake-implicit-center-field.kicad_sch',
        new TextEncoder().encode(`(kicad_sch
            (version 20250114)
            (paper "A4")
            (lib_symbols
                (symbol "Device:D"
                    (pin passive line (at 0 -2.54 90) (length 2.54)
                        (name "~" (effects (font (size 1.27 1.27))))
                        (number "1" (effects (font (size 1.27 1.27))))
                    )
                    (pin passive line (at 0 2.54 270) (length 2.54)
                        (name "~" (effects (font (size 1.27 1.27))))
                        (number "2" (effects (font (size 1.27 1.27))))
                    )
                )
            )
            (symbol "Device:D"
                (at 50 50 90)
                (property "Reference" "D1" (at 51 52 0)
                    (effects (font (size 1.27 1.27)) (justify right))
                )
                (uuid "fake-implicit-center-field")
            )
        )`)
    )
    const reference = document.schematic.texts.find(
        (text) => text.propertyName === 'Reference'
    )

    assert.equal(reference.anchor, 'end')
    assert.equal(reference.vAlign, 'center')
})

/**
 * Verifies only generic connector symbols receive circular pin endpoint
 * markers.
 */
test('KiCad schematic parser limits endpoint markers to generic connectors', () => {
    const document = KicadParser.parseArrayBuffer(
        'fake-pin-endpoints.kicad_sch',
        new TextEncoder().encode(`(kicad_sch
            (version 20250114)
            (paper "A4")
            (lib_symbols
                (symbol "Connector_Generic:Conn_01x02"
                    (pin passive line (at 0 0 180) (length 2.54)
                        (name "~" (effects (font (size 1.27 1.27))))
                        (number "1" (effects (font (size 1.27 1.27))))
                    )
                )
                (symbol "Device:R"
                    (pin passive line (at -2.54 0 0) (length 2.54)
                        (name "~" (effects (font (size 1.27 1.27))))
                        (number "1" (effects (font (size 1.27 1.27))))
                    )
                )
            )
            (symbol "Connector_Generic:Conn_01x02"
                (at 20 20 0)
                (property "Reference" "J1" (at 20 16 0)
                    (effects (font (size 1.27 1.27)))
                )
                (property "Value" "Conn_01x02" (at 20 24 0)
                    (effects (font (size 1.27 1.27)))
                )
                (uuid "connector-symbol")
            )
            (symbol "Device:R"
                (at 40 20 0)
                (property "Reference" "R1" (at 40 16 0)
                    (effects (font (size 1.27 1.27)))
                )
                (property "Value" "10k" (at 40 24 0)
                    (effects (font (size 1.27 1.27)))
                )
                (uuid "resistor-symbol")
            )
        )`)
    )
    const connector = document.schematic.components.find(
        (component) => component.source === 'Connector_Generic:Conn_01x02'
    )
    const resistor = document.schematic.components.find(
        (component) => component.source === 'Device:R'
    )
    const connectorPin = document.schematic.pins.find(
        (pin) => pin.ownerIndex === connector.ownerIndex
    )
    const resistorPin = document.schematic.pins.find(
        (pin) => pin.ownerIndex === resistor.ownerIndex
    )

    assert.equal(connectorPin.endpointVisible, true)
    assert.equal(resistorPin.endpointVisible, false)
})
