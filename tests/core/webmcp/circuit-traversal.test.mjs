import assert from 'node:assert/strict'
import test from 'node:test'
import { CircuitTraversal } from '../../../src/core/webmcp/CircuitTraversal.mjs'

/**
 * Builds a small fake query netlist.
 * @returns {{ nets: object, components: object }}
 */
function createNetlist() {
    return {
        nets: {
            I2C_SDA: {
                U1: '5',
                R1: '2',
                R9: '2'
            },
            PP3V3: {
                R1: '1',
                C1: '1'
            },
            FILTERED_SIG: {
                R9: '1',
                U2: '8'
            },
            GND: {
                C1: '2'
            }
        },
        components: {
            U1: {
                mpn: 'MCU-FAKE-48',
                description: 'IC MCU fake',
                pins: {
                    5: { name: 'SDA', net: 'I2C_SDA' }
                }
            },
            U2: {
                mpn: 'SENSOR-FAKE',
                description: 'IC SENSOR fake',
                pins: {
                    8: { name: 'DIN', net: 'FILTERED_SIG' }
                }
            },
            R1: {
                mpn: 'RC0402-4K7',
                value: '4.7k',
                pins: {
                    1: 'PP3V3',
                    2: 'I2C_SDA'
                }
            },
            R9: {
                mpn: 'RC0402-22R',
                value: '22R',
                pins: {
                    1: 'FILTERED_SIG',
                    2: 'I2C_SDA'
                }
            },
            C1: {
                mpn: 'CC0402-1UF',
                value: '1uF',
                pins: {
                    1: 'PP3V3',
                    2: 'GND'
                }
            }
        }
    }
}

/**
 * Verifies stop-net classification.
 */
test('CircuitTraversal classifies ground and power nets', () => {
    assert.equal(CircuitTraversal.isGroundNet('GND'), true)
    assert.equal(CircuitTraversal.isGroundNet('AGND'), true)
    assert.equal(CircuitTraversal.isPowerNet('PP3V3'), true)
    assert.equal(CircuitTraversal.isPowerNet('+5V'), true)
    assert.equal(CircuitTraversal.isStopNet('I2C_SDA'), false)
})

/**
 * Verifies traversal follows two-pin series passives but does not expand rails.
 */
test('CircuitTraversal follows passives and stops at rails', () => {
    const { nets, components } = createNetlist()
    const result = CircuitTraversal.traverseCircuitFromNet(
        'I2C_SDA',
        nets,
        components
    )

    assert.deepEqual(
        result.components.map((component) => component.refdes),
        ['U1', 'R1', 'R9', 'U2']
    )
    assert.deepEqual(result.visited_nets, ['I2C_SDA', 'PP3V3', 'FILTERED_SIG'])
    assert.equal(
        result.components.some((component) => component.refdes === 'C1'),
        false
    )
})

/**
 * Verifies skip types prevent traversal through matching passives.
 */
test('CircuitTraversal honors skip types', () => {
    const { nets, components } = createNetlist()
    const result = CircuitTraversal.traverseCircuitFromNet(
        'I2C_SDA',
        nets,
        components,
        { skipTypes: ['R'] }
    )

    assert.deepEqual(
        result.components.map((component) => component.refdes),
        ['U1']
    )
    assert.deepEqual(result.visited_nets, ['I2C_SDA'])
    assert.deepEqual(result.skipped, { R: 2 })
})

/**
 * Verifies DNS components are excluded unless requested.
 */
test('CircuitTraversal filters DNS components by default', () => {
    const { nets, components } = createNetlist()
    components.R9.mpn = 'DNP'

    const defaultResult = CircuitTraversal.traverseCircuitFromNet(
        'I2C_SDA',
        nets,
        components
    )
    const dnsResult = CircuitTraversal.traverseCircuitFromNet(
        'I2C_SDA',
        nets,
        components,
        { includeDns: true }
    )

    assert.deepEqual(
        defaultResult.components.map((component) => component.refdes),
        ['U1', 'R1']
    )
    assert.deepEqual(
        dnsResult.components.map((component) => component.refdes),
        ['U1', 'R1', 'R9', 'U2']
    )
})

/**
 * Verifies circuit hashes are stable across equivalent component order.
 */
test('CircuitTraversal computes stable topology hashes', () => {
    const first = [
        { refdes: 'R2', mpn: 'RC', connections: [{ net: 'B', pins: ['2'] }] },
        { refdes: 'R1', mpn: 'RC', connections: [{ net: 'A', pins: ['1'] }] }
    ]
    const second = [first[1], first[0]]

    assert.equal(
        CircuitTraversal.computeCircuitHash(first),
        CircuitTraversal.computeCircuitHash(second)
    )
})
