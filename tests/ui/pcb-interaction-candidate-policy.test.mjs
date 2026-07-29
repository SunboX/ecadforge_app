import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionCandidatePolicy } from '../../src/ui/PcbInteractionCandidatePolicy.mjs'

test('PcbInteractionCandidatePolicy retains only semantic PCB selections in source order', () => {
    const component = { kind: 'component', componentKey: 'U1' }
    const track = { type: 'track', netName: 'SIG' }
    const trace = { role: 'trace', netName: 'CLK' }
    const pad = { kind: 'pad', componentKey: 'U1', netName: 'SIG' }
    const via = { kind: 'via', netName: 'SIG' }
    const candidates = [
        { kind: 'zone', netName: 'GND' },
        component,
        { kind: 'silkscreen', componentKey: 'U1' },
        track,
        { kind: 'silkscreen_text', componentKey: 'U1' },
        trace,
        { kind: 'text', componentKey: 'U1' },
        pad,
        { kind: 'region', netName: 'GND' },
        via
    ]

    assert.deepEqual(PcbInteractionCandidatePolicy.filter(candidates), [
        component,
        track,
        trace,
        pad,
        via
    ])
})

test('PcbInteractionCandidatePolicy maps unambiguous Gerber fabrication primitives', () => {
    const copperLine = {
        sourceFormat: 'gerber',
        role: 'top-copper',
        kind: 'line'
    }
    const copperArc = {
        sourceFormat: 'gerber',
        role: 'bottom-copper',
        kind: 'arc'
    }
    const copperFlash = {
        sourceFormat: 'gerber',
        role: 'top-copper',
        kind: 'flash'
    }
    const drill = {
        sourceFormat: 'gerber',
        role: 'plated-drill',
        kind: 'drill'
    }
    const slot = {
        sourceFormat: 'gerber',
        role: 'plated-drill',
        kind: 'slot'
    }

    assert.deepEqual(
        PcbInteractionCandidatePolicy.filter([
            copperLine,
            {
                sourceFormat: 'gerber',
                role: 'top-silkscreen',
                kind: 'line'
            },
            copperArc,
            {
                sourceFormat: 'gerber',
                role: 'top-copper',
                kind: 'region'
            },
            copperFlash,
            drill,
            slot
        ]),
        [copperLine, copperArc, copperFlash, drill, slot]
    )
})

test('PcbInteractionCandidatePolicy rejects track-shaped non-copper artwork', () => {
    const copperTrack = {
        type: 'track',
        layerKeys: ['Top Layer'],
        netName: 'SIG'
    }
    const internalTrack = {
        type: 'track',
        layerKeys: ['Internal Plane 2'],
        netName: 'POWER'
    }

    assert.deepEqual(
        PcbInteractionCandidatePolicy.filter([
            {
                type: 'track',
                layerKeys: ['Top Overlay'],
                componentKey: 'U1',
                netName: 'STALE_NET'
            },
            {
                type: 'track',
                layerKeys: ['Mechanical 13'],
                componentKey: 'U1',
                netName: 'STALE_NET'
            },
            {
                type: 'track',
                layerKeys: ['F.SilkS'],
                componentKey: 'U2'
            },
            copperTrack,
            internalTrack
        ]),
        [copperTrack, internalTrack]
    )
})

test('PcbInteractionCandidatePolicy rejects invalid candidate input', () => {
    assert.deepEqual(PcbInteractionCandidatePolicy.filter(), [])
    assert.deepEqual(
        PcbInteractionCandidatePolicy.filter([
            null,
            {},
            { kind: 'board' },
            { kind: 'ground-plane', netName: 'GND' }
        ]),
        []
    )
})
