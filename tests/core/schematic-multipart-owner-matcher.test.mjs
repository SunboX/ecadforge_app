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

/**
 * Verifies passive multipart owners can match when the component placement is
 * anchored on the left outer pin endpoint instead of a bounds corner.
 */
test('collectActiveMultipartOwnerParts matches passive multipart owners by left pin anchor', () => {
    const records = [
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '150',
                'Location.Y': '205',
                PinLength: '10',
                PinConglomerate: '50'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '170',
                'Location.Y': '205',
                PinLength: '10',
                PinConglomerate: '48'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '14',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '150',
                'Location.Y': '200',
                'Corner.X': '170',
                'Corner.Y': '210'
            }
        }
    ]
    const componentRecords = [
        {
            raw: '',
            fields: {
                RECORD: '1',
                IndexInSheet: '27',
                PartCount: '5',
                CurrentPartId: '2',
                'Location.X': '140',
                'Location.Y': '205'
            }
        }
    ]

    const activeOwnerParts =
        SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
            records,
            componentRecords
        )

    assert.equal(activeOwnerParts.get('28'), '2')
})

/**
 * Verifies op-amp style multipart owners still resolve their active part when
 * the component placement lands inside the enclosing owner bounds instead of
 * on one of the existing per-part corner anchors.
 */
test('collectActiveMultipartOwnerParts matches op-amp owners by enclosing owner bounds', () => {
    const records = [
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '44',
                OwnerPartId: '1',
                LocationCount: '5',
                X1: '215',
                Y1: '285',
                X2: '215',
                Y2: '225',
                X3: '255',
                Y3: '245',
                X4: '275',
                Y4: '255',
                X5: '215',
                Y5: '285'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '44',
                OwnerPartId: '2',
                LocationCount: '5',
                X1: '215',
                Y1: '280',
                X2: '215',
                Y2: '220',
                X3: '255',
                Y3: '240',
                X4: '275',
                Y4: '250',
                X5: '215',
                Y5: '280'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '44',
                OwnerPartId: '3',
                LocationCount: '5',
                X1: '210',
                Y1: '280',
                X2: '210',
                Y2: '220',
                X3: '250',
                Y3: '240',
                X4: '270',
                Y4: '250',
                X5: '210',
                Y5: '280'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '44',
                OwnerPartId: '4',
                LocationCount: '5',
                X1: '200',
                Y1: '280',
                X2: '200',
                Y2: '220',
                X3: '240',
                Y3: '240',
                X4: '260',
                Y4: '250',
                X5: '200',
                Y5: '280'
            }
        }
    ]
    const componentRecords = [
        {
            raw: '',
            fields: {
                RECORD: '1',
                IndexInSheet: '62',
                PartCount: '6',
                CurrentPartId: '3',
                'Location.X': '215',
                'Location.Y': '265',
                IsMirrored: 'T'
            }
        }
    ]

    const activeOwnerParts =
        SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
            records,
            componentRecords
        )

    assert.equal(activeOwnerParts.get('44'), '3')
})
