import assert from 'node:assert/strict'
import test from 'node:test'
import { StartupSourceResolver } from '../src/StartupSourceResolver.mjs'

test('StartupSourceResolver resolves demo routes and demo query parameters', () => {
    assert.deepEqual(
        StartupSourceResolver.resolve('https://ecadforge.app/demo/kicad'),
        { type: 'demo', id: 'kicad' }
    )
    assert.deepEqual(
        StartupSourceResolver.resolve('https://ecadforge.app/?demo=altium'),
        { type: 'demo', id: 'altium' }
    )
})

test('StartupSourceResolver recovers bundled demo sources from document-only URLs', () => {
    assert.deepEqual(
        StartupSourceResolver.resolve(
            'https://ecadforge.app/?view=3d&document=RP2040_minimal.kicad_pcb&reload=1.5.43'
        ),
        {
            type: 'demo',
            id: 'kicad',
            view: '3d',
            document: 'RP2040_minimal.kicad_pcb'
        }
    )
    assert.equal(
        StartupSourceResolver.resolve(
            'https://ecadforge.app/?view=3d&document=unknown-board.kicad_pcb'
        ),
        null
    )
})

test('StartupSourceResolver resolves GitHub URL inputs', () => {
    assert.deepEqual(
        StartupSourceResolver.resolve(
            'https://ecadforge.app/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fa%2Fb%2Fmain%2Fboard.kicad_pcb&view=3d&document=Boards%2Fboard.kicad_pcb&panel=layers&component=U2'
        ),
        {
            type: 'url',
            url: 'https://raw.githubusercontent.com/a/b/main/board.kicad_pcb',
            view: '3d',
            document: 'Boards/board.kicad_pcb',
            panel: 'layers',
            component: 'U2'
        }
    )
    assert.deepEqual(
        StartupSourceResolver.resolve(
            'https://ecadforge.app/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fa%2Fb%2Fmain%2Fboard.kicad_pcb&view=pcb&document=Boards%2Fboard.kicad_pcb&net=SENSE_A'
        ),
        {
            type: 'url',
            url: 'https://raw.githubusercontent.com/a/b/main/board.kicad_pcb',
            view: 'pcb',
            document: 'Boards/board.kicad_pcb',
            net: 'SENSE_A'
        }
    )
    assert.deepEqual(
        StartupSourceResolver.resolve(
            'https://ecadforge.app/?github=a/b/hardware/board.kicad_pro&ref=dev&document=Schematics%2Fmain.kicad_sch'
        ),
        {
            type: 'github',
            path: 'a/b/hardware/board.kicad_pro',
            ref: 'dev',
            document: 'Schematics/main.kicad_sch'
        }
    )
})
