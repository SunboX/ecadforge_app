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
})

test('PcbScene3dCopperDetailFilter keeps scenes without mask metadata unchanged', () => {
    const detail = {
        tracks: [{ id: 'track-a' }],
        vias: [{ id: 'via-a' }]
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
})
