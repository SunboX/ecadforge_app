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
            canLoadEntries(entries) {
                return entries.some((entry) => entry.name.endsWith('.gtl'))
            },
            loadEntries(entries) {
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
 * Verifies parsed Gerber packages expose the PCB contract required by the
 * shared 3D shell before the interactive scene mounts.
 */
test('EcadParserService prepares Gerber packages for the 3D shell', async () => {
    const service = new EcadParserService()
    const result = await service.parseEntries([
        { name: 'sample-F_Cu.gtl', buffer: textBuffer(gerberLayer('X001000')) },
        { name: 'sample-B_Cu.gbl', buffer: textBuffer(gerberLayer('X002000')) }
    ])
    const documentModel = result.documents[0]

    assert.equal(documentModel.sourceFormat, 'gerber')
    assert.equal(documentModel.pcb.boardOutline.widthMil, 7.874016)
    assert.deepEqual(documentModel.pcb.components, [])
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
            canLoadEntries(entries) {
                return entries.some((entry) => entry.name.endsWith('.zip'))
            },
            loadEntries(entries) {
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
            loadEntries() {
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
