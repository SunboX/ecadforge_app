import assert from 'node:assert/strict'
import test from 'node:test'
import { unzipSync } from '../../src/vendor/fflate/browser.mjs'
import { PcbModelArchiveExporter } from '../../src/ui/PcbModelArchiveExporter.mjs'

/**
 * Verifies the model archive exporter builds one ZIP from embedded STEP text
 * and companion session assets while deduplicating repeated pattern/model
 * pairs.
 */
test('PcbModelArchiveExporter builds a deduplicated archive from resolved model placements', async () => {
    const result = await PcbModelArchiveExporter.buildArchive({
        archiveBaseName: 'forge-demo',
        sceneDescription: {
            components: [
                {
                    designator: 'J16',
                    pattern: 'CK-6.35-636-6P'
                },
                {
                    designator: 'J15',
                    pattern: 'CK-6.35-636-6P'
                },
                {
                    designator: 'P1',
                    pattern: 'CONN-HEADER',
                    externalModel: {
                        origin: 'session',
                        name: 'connector.wrl',
                        relativePath: 'models/connector.wrl',
                        format: 'wrl',
                        file: new Blob(['#VRML V2.0 utf8'])
                    }
                },
                {
                    designator: 'P2',
                    pattern: 'CONN-HEADER',
                    externalModel: {
                        origin: 'session',
                        name: 'connector.wrl',
                        relativePath: 'models/connector.wrl',
                        format: 'wrl',
                        file: new Blob(['#VRML V2.0 utf8'])
                    }
                }
            ],
            externalPlacements: [
                {
                    designator: 'J16',
                    externalModel: {
                        origin: 'embedded',
                        name: 'ck_636_6p.stp',
                        format: 'step',
                        payloadText: 'ISO-10303-21;\nEND-ISO-10303-21;',
                        sourceStream: 'Models/1'
                    }
                },
                {
                    designator: 'J15',
                    externalModel: {
                        origin: 'embedded',
                        name: 'ck_636_6p.stp',
                        format: 'step',
                        payloadText: 'ISO-10303-21;\nEND-ISO-10303-21;',
                        sourceStream: 'Models/1'
                    }
                }
            ]
        }
    })

    assert.equal(result.archiveName, 'forge-demo-models.zip')
    assert.equal(result.exportedEntries.length, 2)
    assert.deepEqual(
        result.exportedEntries.map((entry) => entry.archivePath).sort(),
        ['CK-6.35-636-6P.step', 'CONN-HEADER.wrl']
    )

    const archive = unzipSync(result.archiveBytes)
    assert.deepEqual(
        Object.keys(archive).sort(),
        ['CK-6.35-636-6P.step', 'CONN-HEADER.wrl']
    )
    assert.match(
        new TextDecoder().decode(archive['CK-6.35-636-6P.step']),
        /ISO-10303-21/
    )
    assert.match(
        new TextDecoder().decode(archive['CONN-HEADER.wrl']),
        /#VRML/
    )
})

/**
 * Verifies repeated footprint patterns with distinct resolved models receive
 * deterministic archive suffixes instead of overwriting one another.
 */
test('PcbModelArchiveExporter suffixes archive names when one pattern resolves to multiple models', async () => {
    const result = await PcbModelArchiveExporter.buildArchive({
        archiveBaseName: 'forge-demo',
        sceneDescription: {
            components: [
                {
                    designator: 'U1',
                    pattern: 'SOIC-8'
                },
                {
                    designator: 'U2',
                    pattern: 'SOIC-8'
                }
            ],
            externalPlacements: [
                {
                    designator: 'U1',
                    externalModel: {
                        origin: 'embedded',
                        name: 'alpha.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;\nALPHA',
                        sourceStream: 'Models/10'
                    }
                },
                {
                    designator: 'U2',
                    externalModel: {
                        origin: 'embedded',
                        name: 'beta.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;\nBETA',
                        sourceStream: 'Models/11'
                    }
                }
            ]
        }
    })

    assert.deepEqual(
        result.exportedEntries.map((entry) => entry.archivePath),
        ['SOIC-8.step', 'SOIC-8--2.step']
    )
})

/**
 * Verifies pattern-derived archive names stay as one safe file path even when
 * the original footprint pattern contains path separators.
 */
test('PcbModelArchiveExporter sanitizes path separators in pattern names', async () => {
    const result = await PcbModelArchiveExporter.buildArchive({
        archiveBaseName: 'forge-demo',
        sceneDescription: {
            components: [
                {
                    designator: 'J25',
                    pattern: 'CON/6.35/YKB21-5012SN',
                    externalModel: {
                        origin: 'session',
                        name: '5012jp.step',
                        relativePath: 'models/5012jp.step',
                        format: 'step',
                        file: new Blob(['ISO-10303-21;'])
                    }
                }
            ]
        }
    })

    assert.deepEqual(
        result.exportedEntries.map((entry) => entry.archivePath),
        ['CON-6.35-YKB21-5012SN.step']
    )
})
