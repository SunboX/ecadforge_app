import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { EcadModelSourceClient } from '../../src/core/ecad/EcadModelSourceClient.mjs'
import { EcadMissingModelSearchService } from '../../src/core/ecad/EcadMissingModelSearchService.mjs'
import { EcadModelSearchPreference } from '../../src/core/ecad/EcadModelSearchPreference.mjs'
import { EcadKicadModelLibraryClient } from '../../src/core/ecad/EcadKicadModelLibraryClient.mjs'
import { EcadEasyEdaModelSourceClient } from '../../src/core/ecad/EcadEasyEdaModelSourceClient.mjs'

/**
 * Creates a PCB document with one model reference.
 * @param {string} [modelPath] Authored model path.
 * @returns {object}
 */
function createPcbDocument(modelPath = 'models/FAKE_WIDGET_0603.step') {
    return {
        kind: 'pcb',
        pcb: {
            components: [
                {
                    designator: 'U1',
                    pattern: 'FAKE_WIDGET_0603',
                    source: 'Fake Widget',
                    modelPath
                }
            ]
        }
    }
}

/**
 * Creates a PCB document with several missing model references.
 * @returns {object}
 */
function createMultiModelPcbDocument() {
    return {
        kind: 'pcb',
        pcb: {
            components: [
                {
                    designator: 'U1',
                    pattern: 'FAKE_WIDGET_A',
                    modelPath: 'models/FAKE_WIDGET_A.step'
                },
                {
                    designator: 'U2',
                    pattern: 'FAKE_WIDGET_B',
                    modelPath: 'models/FAKE_WIDGET_B.step'
                },
                {
                    designator: 'U3',
                    pattern: 'FAKE_WIDGET_C',
                    modelPath: 'models/FAKE_WIDGET_C.step'
                }
            ]
        }
    }
}

/**
 * Delays execution.
 * @param {number} delayMs Delay in milliseconds.
 * @returns {Promise<void>}
 */
function delay(delayMs) {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs)
    })
}

test('EcadModelSearchPreference defaults to disabled storage state', () => {
    const storage = new Map()
    const adapter = {
        getItem: (key) => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value)
    }

    assert.equal(EcadModelSearchPreference.read(adapter), false)
    EcadModelSearchPreference.write(adapter, true)
    assert.equal(storage.get(EcadModelSearchPreference.STORAGE_KEY), 'true')
    assert.equal(EcadModelSearchPreference.read(adapter), true)
})

test('EcadMissingModelSearchService avoids client calls when disabled', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            searchComponents: async () => {
                calls += 1
                return []
            }
        }
    })
    const assets = [{ name: 'existing.step', relativePath: 'existing.step' }]
    const result = await service.resolveSessionAssets(createPcbDocument(), {
        enabled: false,
        sessionAssets: assets
    })

    assert.equal(calls, 0)
    assert.equal(result, assets)
})

test('EcadMissingModelSearchService downloads and caches matching model assets', async () => {
    const searchedTerms = []
    const fetchedIds = []
    const service = new EcadMissingModelSearchService({
        client: {
            searchComponents: async (term) => {
                searchedTerms.push(term)
                return [{ id: 'component-a', name: 'Component A' }]
            },
            fetchComponentBundle: async (id) => {
                fetchedIds.push(id)
                return {
                    id,
                    models: [
                        {
                            name: 'downloaded.step',
                            format: 'step',
                            bytes: new TextEncoder().encode('ISO-10303-21;')
                        }
                    ]
                }
            }
        }
    })

    const documentModel = createPcbDocument()
    const first = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })
    const second = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })

    assert.deepEqual(searchedTerms, ['FAKE_WIDGET_0603'])
    assert.deepEqual(fetchedIds, ['component-a'])
    assert.equal(first[0].name, 'FAKE_WIDGET_0603.step')
    assert.equal(first[0].relativePath, 'models/FAKE_WIDGET_0603.step')
    assert.equal(first[0].format, 'step')
    assert.equal(second[0], first[0])
})

test('EcadMissingModelSearchService searches when a same-stem asset belongs to another path', async () => {
    const requestedPaths = []
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async (component) => {
                requestedPaths.push(component.modelPath)
                return {
                    name: 'Neutral_Body.wrl',
                    format: 'wrl',
                    bytes: new TextEncoder().encode('#VRML V2.0 utf8')
                }
            }
        }
    })
    const authoredPath = 'library_b/Neutral_Body.wrl'
    const existingAsset = {
        name: 'Neutral_Body.step',
        relativePath: 'library_a/Neutral_Body.step'
    }

    const result = await service.resolveSessionAssets(
        createPcbDocument(authoredPath),
        {
            enabled: true,
            sessionAssets: [existingAsset]
        }
    )

    assert.deepEqual(requestedPaths, [authoredPath])
    assert.equal(result.length, 2)
    assert.equal(result[1].relativePath, authoredPath)
})

test('EcadMissingModelSearchService accepts only the explicit authored alias for a differently named asset', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return {
                    name: 'Neutral_Body.wrl',
                    format: 'wrl',
                    bytes: new TextEncoder().encode('#VRML V2.0 utf8')
                }
            }
        }
    })
    const authoredPath = '${MODEL_ROOT}\\library_b\\Neutral_Body.wrl'
    const existingAssets = [
        {
            name: 'Resolved_Body.step',
            relativePath: 'download/Resolved_Body.step',
            aliases: ['${MODEL_ROOT}/library_b/Neutral_Body.wrl']
        }
    ]

    const result = await service.resolveSessionAssets(
        createPcbDocument(authoredPath),
        {
            enabled: true,
            sessionAssets: existingAssets
        }
    )

    assert.equal(calls, 0)
    assert.equal(result, existingAssets)
})

test('EcadMissingModelSearchService preserves URL origins during exact asset matching', async () => {
    const requestedPaths = []
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async (component) => {
                requestedPaths.push(component.modelPath)
                return {
                    name: 'Neutral_Body.step',
                    format: 'step',
                    bytes: new TextEncoder().encode('ISO-10303-21;')
                }
            }
        }
    })
    const authoredPath = 'https://models-b.invalid/library/Neutral_Body.step'

    await service.resolveSessionAssets(createPcbDocument(authoredPath), {
        enabled: true,
        sessionAssets: [
            {
                name: 'Neutral_Body.step',
                relativePath:
                    'https://models-a.invalid/library/Neutral_Body.step'
            }
        ]
    })

    assert.deepEqual(requestedPaths, [authoredPath])
})

test('EcadMissingModelSearchService never case-folds URL asset paths', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return null
            }
        }
    })
    const authoredPath = 'https://assets.invalid/Models/Neutral_Body.step'

    await service.resolveSessionAssets(createPcbDocument(authoredPath), {
        enabled: true,
        sessionAssets: [
            {
                name: 'Neutral_Body.step',
                relativePath: 'https://assets.invalid/models/Neutral_Body.step'
            }
        ]
    })

    assert.equal(calls, 1)
})

test('EcadMissingModelSearchService uses a unique case-folded authored path match', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return null
            }
        }
    })

    await service.resolveSessionAssets(
        createPcbDocument('${MODEL_ROOT}/library/Neutral_Body.step'),
        {
            enabled: true,
            sessionAssets: [
                {
                    name: 'Neutral_Body.step',
                    relativePath: '${model_root}/LIBRARY/NEUTRAL_BODY.STEP'
                }
            ]
        }
    )

    assert.equal(calls, 0)
})

test('EcadMissingModelSearchService rejects ambiguous case-folded authored path matches', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return null
            }
        }
    })

    await service.resolveSessionAssets(
        createPcbDocument('MODELS/NEUTRAL_BODY.STEP'),
        {
            enabled: true,
            sessionAssets: [
                { relativePath: 'Models/Neutral_Body.step' },
                { relativePath: 'models/neutral_body.step' }
            ]
        }
    )

    assert.equal(calls, 1)
})

test('EcadMissingModelSearchService ignores accessor-backed asset aliases', async () => {
    let calls = 0
    let getterCalls = 0
    const authoredPath = 'models/Neutral_Body.wrl'
    const asset = {
        name: 'Resolved_Body.step',
        relativePath: 'download/Resolved_Body.step'
    }
    Object.defineProperty(asset, 'aliases', {
        enumerable: true,
        get() {
            getterCalls += 1
            return [authoredPath]
        }
    })
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return null
            }
        }
    })

    await service.resolveSessionAssets(createPcbDocument(authoredPath), {
        enabled: true,
        sessionAssets: [asset]
    })

    assert.equal(calls, 1)
    assert.equal(getterCalls, 0)
})

test('EcadMissingModelSearchService preserves stem matching without an authored model path', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return null
            }
        }
    })
    const existingAssets = [
        {
            name: 'Neutral_Legacy_Body.step',
            relativePath: 'library/Neutral_Legacy_Body.step'
        }
    ]
    const documentModel = {
        kind: 'pcb',
        pcb: {
            components: [
                {
                    designator: 'U1',
                    pattern: 'NEUTRAL_LEGACY_BODY'
                }
            ]
        }
    }

    const result = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: existingAssets
    })

    assert.equal(calls, 0)
    assert.equal(result, existingAssets)
})

test('EcadMissingModelSearchService resolves canonical CircuitJSON component models', async () => {
    const requested = []
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async (component, options) => {
                requested.push({
                    designator: component.designator,
                    term: options.term
                })
                return {
                    name: 'body.step',
                    format: 'step',
                    bytes: new TextEncoder().encode('ISO-10303-21;')
                }
            }
        }
    })
    const documentModel = Parser.parse({
        fileName: 'board.json',
        data: JSON.stringify([
            {
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_chip'
            },
            {
                type: 'pcb_component',
                pcb_component_id: 'pcb_u1',
                source_component_id: 'source_u1',
                center: { x: 0, y: 0 },
                width: 2,
                height: 2,
                rotation: 0,
                layer: 'top'
            },
            {
                type: 'cad_component',
                cad_component_id: 'cad_u1',
                pcb_component_id: 'pcb_u1',
                source_component_id: 'source_u1',
                position: { x: 0, y: 0, z: 0 },
                model_step_url: 'models/FAKE_WIDGET_QFN.step'
            },
            {
                type: 'source_component',
                source_component_id: 'source_u2',
                name: 'U2',
                ftype: 'simple_chip'
            },
            {
                type: 'pcb_component',
                pcb_component_id: 'pcb_u2',
                source_component_id: 'source_u2',
                center: { x: 4, y: 0 },
                width: 2,
                height: 2,
                rotation: 0,
                layer: 'top',
                do_not_place: true
            }
        ])
    })

    const result = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })

    assert.deepEqual(requested, [{ designator: 'U1', term: 'FAKE_WIDGET_QFN' }])
    assert.equal(result[0].relativePath, 'models/FAKE_WIDGET_QFN.step')
    assert.equal(result[0].componentKey, 'U1')
})

test('EcadMissingModelSearchService retains resolved model identity and the exact authored alias', async () => {
    const authoredPath =
        '${KICAD9_3DMODEL_DIR}/Package_Fake.3dshapes/Fake_Body.wrl'
    const resolvedPath =
        '${KICAD9_3DMODEL_DIR}/Package_Fake.3dshapes/Fake_Body.step'
    const sourceUrl =
        'https://assets.invalid/Package_Fake.3dshapes/Fake_Body.step'
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => ({
                name: 'Fake_Body.step',
                relativePath: resolvedPath,
                sourceUrl,
                format: 'step',
                bytes: new TextEncoder().encode('ISO-10303-21;')
            })
        }
    })
    const documentModel = Parser.parse({
        fileName: 'board.json',
        data: JSON.stringify([
            {
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_chip'
            },
            {
                type: 'pcb_component',
                pcb_component_id: 'pcb_u1',
                source_component_id: 'source_u1',
                center: { x: 0, y: 0 },
                width: 2,
                height: 2,
                rotation: 0,
                layer: 'top'
            },
            {
                type: 'cad_component',
                cad_component_id: 'cad_u1',
                pcb_component_id: 'pcb_u1',
                source_component_id: 'source_u1',
                position: { x: 0, y: 0, z: 0 },
                model_wrl_url: authoredPath
            }
        ])
    })

    const [asset] = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })

    assert.equal(asset.name, 'Fake_Body.wrl')
    assert.equal(asset.relativePath, resolvedPath)
    assert.equal(asset.sourceUrl, sourceUrl)
    assert.equal(asset.format, 'step')
    assert.deepEqual(asset.aliases, [authoredPath])
})

test('EcadMissingModelSearchService skips do-not-populate components', async () => {
    const requestedDesignators = []
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async (component) => {
                requestedDesignators.push(component.designator)
                return {
                    name: component.pattern + '.step',
                    format: 'step',
                    bytes: new TextEncoder().encode('ISO-10303-21;')
                }
            }
        }
    })
    const documentModel = {
        kind: 'pcb',
        pcb: {
            components: [
                {
                    designator: 'U1',
                    pattern: 'FAKE_WIDGET_POPULATED',
                    modelPath: 'models/FAKE_WIDGET_POPULATED.step'
                },
                {
                    designator: 'U2',
                    pattern: 'FAKE_WIDGET_DNP',
                    modelPath: 'models/FAKE_WIDGET_DNP.step',
                    doNotPopulate: true
                },
                {
                    designator: 'U3',
                    pattern: 'FAKE_WIDGET_VARIANT_DNP',
                    modelPath: 'models/FAKE_WIDGET_VARIANT_DNP.step',
                    dnp: true
                },
                {
                    designator: 'U4',
                    pattern: 'FAKE_WIDGET_DNS',
                    modelPath: 'models/FAKE_WIDGET_DNS.step',
                    dns: true
                }
            ]
        }
    }

    const result = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })

    assert.deepEqual(requestedDesignators, ['U1'])
    assert.equal(result.length, 1)
    assert.equal(result[0].componentKey, 'U1')
})

test('EcadMissingModelSearchService skips no-BOM and board marker components', async () => {
    const requestedDesignators = []
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async (component) => {
                requestedDesignators.push(component.designator)
                return {
                    name: component.pattern + '.step',
                    format: 'step',
                    bytes: new TextEncoder().encode('ISO-10303-21;')
                }
            }
        }
    })
    const documentModel = {
        kind: 'pcb',
        pcb: {
            components: [
                {
                    designator: 'U1',
                    pattern: 'FAKE_WIDGET_POPULATED',
                    modelPath: 'models/FAKE_WIDGET_POPULATED.step'
                },
                {
                    designator: 'U2',
                    pattern: 'FAKE_WIDGET_NO_BOM',
                    modelPath: 'models/FAKE_WIDGET_NO_BOM.step',
                    componentKind: {
                        name: 'standard-no-bom',
                        includeInBom: false
                    }
                },
                {
                    designator: 'TP7',
                    pattern: 'FAKE_TESTPOINT_PAD',
                    source: 'FAKE_TESTPOINT_PAD',
                    description: 'Fake test point pad'
                },
                {
                    designator: 'F1',
                    pattern: 'FAKE_FIDUCIAL',
                    source: 'FAKE_FIDUCIAL'
                }
            ]
        }
    }

    const result = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })

    assert.deepEqual(requestedDesignators, ['U1'])
    assert.equal(result.length, 1)
    assert.equal(result[0].componentKey, 'U1')
})

test('EcadMissingModelSearchService resolves direct component model assets', async () => {
    const requested = []
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async (component, options) => {
                requested.push({
                    designator: component.designator,
                    term: options.term
                })
                return {
                    name: 'direct.wrl',
                    format: 'wrl',
                    bytes: new TextEncoder().encode('#VRML V2.0 utf8')
                }
            }
        }
    })

    const result = await service.resolveSessionAssets(createPcbDocument(), {
        enabled: true,
        sessionAssets: []
    })

    assert.deepEqual(requested, [
        { designator: 'U1', term: 'FAKE_WIDGET_0603' }
    ])
    assert.equal(result[0].name, 'FAKE_WIDGET_0603.step')
    assert.equal(result[0].format, 'wrl')
})

test('EcadMissingModelSearchService resolves missing models in bounded parallel batches', async () => {
    let activeCalls = 0
    let maxActiveCalls = 0
    const requested = []
    const service = new EcadMissingModelSearchService({
        concurrencyLimit: 2,
        client: {
            fetchComponentModel: async (component) => {
                requested.push(component.designator)
                activeCalls += 1
                maxActiveCalls = Math.max(maxActiveCalls, activeCalls)
                await delay(5)
                activeCalls -= 1
                return {
                    name: component.pattern + '.step',
                    format: 'step',
                    bytes: new TextEncoder().encode('ISO-10303-21;')
                }
            }
        }
    })

    const result = await service.resolveSessionAssets(
        createMultiModelPcbDocument(),
        {
            enabled: true,
            sessionAssets: []
        }
    )

    assert.deepEqual(requested, ['U1', 'U2', 'U3'])
    assert.equal(maxActiveCalls, 2)
    assert.equal(result.length, 3)
})

test('EcadKicadModelLibraryClient prefers STEP for known KiCad library model paths', async () => {
    const requestedUrls = []
    const requestedSignals = []
    const client = new EcadKicadModelLibraryClient({
        fetcher: async (url, options) => {
            requestedUrls.push(String(url))
            requestedSignals.push(options.signal instanceof AbortSignal)
            return new Response('ISO-10303-21;')
        },
        baseUrl: 'https://models.example.invalid/',
        requestTimeoutMs: 25
    })

    const model = await client.fetchComponentModel({
        modelPath:
            '${KICAD6_3DMODEL_DIR}/Capacitor_SMD.3dshapes/C_0805_2012Metric.wrl'
    })

    assert.equal(model.name, 'C_0805_2012Metric.step')
    assert.equal(
        model.relativePath,
        '${KICAD6_3DMODEL_DIR}/Capacitor_SMD.3dshapes/C_0805_2012Metric.step'
    )
    assert.equal(model.format, 'step')
    assert.equal(new TextDecoder().decode(model.bytes), 'ISO-10303-21;')
    assert.deepEqual(requestedUrls, [
        'https://models.example.invalid/Capacitor_SMD.3dshapes/C_0805_2012Metric.step'
    ])
    assert.deepEqual(requestedSignals, [true])
})

test('EcadKicadModelLibraryClient falls back to WRL when STEP is unavailable', async () => {
    const requestedUrls = []
    const client = new EcadKicadModelLibraryClient({
        fetcher: async (url) => {
            requestedUrls.push(String(url))
            return String(url).endsWith('.step')
                ? new Response('missing', { status: 404 })
                : new Response('#VRML V2.0 utf8')
        },
        baseUrl: 'https://models.example.invalid/'
    })

    const model = await client.fetchComponentModel({
        modelPath:
            '${KICAD6_3DMODEL_DIR}/Capacitor_SMD.3dshapes/C_0805_2012Metric.wrl'
    })

    assert.equal(model.name, 'C_0805_2012Metric.wrl')
    assert.equal(model.format, 'wrl')
    assert.deepEqual(requestedUrls, [
        'https://models.example.invalid/Capacitor_SMD.3dshapes/C_0805_2012Metric.step',
        'https://models.example.invalid/Capacitor_SMD.3dshapes/C_0805_2012Metric.wrl'
    ])
})

test('EcadKicadModelLibraryClient finds closest same-folder KiCad package model after exact misses', async () => {
    const requestedUrls = []
    const client = new EcadKicadModelLibraryClient({
        fetcher: async (url) => {
            requestedUrls.push(String(url))
            if (String(url).includes('index.example.invalid')) {
                return Response.json([
                    {
                        name: 'SOIC-8_3.9x4.9mm_P1.27mm.step'
                    },
                    {
                        name: 'SOIC-8_5.275x5.275mm_P1.27mm.step'
                    },
                    {
                        name: 'SOIC-8_5.275x5.275mm_P1.27mm.wrl'
                    }
                ])
            }
            return String(url).endsWith('5.275mm_P1.27mm.step')
                ? new Response('ISO-10303-21;')
                : new Response('missing', { status: 404 })
        },
        baseUrl: 'https://models.example.invalid/',
        packageIndexBaseUrl: 'https://index.example.invalid/'
    })

    const model = await client.fetchComponentModel({
        modelPath:
            '${KICAD6_3DMODEL_DIR}/Package_SO.3dshapes/SOIC-8_5.23x5.23mm_P1.27mm.wrl'
    })

    assert.equal(model.name, 'SOIC-8_5.275x5.275mm_P1.27mm.step')
    assert.equal(model.format, 'step')
    assert.equal(
        model.relativePath,
        '${KICAD6_3DMODEL_DIR}/Package_SO.3dshapes/SOIC-8_5.275x5.275mm_P1.27mm.step'
    )
    assert.equal(new TextDecoder().decode(model.bytes), 'ISO-10303-21;')
    assert.deepEqual(requestedUrls, [
        'https://models.example.invalid/Package_SO.3dshapes/SOIC-8_5.23x5.23mm_P1.27mm.step',
        'https://models.example.invalid/Package_SO.3dshapes/SOIC-8_5.23x5.23mm_P1.27mm.wrl',
        'https://index.example.invalid/Package_SO.3dshapes?ref=master',
        'https://models.example.invalid/Package_SO.3dshapes/SOIC-8_5.275x5.275mm_P1.27mm.step'
    ])
})

test('EcadKicadModelLibraryClient skips project-relative model paths', async () => {
    let calls = 0
    const client = new EcadKicadModelLibraryClient({
        fetcher: async () => {
            calls += 1
            return new Response('')
        }
    })

    const model = await client.fetchComponentModel({
        modelPath: '10103594.stp'
    })

    assert.equal(model, null)
    assert.equal(calls, 0)
})

test('EcadEasyEdaModelSourceClient resolves search results to STEP bytes', async () => {
    const requestedUrls = []
    const requestedSignals = []
    const client = new EcadEasyEdaModelSourceClient({
        fetcher: async (url, options) => {
            requestedUrls.push(String(url))
            requestedSignals.push(options.signal instanceof AbortSignal)
            if (String(url).includes('/product/list?')) {
                return Response.json({
                    result: [
                        {
                            display_title: 'Fake connector',
                            product_code: 'C2040',
                            attributes: {
                                '3D Model': 'seed-model',
                                Manufacturer: 'Fake Parts'
                            }
                        }
                    ]
                })
            }

            if (String(url).includes('/api/components/seed-model')) {
                return Response.json({
                    code: 0,
                    result: {
                        '3d_model_uuid': 'resolved-model'
                    }
                })
            }

            return new Response('ISO-10303-21;')
        }
    })

    const rows = await client.searchComponents('C2040', { limit: 1 })
    const bundle = await client.fetchComponentBundle(rows[0].id)
    const bytes = await client.fetchBinaryAsset(bundle.models[0].sourceUrl)

    assert.equal(rows[0].id, 'seed-model')
    assert.equal(rows[0].name, 'Fake connector')
    assert.equal(bundle.models[0].sourceUrl, 'models/resolved-model.step')
    assert.equal(new TextDecoder().decode(bytes), 'ISO-10303-21;')
    assert.deepEqual(requestedUrls, [
        'https://pro.lceda.cn/api/szlcsc/eda/product/list?wd=C2040',
        'https://pro.lceda.cn/api/components/seed-model?uuid=seed-model',
        'https://modules.lceda.cn/qAxj6KHrDKw4blvCG8QJPs7Y/resolved-model'
    ])
    assert.deepEqual(requestedSignals, [true, true, true])
})

test('EcadModelSourceClient resolves provider search and model assets', async () => {
    const requestedUrls = []
    const requestedSignals = []
    const fetcher = async (url, options) => {
        requestedUrls.push(String(url))
        requestedSignals.push(options.signal instanceof AbortSignal)

        if (String(url).includes('/lookup?')) {
            return Response.json({
                results: [{ id: 'component-a', name: 'Component A' }]
            })
        }

        if (String(url).endsWith('/components/component-a')) {
            return Response.json({
                id: 'component-a',
                models: [
                    {
                        name: 'asset.step',
                        format: 'step',
                        sourceUrl: 'assets/component-a.step'
                    }
                ]
            })
        }

        return new Response('ISO-10303-21;', {
            headers: { 'content-type': 'model/step' }
        })
    }
    const client = new EcadModelSourceClient({
        fetcher,
        baseUrl: 'https://example.invalid/api/',
        searchPath: 'lookup',
        componentPath: 'components/{id}'
    })

    const rows = await client.searchComponents('FAKE PART', { limit: 1 })
    const bundle = await client.fetchComponentBundle(rows[0].id)
    const bytes = await client.fetchBinaryAsset(bundle.models[0].sourceUrl)

    assert.deepEqual(rows, [{ id: 'component-a', name: 'Component A' }])
    assert.equal(bundle.models[0].name, 'asset.step')
    assert.equal(new TextDecoder().decode(bytes), 'ISO-10303-21;')
    assert.deepEqual(requestedUrls, [
        'https://example.invalid/api/lookup?q=FAKE+PART&limit=1',
        'https://example.invalid/api/components/component-a',
        'https://example.invalid/api/assets/component-a.step'
    ])
    assert.deepEqual(requestedSignals, [true, true, true])
})

test('EcadModelSourceClient resolves relative same-origin provider URLs', async () => {
    const requestedUrls = []
    const client = new EcadModelSourceClient({
        fetcher: async (url) => {
            requestedUrls.push(String(url))
            return Response.json({ results: [] })
        },
        baseUrl: '/api/component-source/'
    })

    const rows = await client.searchComponents('FAKE PART', { limit: 1 })

    assert.deepEqual(rows, [])
    assert.deepEqual(requestedUrls, [
        'http://localhost/api/component-source/search?q=FAKE+PART&limit=1'
    ])
})

test('EcadModelSourceClient falls back to PHP component-source endpoint', async () => {
    const requestedUrls = []
    const client = new EcadModelSourceClient({
        fetcher: async (url) => {
            requestedUrls.push(String(url))
            if (String(url).includes('/component-source/search?')) {
                return new Response('missing', { status: 404 })
            }
            return Response.json({ results: [] })
        },
        baseUrl: '/api/component-source/',
        fallbackBaseUrl: '/api/component-source.php'
    })

    const rows = await client.searchComponents('FAKE PART', { limit: 1 })

    assert.deepEqual(rows, [])
    assert.deepEqual(requestedUrls, [
        'http://localhost/api/component-source/search?q=FAKE+PART&limit=1',
        'http://localhost/api/component-source.php?path=search&q=FAKE+PART&limit=1'
    ])
})
