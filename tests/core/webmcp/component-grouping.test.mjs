import assert from 'node:assert/strict'
import test from 'node:test'
import {
    ComponentGrouping,
    MPN_MISSING_NOTE
} from '../../../src/core/webmcp/ComponentGrouping.mjs'

/**
 * Verifies grouped component output stays compact and stable.
 */
test('ComponentGrouping groups components by MPN', () => {
    const groups = ComponentGrouping.groupComponentsByMpn(
        [
            [
                'R2',
                {
                    mpn: 'RC0402-1K',
                    description: 'RES 1K 0402',
                    value: '1k',
                    pins: {}
                }
            ],
            [
                'R1',
                {
                    mpn: 'RC0402-1K',
                    description: 'RES 1K 0402',
                    value: '1k',
                    pins: {}
                }
            ],
            ['C1', { description: 'CAP 1UF 0402', value: '1uF', pins: {} }]
        ],
        false
    )

    assert.deepEqual(groups, [
        {
            description: 'CAP 1UF 0402',
            value: '1uF',
            count: 1,
            refdes: 'C1',
            notes: [MPN_MISSING_NOTE]
        },
        {
            mpn: 'RC0402-1K',
            description: 'RES 1K 0402',
            value: '1k',
            count: 2,
            refdes: ['R1', 'R2']
        }
    ])
})

/**
 * Verifies DNS marker detection checks structured component fields.
 */
test('ComponentGrouping detects DNS markers', () => {
    assert.equal(
        ComponentGrouping.isDnsComponent({
            mpn: 'DNS',
            description: '',
            comment: '',
            value: ''
        }),
        true
    )
    assert.equal(
        ComponentGrouping.isDnsComponent({
            mpn: '',
            description: 'Do not populate jumper',
            comment: '',
            value: ''
        }),
        true
    )
    assert.equal(
        ComponentGrouping.isDnsComponent({
            mpn: 'RC0402-10K',
            description: 'RES 10K 0402',
            comment: '',
            value: '10k'
        }),
        false
    )
})

/**
 * Verifies DNS components are excluded unless explicitly requested.
 */
test('ComponentGrouping filters DNS components by default', () => {
    const entries = [
        ['R1', { mpn: 'RC0402-10K', value: '10k', pins: {} }],
        ['R2', { mpn: 'DNP', value: '10k', pins: {} }]
    ]

    assert.deepEqual(
        ComponentGrouping.groupComponentsByMpn(entries, false).map(
            (group) => group.refdes
        ),
        ['R1']
    )
    assert.deepEqual(
        ComponentGrouping.groupComponentsByMpn(entries, true).map(
            (group) => group.refdes
        ),
        ['R2', 'R1']
    )
})
