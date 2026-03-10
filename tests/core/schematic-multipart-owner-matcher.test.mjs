import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicMultipartOwnerMatcher } from '../../src/core/altium/SchematicMultipartOwnerMatcher.mjs'

/**
 * Verifies mirrored multipart symbols still resolve their active owner part
 * when the component anchor lands on the top-right corner instead of the
 * top-left corner of the visible part bounds.
 */
test('collectActiveMultipartOwnerParts matches mirrored multipart owners by full bounds', () => {
    const records = [
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '28',
                OwnerPartId: '6',
                LocationCount: '4',
                X1: '520',
                Y1: '620',
                X2: '600',
                Y2: '620',
                X3: '600',
                Y3: '980',
                X4: '520',
                Y4: '980'
            }
        }
    ]
    const componentRecords = [
        {
            raw: '',
            fields: {
                RECORD: '1',
                IndexInSheet: '27',
                PartCount: '11',
                CurrentPartId: '6',
                'Location.X': '600',
                'Location.Y': '620',
                IsMirrored: 'T'
            }
        }
    ]

    const activeOwnerParts =
        SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
            records,
            componentRecords
        )

    assert.equal(activeOwnerParts.get('28'), '6')
})
