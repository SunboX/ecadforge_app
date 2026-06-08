import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dDetailCoordinateNormalizer } from '../../src/ui/PcbScene3dDetailCoordinateNormalizer.mjs'

test('PcbScene3dDetailCoordinateNormalizer flips Altium detail Y into viewer space', () => {
    assert.deepEqual(
        PcbScene3dDetailCoordinateNormalizer.normalize(
            {
                sourceFormat: 'altium',
                board: {
                    centerX: 100,
                    centerY: 200
                }
            },
            125,
            160
        ),
        {
            x: 25,
            y: 40
        }
    )
})

test('PcbScene3dDetailCoordinateNormalizer preserves KiCad y-up detail coordinates', () => {
    assert.deepEqual(
        PcbScene3dDetailCoordinateNormalizer.normalize(
            {
                sourceFormat: 'kicad',
                coordinateSystem: 'kicad-3d-y-up',
                board: {
                    centerX: 100,
                    centerY: 200
                }
            },
            125,
            160
        ),
        {
            x: 25,
            y: -40
        }
    )
})

test('PcbScene3dDetailCoordinateNormalizer preserves generic centered coordinates', () => {
    const normalize = PcbScene3dDetailCoordinateNormalizer.create({
        board: {
            centerX: 100,
            centerY: 200
        }
    })

    assert.deepEqual(normalize(125, 160), {
        x: 25,
        y: -40
    })
})
