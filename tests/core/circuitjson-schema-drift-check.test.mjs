import assert from 'node:assert/strict'
import test from 'node:test'
import {
    CircuitJsonSchemaDriftChecker,
    run
} from '../../scripts/check-circuitjson-schema-drift.mjs'

/**
 * Verifies the checked-in schema snapshot matches the active parser metadata.
 */
test('CircuitJsonSchemaDriftChecker accepts the checked-in snapshot', async () => {
    const comparison = await CircuitJsonSchemaDriftChecker.checkFile(
        'spec/circuitjson-schema-snapshot.json'
    )

    assert.equal(comparison.matches, true)
})

/**
 * Verifies reduced snapshots report drift against the active metadata.
 */
test('CircuitJsonSchemaDriftChecker reports schema drift', () => {
    const comparison = CircuitJsonSchemaDriftChecker.compare({
        elementTypes: ['pcb_board'],
        idFieldExceptions: [],
        variantSets: {
            pcbSmtPadShapes: ['rect']
        }
    })

    assert.equal(comparison.matches, false)
    assert.equal(
        comparison.unexpectedElementTypes.includes('source_component'),
        true
    )
    assert.equal(
        comparison.unexpectedIdFieldExceptions.includes('pcb_board'),
        true
    )
    assert.equal(
        comparison.unexpectedVariants.some(
            (variant) =>
                variant.set === 'pcbSmtPadShapes' &&
                variant.value === 'rotated_rect'
        ),
        true
    )
})

/**
 * Verifies the CLI runner reports a clean snapshot with exit code zero.
 */
test('schema drift CLI runner reports clean snapshots', async () => {
    let stdout = ''
    let stderr = ''
    const exitCode = await run(
        ['--snapshot', 'spec/circuitjson-schema-snapshot.json'],
        {
            stdout: { write: (text) => (stdout += text) },
            stderr: { write: (text) => (stderr += text) }
        }
    )

    assert.equal(exitCode, 0)
    assert.match(stdout, /snapshot is current/)
    assert.equal(stderr, '')
})
