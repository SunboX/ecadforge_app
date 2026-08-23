import assert from 'node:assert/strict'
import test from 'node:test'

import { SchematicSvgRenderer } from 'altium-toolkit/extensions'

/**
 * Creates a generic schematic containing native frame, harness, and rotated
 * passive annotation data.
 * @returns {Record<string, any>} Renderer model.
 */
function createSchematicFidelityModel() {
    return {
        summary: { title: 'Generic fidelity schematic' },
        schematic: {
            sheet: {
                width: 340,
                height: 170,
                sourceWidth: 300,
                sourceHeight: 220,
                marginWidth: 20,
                borderOn: true,
                titleBlockOn: false,
                paperSize: 'A3'
            },
            lines: [
                {
                    x1: 200,
                    y1: 40,
                    x2: 280,
                    y2: 40,
                    ownerIndex: '1',
                    color: '#000080',
                    width: 1
                }
            ],
            polygons: [],
            rectangles: [
                {
                    x: 100,
                    y: 70,
                    width: 8,
                    height: 30,
                    ownerIndex: '42',
                    color: '#000080',
                    fill: '#ffff80',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                }
            ],
            roundedRectangles: [],
            ellipses: [],
            arcs: [],
            pies: [],
            texts: [
                {
                    x: 205,
                    y: 150,
                    text: '=organization',
                    rawText: '=organization',
                    resolvedText: '=organization',
                    specialString: {
                        rawText: '=organization',
                        resolvedText: '=organization',
                        parameterNames: ['organization'],
                        expressionParts: [
                            {
                                kind: 'parameter',
                                name: 'organization',
                                value: '=organization'
                            }
                        ]
                    },
                    ownerIndex: '1',
                    recordType: '4',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 0,
                    anchor: 'start'
                },
                {
                    x: 99,
                    y: 70,
                    text: 'R42',
                    ownerIndex: '42',
                    recordType: '34',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                },
                {
                    x: 109,
                    y: 70,
                    text: '62R',
                    ownerIndex: '42',
                    recordType: '41',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                },
                {
                    x: 119,
                    y: 70,
                    text: '0.5W',
                    ownerIndex: '42',
                    recordType: '41',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 90,
                    anchor: 'start'
                },
                {
                    x: 75,
                    y: 145,
                    text: 'PAIR_BUS',
                    recordType: '217',
                    color: '#000080',
                    fontSize: 10,
                    rotation: 0,
                    anchor: 'start'
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            harnesses: {
                connectors: [
                    {
                        key: 'harness-connector-9',
                        recordKey: 'schematic-record-9',
                        x: 40,
                        y: 140,
                        width: 70,
                        height: 40,
                        side: 'left',
                        primaryConnectionPosition: 20,
                        lineWidth: 1,
                        color: '#9fc5e8',
                        fill: '#ffffff'
                    }
                ],
                signalHarnesses: [
                    {
                        points: [
                            { x: 20, y: 120 },
                            { x: 40, y: 120 }
                        ],
                        color: '#9fc5e8',
                        lineWidth: 2
                    }
                ],
                bundleLinks: []
            },
            ownership: {
                records: [
                    {
                        key: 'schematic-record-1',
                        recordIndex: 1,
                        recordType: '31',
                        fields: { RECORD: '31', SHEETSTYLE: '1' }
                    },
                    {
                        key: 'schematic-record-2',
                        recordIndex: 2,
                        recordType: '4',
                        ownerIndex: '1',
                        fields: {
                            RECORD: '4',
                            OWNERINDEX: '1',
                            'LOCATION.X': '210',
                            'LOCATION.Y': '50'
                        }
                    },
                    {
                        key: 'schematic-record-3',
                        recordIndex: 3,
                        recordType: '41',
                        fields: {
                            RECORD: '41',
                            NAME: 'Organization',
                            TEXT: 'OBSERVATORY GROUP'
                        }
                    },
                    {
                        key: 'schematic-record-9',
                        recordIndex: 9,
                        recordType: '215',
                        fields: { RECORD: '215' }
                    },
                    {
                        key: 'schematic-record-10',
                        recordIndex: 10,
                        recordType: '216',
                        fields: {
                            RECORD: '216',
                            OWNERINDEXADDITIONALLIST: 'T',
                            NAME: 'PAIR_P',
                            SIDE: '1',
                            DISTANCEFROMTOP: '1',
                            HARNESSTYPE: 'PAIR_BUS',
                            TEXTCOLOR: '128'
                        }
                    },
                    {
                        key: 'schematic-record-11',
                        recordIndex: 11,
                        recordType: '216',
                        fields: {
                            RECORD: '216',
                            OWNERINDEXADDITIONALLIST: 'T',
                            NAME: 'PAIR_N',
                            SIDE: '1',
                            DISTANCEFROMTOP: '3',
                            HARNESSTYPE: 'PAIR_BUS',
                            TEXTCOLOR: '128'
                        }
                    },
                    {
                        key: 'schematic-record-12',
                        recordIndex: 12,
                        recordType: '217',
                        fields: {
                            RECORD: '217',
                            OWNERINDEXADDITIONALLIST: 'T',
                            'LOCATION.X': '65',
                            'LOCATION.Y': '145',
                            TEXT: 'PAIR_BUS',
                            COLOR: '128'
                        }
                    }
                ]
            }
        }
    }
}

test('published Altium renderer restores complete schematic fidelity', () => {
    const markup = SchematicSvgRenderer.render(createSchematicFidelityModel(), {
        projectParameters: {
            CurrentDate: '1/2/2026',
            DocumentName: 'neutral.SchDoc'
        }
    })

    assert.match(markup, /viewBox="0 0 300 220"/u)
    assert.match(markup, /class="schematic-signal-harness"/u)
    assert.match(markup, /class="schematic-harness-connector"/u)
    assert.match(markup, /class="schematic-harness-entry"/u)
    assert.match(markup, />PAIR_P</u)
    assert.match(markup, />PAIR_N</u)
    assert.match(markup, /class="schematic-harness-type"/u)
    assert.match(markup, />PAIR_BUS</u)
    assert.match(markup, /stroke="var\(--schematic-accent-ink-color\)"/u)
    assert.match(markup, /class="schematic-signal-harness__rail"/u)
    assert.match(markup, /class="schematic-signal-harness__mark"/u)
    assert.match(markup, /class="schematic-harness-connector__bracket"/u)
    assert.match(markup, /fill="var\(--schematic-pin-marker-fill\)"/u)
    assert.doesNotMatch(markup, /#9fc5e8/iu)
    assert.match(markup, />OBSERVATORY GROUP</u)
    assert.doesNotMatch(markup, />=organization</u)
    assert.match(markup, /class="schematic-label" x="99"[^>]*>R42</u)
    assert.match(markup, /class="schematic-label" x="118"[^>]*>62R</u)
    assert.match(markup, /class="schematic-label" x="128"[^>]*>0\.5W</u)
})
