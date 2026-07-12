import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser as KicadParser } from 'kicad-toolkit/parser'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

const KICAD_SCHEMATIC =
    '(kicad_sch (version 20250114) (generator "fixture") (paper "A4"))'
const KICAD_PCB =
    '(kicad_pcb (version 20240108) (generator pcbnew)' +
    ' (general (thickness 1.6)) (paper "A4")' +
    ' (layers (0 "F.Cu" signal) (31 "B.Cu" signal)' +
    ' (36 "B.SilkS" user "b.silkscreen")' +
    ' (37 "F.SilkS" user "f.silkscreen") (44 "Edge.Cuts" user))' +
    ' (gr_rect (start 0 0) (end 10 5)' +
    ' (stroke (width 0.05) (type default)) (fill none)' +
    ' (layer "Edge.Cuts"))' +
    ' (segment (start 1 1) (end 9 1) (width 0.5)' +
    ' (layer "F.Cu") (net 0)))'

/**
 * Parses one neutral canonical KiCad document with native fidelity retained.
 * @param {string} fileName Source file name.
 * @param {string} data Source text.
 * @returns {object} Canonical document.
 */
function parseKicad(fileName, data) {
    return structuredClone(
        KicadParser.parse(
            { fileName, data },
            { extensions: ['kicad.native-model'] }
        )
    )
}

test('canonical Altium schematics route through the retained native renderer', () => {
    const source = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CUSTOMX=200|CUSTOMY=120|VISIBLEGRIDSIZE=10' +
            '|SNAPGRIDSIZE=5|BORDERON=F|TITLEBLOCKON=F' +
            '|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=4|CUSTOMYZONES=4' +
            '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman' +
            '|BOLD1=F|ROTATION1=0' +
            '|RECORD=6|LOCATIONCOUNT=2|X1=20|Y1=20|X2=100|Y2=20' +
            '|COLOR=128|LINEWIDTH=1'
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'neutral.SchDoc',
        source.buffer
    )
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.match(markup, /var\(--schematic-/u)
    assert.doesNotMatch(markup, /schematic-svg--circuitjson/u)
})

test('canonical KiCad schematics route through the retained native renderer', () => {
    const documentModel = parseKicad('neutral.kicad_sch', KICAD_SCHEMATIC)
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.match(markup, /var\(--schematic-/u)
    assert.doesNotMatch(markup, /schematic-svg--circuitjson/u)
})

test('canonical KiCad PCB fidelity uses native 2D services and canonical 3D', async () => {
    const documentModel = parseKicad('neutral.kicad_pcb', KICAD_PCB)
    const markup = EcadRendererService.renderPcb(documentModel)
    const layers =
        EcadRendererService.resolvePcbInteractionLayers(documentModel)
    const hits = EcadRendererService.hitTestPcb(
        documentModel,
        { x: 3, y: 1 },
        { side: 'top' }
    )
    const scene = EcadScene3dService.build(documentModel)
    const preparedScene = await EcadScene3dService.prepare(documentModel)

    assert.match(markup, /pcb-svg--kicad/u)
    assert.doesNotMatch(markup, /pcb-svg--circuitjson/u)
    assert.equal(
        layers.physicalLayers.some((layer) => layer.key === 'F.Cu'),
        true
    )
    assert.equal(
        hits.some((candidate) => candidate.type === 'track'),
        true
    )
    for (const resolvedScene of [scene, preparedScene]) {
        assert.equal(resolvedScene.sourceFormat, 'kicad')
        assert.equal(
            resolvedScene.detail.tracks.some(
                (track) => track.solderMaskOpening === true
            ),
            false
        )
    }
    assert.equal(
        EcadScene3dService.createModelRegistry(documentModel, []),
        null
    )
})
