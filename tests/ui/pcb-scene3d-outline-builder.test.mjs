import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dOutlineBuilder } from '../../src/ui/PcbScene3dOutlineBuilder.mjs'

/**
 * Verifies the 3D outline builder traces rounded board corners from the
 * ordered segment endpoints instead of trusting reversed serialized arc
 * angles, and drops negligible connector lines that destabilize filling.
 */
test('PcbScene3dOutlineBuilder keeps rounded board corners ordered and stable', () => {
    const commands = PcbScene3dOutlineBuilder.buildCommands({
        centerX: 500,
        centerY: 500,
        segments: [
            { type: 'line', x1: 0, y1: 900, x2: 0, y2: 120 },
            { type: 'line', x1: 0, y1: 120, x2: 0.0002, y2: 120 },
            {
                type: 'arc',
                x1: 0.0002,
                y1: 120,
                x2: 120,
                y2: 0.0002,
                cx: 120,
                cy: 120,
                radius: 120,
                startAngle: 270,
                endAngle: 180
            },
            { type: 'line', x1: 120, y1: 0.0002, x2: 880, y2: 0.0003 },
            {
                type: 'arc',
                x1: 880,
                y1: 0.0003,
                x2: 999.9998,
                y2: 120,
                cx: 880,
                cy: 120,
                radius: 120,
                startAngle: 359.9999,
                endAngle: 269.9999
            },
            { type: 'line', x1: 999.9998, y1: 120, x2: 1000, y2: 900 },
            {
                type: 'arc',
                x1: 1000,
                y1: 900,
                x2: 880,
                y2: 1020,
                cx: 880,
                cy: 900,
                radius: 120,
                startAngle: 90,
                endAngle: 0
            },
            { type: 'line', x1: 880, y1: 1020, x2: 120, y2: 1020 },
            {
                type: 'arc',
                x1: 120,
                y1: 1020,
                x2: 0,
                y2: 900,
                cx: 120,
                cy: 900,
                radius: 120,
                startAngle: 180,
                endAngle: 90
            },
            { type: 'line', x1: 0, y1: 900, x2: 0, y2: 900 }
        ]
    })

    assert.equal(commands[0]?.type, 'move')
    assert.equal(
        commands.filter((command) => command.type === 'arc').length,
        4
    )
    assert.equal(
        commands.filter((command) => command.type === 'line').length,
        4
    )

    const firstArc = commands.find((command) => command.type === 'arc')
    assert.ok(firstArc)
    assert.equal(firstArc?.clockwise, false)
    assert.ok(Math.abs((firstArc?.startAngleRad || 0) - Math.PI) < 0.001)
    assert.ok(
        Math.abs((firstArc?.endAngleRad || 0) + Math.PI / 2) < 0.001
    )
})
