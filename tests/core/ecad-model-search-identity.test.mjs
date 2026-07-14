import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadMissingModelSearchService } from '../../src/core/ecad/EcadMissingModelSearchService.mjs'

/**
 * Creates a neutral PCB document from component rows.
 * @param {object[]} components PCB components.
 * @returns {object}
 */
function createPcbDocument(components) {
    return {
        kind: 'pcb',
        pcb: { components }
    }
}

/**
 * Creates a service that records authored paths requested from its client.
 * @param {string[]} requestedPaths Request log.
 * @returns {EcadMissingModelSearchService}
 */
function createRecordingService(requestedPaths) {
    return new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async (component) => {
                requestedPaths.push(component.modelPath)
                return {
                    name: component.designator + '.step',
                    relativePath: 'download/' + component.designator + '.step',
                    format: 'step',
                    bytes: new TextEncoder().encode('ISO-10303-21;')
                }
            }
        }
    })
}

test('EcadMissingModelSearchService keeps same-stem authored paths distinct within one document', async () => {
    const requestedPaths = []
    const service = createRecordingService(requestedPaths)
    const firstPath = 'library_a/Neutral_Body.step'
    const secondPath = 'library_b/Neutral_Body.wrl'
    const documentModel = createPcbDocument([
        {
            designator: 'U1',
            pattern: 'NEUTRAL_BODY_A',
            modelPath: firstPath
        },
        {
            designator: 'U2',
            pattern: 'NEUTRAL_BODY_B',
            modelPath: secondPath
        }
    ])

    const assets = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })

    assert.deepEqual(requestedPaths, [firstPath, secondPath])
    assert.deepEqual(
        assets.map((asset) => asset.aliases),
        [[firstPath], [secondPath]]
    )
})

test('EcadMissingModelSearchService caches same-stem models by authored path', async () => {
    const requestedPaths = []
    const service = createRecordingService(requestedPaths)
    const firstPath = 'library_a/Neutral_Body.step'
    const secondPath = 'library_b/Neutral_Body.wrl'

    await service.resolveSessionAssets(
        createPcbDocument([
            {
                designator: 'U1',
                pattern: 'NEUTRAL_BODY_A',
                modelPath: firstPath
            }
        ]),
        { enabled: true, sessionAssets: [] }
    )
    const secondAssets = await service.resolveSessionAssets(
        createPcbDocument([
            {
                designator: 'U2',
                pattern: 'NEUTRAL_BODY_B',
                modelPath: secondPath
            }
        ]),
        { enabled: true, sessionAssets: [] }
    )

    assert.deepEqual(requestedPaths, [firstPath, secondPath])
    assert.deepEqual(secondAssets[0].aliases, [secondPath])
})

test('EcadMissingModelSearchService keeps downloaded assets within their owning document', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return {
                    name: 'Shared_Body.step',
                    relativePath:
                        'download/Shared_Body-' + String(calls) + '.step',
                    sourceUrl:
                        'https://models.invalid/Shared_Body-' +
                        String(calls) +
                        '.step',
                    format: 'step',
                    bytes: new Uint8Array([calls])
                }
            }
        }
    })
    const authoredPath = 'models/Shared_Body.step'
    const component = {
        designator: 'U1',
        pattern: 'SHARED_BODY',
        modelPath: authoredPath
    }
    const firstDocument = createPcbDocument([{ ...component }])
    const secondDocument = createPcbDocument([{ ...component }])

    const firstAssets = await service.resolveSessionAssets(firstDocument, {
        enabled: true,
        sessionAssets: []
    })
    const secondAssets = await service.resolveSessionAssets(secondDocument, {
        enabled: true,
        sessionAssets: firstAssets
    })

    assert.equal(calls, 2)
    assert.equal(secondAssets.length, 1)
    assert.notEqual(secondAssets[0].file, firstAssets[0].file)
    assert.equal(
        secondAssets[0].sourceUrl,
        'https://models.invalid/Shared_Body-2.step'
    )
    assert.deepEqual(secondAssets[0].aliases, [authoredPath])
})

test('EcadMissingModelSearchService reuses an exact unscoped project asset', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return null
            }
        }
    })
    const authoredPath = 'project/models/Shared_Body.step'
    const projectAssets = [
        {
            name: 'Shared_Body.step',
            relativePath: authoredPath,
            file: new Uint8Array([7]),
            format: 'step',
            source: 'project'
        }
    ]

    const result = await service.resolveSessionAssets(
        createPcbDocument([
            {
                designator: 'U1',
                pattern: 'SHARED_BODY',
                modelPath: authoredPath
            }
        ]),
        { enabled: true, sessionAssets: projectAssets }
    )

    assert.equal(calls, 0)
    assert.equal(result, projectAssets)
})

test('EcadMissingModelSearchService excludes foreign scoped project assets', async () => {
    const requestedPaths = []
    const service = createRecordingService(requestedPaths)
    const authoredPath = 'project/models/Shared_Body.step'
    const documentModel = createPcbDocument([
        {
            designator: 'U1',
            pattern: 'SHARED_BODY',
            modelPath: authoredPath
        }
    ])

    const result = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: [
            {
                name: 'Shared_Body.step',
                relativePath: authoredPath,
                file: new Uint8Array([7]),
                format: 'step',
                source: 'project',
                documentScope: Object.freeze({})
            }
        ]
    })

    assert.deepEqual(requestedPaths, [authoredPath])
    assert.equal(result.length, 1)
    assert.equal(result[0].source, 'model-search')
})

test('EcadMissingModelSearchService filters foreign scopes while search is disabled', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return {
                    name: 'Shared_Body.step',
                    relativePath: 'download/Shared_Body.step',
                    format: 'step',
                    bytes: new Uint8Array([calls])
                }
            }
        }
    })
    const component = {
        designator: 'U1',
        pattern: 'SHARED_BODY',
        modelPath: 'models/Shared_Body.step'
    }
    const firstDocument = createPcbDocument([{ ...component }])
    const secondDocument = createPcbDocument([{ ...component }])
    const firstAssets = await service.resolveSessionAssets(firstDocument, {
        enabled: true,
        sessionAssets: []
    })

    const secondAssets = await service.resolveSessionAssets(secondDocument, {
        enabled: false,
        sessionAssets: firstAssets
    })

    assert.equal(calls, 1)
    assert.deepEqual(secondAssets, [])
})

test('EcadMissingModelSearchService rejects duplicate exact authored path candidates', async () => {
    const requestedPaths = []
    const service = createRecordingService(requestedPaths)
    const authoredPath = 'models/Neutral_Body.wrl'
    const documentModel = createPcbDocument([
        {
            designator: 'U1',
            pattern: 'NEUTRAL_BODY',
            modelPath: authoredPath
        }
    ])

    await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: [
            {
                name: 'Neutral_Body.wrl',
                relativePath: authoredPath
            },
            {
                name: 'Resolved_Body.step',
                relativePath: 'download/Resolved_Body.step',
                aliases: [authoredPath]
            }
        ]
    })

    assert.deepEqual(requestedPaths, [authoredPath])
})

test('EcadMissingModelSearchService shares an in-flight document lookup', async () => {
    let calls = 0
    let releaseLookup
    const lookupGate = new Promise((resolve) => {
        releaseLookup = resolve
    })
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                await lookupGate
                return {
                    name: 'Shared_Body.step',
                    relativePath: 'download/Shared_Body.step',
                    format: 'step',
                    bytes: new TextEncoder().encode('ISO-10303-21;')
                }
            }
        }
    })
    const documentModel = createPcbDocument([
        {
            designator: 'U1',
            pattern: 'SHARED_BODY',
            modelPath: 'models/Shared_Body.wrl'
        }
    ])

    const firstLookup = service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })
    const secondLookup = service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })
    const callsBeforeRelease = calls
    releaseLookup()
    const [firstAssets, secondAssets] = await Promise.all([
        firstLookup,
        secondLookup
    ])

    assert.equal(callsBeforeRelease, 1)
    assert.equal(calls, 1)
    assert.equal(secondAssets[0], firstAssets[0])
})

test('EcadMissingModelSearchService retries after a shared lookup rejection', async () => {
    let calls = 0
    let releaseFailure
    const failureGate = new Promise((resolve) => {
        releaseFailure = resolve
    })
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                if (calls === 1) {
                    await failureGate
                    throw new Error('transient lookup failure')
                }
                return {
                    name: 'Retry_Body.step',
                    relativePath: 'download/Retry_Body.step',
                    format: 'step',
                    bytes: new TextEncoder().encode('ISO-10303-21;')
                }
            }
        }
    })
    const documentModel = createPcbDocument([
        {
            designator: 'U1',
            pattern: 'RETRY_BODY',
            modelPath: 'models/Retry_Body.wrl'
        }
    ])

    const firstLookup = service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })
    const secondLookup = service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })
    releaseFailure()
    const failedResults = await Promise.all([firstLookup, secondLookup])
    const recoveredAssets = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })

    assert.deepEqual(failedResults, [[], []])
    assert.equal(calls, 2)
    assert.equal(recoveredAssets.length, 1)
})

test('EcadMissingModelSearchService retries after a settled null lookup', async () => {
    let calls = 0
    const service = new EcadMissingModelSearchService({
        client: {
            fetchComponentModel: async () => {
                calls += 1
                return calls === 1
                    ? null
                    : {
                          name: 'Recovered_Body.step',
                          relativePath: 'download/Recovered_Body.step',
                          format: 'step',
                          bytes: new TextEncoder().encode('ISO-10303-21;')
                      }
            }
        }
    })
    const documentModel = createPcbDocument([
        {
            designator: 'U1',
            pattern: 'RECOVERED_BODY',
            modelPath: 'models/Recovered_Body.wrl'
        }
    ])

    const missingAssets = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })
    const recoveredAssets = await service.resolveSessionAssets(documentModel, {
        enabled: true,
        sessionAssets: []
    })

    assert.deepEqual(missingAssets, [])
    assert.equal(calls, 2)
    assert.equal(recoveredAssets.length, 1)
})
