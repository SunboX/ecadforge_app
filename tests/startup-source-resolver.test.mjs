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

test('StartupSourceResolver resolves GitHub URL inputs', () => {
    assert.deepEqual(
        StartupSourceResolver.resolve(
            'https://ecadforge.app/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fa%2Fb%2Fmain%2Fboard.kicad_pcb'
        ),
        {
            type: 'url',
            url: 'https://raw.githubusercontent.com/a/b/main/board.kicad_pcb'
        }
    )
    assert.deepEqual(
        StartupSourceResolver.resolve(
            'https://ecadforge.app/?github=a/b/hardware/board.kicad_pro&ref=dev'
        ),
        {
            type: 'github',
            path: 'a/b/hardware/board.kicad_pro',
            ref: 'dev'
        }
    )
})
