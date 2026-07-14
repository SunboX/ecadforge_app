import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'
import { AppControllerParserData } from '../../src/AppControllerParserData.mjs'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'

/**
 * Builds one immutable canonical document for parser identity tests.
 * @param {string} id Stable document id.
 * @returns {object} Frozen canonical document.
 */
function createDocument(id) {
    return Object.freeze({
        schema: 'ecad-toolkit.document.v1',
        id,
        modelSchema: Object.freeze({
            name: 'circuit-json',
            version: '0.0.446'
        }),
        model: Object.freeze([]),
        source: Object.freeze({
            format: 'altium',
            fileName: 'board.PcbDoc',
            fileType: 'pcbdoc'
        }),
        extensions: Object.freeze({}),
        assets: Object.freeze([]),
        diagnostics: Object.freeze([]),
        statistics: Object.freeze({ elementCount: 0 })
    })
}

test('EcadParserService preserves canonical parser result identity', async () => {
    const directResult = createDocument('direct-document')
    const batchResult = createDocument('batch-document')
    const optionCalls = []
    const service = new EcadParserService({
        altiumParser: {
            parse(input, options) {
                optionCalls.push({ kind: 'parse', input, options })
                return directResult
            }
        },
        altiumProjectLoader: {
            loadAsync(entries, options) {
                optionCalls.push({ kind: 'project', entries, options })
                return {
                    documents: [batchResult],
                    assets: [],
                    diagnostics: []
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'board.PcbDoc', buffer: new ArrayBuffer(1) }
    ])
    const parsedDirectResult = service.parseArrayBuffer(
        'board.PcbDoc',
        new ArrayBuffer(1)
    )

    assert.equal(result.documents[0], batchResult)
    assert.equal(parsedDirectResult, directResult)
    assert.equal(Object.isFrozen(result.documents[0]), true)
    assert.equal(Object.isFrozen(parsedDirectResult), true)
    assert.deepEqual(
        optionCalls.map((call) => [
            call.kind,
            call.options.extensions,
            call.options.decodeAssets,
            call.options.worker
        ]),
        [
            ['project', ['altium.native-model'], 'full', 'auto'],
            ['parse', ['altium.native-model'], 'full', undefined]
        ]
    )
    assert.equal(Object.hasOwn(parsedDirectResult, 'schematic'), false)
})

test('EcadParserService retains KiCad native fidelity data in direct and project parses', async () => {
    const directResult = createDocument('kicad-direct-document')
    const batchResult = createDocument('kicad-batch-document')
    const optionCalls = []
    const service = new EcadParserService({
        kicadParser: {
            parse(input, options) {
                optionCalls.push({ kind: 'parse', input, options })
                return directResult
            }
        },
        kicadProjectLoader: {
            loadAsync(entries, options) {
                optionCalls.push({ kind: 'project', entries, options })
                return {
                    documents: [batchResult],
                    assets: [],
                    diagnostics: []
                }
            }
        }
    })

    await service.parseEntries(
        [{ name: 'neutral.kicad_pcb', buffer: new ArrayBuffer(1) }],
        { worker: false }
    )
    service.parseArrayBuffer('neutral.kicad_sch', new ArrayBuffer(1))

    assert.deepEqual(
        optionCalls.map((call) => [
            call.kind,
            call.options.extensions,
            call.options.decodeAssets,
            call.options.worker
        ]),
        [
            ['project', ['kicad.native-model'], 'full', false],
            ['parse', ['kicad.native-model'], 'full', undefined]
        ]
    )
})

test('EcadParserService forwards one explicit worker mode to every project loader', async () => {
    const workerModes = new Map()

    /**
     * Builds a project-loader fake that records its common worker option.
     * @param {string} format Toolkit format.
     * @returns {{ loadAsync: (entries: object[], options: object) => object }}
     */
    function projectLoader(format) {
        return {
            loadAsync(entries, options) {
                workerModes.set(format, options.worker)
                return {
                    documents: [createDocument(format + '-document')],
                    assets: [],
                    diagnostics: []
                }
            }
        }
    }

    const gerberProjectLoader = projectLoader('gerber')
    gerberProjectLoader.supports = () => true
    const service = new EcadParserService({
        altiumProjectLoader: projectLoader('altium'),
        circuitJsonProjectLoader: projectLoader('circuitjson'),
        gerberProjectLoader,
        kicadProjectLoader: projectLoader('kicad')
    })

    await service.parseEntries(
        [
            { name: 'neutral.PcbDoc', buffer: new ArrayBuffer(1) },
            { name: 'neutral.json', buffer: new ArrayBuffer(1) },
            { name: 'neutral.gbr', buffer: new ArrayBuffer(1) },
            { name: 'neutral.kicad_pcb', buffer: new ArrayBuffer(1) }
        ],
        { worker: false }
    )

    assert.deepEqual(Object.fromEntries(workerModes), {
        altium: false,
        circuitjson: false,
        gerber: false,
        kicad: false
    })
})

test('EcadParserService rejects an invalid common worker mode', async () => {
    const service = new EcadParserService()

    await assert.rejects(service.parseEntries([], { worker: 'nested' }), {
        name: 'TypeError',
        message: "worker must be true, false, or 'auto'."
    })
})

test('EcadParserService parses independent toolkit project groups concurrently', async () => {
    const starts = []

    /**
     * Builds a loader that proves both format groups started before either
     * asynchronous parse resumes.
     * @param {string} format Source format label.
     * @returns {{ loadAsync: () => Promise<object> }} Project loader.
     */
    function projectLoader(format) {
        return {
            async loadAsync() {
                starts.push(format)
                await Promise.resolve()
                if (starts.length !== 2) {
                    throw new Error('Project groups were parsed serially.')
                }
                return {
                    documents: [createDocument(format + '-document')],
                    assets: [],
                    diagnostics: []
                }
            }
        }
    }

    const service = new EcadParserService({
        altiumProjectLoader: projectLoader('altium'),
        kicadProjectLoader: projectLoader('kicad'),
        gerberProjectLoader: {
            supports() {
                return false
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'board.PcbDoc', buffer: new ArrayBuffer(1) },
        { name: 'board.kicad_pcb', buffer: new ArrayBuffer(1) }
    ])

    assert.deepEqual(starts, ['altium', 'kicad'])
    assert.deepEqual(
        result.documents.map((document) => document.id),
        ['altium-document', 'kicad-document']
    )
    assert.deepEqual(result.diagnostics, [])
})

test('EcadParserService retains full bytes when overlapping groups return the same asset', async () => {
    const fullBytes = Uint8Array.from([1, 2, 3, 4])

    /**
     * Builds one canonical companion asset at a requested decode level.
     * @param {Uint8Array | null} data Resident bytes or metadata-only null.
     * @returns {object} Canonical toolkit asset.
     */
    function modelAsset(data) {
        return {
            id: 'asset-parts-body-step',
            kind: 'companion',
            name: 'parts/body.step',
            mediaType: 'model/step',
            byteLength: 4,
            data,
            source: null
        }
    }

    const service = new EcadParserService({
        gerberProjectLoader: {
            supports(entries) {
                return entries.some((entry) => entry.name.endsWith('.gbr'))
            },
            async loadAsync() {
                return {
                    documents: [createDocument('gerber-document')],
                    assets: [modelAsset(null)],
                    diagnostics: []
                }
            }
        },
        kicadProjectLoader: {
            async loadAsync() {
                return {
                    documents: [createDocument('kicad-document')],
                    assets: [modelAsset(fullBytes)],
                    diagnostics: []
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'board.gbr', buffer: new ArrayBuffer(1) },
        { name: 'board.kicad_pcb', buffer: new ArrayBuffer(1) },
        { name: 'parts/body.step', buffer: fullBytes.buffer }
    ])

    assert.equal(result.assets.length, 1)
    assert.equal(result.assets[0].data, fullBytes)
})

test('AppControllerParserData consumes canonical ToolkitAsset data bytes', async () => {
    const asset = AppControllerParserData.buildParsedAsset({
        name: 'parts/body.step',
        data: Uint8Array.from([1, 2, 3, 4]),
        source: {
            uri: 'https://models.invalid/parts/body.step'
        }
    })
    const clonedFile = structuredClone(asset.file)

    assert.ok(asset.file instanceof Uint8Array)
    assert.deepEqual([...asset.file], [1, 2, 3, 4])
    assert.deepEqual([...clonedFile], [1, 2, 3, 4])
    assert.equal(asset.relativePath, 'parts/body.step')
    assert.equal(asset.sourceUrl, 'https://models.invalid/parts/body.step')
})

test('AppControllerParserData owns ordinary bytes for Buffer payloads', () => {
    const sourceBytes = Buffer.from([1, 2, 3, 4])
    const asset = AppControllerParserData.buildParsedAsset({
        name: 'parts/body.step',
        data: sourceBytes
    })

    sourceBytes[0] = 0xff

    assert.equal(Object.getPrototypeOf(asset.file), Uint8Array.prototype)
    assert.deepEqual([...asset.file], [1, 2, 3, 4])
    assert.equal(asset.file.buffer.byteLength, 4)
})

test('AppControllerParserData owns only the selected binary subview', () => {
    const sourceBytes = Uint8Array.from([0, 1, 2, 3, 4, 5])
    const sourceView = new DataView(sourceBytes.buffer, 1, 4)
    const asset = AppControllerParserData.buildParsedAsset({
        name: 'parts/body.step',
        data: sourceView
    })

    sourceBytes[2] = 0xff
    asset.file[0] = 0xee

    assert.deepEqual([...asset.file], [0xee, 2, 3, 4])
    assert.deepEqual([...sourceBytes], [0, 1, 0xff, 3, 4, 5])
    assert.equal(asset.file.byteOffset, 0)
    assert.equal(asset.file.buffer.byteLength, 4)
})
