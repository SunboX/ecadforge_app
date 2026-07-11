import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumExtensionResolver } from 'altium-toolkit/extensions'
import { EcadFormatRegistry } from '../../src/core/ecad/EcadFormatRegistry.mjs'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Builds a minimal canonical document returned by common parser fakes.
 * @param {string} format Source format.
 * @param {string} fileName Source file name.
 * @returns {object} Canonical document.
 */
function createCanonicalDocument(format, fileName) {
    return {
        schema: 'ecad-toolkit.document.v1',
        id: format + '-' + fileName,
        modelSchema: { name: 'circuit-json', version: '0.0.446' },
        model: [],
        source: { format, fileName, fileType: 'test' },
        extensions: {},
        assets: [],
        diagnostics: [],
        statistics: { elementCount: 0 }
    }
}

/**
 * Verifies the format registry accepts the expanded ECAD intake surface.
 */
test('EcadFormatRegistry detects Altium, KiCad, ZIP, and companion assets', () => {
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('a.SchDoc').sourceFormat,
        'altium'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('b.kicad_sch').sourceFormat,
        'kicad'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('c.kicad_pcb').fileType,
        'kicad_pcb'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('project.zip').fileType,
        'zip'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('board.json').sourceFormat,
        'circuitjson'
    )
    assert.equal(EcadFormatRegistry.resolveCompanionFormat('Body.step'), 'step')
    assert.equal(EcadFormatRegistry.resolveCompanionFormat('Body.vrml'), 'vrml')
    assert.equal(EcadFormatRegistry.resolveCompanionFormat('Body.glb'), 'glb')
    assert.equal(EcadFormatRegistry.resolveCompanionFormat('Body.gltf'), 'gltf')
    assert.equal(EcadFormatRegistry.resolveCompanionFormat('Body.stl'), 'stl')
    assert.equal(EcadFormatRegistry.resolveCompanionFormat('Body.obj'), 'obj')
    assert.equal(EcadFormatRegistry.resolveCompanionFormat('Body.3mf'), '3mf')
    assert.equal(
        EcadFormatRegistry.resolveCompanionFormat('symbols.kicad_sym'),
        'kicad-library'
    )
})

/**
 * Verifies parser dispatch keeps toolkit parsing behind the app facade.
 */
test('EcadParserService dispatches mixed Altium and KiCad batches', async () => {
    const service = new EcadParserService({
        altiumProjectLoader: {
            loadAsync(entries) {
                return {
                    documents: entries.map((entry) =>
                        createCanonicalDocument('altium', entry.name)
                    ),
                    assets: [],
                    diagnostics: []
                }
            }
        },
        kicadProjectLoader: {
            loadAsync(entries) {
                return {
                    documents: entries.map((entry) => ({
                        ...createCanonicalDocument('kicad', entry.name)
                    })),
                    assets: [{ name: 'model.step' }],
                    diagnostics: [{ severity: 'info', message: 'ok' }]
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'board.PcbDoc', buffer: new ArrayBuffer(1) },
        { name: 'demo.kicad_pro', buffer: new ArrayBuffer(1) },
        { name: 'demo.kicad_sch', buffer: new ArrayBuffer(1) }
    ])

    assert.deepEqual(
        result.documents.map((document) => document.source.format),
        ['altium', 'kicad', 'kicad']
    )
    assert.equal(result.assets[0].name, 'model.step')
    assert.equal(result.diagnostics[0].message, 'ok')
})

/**
 * Verifies batch Altium parsing preserves readable documents when one native
 * file in the same source folder is damaged.
 */
test('EcadParserService reports damaged Altium entries as diagnostics', async () => {
    const service = new EcadParserService({
        altiumProjectLoader: {
            loadAsync(entries) {
                const schematicEntry = entries.find((entry) =>
                    entry.name.endsWith('.SchDoc')
                )
                return {
                    documents: [
                        createCanonicalDocument('altium', schematicEntry.name)
                    ],
                    assets: [],
                    diagnostics: [
                        {
                            severity: 'error',
                            fileName: 'board.PcbDoc',
                            message:
                                'Failed to parse board.PcbDoc: OLE compound document is not sector-aligned.'
                        }
                    ]
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'logic.SchDoc', buffer: new ArrayBuffer(1) },
        { name: 'board.PcbDoc', buffer: new ArrayBuffer(1) }
    ])

    assert.deepEqual(
        result.documents.map((document) => document.source.fileName),
        ['logic.SchDoc']
    )
    assert.equal(result.diagnostics.length, 1)
    assert.equal(result.diagnostics[0].severity, 'error')
    assert.equal(result.diagnostics[0].fileName, 'board.PcbDoc')
    assert.match(result.diagnostics[0].message, /board\.PcbDoc.*sector-aligned/)
    assert.deepEqual(result.documents[0].diagnostics, [])
})

/**
 * Verifies native-style uppercase Altium schematic fields remain readable
 * through the app's installed parser integration.
 */
test('EcadParserService parses uppercase Altium schematic fields', () => {
    const source = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=200|CUSTOMY=120|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
            '|BORDERON=F|TITLEBLOCKON=F|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
            '|RECORD=13|LOCATION.X=20|LOCATION.Y=40|CORNER.X=90|CORNER.Y=40' +
            '|LINEWIDTH=1|COLOR=128|INDEXINSHEET=1' +
            '|RECORD=2|OWNERINDEX=700|OWNERPARTID=1|PINCONGLOMERATE=58|PINLENGTH=20' +
            '|LOCATION.X=120|LOCATION.Y=60|NAME=RUNE_A|DESIGNATOR=1' +
            '|RECORD=41|LOCATION.X=140|LOCATION.Y=70|COLOR=8388608|FONTID=1' +
            '|TEXT=GLYPH_A|NAME=Designator|OWNERINDEX=700'
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'uppercase-fields.SchDoc',
        source.buffer
    )
    const nativeModel = AltiumExtensionResolver.nativeModel(documentModel)

    assert.equal(Object.hasOwn(documentModel, 'schematic'), false)
    assert.equal(nativeModel.schematic.sheet.width, 200)
    assert.equal(nativeModel.schematic.lines.length, 1)
    assert.equal(nativeModel.schematic.pins.length, 1)
    assert.equal(nativeModel.schematic.texts.length, 1)
})

/**
 * Verifies schematic component labels stay bound to their native owner group
 * instead of the nearest unrelated visible text.
 */
test('EcadParserService preserves owner-bound schematic component labels', () => {
    const source = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=300|CustomY=220|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=1|IndexInSheet=20|Location.X=100|Location.Y=100|LibReference=IC/FAKE/CONTROL-HUB|UniqueID=CMP-A' +
            '|RECORD=14|OwnerIndex=300|OwnerPartID=1|Location.X=20|Location.Y=100|Corner.X=80|Corner.Y=190' +
            '|RECORD=2|OwnerIndex=300|OwnerPartID=1|Location.X=80|Location.Y=120|Name=SIG_A|Designator=1' +
            '|RECORD=34|OwnerIndex=300|OwnerPartID=-1|Location.X=20|Location.Y=200|Color=8388608|FontID=1|Text=U7|Name=Designator' +
            '|RECORD=41|OwnerIndex=300|OwnerPartID=-1|Location.X=20|Location.Y=90|Color=8388608|FontID=1|Text=CONTROL-HUB|Name=Comment' +
            '|RECORD=34|OwnerIndex=500|OwnerPartID=-1|Location.X=105|Location.Y=105|Color=8388608|FontID=1|Text=R4|Name=Designator' +
            '|RECORD=41|OwnerIndex=500|OwnerPartID=-1|Location.X=105|Location.Y=115|Color=8388608|FontID=1|Text=4K7|Name=Comment'
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'owner-bound-labels.SchDoc',
        source.buffer
    )
    const nativeModel = AltiumExtensionResolver.nativeModel(documentModel)

    assert.equal(nativeModel.schematic.components[0].designator, 'U7')
    assert.equal(nativeModel.schematic.components[0].value, 'CONTROL-HUB')
})

/**
 * Verifies the app integration preserves marker-prefix Altium fields, visible
 * metadata placeholders, and extended schematic line styles.
 */
test('EcadParserService renders prefixed Altium schematic records without internal parameters', () => {
    const source = new TextEncoder().encode(
        [
            '|HEADER=Schematic Document',
            '|FONTNAME1=Times New Roman|SIZE1=10|BORDERON=T|CUSTOMX=300' +
                '|RECORD=31|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
                '|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4|FONTIDCOUNT=1',
            '|X4=20|Y4=30|X1=20|Y1=80' +
                '|RECORD=7|LOCATIONCOUNT=4|X2=80|Y2=80|X3=80|Y3=30' +
                '|COLOR=128|AREACOLOR=16776960|ISSOLID=T|LINEWIDTH=1',
            '|RECORD=41|NAME=Title|TEXT=RUNE BOARD|ISHIDDEN=T',
            '|RECORD=4|LOCATION.X=20|LOCATION.Y=150|COLOR=8388608|FONTID=1|TEXT==Title',
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=120|NAME=PinUniqueId|TEXT=HIDDEN_PIN_KEY|FONTID=1',
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=110|NAME=Vendor|TEXT=HIDDEN_VENDOR|FONTID=1',
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=100|NAME=IC|TEXT=HIDDEN_DEVICE|FONTID=1',
            '|RECORD=41|LOCATION.X=40|LOCATION.Y=90|NAME=DifferentialPair|TEXT=True|FONTID=1',
            '|RECORD=41|LOCATION.X=80|LOCATION.Y=70|NAME=Comment|TEXT=VISIBLE_VALUE|FONTID=1',
            '|RECORD=6|LOCATIONCOUNT=2|X1=20|Y1=150|X2=240|Y2=150' +
                '|COLOR=8323857|LINEWIDTH=2|LINESTYLEEXT=3|INDEXINSHEET=2'
        ].join('\u0000')
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'prefixed-records.SchDoc',
        source.buffer
    )
    const nativeModel = AltiumExtensionResolver.nativeModel(documentModel)
    const visibleTexts = nativeModel.schematic.texts.map((text) => text.text)
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.equal(nativeModel.schematic.sheet.width, 300)
    assert.equal(nativeModel.schematic.sheet.borderOn, true)
    assert.deepEqual(nativeModel.schematic.polygons[0].points, [
        { x: 20, y: 80 },
        { x: 80, y: 80 },
        { x: 80, y: 30 },
        { x: 20, y: 30 }
    ])
    assert.equal(visibleTexts.includes('RUNE BOARD'), true)
    assert.equal(visibleTexts.includes('VISIBLE_VALUE'), true)
    assert.equal(visibleTexts.includes('HIDDEN_PIN_KEY'), false)
    assert.equal(visibleTexts.includes('HIDDEN_VENDOR'), false)
    assert.equal(visibleTexts.includes('HIDDEN_DEVICE'), false)
    assert.equal(visibleTexts.includes('True'), false)
    assert.equal(
        nativeModel.schematic.lines.some((line) => line.lineStyle === 3),
        true
    )
    assert.match(markup, /stroke-dasharray="16 10 3 10" stroke-linecap="round"/)
})

/**
 * Verifies the app's installed Altium renderer scales sparse custom sheets
 * even when parsed component placeholders are not rendered.
 */
test('EcadRendererService scales sparse Altium custom sheets with hidden placeholders', () => {
    const markup = EcadRendererService.renderSchematic({
        summary: { title: 'Hidden placeholder fit' },
        schematic: {
            sheet: {
                width: 1500,
                height: 950,
                sourceWidth: 1500,
                sourceHeight: 950,
                marginWidth: 20,
                borderOn: true,
                titleBlockOn: false,
                xZones: 4,
                yZones: 4,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    },
                    6: {
                        size: 36,
                        family: 'Times New Roman',
                        bold: false
                    }
                }
            },
            lines: [
                {
                    x1: 740,
                    y1: 730,
                    x2: 1120,
                    y2: 730,
                    color: '#000080',
                    width: 2
                },
                {
                    x1: 30,
                    y1: 30,
                    x2: 1120,
                    y2: 30,
                    color: '#000080',
                    width: 2
                }
            ],
            texts: [
                {
                    x: 50,
                    y: 690,
                    text: 'EMBER NODE',
                    color: '#000080',
                    fontSize: 36,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400
                }
            ],
            components: [{ x: 0, y: 580, designator: 'U?' }],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<g class="schematic-content" clip-path="url\(#schematic-content-clip-[^"]+\)" transform="translate\(39\.55 37\.50\) scale\(1\.3036\) translate\(-30 -240\)">/
    )
})

/**
 * Verifies renderer and scene facades branch on sourceFormat.
 */
test('ECAD renderer and 3D services accept KiCad document models', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'board.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 100, heightMil: 50, segments: [] },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'KiCad Board',
                bounds: { minX: 0, minY: 0, width: 2.54, height: 1.27 },
                outlines: [],
                pads: [],
                drawings: [],
                texts: []
            }
        },
        bom: []
    }
    const scene = EcadScene3dService.build(kicadPcbDocument)
    const kicadPcbMarkup = EcadRendererService.renderPcb(kicadPcbDocument)

    assert.match(kicadPcbMarkup, /pcb-svg/)
    assert.match(kicadPcbMarkup, /pcb-svg--app-palette/)
    assert.match(kicadPcbMarkup, /pcb-svg--kicad/)
    assert.equal(scene.sourceFormat, 'kicad')
    assert.equal(scene.board.widthMil, 100)
})

/**
 * Verifies Altium silkscreen scene data includes drill masks so overlay
 * strokes and text planes cannot cover via or through-hole openings.
 */
test('ECAD 3D service exposes Altium silkscreen drill cutouts', async () => {
    const altiumPcbDocument = {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 400,
                segments: []
            },
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            fills: [{ layerId: 33, x1: 80, y1: 40, x2: 220, y2: 160 }],
            tracks: [
                {
                    layerId: 33,
                    x1: 50,
                    y1: 100,
                    x2: 250,
                    y2: 100,
                    width: 10
                }
            ],
            arcs: [],
            texts: [],
            regions: [],
            shapeBasedRegions: [],
            pads: [
                { x: 120, y: 100, holeDiameter: 40 },
                {
                    x: 180,
                    y: 100,
                    holeDiameter: 30,
                    holeShape: 2,
                    holeSlotLength: 70,
                    holeRotation: 0,
                    rotation: 90
                }
            ],
            vias: [{ x: 200, y: 100, holeDiameter: 20 }],
            components: []
        },
        bom: []
    }

    const builtScene = EcadScene3dService.build(altiumPcbDocument)
    const preparedScene = await EcadScene3dService.prepare(altiumPcbDocument)

    for (const scene of [builtScene, preparedScene]) {
        const topSilkscreen = scene.detail.silkscreen.top
        const bottomSilkscreen = scene.detail.silkscreen.bottom

        assert.equal(topSilkscreen.drillCutouts.length, 3)
        assert.equal(bottomSilkscreen.drillCutouts.length, 3)
        assert.equal(topSilkscreen.fills[0].holes.length, 3)
        assert.ok(
            topSilkscreen.drillCutouts.some((cutout) => {
                const xs = cutout.map((point) => point.x)
                const ys = cutout.map((point) => point.y)
                const width = Math.max(...xs) - Math.min(...xs)
                const height = Math.max(...ys) - Math.min(...ys)

                return (
                    Math.max(width, height) > 60 && Math.min(width, height) > 29
                )
            }),
            'Expected the slotted through-hole pad to produce a long cutout'
        )
    }
})

/**
 * Verifies 3D Altium scenes prefer a matching board-region contour when the
 * recovered board outline is a rasterized stair-step fallback.
 */
test('ECAD 3D service refines rasterized Altium board outlines from board regions', () => {
    const stairStepSegments = []
    const stairPoints = [
        { x: 0, y: 100 },
        { x: 72, y: 100 },
        { x: 72, y: 96 },
        { x: 80, y: 96 },
        { x: 80, y: 92 },
        { x: 84, y: 92 },
        { x: 84, y: 88 },
        { x: 88, y: 88 },
        { x: 88, y: 84 },
        { x: 92, y: 84 },
        { x: 92, y: 80 },
        { x: 96, y: 80 },
        { x: 96, y: 72 },
        { x: 100, y: 72 },
        { x: 100, y: 0 },
        { x: 0, y: 0 }
    ]

    for (let index = 0; index < stairPoints.length; index += 1) {
        const current = stairPoints[index]
        const next = stairPoints[(index + 1) % stairPoints.length]
        stairStepSegments.push({
            type: 'line',
            x1: current.x,
            y1: current.y,
            x2: next.x,
            y2: next.y
        })
    }

    const altiumPcbDocument = {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: stairStepSegments
            },
            primitiveLayers: [],
            boardRegions: [
                {
                    objectKind: 'BoardRegion',
                    isBoardCutout: true,
                    points: [
                        { x: 0, y: 100 },
                        { x: 0, y: 0 },
                        { x: 100, y: 0 },
                        { x: 100, y: 76 },
                        { x: 96, y: 88 },
                        { x: 88, y: 96 },
                        { x: 76, y: 100 }
                    ]
                }
            ],
            pads: [],
            tracks: [],
            arcs: [],
            vias: [],
            components: []
        },
        bom: []
    }

    const scene = EcadScene3dService.build(altiumPcbDocument)

    assert.equal(scene.board.segments.length, 7)
    assert.deepEqual(scene.board.segments[4], {
        type: 'line',
        x1: 96,
        y1: 88,
        x2: 88,
        y2: 96
    })
})

/**
 * Verifies KiCad footprint model transforms stay raw so the 3D renderer can
 * compose them with KiCad's model matrix order.
 */
test('ECAD 3D service preserves KiCad model transforms for external placements', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'model-board.kicad_pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 800,
                segments: []
            },
            components: [
                {
                    designator: 'LED1',
                    x: 400,
                    y: 300,
                    layer: 'TOP',
                    pattern: 'Fixture:Matrix',
                    rotation: 90,
                    modelName: 'matrix.step',
                    modelPath: '${KIPRJMOD}/parts/matrix.step',
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: -90 },
                        offsetMil: { x: 10, y: -20, z: 30 },
                        dxMil: 10,
                        dyMil: -20,
                        dzMil: 30,
                        scale: { x: 1.5, y: 2, z: 0.5 }
                    }
                }
            ],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'KiCad Board',
                bounds: { minX: 0, minY: 0, width: 25.4, height: 20.32 },
                outlines: [],
                pads: [],
                drawings: [],
                texts: []
            }
        },
        bom: []
    }

    const scene = EcadScene3dService.build(kicadPcbDocument, {
        sessionAssets: [
            {
                name: 'matrix.step',
                relativePath: 'parts/matrix.step',
                format: 'step'
            }
        ]
    })

    assert.equal(scene.externalPlacements.length, 1)
    assert.deepEqual(scene.externalPlacements[0].modelTransform, {
        rotationDeg: { x: -90, y: 0, z: -90 },
        offsetMil: { x: 10, y: -20, z: 30 },
        dxMil: 10,
        dyMil: -20,
        dzMil: 30,
        scale: { x: 1.5, y: 2, z: 0.5 }
    })
})

/**
 * Verifies KiCad STEP placements use the PCB face as their mount anchor while
 * procedural body placeholders keep their height-centered positions.
 */
test('ECAD 3D service anchors KiCad external placements to board faces', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'bottom-model-board.kicad_pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 800,
                segments: []
            },
            components: [
                {
                    designator: 'U1',
                    x: 400,
                    y: 300,
                    layer: 'BOTTOM',
                    pattern: 'Package_SO:SOIC-8',
                    modelName: 'body.step',
                    modelPath: '${KIPRJMOD}/parts/body.step',
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 }
                    }
                }
            ],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'KiCad Board',
                bounds: { minX: 0, minY: 0, width: 25.4, height: 20.32 },
                outlines: [],
                pads: [],
                drawings: [],
                texts: []
            }
        },
        bom: []
    }

    const scene = EcadScene3dService.build(kicadPcbDocument, {
        boardThicknessMil: 80,
        sessionAssets: [
            {
                name: 'body.step',
                relativePath: 'parts/body.step',
                format: 'step'
            }
        ]
    })

    assert.equal(scene.components[0].positionMil.z < -40, true)
    assert.equal(scene.externalPlacements[0].positionMil.z, -40)
})

/**
 * Verifies KiCad silkscreen drawings from the parser root are exposed to the
 * app's interactive 3D silkscreen layer.
 */
test('ECAD 3D service exposes KiCad silkscreen detail', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'silk-board.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500, segments: [] },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Silk Board',
                bounds: { minX: 0, minY: 0, width: 25.4, height: 12.7 },
                outlines: [],
                pads: [],
                drawings: [
                    {
                        type: 'line',
                        layer: 'F.SilkS',
                        side: 'front',
                        strokeWidth: 0.2,
                        start: { x: 1, y: 2 },
                        end: { x: 4, y: 2 }
                    },
                    {
                        type: 'polygon',
                        layer: 'B.SilkS',
                        side: 'back',
                        fill: true,
                        points: [
                            { x: 5, y: 5 },
                            { x: 6, y: 5 },
                            { x: 6, y: 7 },
                            { x: 5, y: 7 }
                        ]
                    },
                    {
                        type: 'zone',
                        layer: 'F.Cu',
                        side: 'front',
                        fill: true,
                        points: [
                            { x: 0, y: 0 },
                            { x: 20, y: 0 },
                            { x: 20, y: 10 },
                            { x: 0, y: 10 }
                        ]
                    }
                ],
                texts: []
            }
        },
        bom: []
    }

    const scene = EcadScene3dService.build(kicadPcbDocument)

    assert.deepEqual(scene.detail.silkscreen.top.tracks, [
        {
            x1: 39.37007874015748,
            y1: 421.25984251968504,
            x2: 157.48031496062993,
            y2: 421.25984251968504,
            width: 7.874015748031496
        }
    ])
    assert.deepEqual(scene.detail.silkscreen.top.fills, [])
    assert.deepEqual(scene.detail.silkscreen.bottom.fills, [
        {
            points: [
                { x: 196.8503937007874, y: 303.14960629921256 },
                { x: 236.2204724409449, y: 303.14960629921256 },
                { x: 236.2204724409449, y: 224.40944881889766 },
                { x: 196.8503937007874, y: 224.40944881889766 }
            ]
        }
    ])
})

/**
 * Verifies KiCad copper-layer text remains available to the 3D copper detail
 * renderer instead of being dropped with non-copper annotations.
 */
test('ECAD 3D service exposes KiCad copper text detail', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'copper-text-board.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500, segments: [] },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Copper Text Board',
                bounds: { minX: 0, minY: 0, width: 25.4, height: 12.7 },
                outlines: [],
                pads: [],
                drawings: [],
                texts: [
                    {
                        value: 'COPPER',
                        x: 2,
                        y: 3,
                        rotation: 15,
                        layer: 'F.Cu',
                        side: 'front',
                        hAlign: 'left',
                        vAlign: 'bottom',
                        sizeX: 0.5,
                        sizeY: 0.6,
                        thickness: 0.12,
                        visible: true
                    },
                    {
                        value: 'MASK',
                        x: 2,
                        y: 3,
                        layer: 'F.Mask',
                        side: 'front',
                        visible: true
                    }
                ]
            }
        },
        bom: []
    }

    const scene = EcadScene3dService.build(kicadPcbDocument)

    assert.deepEqual(scene.detail.copperTexts, [
        {
            x: 78.74015748031496,
            y: 381.8897637795276,
            value: 'COPPER',
            layer: 'F.Cu',
            side: 'front',
            layerId: 1,
            rotation: 345,
            mirrored: false,
            hAlign: 'left',
            vAlign: 'bottom',
            sizeX: 19.68503937007874,
            sizeY: 23.62204724409449,
            thickness: 4.724409448818898
        }
    ])
})

/**
 * Verifies the app renders KiCad PCB files with the KiCad-style full layer
 * context instead of a single active copper side.
 */
test('ECAD renderer includes subdued opposite-side copper for KiCad PCB views', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'two-layer-fake.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 400, heightMil: 400, segments: [] },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Two Layer Fake',
                bounds: {
                    minX: 0,
                    minY: 0,
                    maxX: 10,
                    maxY: 10,
                    width: 10,
                    height: 10
                },
                outlines: [],
                pads: [],
                drawings: [
                    {
                        type: 'segment',
                        layer: 'F.Cu',
                        material: 'copper',
                        side: 'front',
                        start: { x: 1, y: 2 },
                        end: { x: 4, y: 2 },
                        strokeWidth: 0.8
                    },
                    {
                        type: 'segment',
                        layer: 'B.Cu',
                        material: 'copper',
                        side: 'back',
                        start: { x: 1, y: 4 },
                        end: { x: 4, y: 4 },
                        strokeWidth: 0.4
                    }
                ],
                texts: []
            }
        },
        bom: []
    }
    const markup = EcadRendererService.renderPcb(kicadPcbDocument)

    assert.match(markup, /pcb-svg--app-palette/)
    assert.match(markup, /pcb-svg--kicad/)
    assert.match(markup, /data-layer="F\.Cu"/)
    assert.match(markup, /data-layer="B\.Cu"/)
    assert.match(markup, /class="pcb-segment"[^>]+stroke-width="0\.8"/)
    assert.doesNotMatch(markup, /class="pcb-segment"[^>]+vector-effect/)
})

/**
 * Verifies the app-level PCB renderer facade can request either board side
 * from the KiCad renderer while retaining the full copper context.
 */
test('ECAD renderer switches KiCad PCB output between top and bottom sides', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'side-toggle-fake.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 400, heightMil: 400, segments: [] },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Side Toggle Fake',
                bounds: {
                    minX: 0,
                    minY: 0,
                    maxX: 10,
                    maxY: 10,
                    width: 10,
                    height: 10
                },
                outlines: [],
                pads: [],
                drawings: [],
                texts: [
                    {
                        value: 'TOP_SIDE_MARK',
                        x: 2,
                        y: 3,
                        rotation: 0,
                        layer: 'F.SilkS',
                        side: 'front',
                        hAlign: 'left',
                        vAlign: 'bottom',
                        sizeX: 0.5,
                        sizeY: 0.6,
                        thickness: 0.12,
                        visible: true
                    },
                    {
                        value: 'BOTTOM_SIDE_MARK',
                        x: 4,
                        y: 5,
                        rotation: 0,
                        layer: 'B.SilkS',
                        side: 'back',
                        hAlign: 'left',
                        vAlign: 'bottom',
                        sizeX: 0.5,
                        sizeY: 0.6,
                        thickness: 0.12,
                        visible: true
                    }
                ]
            }
        },
        bom: []
    }

    const topMarkup = EcadRendererService.renderPcb(kicadPcbDocument, {
        side: 'top'
    })
    const bottomMarkup = EcadRendererService.renderPcb(kicadPcbDocument, {
        side: 'bottom'
    })

    assert.match(topMarkup, /aria-label="TOP_SIDE_MARK"/)
    assert.doesNotMatch(topMarkup, /aria-label="BOTTOM_SIDE_MARK"/)
    assert.match(bottomMarkup, /aria-label="BOTTOM_SIDE_MARK"/)
    assert.doesNotMatch(bottomMarkup, /aria-label="TOP_SIDE_MARK"/)
    assert.match(
        bottomMarkup,
        /<g class="pcb-scene" transform="translate\(10 0\) scale\(-1 1\)">/
    )
})
