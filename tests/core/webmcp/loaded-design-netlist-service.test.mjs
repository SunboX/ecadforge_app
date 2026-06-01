import assert from 'node:assert/strict'
import test from 'node:test'
import { LoadedDesignNetlistService } from '../../../src/core/webmcp/LoadedDesignNetlistService.mjs'

/**
 * Builds a service over fake loaded documents.
 * @param {object[]} documents Document entries.
 * @param {string} [activeDocumentId] Active document id.
 * @returns {LoadedDesignNetlistService}
 */
function createService(documents, activeDocumentId = 'doc-1') {
    return new LoadedDesignNetlistService({
        getSnapshot: () => ({
            documents,
            activeDocumentId,
            documentModel:
                documents.find((entry) => entry.id === activeDocumentId)
                    ?.documentModel || null
        })
    })
}

/**
 * Builds one fake schematic document with component metadata and nets.
 * @param {string} fileName Loaded file name.
 * @param {string} [sourceFormat] Source format override.
 * @returns {object}
 */
function createSchematicDocument(fileName = 'logic.SchDoc', sourceFormat) {
    return {
        sourceFormat,
        fileName,
        kind: 'schematic',
        summary: { title: 'Logic Sheet', componentCount: 3 },
        schematic: {
            components: [
                {
                    designator: 'U1',
                    ownerIndex: '100',
                    libReference: 'MCU_FAKE',
                    value: 'controller'
                },
                {
                    designator: 'R1',
                    ownerIndex: '200',
                    libReference: 'RES_FAKE',
                    value: '4.7k'
                },
                {
                    designator: 'C1',
                    ownerIndex: '300',
                    libReference: 'CAP_FAKE',
                    value: '1uF'
                }
            ],
            nets: [
                {
                    name: 'I2C_SDA',
                    pins: [
                        {
                            refdes: 'U1',
                            designator: '5',
                            name: 'SDA'
                        },
                        {
                            refdes: 'R1',
                            designator: '2',
                            name: '2'
                        }
                    ]
                },
                {
                    name: 'PP3V3',
                    pins: [
                        {
                            refdes: 'U1',
                            designator: '3',
                            name: 'VDD'
                        },
                        {
                            refdes: 'R1',
                            designator: '1',
                            name: '1'
                        },
                        {
                            refdes: 'C1',
                            designator: '1',
                            name: '1'
                        }
                    ]
                },
                {
                    name: 'GND',
                    pins: [
                        {
                            refdes: 'C1',
                            designator: '2',
                            name: '2'
                        }
                    ]
                }
            ]
        },
        bom: [
            {
                designators: ['U1'],
                quantity: 1,
                pattern: 'MCU-FAKE-48',
                source: 'IC MCU fake 48QFN',
                value: 'controller'
            },
            {
                designators: ['R1'],
                quantity: 1,
                pattern: 'RC0402-4K7',
                source: 'RES 4.7K 0402',
                value: '4.7k'
            },
            {
                designators: ['C1'],
                quantity: 1,
                pattern: 'CC0402-1UF',
                source: 'CAP 1UF 0402',
                value: '1uF'
            }
        ]
    }
}

/**
 * Verifies design listing returns only currently loaded documents.
 */
test('LoadedDesignNetlistService lists loaded designs', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(service.listDesigns(), [
        {
            id: 'doc-1',
            name: 'Logic Sheet',
            fileName: 'logic.SchDoc',
            kind: 'schematic',
            active: true,
            hasConnectivity: true
        }
    ])
})

/**
 * Verifies design lookup accepts active id, exact file names, and base names.
 */
test('LoadedDesignNetlistService resolves loaded design aliases', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument('logic.SchDoc') },
        { id: 'doc-2', documentModel: createSchematicDocument('power.SchDoc') }
    ])

    assert.deepEqual(service.listNets({ design: 'active' }).nets, [
        'GND',
        'I2C_SDA',
        'PP3V3'
    ])
    assert.deepEqual(service.listNets({ design: 'doc-2' }).nets, [
        'GND',
        'I2C_SDA',
        'PP3V3'
    ])
    assert.deepEqual(service.listNets({ design: 'power.SchDoc' }).nets, [
        'GND',
        'I2C_SDA',
        'PP3V3'
    ])
    assert.deepEqual(service.listNets({ design: 'power' }).nets, [
        'GND',
        'I2C_SDA',
        'PP3V3'
    ])
})

/**
 * Verifies ambiguous design names return a structured error.
 */
test('LoadedDesignNetlistService rejects ambiguous design aliases', () => {
    const service = createService([
        {
            id: 'doc-1',
            documentModel: createSchematicDocument('duplicate.SchDoc')
        },
        {
            id: 'doc-2',
            documentModel: createSchematicDocument('duplicate.kicad_sch')
        }
    ])

    assert.match(service.listNets({ design: 'duplicate' }).error, /ambiguous/)
})

/**
 * Verifies component and net search operate on loaded schematic metadata.
 */
test('LoadedDesignNetlistService searches loaded components and nets', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(service.searchNets({ pattern: 'i2c' }), {
        results: { 'Logic Sheet': ['I2C_SDA'] }
    })
    assert.deepEqual(service.searchComponentsByMpn({ pattern: 'MCU' }), {
        results: {
            'Logic Sheet': [
                {
                    mpn: 'MCU-FAKE-48',
                    description: 'IC MCU fake 48QFN',
                    value: 'controller',
                    count: 1,
                    refdes: 'U1'
                }
            ]
        }
    })
    assert.deepEqual(service.listComponents({ type: 'R' }), {
        components: [
            {
                mpn: 'RC0402-4K7',
                description: 'RES 4.7K 0402',
                value: '4.7k',
                count: 1,
                refdes: 'R1'
            }
        ]
    })
})

/**
 * Verifies query_component returns pin names when they add information.
 */
test('LoadedDesignNetlistService queries component details', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(service.queryComponent({ refdes: 'u1' }), {
        refdes: 'U1',
        mpn: 'MCU-FAKE-48',
        description: 'IC MCU fake 48QFN',
        value: 'controller',
        pins: {
            3: { name: 'VDD', net: 'PP3V3' },
            5: { name: 'SDA', net: 'I2C_SDA' }
        }
    })
})

/**
 * Verifies extended net queries return aggregated circuit summaries.
 */
test('LoadedDesignNetlistService queries extended nets by net name', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])
    const result = service.queryXnetByNetName({ net_name: 'I2C_SDA' })

    assert.equal(result.starting_point, 'I2C_SDA')
    assert.equal(result.total_components, 2)
    assert.equal(result.unique_configurations, 2)
    assert.deepEqual(result.visited_nets, ['I2C_SDA', 'PP3V3'])
    assert.equal(result.circuit_hash.length, 16)
    assert.deepEqual(
        result.components_by_mpn.map((component) => component.refdes),
        ['U1', 'R1']
    )
})

/**
 * Verifies extended net queries can start from a component pin.
 */
test('LoadedDesignNetlistService queries extended nets by pin name', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])
    const result = service.queryXnetByPinName({ pin_name: 'u1.5' })

    assert.equal(result.starting_point, 'U1.5')
    assert.equal(result.net, 'I2C_SDA')
    assert.equal(result.total_components, 2)
    assert.deepEqual(result.visited_nets, ['I2C_SDA', 'PP3V3'])
})

/**
 * Verifies extended net queries reject ground and power starts.
 */
test('LoadedDesignNetlistService blocks stop-net traversal starts', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.match(
        service.queryXnetByNetName({ net_name: 'GND' }).error,
        /cannot be queried/
    )
    assert.match(
        service.queryXnetByPinName({ pin_name: 'C1.2' }).error,
        /cannot be queried/
    )
})

/**
 * Verifies PCB-only documents return useful connectivity errors.
 */
test('LoadedDesignNetlistService handles PCB-only documents without connectivity', () => {
    const service = createService([
        {
            id: 'doc-1',
            documentModel: {
                fileName: 'board.PcbDoc',
                kind: 'pcb',
                summary: { title: 'Board' },
                pcb: {
                    components: [{ designator: 'U1', pattern: 'QFN48' }]
                },
                bom: []
            }
        }
    ])

    assert.match(service.listNets().error, /No schematic connectivity/)
})

/**
 * Verifies app-level dispatch rejects unsupported loaded document formats.
 */
test('LoadedDesignNetlistService rejects unsupported source formats', () => {
    const service = createService([
        {
            id: 'doc-1',
            documentModel: createSchematicDocument('logic.fake', 'unknown')
        }
    ])

    assert.match(service.listNets().error, /Unsupported ECAD source format/)
})
