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
 * Builds one fake PCB document with pad-level net references.
 * @param {string} fileName Loaded file name.
 * @param {string} [sourceFormat] Source format override.
 * @returns {object}
 */
function createPcbDocument(fileName = 'logic.PcbDoc', sourceFormat) {
    return {
        sourceFormat,
        fileName,
        kind: 'pcb',
        summary: { title: 'Logic Board', componentCount: 3 },
        pcb: {
            components: [
                {
                    designator: 'U1',
                    pattern: 'MCU-FAKE-48',
                    pads: [
                        { designator: '5', net: 'I2C_SDA' },
                        { designator: '3', net: 'PP3V3' }
                    ]
                },
                {
                    designator: 'R1',
                    pattern: 'RC0402-4K7',
                    pads: [
                        { designator: '2', net: 'I2C_SDA' },
                        { designator: '1', net: 'PP3V3' }
                    ]
                },
                {
                    designator: 'C1',
                    pattern: 'CC0402-1UF',
                    pads: [
                        { designator: '1', net: 'PP3V3' },
                        { designator: '2', net: 'GND' }
                    ]
                }
            ],
            nets: [
                {
                    name: 'I2C_SDA',
                    pads: [
                        { refdes: 'U1', designator: '5' },
                        { refdes: 'R1', designator: '2' }
                    ]
                },
                {
                    name: 'PP3V3',
                    pads: [
                        { refdes: 'U1', designator: '3' },
                        { refdes: 'R1', designator: '1' },
                        { refdes: 'C1', designator: '1' }
                    ]
                },
                {
                    name: 'GND',
                    pads: [{ refdes: 'C1', designator: '2' }]
                }
            ]
        },
        bom: []
    }
}

/**
 * Verifies app-owned queries stop at a pre-aborted execution boundary.
 */
test('LoadedDesignNetlistService aborts app-owned queries before work', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])
    const controller = new AbortController()
    const reason = new Error('browser cancelled query')
    controller.abort(reason)

    assert.throws(
        () => service.reviewDesign({}, { signal: controller.signal }),
        (error) => error === reason
    )
    assert.throws(
        () => service.reviewDesign({}, { signal: { aborted: true } }),
        /AbortSignal/
    )
})

/**
 * Verifies toolkit-backed queries receive the browser execution signal.
 */
test('LoadedDesignNetlistService forwards execution context to toolkits', () => {
    const controller = new AbortController()
    const calls = []

    class FakeLoadedDesignService {
        /**
         * @param {object} _dependencies Dependencies.
         */
        constructor(_dependencies) {}

        /**
         * @param {object} args Query args.
         * @param {object} executionOptions Execution options.
         * @returns {{ components: object[] }}
         */
        listComponents(args, executionOptions) {
            calls.push({ args, executionOptions })
            return { components: [] }
        }
    }

    const service = new LoadedDesignNetlistService({
        getSnapshot: () => ({
            activeDocumentId: 'doc-1',
            documents: [
                { id: 'doc-1', documentModel: createSchematicDocument() }
            ]
        }),
        serviceFactories: { altium: FakeLoadedDesignService }
    })

    assert.deepEqual(
        service.listComponents({}, { signal: controller.signal }),
        { components: [] }
    )
    assert.deepEqual(calls, [
        {
            args: { design: 'active' },
            executionOptions: { signal: controller.signal }
        }
    ])
})

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
 * Verifies component and net list responses can be bounded for agents.
 */
test('LoadedDesignNetlistService paginates compact list responses', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(
        service.listComponents({
            type: 'R',
            compact: true,
            limit: 1,
            offset: 0
        }),
        {
            components: [
                {
                    refdes: 'R1',
                    mpn: 'RC0402-4K7',
                    value: '4.7k',
                    count: 1
                }
            ],
            total_count: 1,
            returned_count: 1,
            offset: 0,
            limit: 1,
            has_more: false
        }
    )
    assert.deepEqual(service.listNets({ limit: 2, offset: 1 }), {
        nets: ['I2C_SDA', 'PP3V3'],
        total_count: 3,
        returned_count: 2,
        offset: 1,
        limit: 2,
        has_more: false
    })
})

/**
 * Verifies design review returns agent-friendly session coverage.
 */
test('LoadedDesignNetlistService reviews loaded design coverage', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.reviewDesign(), {
        summary: {
            loaded_designs: 2,
            supported_designs: 2,
            components: 6,
            nets: 6,
            diagnostics: 0,
            designs_with_connectivity: 2
        },
        metadata_coverage: {
            components: 3,
            with_mpn: 3,
            missing_mpn: 0,
            with_description: 3,
            missing_description: 0,
            with_value: 3,
            missing_value: 0,
            with_footprint: 3,
            missing_footprint: 0
        },
        designs: [
            {
                id: 'doc-1',
                name: 'Logic Sheet',
                fileName: 'logic.SchDoc',
                kind: 'schematic',
                sourceFormat: 'altium',
                active: true,
                components: 3,
                nets: 3,
                diagnostics: 0,
                hasConnectivity: true
            },
            {
                id: 'doc-2',
                name: 'Logic Board',
                fileName: 'logic.PcbDoc',
                kind: 'pcb',
                sourceFormat: 'altium',
                active: false,
                components: 3,
                nets: 3,
                diagnostics: 0,
                hasConnectivity: true
            }
        ],
        top_issues: []
    })
})

/**
 * Verifies audit_design surfaces parser, metadata, and connectivity issues.
 */
test('LoadedDesignNetlistService audits loaded design issues', () => {
    const documentModel = createSchematicDocument()
    documentModel.diagnostics = [
        {
            severity: 'warning',
            message: 'A fake parser warning.'
        }
    ]
    documentModel.schematic.components.push({
        designator: 'R1',
        value: ''
    })
    documentModel.bom[1].pattern = ''
    documentModel.bom[1].source = ''

    const service = createService([{ id: 'doc-1', documentModel }])
    const result = service.auditDesign()

    assert.deepEqual(result.summary, {
        designs: 1,
        issue_count: 6,
        errors: 0,
        warnings: 6,
        info: 0
    })
    assert.deepEqual(
        result.issues.map((issue) => issue.code),
        [
            'parser.diagnostic',
            'component.duplicate_refdes',
            'metadata.missing_mpn',
            'metadata.missing_description',
            'connectivity.single_pin_net',
            'metadata.missing_footprint'
        ]
    )
})

/**
 * Verifies crossref_net compares schematic pins to PCB pads.
 */
test('LoadedDesignNetlistService cross-references nets across schematic and PCB', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.crossrefNet({ net_name: 'i2c_sda' }), {
        net: 'I2C_SDA',
        status: 'matched',
        schematic: {
            design: 'Logic Sheet',
            pins: ['R1.2', 'U1.5'],
            pin_count: 2
        },
        pcb: {
            design: 'Logic Board',
            pads: ['R1.2', 'U1.5'],
            pad_count: 2
        },
        matched: ['R1.2', 'U1.5'],
        missing_on_pcb: [],
        missing_on_schematic: []
    })
})

/**
 * Verifies query_bom_item finds normalized BOM rows by refdes and MPN.
 */
test('LoadedDesignNetlistService queries BOM items', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(service.queryBomItem({ refdes: 'r1' }), {
        items: [
            {
                design: 'Logic Sheet',
                refdes: 'R1',
                designators: ['R1'],
                quantity: 1,
                mpn: 'RC0402-4K7',
                description: 'RES 4.7K 0402',
                value: '4.7k',
                footprint: 'RC0402-4K7'
            }
        ],
        total_count: 1
    })
    assert.deepEqual(service.queryBomItem({ mpn: 'MCU' }).items[0].refdes, 'U1')
})

/**
 * Verifies list_pin_connections returns compact pin/net rows.
 */
test('LoadedDesignNetlistService lists component pin connections', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(service.listPinConnections({ refdes: 'u1' }), {
        refdes: 'U1',
        design: 'Logic Sheet',
        pins: [
            { pin: '3', name: 'VDD', net: 'PP3V3' },
            { pin: '5', name: 'SDA', net: 'I2C_SDA' }
        ],
        pin_count: 2
    })
})

/**
 * Verifies compare_schematic_pcb reports all-net schematic/PCB mismatches.
 */
test('LoadedDesignNetlistService compares schematic and PCB connectivity', () => {
    const pcb = createPcbDocument()
    pcb.pcb.nets[0].pads = [{ refdes: 'U1', designator: '5' }]
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: pcb }
    ])

    assert.deepEqual(service.compareSchematicPcb(), {
        status: 'mismatch',
        schematic: 'Logic Sheet',
        pcb: 'Logic Board',
        summary: {
            compared_nets: 3,
            matched_nets: 2,
            mismatched_nets: 1,
            schematic_only_nets: 0,
            pcb_only_nets: 0
        },
        mismatches: [
            {
                net: 'I2C_SDA',
                missing_on_pcb: ['R1.2'],
                missing_on_schematic: []
            }
        ]
    })
})

/**
 * Verifies summarize_design returns an agent-friendly session narrative.
 */
test('LoadedDesignNetlistService summarizes loaded design state', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.summarizeDesign(), {
        summary:
            '2 supported designs loaded: 6 components, 6 nets, 0 diagnostics, and 1 audit issues.',
        highlights: [
            'Active design: Logic Sheet (logic.SchDoc).',
            'Connectivity is available for 2 designs.',
            'Metadata coverage: 3/3 components have MPNs and 3/3 have footprints.'
        ],
        next_steps: [
            'Use compare_schematic_pcb to check schematic and PCB net parity.',
            'Use audit_design for parser, metadata, and connectivity issues.',
            'Use find_components to locate parts by refdes, MPN, value, description, or footprint.'
        ]
    })
})

/**
 * Verifies find_components searches across common metadata fields.
 */
test('LoadedDesignNetlistService finds components across metadata fields', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.findComponents({ query: '0402', limit: 2 }), {
        components: [
            {
                design: 'Logic Sheet',
                refdes: 'C1',
                mpn: 'CC0402-1UF',
                description: 'CAP 1UF 0402',
                value: '1uF',
                footprint: 'CC0402-1UF',
                matched_fields: ['mpn', 'description', 'footprint']
            },
            {
                design: 'Logic Sheet',
                refdes: 'R1',
                mpn: 'RC0402-4K7',
                description: 'RES 4.7K 0402',
                value: '4.7k',
                footprint: 'RC0402-4K7',
                matched_fields: ['mpn', 'description', 'footprint']
            }
        ],
        total_count: 2,
        returned_count: 2,
        limit: 2,
        has_more: false
    })
})

/**
 * Verifies query_net returns direct net membership without traversal.
 */
test('LoadedDesignNetlistService queries direct net membership', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(service.queryNet({ net_name: 'pp3v3' }), {
        net: 'PP3V3',
        design: 'Logic Sheet',
        components: ['C1', 'R1', 'U1'],
        pins: [
            { refdes: 'C1', pin: '1' },
            { refdes: 'R1', pin: '1' },
            { refdes: 'U1', pin: '3', name: 'VDD' }
        ],
        pin_count: 3
    })
})

/**
 * Verifies list_component_types returns reference-designator prefix counts.
 */
test('LoadedDesignNetlistService lists component type counts', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(service.listComponentTypes(), {
        designs: 1,
        total_components: 3,
        types: [
            { type: 'C', count: 1 },
            { type: 'R', count: 1 },
            { type: 'U', count: 1 }
        ]
    })
})

/**
 * Verifies list_diagnostics returns parser diagnostics directly.
 */
test('LoadedDesignNetlistService lists parser diagnostics', () => {
    const documentModel = createSchematicDocument()
    documentModel.diagnostics = [
        {
            severity: 'warning',
            message: 'A fake parser warning.'
        }
    ]
    const service = createService([{ id: 'doc-1', documentModel }])

    assert.deepEqual(service.listDiagnostics(), {
        diagnostics: [
            {
                design: 'Logic Sheet',
                severity: 'warning',
                message: 'A fake parser warning.'
            }
        ],
        total_count: 1
    })
})

/**
 * Verifies compare_bom_pcb reports missing and mismatched placements.
 */
test('LoadedDesignNetlistService compares BOM and PCB component coverage', () => {
    const pcb = createPcbDocument()
    pcb.pcb.components = [
        { designator: 'U1', pattern: 'MCU-FAKE-48' },
        { designator: 'R1', pattern: 'RC0402-10K' },
        { designator: 'J1', pattern: 'CONN-FAKE' }
    ]
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: pcb }
    ])

    assert.deepEqual(service.compareBomPcb(), {
        status: 'mismatch',
        bom: 'Logic Sheet',
        pcb: 'Logic Board',
        summary: {
            bom_components: 3,
            pcb_components: 3,
            matched_components: 1,
            missing_on_pcb: 1,
            pcb_only_components: 1,
            footprint_mismatches: 1
        },
        missing_on_pcb: ['C1'],
        pcb_only_components: ['J1'],
        footprint_mismatches: [
            {
                refdes: 'R1',
                bom_footprint: 'RC0402-4K7',
                pcb_footprint: 'RC0402-10K'
            }
        ]
    })
})

/**
 * Verifies list_single_pin_nets returns focused connectivity lint output.
 */
test('LoadedDesignNetlistService lists single-pin nets', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() }
    ])

    assert.deepEqual(service.listSinglePinNets(), {
        nets: [
            {
                design: 'Logic Sheet',
                net: 'GND',
                pins: ['C1.2'],
                pin_count: 1
            }
        ],
        total_count: 1
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
