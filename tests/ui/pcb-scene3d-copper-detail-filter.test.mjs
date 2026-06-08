import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dCopperDetailFilter } from '../../src/ui/PcbScene3dCopperDetailFilter.mjs'

test('PcbScene3dCopperDetailFilter hides KiCad copper covered by solder mask', () => {
    const filtered = PcbScene3dCopperDetailFilter.resolve({
        sourceFormat: 'kicad',
        detail: {
            pads: [{ id: 'pad-a' }],
            tracks: [
                { id: 'covered-track' },
                { id: 'open-track', hasSolderMask: true }
            ],
            arcs: [
                { id: 'covered-arc' },
                { id: 'open-arc', solderMaskExpansion: 2 }
            ],
            copperTexts: [
                { id: 'covered-text' },
                { id: 'open-text', solderMaskOpening: true }
            ],
            vias: [
                { id: 'tented-via' },
                { id: 'open-via', isTentingBottom: false }
            ]
        }
    })

    assert.deepEqual(filtered.pads, [{ id: 'pad-a' }])
    assert.deepEqual(
        filtered.tracks.map((track) => track.id),
        ['open-track']
    )
    assert.deepEqual(
        filtered.arcs.map((arc) => arc.id),
        ['open-arc']
    )
    assert.deepEqual(
        filtered.copperTexts.map((text) => text.id),
        ['open-text']
    )
    assert.deepEqual(
        filtered.vias.map((via) => via.id),
        ['open-via']
    )
    assert.equal(
        PcbScene3dCopperDetailFilter.shouldRenderStandaloneVias({
            sourceFormat: 'kicad'
        }),
        false
    )
    assert.equal(
        PcbScene3dCopperDetailFilter.shouldRenderStandaloneVias({
            sourceFormat: 'kicad',
            detail: {
                vias: [{ id: 'open-via', isTentingBottom: false }]
            }
        }),
        true
    )
    assert.deepEqual(
        PcbScene3dCopperDetailFilter.resolveStandaloneVias({
            sourceFormat: 'kicad',
            detail: {
                vias: [
                    { id: 'tented-via' },
                    { id: 'open-via', isTentingBottom: false }
                ]
            }
        }).map((via) => via.id),
        ['open-via']
    )
})

test('PcbScene3dCopperDetailFilter keeps KiCad copper text with matching mask text', () => {
    const filtered = PcbScene3dCopperDetailFilter.resolve({
        sourceFormat: 'kicad',
        coordinateSystem: 'kicad-3d-y-up',
        board: { centerY: 200 },
        texts: [
            {
                value: 'OPEN_LABEL',
                layer: 'F.Mask',
                side: 'front',
                x: 100,
                y: 275,
                rotation: 0,
                mirrored: false
            }
        ],
        detail: {
            copperTexts: [
                {
                    id: 'open-label',
                    value: 'OPEN_LABEL',
                    layer: 'F.Cu',
                    side: 'front',
                    x: 100,
                    y: 125,
                    rotation: 0,
                    mirrored: false
                },
                {
                    id: 'covered-label',
                    value: 'COVERED_LABEL',
                    layer: 'F.Cu',
                    side: 'front',
                    x: 140,
                    y: 125,
                    rotation: 0,
                    mirrored: false
                }
            ]
        }
    })

    assert.deepEqual(
        filtered.copperTexts.map((text) => text.id),
        ['open-label']
    )
})

test('PcbScene3dCopperDetailFilter keeps KiCad scene-space copper text with matching mask text', () => {
    const filtered = PcbScene3dCopperDetailFilter.resolve({
        sourceFormat: 'kicad',
        coordinateSystem: 'kicad-3d-y-up',
        board: { centerY: 200 },
        texts: [
            {
                value: 'OPEN_LABEL',
                layer: 'F.Mask',
                side: 'front',
                x: 100,
                y: 275,
                rotation: 0,
                mirrored: false
            }
        ],
        detail: {
            copperTexts: [
                {
                    id: 'open-label',
                    value: 'OPEN_LABEL',
                    layer: 'F.Cu',
                    side: 'front',
                    x: 100,
                    y: 275,
                    rotation: 0,
                    mirrored: false
                },
                {
                    id: 'covered-label',
                    value: 'COVERED_LABEL',
                    layer: 'F.Cu',
                    side: 'front',
                    x: 140,
                    y: 275,
                    rotation: 0,
                    mirrored: false
                }
            ]
        }
    })

    assert.deepEqual(
        filtered.copperTexts.map((text) => text.id),
        ['open-label']
    )
})

test('PcbScene3dCopperDetailFilter hides Altium copper covered by solder mask', () => {
    const filtered = PcbScene3dCopperDetailFilter.resolve({
        sourceFormat: 'altium',
        detail: {
            tracks: [
                { id: 'covered-track' },
                { id: 'open-track', hasSolderMask: true }
            ],
            arcs: [
                { id: 'covered-arc' },
                { id: 'open-arc', solderMaskExpansion: 2 }
            ],
            copperTexts: [
                { id: 'covered-text' },
                { id: 'open-text', solderMaskOpening: true }
            ],
            vias: [
                {
                    id: 'tented-via',
                    isTentingTop: true,
                    isTentingBottom: true,
                    solderMaskExpansion: 4
                },
                { id: 'open-via', isTentingTop: false }
            ]
        }
    })

    assert.deepEqual(
        filtered.tracks.map((track) => track.id),
        ['open-track']
    )
    assert.deepEqual(
        filtered.arcs.map((arc) => arc.id),
        ['open-arc']
    )
    assert.deepEqual(
        filtered.copperTexts.map((text) => text.id),
        ['open-text']
    )
    assert.deepEqual(
        filtered.vias.map((via) => via.id),
        ['open-via']
    )
    assert.equal(
        PcbScene3dCopperDetailFilter.shouldRenderStandaloneVias({
            sourceFormat: 'altium'
        }),
        false
    )
    assert.equal(
        PcbScene3dCopperDetailFilter.shouldRenderStandaloneVias({
            sourceFormat: 'altium',
            detail: {
                vias: [{ id: 'open-via', isTentingTop: false }]
            }
        }),
        true
    )
    assert.deepEqual(
        PcbScene3dCopperDetailFilter.resolveStandaloneVias({
            sourceFormat: 'altium',
            detail: {
                vias: [
                    { id: 'tented-via', isTentingTop: true },
                    { id: 'open-via', isTentingTop: false }
                ]
            }
        }).map((via) => via.id),
        ['open-via']
    )
})

test('PcbScene3dCopperDetailFilter keeps scenes without mask metadata unchanged', () => {
    const detail = {
        pads: [
            {
                id: 'pad-a',
                x: 20,
                y: 30,
                sizeTopX: 70,
                sizeTopY: 70,
                holeDiameter: 40
            },
            {
                id: 'mechanical-hole',
                x: 90,
                y: 30,
                holeDiameter: 40
            }
        ],
        tracks: [{ id: 'track-a' }],
        vias: [{ id: 'via-a', x: 50, y: 30, diameter: 32, holeDiameter: 14 }]
    }
    const filtered = PcbScene3dCopperDetailFilter.resolve({
        sourceFormat: 'generic',
        detail
    })

    assert.equal(filtered, detail)
    assert.equal(
        PcbScene3dCopperDetailFilter.shouldRenderStandaloneVias({
            sourceFormat: 'generic'
        }),
        true
    )
    assert.deepEqual(
        PcbScene3dCopperDetailFilter.resolveStandaloneVias({
            sourceFormat: 'generic',
            detail
        }),
        [
            { id: 'via-a', x: 50, y: 30, diameter: 32, holeDiameter: 14 },
            {
                x: 20,
                y: 30,
                holeDiameter: 40,
                barrelOnly: true
            }
        ]
    )
})
