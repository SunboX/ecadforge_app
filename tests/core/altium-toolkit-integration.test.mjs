import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../node_modules/altium-toolkit/src/parser.mjs'
import { PcbTextPrimitiveParser } from '../../node_modules/altium-toolkit/src/core/altium/PcbTextPrimitiveParser.mjs'
import { SchematicSvgRenderer } from '../../node_modules/altium-toolkit/src/renderers.mjs'
import { PcbScene3dBuilder } from '../../node_modules/altium-toolkit/src/scene3d.mjs'

/**
 * Creates one generic binary Altium text primitive stream.
 * @param {{ text?: string, layerId?: number, rotation?: number, mirrored?: boolean, isInverted?: boolean, marginBorderWidth?: number, useInvertedRectangle?: boolean, textboxRectWidth?: number, textboxRectHeight?: number }} options
 * @returns {{ header: Uint8Array, data: Uint8Array }}
 */
function createGenericTextPrimitiveStream(options = {}) {
    const hasTailFields =
        options.isInverted !== undefined ||
        options.marginBorderWidth !== undefined ||
        options.useInvertedRectangle !== undefined ||
        options.textboxRectWidth !== undefined ||
        options.textboxRectHeight !== undefined
    const payloadLength = hasTailFields ? 134 : 110
    const payload = new Uint8Array(payloadLength)
    const view = new DataView(payload.buffer)
    const text = String(options.text || 'TXT')
    const textBytes = new TextEncoder().encode(text + '\0')
    const data = new Uint8Array(5 + payloadLength + textBytes.byteLength)
    const dataView = new DataView(data.buffer)
    const header = new Uint8Array(4)

    new DataView(header.buffer).setUint32(0, 1, true)
    payload[0] = Number(options.layerId ?? 34)
    view.setInt16(7, -1, true)
    view.setInt32(13, 1200000, true)
    view.setInt32(17, 2600000, true)
    view.setInt32(21, 400000, true)
    view.setUint16(25, 0, true)
    view.setFloat64(27, Number(options.rotation || 0), true)
    payload[35] = options.mirrored ? 1 : 0
    view.setInt32(36, 50000, true)
    if (hasTailFields) {
        payload[110] = options.isInverted ? 1 : 0
        view.setInt32(
            111,
            Math.round(Number(options.marginBorderWidth || 0) * 10000),
            true
        )
        payload[123] = options.useInvertedRectangle ? 1 : 0
        view.setInt32(
            124,
            Math.round(Number(options.textboxRectWidth || 0) * 10000),
            true
        )
        view.setInt32(
            128,
            Math.round(Number(options.textboxRectHeight || 0) * 10000),
            true
        )
        payload[132] = 3
    }

    data[0] = 5
    dataView.setUint32(1, payloadLength, true)
    data.set(payload, 5)
    data.set(textBytes, 5 + payloadLength)

    return { header, data }
}

/**
 * Extracts placeholder text lines from rendered SVG markup.
 * @param {string} markup
 * @returns {string[]}
 */
function extractPlaceholderTextLines(markup) {
    const placeholderMarkup =
        markup.match(
            /<g class="schematic-image-placeholder">[\s\S]*?<\/g>/
        )?.[0] || ''

    return [...placeholderMarkup.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(
        (match) => match[1]
    )
}

/**
 * Estimates the rendered width of one placeholder text line.
 * @param {string} text
 * @param {number} fontSize
 * @returns {number}
 */
function estimatePlaceholderLineWidth(text, fontSize) {
    return [...text].reduce(
        (width, character) =>
            width + estimatePlaceholderCharacterWidth(character, fontSize),
        0
    )
}

/**
 * Estimates one Times-like placeholder glyph width.
 * @param {string} character
 * @param {number} fontSize
 * @returns {number}
 */
function estimatePlaceholderCharacterWidth(character, fontSize) {
    if (/[^\x00-\x7F]/u.test(character)) return fontSize
    if (/[A-Z]/.test(character)) return fontSize * 0.62
    if (/[a-z]/.test(character)) return fontSize * 0.45
    if (/[0-9]/.test(character)) return fontSize * 0.5
    if (/[\\/]/.test(character)) return fontSize * 0.32
    if (/[.:\-_]/.test(character)) return fontSize * 0.28

    return fontSize * 0.35
}

/**
 * Verifies the published altium-toolkit package keeps compact double-marker
 * pin numbers clear of the marker triangles while anchoring toward them.
 */
test('altium-toolkit clears double outer pin markers from pin numbers', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Neutral marker schematic' },
        schematic: {
            sheet: {
                width: 220,
                height: 140,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [
                {
                    x: 110,
                    y: 80,
                    length: 20,
                    name: 'A',
                    designator: '1',
                    orientation: 'left',
                    symbolOuter: 34,
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: 'N1'
                },
                {
                    x: 150,
                    y: 80,
                    length: 20,
                    name: 'B',
                    designator: '2',
                    orientation: 'right',
                    symbolOuter: 34,
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: 'N1'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<text class="schematic-pin-number" x="89" y="59" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">1<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="171" y="59" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">2<\/text>/
    )
})

/**
 * Verifies the published altium-toolkit package renders Altium's omitted
 * formal electrical type as the default input marker.
 */
test('altium-toolkit renders default input markers from omitted formal electrical type', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=260|CustomY=180|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=6|OwnerIndex=800|OwnerPartId=1|LineWidth=1|Color=11796480' +
            '|LocationCount=5|X1=120|Y1=140|X2=180|Y2=140|X3=180|Y3=80|X4=120|Y4=80|X5=120|Y5=140',
        '|RECORD=2|OwnerIndex=800|OwnerPartId=1|FormalType=1|PinConglomerate=58' +
            '|PinLength=20|Location.X=120|Location.Y=120|Name=IN_A|Designator=1',
        '|RECORD=2|OwnerIndex=800|OwnerPartId=1|FormalType=1|Electrical=4|PinConglomerate=58' +
            '|PinLength=20|Location.X=120|Location.Y=100|Name=PASS_A|Designator=2',
        '|RECORD=2|OwnerIndex=800|OwnerPartId=1|FormalType=1|PinConglomerate=56' +
            '|PinLength=20|Location.X=180|Location.Y=120|Name=IN_B|Designator=3'
    ]
    const documentModel = AltiumParser.parseArrayBufferToRendererModel(
        'default-input-marker.SchDoc',
        new TextEncoder().encode(records.join('')).buffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(
        documentModel.schematic.pins.find((pin) => pin.designator === '1')
            ?.electrical,
        0
    )
    assert.equal(
        (markup.match(/class="schematic-pin-marker"/g) || []).length,
        2
    )
    assert.match(
        markup,
        /<polygon points="114,57 114,63 120,60" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)"/
    )
    assert.match(
        markup,
        /<polygon points="186,57 186,63 180,60" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)"/
    )
})

/**
 * Verifies the published altium-toolkit package keeps unresolved image
 * placeholder text inside the image rectangle.
 */
test('altium-toolkit wraps unresolved image placeholder text inside its bounds', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Neutral image schematic' },
        schematic: {
            sheet: { width: 260, height: 200 },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            images: [
                {
                    x: 40,
                    y: 20,
                    cornerX: 179,
                    cornerY: 159,
                    fileName:
                        'C:\\Workspace\\Packages\\Hardware\\Design\\2026年模块设计\\Module\\Module_LongName\\ArtworkBadge.png',
                    mimeType: '',
                    dataBase64: '',
                    diagnosticState: 'missing-embedded-payload'
                }
            ]
        }
    })
    const fontSize = Math.max(139 / 18, 5)
    const usableWidth = 139 - 12
    const lines = extractPlaceholderTextLines(markup)

    assert.match(markup, /overflow="hidden"/)
    assert.ok(lines.length >= 5)

    for (const line of lines.slice(1, -1)) {
        assert.ok(
            estimatePlaceholderLineWidth(line, fontSize) <= usableWidth,
            'Expected "' + line + '" to fit inside the placeholder'
        )
    }
})

/**
 * Verifies graphic table linework from Altium polyline records does not create
 * synthetic electrical junction dots in the toolkit renderer.
 */
test('altium-toolkit skips junction dots on graphic table linework', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Neutral table schematic' },
        schematic: {
            sheet: { width: 180, height: 140 },
            lines: [
                {
                    x1: 100,
                    y1: 40,
                    x2: 140,
                    y2: 40,
                    color: '#a44a1b',
                    width: 2,
                    recordType: '6'
                },
                {
                    x1: 100,
                    y1: 70,
                    x2: 140,
                    y2: 70,
                    color: '#a44a1b',
                    width: 2,
                    recordType: '6'
                },
                {
                    x1: 100,
                    y1: 30,
                    x2: 100,
                    y2: 90,
                    color: '#a44a1b',
                    width: 2,
                    recordType: '6'
                },
                {
                    x1: 20,
                    y1: 110,
                    x2: 60,
                    y2: 110,
                    color: '#000080',
                    width: 1,
                    recordType: '27'
                },
                {
                    x1: 60,
                    y1: 110,
                    x2: 90,
                    y2: 110,
                    color: '#000080',
                    width: 1,
                    recordType: '27'
                },
                {
                    x1: 60,
                    y1: 90,
                    x2: 60,
                    y2: 110,
                    color: '#000080',
                    width: 1,
                    recordType: '27'
                }
            ],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.doesNotMatch(markup, /class="schematic-junction" cx="100" cy="70"/)
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="60" cy="30" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
    assert.equal((markup.match(/class="schematic-junction"/g) || []).length, 1)
})

/**
 * Verifies Altium rail power ports keep the source T cap instead of rendering
 * as a bare stem through the label area.
 */
test('altium-toolkit renders rail power ports with a cap', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Neutral rail schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                {
                    x1: 150,
                    y1: 50,
                    x2: 180,
                    y2: 50,
                    color: '#000080',
                    width: 1
                }
            ],
            texts: [
                {
                    x: 150,
                    y: 50,
                    text: 'RAIL_A',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 2,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    powerPortDirection: 'up',
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: []
        }
    })

    assert.match(markup, /schematic-power-port--rail/)
    assert.match(markup, /x1="150" y1="50" x2="150" y2="38"/)
    assert.match(markup, /x1="144" y1="38" x2="156" y2="38"/)
})

/**
 * Verifies rail label placement stays anchored just above the rail cap.
 */
test('altium-toolkit keeps rail labels anchored above their cap', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Neutral rail clearance schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                {
                    x1: 120,
                    y1: 50,
                    x2: 150,
                    y2: 50,
                    color: '#000080',
                    width: 1
                },
                {
                    x1: 100,
                    y1: 70,
                    x2: 190,
                    y2: 70,
                    color: '#000080',
                    width: 1
                }
            ],
            texts: [
                {
                    x: 150,
                    y: 50,
                    text: 'RAIL_A',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 2,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    powerPortDirection: 'up',
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: []
        }
    })

    assert.match(markup, /x1="150" y1="50" x2="150" y2="38"/)
    assert.match(markup, /x1="144" y1="38" x2="156" y2="38"/)
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="150" y="36" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="9"/
    )
    assert.doesNotMatch(markup, /schematic-power-port-label" x="150" y="23\.75"/)
    assert.doesNotMatch(markup, /schematic-power-port-label" x="150" y="34"/)
    assert.doesNotMatch(markup, /schematic-power-port-label" x="150" y="43"/)
})

/**
 * Verifies explicit Altium 3D bodies use their authored 3D yaw once and
 * convert local X/Y tilt into the renderer's signed rotation convention.
 */
test('altium-toolkit promotes 3D body Z yaw into placement rotation', () => {
    const scene = PcbScene3dBuilder.build(
        {
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 1000,
                    heightMil: 1000,
                    segments: []
                },
                primitiveLayers: [],
                pads: [],
                componentBodies: [
                    {
                        identifier: 'Fixture Wide Body',
                        name: 'Fixture-Wide-Body.step',
                        layer: 'MECHANICAL13',
                        modelId: 'matched-model',
                        positionMil: { x: 500, y: 500 },
                        rotationDeg: 45,
                        modelRotationDeg: { x: 90, y: 45, z: 270 }
                    }
                ],
                components: [
                    {
                        designator: 'U1',
                        x: 500,
                        y: 500,
                        layer: 'TOP',
                        pattern: 'Fixture Wide Body',
                        source: 'Fixture Wide Body',
                        rotation: 90
                    }
                ]
            }
        },
        {
            modelRegistry: {
                resolveComponentModel() {
                    return null
                },
                resolveComponentBodyModel() {
                    return {
                        origin: 'embedded',
                        name: 'Fixture-Wide-Body.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/0'
                    }
                }
            }
        }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'U1')
    assert.equal(scene.externalPlacements[0].rotationDeg, 270)
    assert.equal(scene.externalPlacements[0].bodyRotationDeg, 45)
    assert.deepEqual(scene.externalPlacements[0].modelTransform.rotationDeg, {
        x: -90,
        y: -45,
        z: 0
    })
})

/**
 * Verifies an explicit 3D body can claim its owning component when the body is
 * authored exactly at the component anchor but library names do not share
 * useful footprint tokens.
 */
test('altium-toolkit matches exact-position external bodies to components', () => {
    const scene = PcbScene3dBuilder.build(
        {
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 1000,
                    heightMil: 1000,
                    segments: []
                },
                primitiveLayers: [],
                pads: [],
                componentBodies: [
                    {
                        identifier: 'Library Molded Body',
                        name: 'Library-Molded-Body.step',
                        layer: 'MECHANICAL13',
                        modelId: 'exact-body-model',
                        positionMil: { x: 200, y: 300 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 180 }
                    }
                ],
                components: [
                    {
                        designator: 'Q1',
                        x: 200,
                        y: 300,
                        layer: 'TOP',
                        pattern: 'Package Alpha',
                        source: 'Discrete Device',
                        rotation: 180
                    }
                ]
            }
        },
        {
            modelRegistry: {
                resolveComponentModel() {
                    return null
                },
                resolveComponentBodyModel() {
                    return {
                        origin: 'embedded',
                        name: 'Library-Molded-Body.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/1'
                    }
                }
            }
        }
    )

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].designator, 'Q1')
    assert.equal(scene.externalPlacements[0].rotationDeg, 180)
})

/**
 * Verifies Altium overlay fills do not cover drilled holes in 3D scene data.
 */
test('altium-toolkit clips silkscreen fills around drilled pads and vias', () => {
    const scene = PcbScene3dBuilder.build({
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 400,
                segments: []
            },
            primitiveLayers: [{ layerId: 34, name: 'Bottom Overlay' }],
            fills: [],
            tracks: [],
            arcs: [],
            regions: [
                {
                    layerId: 34,
                    points: [
                        { x: 40, y: 50 },
                        { x: 360, y: 50 },
                        { x: 360, y: 190 },
                        { x: 40, y: 190 }
                    ]
                }
            ],
            pads: [
                {
                    x: 120,
                    y: 110,
                    holeDiameter: 40,
                    sizeTopX: 80,
                    sizeTopY: 80,
                    sizeBottomX: 80,
                    sizeBottomY: 80
                },
                {
                    x: 220,
                    y: 120,
                    holeDiameter: 30,
                    holeShape: 2,
                    holeSlotLength: 90,
                    rotation: 90,
                    holeRotation: 0,
                    sizeTopX: 120,
                    sizeTopY: 70,
                    sizeBottomX: 120,
                    sizeBottomY: 70
                }
            ],
            vias: [{ x: 310, y: 130, holeDiameter: 24, diameter: 52 }],
            components: []
        }
    })

    const fill = scene.detail.silkscreen.bottom.fills[0]

    assert.equal(scene.sourceFormat, 'altium')
    assert.ok(fill, 'Expected a bottom overlay fill')
    assert.equal(fill.holes.length, 3)
    assert.ok(fill.holes.every((hole) => hole.length >= 12))
    assert.ok(
        fill.holes.some((hole) =>
            hole.some((point) => point.x > 280 && point.x < 340)
        ),
        'Expected the via drill to be included as an overlay cutout'
    )
    assert.ok(
        fill.holes.some((hole) => {
            const xs = hole.map((point) => point.x)
            const ys = hole.map((point) => point.y)

            return (
                Math.max(...xs) - Math.min(...xs) > 80 ||
                Math.max(...ys) - Math.min(...ys) > 80
            )
        }),
        'Expected the slotted pad drill to be included as a long cutout'
    )
})

/**
 * Verifies Altium 3D scenes preserve dense bottom overlay artwork without
 * recoloring the app's board solder-mask palette.
 */
test('altium-toolkit colors dense bottom overlay artwork from 3D appearance', () => {
    const scene = PcbScene3dBuilder.build({
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: []
            },
            appearance3d: {
                boardCoreColor: 0xf7f9d1,
                solderMaskTopColor: 0x17396b,
                solderMaskBottomColor: 0x17396b,
                silkscreenTopColor: 0xebebeb,
                silkscreenBottomColor: 0xebebeb
            },
            primitiveLayers: [{ layerId: 34, name: 'Bottom Overlay' }],
            fills: [],
            tracks: Array.from({ length: 320 }, (_, index) => ({
                layerId: 34,
                x1: 120 + (index % 80),
                y1: 160 + Math.floor(index / 80) * 12,
                x2: 180 + (index % 80),
                y2: 160 + Math.floor(index / 80) * 12,
                width: 4
            })),
            arcs: [],
            texts: [
                {
                    layerId: 34,
                    text: 'LOGO',
                    x: 180,
                    y: 240,
                    height: 70,
                    strokeWidth: 8,
                    visible: true
                }
            ],
            regions: [
                {
                    layerId: 34,
                    points: [
                        { x: 50, y: 100 },
                        { x: 950, y: 100 },
                        { x: 950, y: 650 },
                        { x: 50, y: 650 }
                    ],
                    holes: [
                        [
                            { x: 180, y: 240 },
                            { x: 260, y: 240 },
                            { x: 260, y: 310 },
                            { x: 180, y: 310 }
                        ]
                    ]
                }
            ],
            pads: [],
            vias: [],
            components: []
        }
    })

    assert.equal(scene.board.surfaceColor, 0x17396b)
    assert.equal(scene.board.edgeColor, 0xf7f9d1)
    assert.equal(scene.detail.silkscreen.bottom.fillColor, 0xebebeb)
    assert.equal(scene.detail.silkscreen.bottom.strokeColor, 0xebebeb)
    assert.equal(scene.detail.silkscreen.bottom.knockoutColor, 0x2f6a2c)
    assert.equal(scene.detail.silkscreen.bottom.nativeTextKnockouts, true)
    assert.equal(scene.detail.silkscreen.bottom.texts.length, 1)
    assert.equal(scene.detail.silkscreen.bottom.texts[0].text, 'LOGO')
})

/**
 * Verifies parsed PCB text primitives preserve Altium's explicit mirror byte.
 */
test('altium-toolkit preserves the text primitive mirror flag', () => {
    const regular = createGenericTextPrimitiveStream({
        text: 'TXT',
        mirrored: false
    })
    const mirrored = createGenericTextPrimitiveStream({
        text: 'MIR',
        mirrored: true
    })

    assert.equal(
        PcbTextPrimitiveParser.parseTextStream(regular.header, regular.data)[0]
            .mirrored,
        false
    )
    assert.equal(
        PcbTextPrimitiveParser.parseTextStream(
            mirrored.header,
            mirrored.data
        )[0].mirrored,
        true
    )
})

/**
 * Verifies parsed PCB text primitives expose Altium's inverted text fields so
 * 3D overlay rendering can paint knockout labels with the right material.
 */
test('altium-toolkit preserves inverted text metadata', () => {
    const inverted = createGenericTextPrimitiveStream({
        text: 'INV',
        isInverted: true,
        marginBorderWidth: 8,
        useInvertedRectangle: true,
        textboxRectWidth: 120,
        textboxRectHeight: 32
    })
    const text = PcbTextPrimitiveParser.parseTextStream(
        inverted.header,
        inverted.data
    )[0]

    assert.equal(text.isInverted, true)
    assert.equal(text.marginBorderWidth, 8)
    assert.equal(text.useInvertedRectangle, true)
    assert.equal(text.textboxRectWidth, 120)
    assert.equal(text.textboxRectHeight, 32)
})

/**
 * Verifies bottom overlay text follows Altium's per-primitive mirror flag
 * instead of mirroring every bottom-side label.
 */
test('altium-toolkit keeps bottom overlay text mirror flags explicit', () => {
    const scene = PcbScene3dBuilder.build({
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 800,
                heightMil: 500,
                segments: []
            },
            primitiveLayers: [
                { layerId: 33, name: 'Top Overlay' },
                { layerId: 34, name: 'Bottom Overlay' }
            ],
            fills: [],
            tracks: [],
            arcs: [],
            texts: [
                {
                    layerId: 33,
                    text: 'TOP',
                    x: 120,
                    y: 160,
                    height: 40,
                    strokeWidth: 5,
                    rotation: 90,
                    visible: true
                },
                {
                    layerId: 34,
                    text: 'BOT',
                    x: 220,
                    y: 260,
                    height: 40,
                    strokeWidth: 5,
                    rotation: 270,
                    mirrored: false,
                    visible: true
                },
                {
                    layerId: 34,
                    text: 'MIR',
                    x: 320,
                    y: 360,
                    height: 40,
                    strokeWidth: 5,
                    rotation: 0,
                    mirrored: true,
                    visible: true
                }
            ],
            regions: [],
            pads: [],
            vias: [],
            components: []
        }
    })

    assert.equal(scene.detail.silkscreen.top.texts.length, 1)
    assert.equal(scene.detail.silkscreen.bottom.texts.length, 2)
    assert.equal(scene.detail.silkscreen.top.texts[0].mirrored, false)
    assert.equal(scene.detail.silkscreen.bottom.texts[0].mirrored, false)
    assert.equal(scene.detail.silkscreen.bottom.texts[1].mirrored, true)
    assert.equal(scene.detail.silkscreen.top.texts[0].rotation, 270)
    assert.equal(scene.detail.silkscreen.bottom.texts[0].rotation, 90)
})

/**
 * Verifies TrueType text follows the 3D scene rotation conversion while
 * mirroring remains a separate primitive transform.
 */
test('altium-toolkit normalizes TrueType silkscreen rotation', () => {
    const scene = PcbScene3dBuilder.build({
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 900,
                heightMil: 500,
                segments: []
            },
            primitiveLayers: [{ layerId: 34, name: 'Bottom Overlay' }],
            fills: [],
            tracks: [],
            arcs: [],
            texts: [
                {
                    layerId: 34,
                    text: 'TEXT',
                    x: 200,
                    y: 300,
                    height: 100,
                    strokeWidth: 6,
                    rotation: 270,
                    mirrored: true,
                    fontTypeName: 'TrueType',
                    visible: true
                }
            ],
            regions: [],
            pads: [],
            vias: [],
            components: []
        }
    })

    assert.equal(scene.detail.silkscreen.bottom.texts[0].rotation, 90)
})

/**
 * Verifies Altium TrueType overlay text uses a font-like width ratio when it
 * is approximated with 3D stroke glyphs.
 */
test('altium-toolkit narrows TrueType silkscreen glyphs for 3D', () => {
    const scene = PcbScene3dBuilder.build({
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 900,
                heightMil: 500,
                segments: []
            },
            primitiveLayers: [{ layerId: 34, name: 'Bottom Overlay' }],
            fills: [],
            tracks: [],
            arcs: [],
            texts: [
                {
                    layerId: 34,
                    text: 'TEXT',
                    x: 200,
                    y: 300,
                    height: 100,
                    strokeWidth: 6,
                    rotation: 0,
                    mirrored: true,
                    fontTypeName: 'TrueType',
                    fontFamily: 'Consolas',
                    visible: true
                },
                {
                    layerId: 34,
                    text: 'LINE',
                    x: 200,
                    y: 360,
                    height: 100,
                    strokeWidth: 6,
                    rotation: 0,
                    mirrored: true,
                    fontTypeName: 'Stroke',
                    visible: true
                }
            ],
            regions: [],
            pads: [],
            vias: [],
            components: []
        }
    })

    assert.equal(scene.detail.silkscreen.bottom.texts[0].sizeX, 100)
    assert.ok(scene.detail.silkscreen.bottom.texts[0].sizeY < 60)
    assert.equal(scene.detail.silkscreen.bottom.texts[1].sizeY, 100)
})
