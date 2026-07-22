import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadFormatRegistry } from '../../src/core/ecad/EcadFormatRegistry.mjs'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'
import { DocumentPreferredViewResolver } from '../../src/DocumentPreferredViewResolver.mjs'
import { DocumentViewCompatibility } from '../../src/DocumentViewCompatibility.mjs'
import { AppViewScene3dShellRenderer } from '../../src/ui/AppViewScene3dShellRenderer.mjs'

/**
 * Encodes fixture text as an ArrayBuffer.
 * @param {string} text Fixture text.
 * @returns {ArrayBuffer}
 */
function textBuffer(text) {
    return new TextEncoder().encode(text).buffer
}

/**
 * Returns a minimal Gerber layer with one flashed feature.
 * @param {string} x Coordinate token.
 * @returns {string}
 */
function gerberLayer(x) {
    return [
        '%FSLAX24Y24*%',
        '%MOMM*%',
        '%ADD10C,0.100*%',
        'D10*',
        `${x}Y000000D03*`,
        'M02*'
    ].join('\n')
}

/**
 * Returns a minimal Excellon drill layer with a content-detected text suffix.
 * @returns {string}
 */
function excellonLayer() {
    return [
        'M48',
        'METRIC,TZ',
        'T01C0.600',
        '%',
        'T01',
        'X001000Y001000',
        'M30'
    ].join('\n')
}

/**
 * Builds a two-sided synthetic Gerber document.
 * @returns {object}
 */
function createTwoSideGerberDocument() {
    return {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'fabrication',
        pcb: {
            bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
            fabrication: {
                layers: [
                    {
                        id: 'gerber-top',
                        fileName: 'sample-F_Cu.gtl',
                        role: 'top-copper',
                        side: 'top',
                        primitives: [
                            {
                                type: 'line',
                                x1: 2,
                                y1: 2,
                                x2: 4,
                                y2: 2,
                                width: 0.4
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'gerber-bottom',
                        fileName: 'sample-B_Cu.gbl',
                        role: 'bottom-copper',
                        side: 'bottom',
                        primitives: [
                            {
                                type: 'line',
                                x1: 6,
                                y1: 2,
                                x2: 8,
                                y2: 2,
                                width: 0.4
                            }
                        ],
                        drills: []
                    }
                ]
            }
        },
        bom: []
    }
}

/**
 * Builds a synthetic Gerber document with silkscreen artwork crossing round and
 * obround copper features.
 * @returns {object}
 */
function createGerberSilkscreenCutoutDocument() {
    return {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'fabrication',
        pcb: {
            bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
            fabrication: {
                layers: [
                    {
                        id: 'gerber-top',
                        fileName: 'sample-F_Cu.gtl',
                        role: 'top-copper',
                        side: 'top',
                        primitives: [
                            {
                                type: 'flash',
                                shape: 'circle',
                                x: 4,
                                y: 4,
                                diameter: 1
                            },
                            {
                                type: 'flash',
                                shape: 'obround',
                                x: 6,
                                y: 4,
                                width: 1.4,
                                height: 0.7
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'gerber-top-silkscreen',
                        fileName: 'sample-F_SilkS.gto',
                        role: 'top-silkscreen',
                        side: 'top',
                        primitives: [
                            {
                                type: 'region',
                                points: [
                                    { x: 2, y: 2 },
                                    { x: 8, y: 2 },
                                    { x: 8, y: 6 },
                                    { x: 2, y: 6 }
                                ]
                            }
                        ],
                        drills: []
                    }
                ]
            }
        },
        bom: []
    }
}

/**
 * Builds a canonical Gerber document with retained native 3D scene detail.
 * @returns {object}
 */
function createCanonicalGerberSceneDocument() {
    const native = {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'synthetic-fabrication',
        pcb: {
            bounds: { minX: 0, minY: 0, maxX: 8, maxY: 6 },
            fabrication: {
                layers: [
                    {
                        id: 'copper-a',
                        fileName: 'layer-a.gtl',
                        role: 'top-copper',
                        side: 'top',
                        primitives: [
                            {
                                type: 'line',
                                x1: 1,
                                y1: 1,
                                x2: 3,
                                y2: 1,
                                width: 0.25
                            },
                            {
                                type: 'flash',
                                shape: 'circle',
                                x: 2,
                                y: 3,
                                diameter: 1
                            },
                            {
                                type: 'region',
                                points: [
                                    { x: 4, y: 2 },
                                    { x: 6, y: 2 },
                                    { x: 6, y: 4 },
                                    { x: 4, y: 4 },
                                    { x: 4, y: 2 }
                                ]
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'copper-b',
                        fileName: 'layer-b.gbl',
                        role: 'bottom-copper',
                        side: 'bottom',
                        primitives: [
                            {
                                type: 'line',
                                x1: 1,
                                y1: 5,
                                x2: 3,
                                y2: 5,
                                width: 0.25
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'mask-a',
                        fileName: 'mask-a.gts',
                        role: 'top-soldermask',
                        side: 'top',
                        primitives: [
                            {
                                type: 'flash',
                                shape: 'circle',
                                x: 2,
                                y: 3,
                                diameter: 1.2
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'mask-b',
                        fileName: 'mask-b.gbs',
                        role: 'bottom-soldermask',
                        side: 'bottom',
                        primitives: [
                            {
                                type: 'line',
                                x1: 0.9,
                                y1: 5,
                                x2: 3.1,
                                y2: 5,
                                width: 0.4
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'silk-a',
                        fileName: 'silk-a.gto',
                        role: 'top-silkscreen',
                        side: 'top',
                        primitives: [
                            {
                                type: 'line',
                                x1: 1,
                                y1: 4.5,
                                x2: 3,
                                y2: 4.5,
                                width: 0.2
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'silk-b',
                        fileName: 'silk-b.gbo',
                        role: 'bottom-silkscreen',
                        side: 'bottom',
                        primitives: [
                            {
                                type: 'line',
                                x1: 5,
                                y1: 1,
                                x2: 7,
                                y2: 1,
                                width: 0.2
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'drill-a',
                        fileName: 'drill-a.drl',
                        role: 'plated-drill',
                        side: 'both',
                        primitives: [],
                        drills: [
                            {
                                x: 2,
                                y: 3,
                                diameter: 0.4,
                                plated: true,
                                tool: 'T01'
                            }
                        ]
                    }
                ]
            }
        },
        bom: []
    }

    return {
        schema: 'ecad-toolkit.document.v1',
        model: [
            {
                type: 'pcb_board',
                pcb_board_id: 'board-a',
                center: { x: 4, y: 3 },
                width: 8,
                height: 6,
                num_layers: 2
            }
        ],
        source: {
            format: 'gerber',
            fileName: 'synthetic-fabrication',
            fileType: 'gbr'
        },
        extensions: { gerber: { native } }
    }
}

/**
 * Builds a canonical Gerber document without usable retained native data.
 * @param {object} [native] Retained native payload to attach.
 * @returns {object}
 */
function createCanonicalGerberFallbackSceneDocument(native) {
    const { extensions, ...documentModel } =
        createCanonicalGerberSceneDocument()
    return native === undefined
        ? documentModel
        : { ...documentModel, extensions: { gerber: { native } } }
}

/**
 * Verifies the format registry detects Gerber and drill sources.
 */
test('EcadFormatRegistry detects Gerber and drill sources', () => {
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('board-F_Cu.gtl').sourceFormat,
        'gerber'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('board-PTH.drl').fileType,
        'drill'
    )
})

/**
 * Verifies Gerber and drill selections are grouped through the fabrication
 * package loader instead of producing one document per source layer.
 */
test('EcadParserService groups Gerber fabrication batches', async () => {
    const service = new EcadParserService({
        gerberProjectLoader: {
            supports(entries) {
                return entries.some((entry) => entry.name.endsWith('.gtl'))
            },
            loadAsync(entries) {
                return {
                    documents: [
                        {
                            sourceFormat: 'gerber',
                            kind: 'pcb',
                            fileName: 'fabrication',
                            pcb: {
                                fabrication: {
                                    layers: entries.map((entry) => ({
                                        fileName: entry.name
                                    }))
                                }
                            }
                        }
                    ],
                    diagnostics: [],
                    assets: [],
                    project: { sourceFormat: 'gerber' }
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'board-F_Cu.gtl', buffer: new ArrayBuffer(1) },
        { name: 'board-PTH.drl', buffer: new ArrayBuffer(1) }
    ])

    assert.equal(result.documents.length, 1)
    assert.equal(result.documents[0].sourceFormat, 'gerber')
    assert.equal(result.documents[0].pcb.fabrication.layers.length, 2)
    assert.equal(result.project.sourceFormat, 'gerber')
})

/**
 * Verifies content-detected Excellon TXT drill layers stay with Gerber batches.
 */
test('EcadParserService includes content-detected text drill files in Gerber batches', async () => {
    const service = new EcadParserService({
        gerberProjectLoader: {
            supports(entries) {
                return entries.some((entry) => entry.name.endsWith('.gtl'))
            },
            loadAsync(entries) {
                return {
                    documents: [
                        {
                            sourceFormat: 'gerber',
                            kind: 'pcb',
                            fileName: 'fabrication',
                            pcb: {
                                fabrication: {
                                    layers: entries.map((entry) => ({
                                        fileName: entry.name
                                    }))
                                }
                            }
                        }
                    ],
                    diagnostics: [],
                    assets: [],
                    project: { sourceFormat: 'gerber' }
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'board-F_Cu.gtl', buffer: textBuffer(gerberLayer('X001000')) },
        { name: 'board-holes.TXT', buffer: textBuffer(excellonLayer()) }
    ])

    assert.deepEqual(
        result.documents[0].pcb.fabrication.layers.map(
            (layer) => layer.fileName
        ),
        ['board-F_Cu.gtl', 'board-holes.TXT']
    )
})

/**
 * Verifies parsed Gerber packages expose the canonical document contract
 * accepted directly by the shared 3D shell.
 */
test('EcadParserService prepares Gerber packages for the 3D shell', async () => {
    const service = new EcadParserService()
    const result = await service.parseEntries([
        { name: 'sample-F_Cu.gtl', buffer: textBuffer(gerberLayer('X001000')) },
        { name: 'sample-B_Cu.gbl', buffer: textBuffer(gerberLayer('X002000')) }
    ])
    const documentModel = result.documents[0]

    assert.equal(documentModel.schema, 'ecad-toolkit.document.v1')
    assert.equal(documentModel.source.format, 'gerber')
    assert.equal(
        documentModel.model.some((element) => element.type === 'pcb_board'),
        true
    )
    assert.doesNotThrow(() =>
        AppViewScene3dShellRenderer.render(documentModel, (key) => key)
    )
})

/**
 * Verifies ZIP archives can be routed to Gerber when their contents are a
 * fabrication bundle.
 */
test('EcadParserService routes fabrication ZIP archives to Gerber loader', async () => {
    const service = new EcadParserService({
        gerberProjectLoader: {
            supports(entries) {
                return entries.some((entry) => entry.name.endsWith('.zip'))
            },
            loadAsync(entries) {
                return {
                    documents: [
                        {
                            sourceFormat: 'gerber',
                            kind: 'pcb',
                            fileName: entries[0].name,
                            pcb: { fabrication: { layers: [] } }
                        }
                    ],
                    diagnostics: [],
                    assets: [],
                    project: null
                }
            }
        },
        kicadProjectLoader: {
            loadAsync() {
                throw new Error('KiCad loader should not receive this archive')
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'fabrication.zip', buffer: new ArrayBuffer(1) }
    ])

    assert.equal(result.documents[0].sourceFormat, 'gerber')
})

/**
 * Verifies Gerber documents open as PCB-first documents with 3D support.
 */
test('Document view compatibility treats Gerber as PCB-first with 3D support', () => {
    const documentModel = {
        sourceFormat: 'gerber',
        kind: 'pcb',
        pcb: { fabrication: { layers: [] } }
    }

    assert.equal(DocumentPreferredViewResolver.resolve(documentModel), 'pcb')
    assert.equal(
        DocumentViewCompatibility.supportsView(documentModel, 'pcb'),
        true
    )
    assert.equal(
        DocumentViewCompatibility.supportsView(documentModel, '3d'),
        true
    )
})

/**
 * Verifies Gerber PCB documents route through the fabrication renderer and
 * bare-board 3D scene path.
 */
test('ECAD renderer services accept Gerber fabrication document models', () => {
    const gerberDocument = {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'fabrication',
        pcb: {
            bounds: { minX: 0, minY: 0, maxX: 5, maxY: 4 },
            fabrication: {
                layers: [
                    {
                        id: 'gerber-top',
                        fileName: 'sample-F_Cu.gtl',
                        role: 'top-copper',
                        side: 'top',
                        primitives: [
                            {
                                type: 'flash',
                                shape: 'circle',
                                x: 1,
                                y: 1,
                                diameter: 0.5
                            }
                        ],
                        drills: []
                    }
                ]
            }
        },
        bom: []
    }
    const markup = EcadRendererService.renderPcb(gerberDocument, {
        renderMode: 'separated',
        layerId: 'gerber-top'
    })
    const layers =
        EcadRendererService.resolvePcbInteractionLayers(gerberDocument)

    assert.match(markup, /data-source-format="gerber"/)
    assert.match(markup, /data-render-mode="separated"/)
    assert.equal(layers.physicalLayers[0].id, 'gerber-top')
    const scene = EcadScene3dService.build(gerberDocument)

    assert.equal(scene.sourceFormat, 'gerber')
    assert.equal(scene.board.widthMil, 196.850394)
    assert.equal(scene.board.heightMil, 157.480315)
    assert.equal(scene.components.length, 0)
    assert.equal(scene.detail.pads.length, 1)
})

test('EcadScene3dService uses retained Gerber geometry for canonical documents', () => {
    const scene = EcadScene3dService.build(createCanonicalGerberSceneDocument())

    assert.equal(scene.sourceFormat, 'gerber')
    assert.deepEqual(
        {
            tracks: scene.detail.tracks.length,
            pads: scene.detail.pads.length,
            vias: scene.detail.vias.length,
            polygons: scene.detail.polygons.length,
            topSilkscreen: scene.detail.silkscreen.top.tracks.length,
            bottomSilkscreen: scene.detail.silkscreen.bottom.tracks.length
        },
        {
            tracks: 2,
            pads: 1,
            vias: 1,
            polygons: 1,
            topSilkscreen: 1,
            bottomSilkscreen: 1
        }
    )
    assert.equal(
        scene.detail.tracks.every((track) => track.hasSolderMask),
        true
    )
    assert.equal(scene.detail.pads[0].hasTopSolderMaskOpening, false)
    assert.equal(scene.detail.vias[0].barrelOnly, true)
    assert.equal(scene.detail.vias[0].diameter, 39.370079)
    assert.equal(scene.detail.vias[0].isTentingTop, true)
    assert.equal(scene.detail.vias[0].isTentingBottom, true)
})

test('EcadScene3dService prepares retained Gerber geometry asynchronously', async () => {
    const documentModel = createCanonicalGerberSceneDocument()
    const prepared = await EcadScene3dService.prepare(documentModel)

    assert.equal(prepared.detail.tracks.length, 2)
    assert.equal(prepared.detail.pads.length, 1)
    assert.equal(prepared.detail.vias.length, 1)
    assert.equal(prepared.detail.polygons.length, 1)
    assert.equal(prepared.detail.silkscreen.top.tracks.length, 1)
    assert.equal(prepared.detail.silkscreen.bottom.tracks.length, 1)
    assert.deepEqual(prepared, EcadScene3dService.build(documentModel))
})

test('EcadScene3dService uses generic geometry for canonical Gerber without usable retained data', () => {
    const genericDocument = createCanonicalGerberFallbackSceneDocument()
    const genericScene = EcadScene3dService.build(genericDocument)

    assert.deepEqual(
        {
            widthMil: genericScene.board.widthMil,
            heightMil: genericScene.board.heightMil
        },
        { widthMil: 314.96063, heightMil: 236.220472 }
    )
    for (const native of [{}, { pcb: { fabrication: { layers: [] } } }]) {
        assert.deepEqual(
            EcadScene3dService.build(
                createCanonicalGerberFallbackSceneDocument(native)
            ),
            genericScene
        )
    }
})

test('EcadScene3dService prepares generic geometry for canonical Gerber without usable retained data', async () => {
    const genericDocument = createCanonicalGerberFallbackSceneDocument()
    const genericScene = EcadScene3dService.build(genericDocument)
    const missingNativeScene = await EcadScene3dService.prepare(genericDocument)

    assert.deepEqual(missingNativeScene, genericScene)
    assert.equal(missingNativeScene.board.widthMil, 314.96063)
    assert.equal(missingNativeScene.board.heightMil, 236.220472)
    for (const native of [{}, { pcb: { fabrication: { layers: [] } } }]) {
        assert.deepEqual(
            await EcadScene3dService.prepare(
                createCanonicalGerberFallbackSceneDocument(native)
            ),
            genericScene
        )
    }
})

/**
 * Verifies Gerber silkscreen keepouts use dense curved contours before the
 * viewer triangulates the fill mesh.
 */
test('EcadScene3dService smooths Gerber curved silkscreen cutouts', () => {
    const scene = EcadScene3dService.build(
        createGerberSilkscreenCutoutDocument()
    )
    const topSilkscreen = scene.detail.silkscreen.top
    const circularCutout = topSilkscreen.drillCutouts.find(
        (cutout) => cutout.length > 80
    )
    const obroundCutout = topSilkscreen.drillCutouts.find(
        (cutout) => cutout.length > 50 && cutout.length < 90
    )

    assert.ok(
        circularCutout,
        'Expected Gerber circular copper keepout to use a dense contour'
    )
    assert.ok(
        obroundCutout,
        'Expected Gerber obround copper keepout to use dense rounded caps'
    )
})

/**
 * Verifies the app renderer facade forwards Gerber side selection so the PCB
 * view buttons produce different active-side composite SVGs.
 */
test('ECAD renderer switches Gerber PCB output between top and bottom sides', () => {
    const gerberDocument = createTwoSideGerberDocument()
    const topMarkup = EcadRendererService.renderPcb(gerberDocument, {
        side: 'top'
    })
    const bottomMarkup = EcadRendererService.renderPcb(gerberDocument, {
        side: 'bottom'
    })

    assert.notEqual(bottomMarkup, topMarkup)
    assert.match(topMarkup, /pcb-svg--app-palette/)
    assert.match(topMarkup, /pcb-svg--gerber/)
    assert.match(
        topMarkup,
        /gerber-role-top-copper pcb-copper pcb-copper--surface/
    )
    assert.match(
        bottomMarkup,
        /gerber-role-bottom-copper pcb-copper pcb-copper--surface/
    )
    assert.match(bottomMarkup, /data-render-side="bottom"/)
    assert.match(bottomMarkup, /scale\(-1 -1\)/)
})
