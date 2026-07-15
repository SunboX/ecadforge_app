import assert from 'node:assert/strict'
import test from 'node:test'
import { AppControllerParserData } from '../../src/AppControllerParserData.mjs'
import { EcadCircuitJsonContext } from '../../src/core/ecad/EcadCircuitJsonContext.mjs'

/**
 * Builds one compact canonical document with extension payload data.
 * @param {unknown} payload Extension payload.
 * @returns {Record<string, any>} Canonical document.
 */
function createDocument(payload) {
    return {
        schema: 'ecad-toolkit.document.v1',
        id: 'document-context-provenance',
        modelSchema: { name: 'circuit-json', version: '0.0.446' },
        model: [],
        source: {
            format: 'altium',
            fileName: 'fake-board.PcbDoc',
            fileType: 'pcb'
        },
        extensions: {
            altium: {
                $meta: {
                    schema: 'ecad-toolkit.extension.v1',
                    completeness: 'native',
                    included: ['payload'],
                    omitted: []
                },
                payload
            }
        },
        assets: [],
        diagnostics: [],
        statistics: {}
    }
}

test('generic app contexts preserve altered-prototype extension buffers', () => {
    const payload = new ArrayBuffer(4)
    new Uint8Array(payload).set([11, 22, 33, 44])
    Object.setPrototypeOf(payload, Object.prototype)

    const context = EcadCircuitJsonContext.prepare(createDocument(payload))

    assert.deepEqual(
        [...new Uint8Array(context.extensions.altium.payload)],
        [11, 22, 33, 44]
    )
})

test('worker-cloned documents can adopt and reuse a prepared app context', () => {
    const document = structuredClone(createDocument(new Uint8Array([3, 1, 4])))

    const adopted = EcadCircuitJsonContext.adoptStructuredClone(document)

    assert.strictEqual(EcadCircuitJsonContext.prepare(document), adopted)
    assert.deepEqual([...adopted.extensions.altium.payload], [3, 1, 4])
})

test('worker-result normalization adopts only canonical cloned documents', () => {
    const canonical = structuredClone(
        createDocument(new Uint8Array([2, 7, 1, 8]))
    )
    const nativeCompatibilityDocument = {
        fileName: 'legacy-board.PcbDoc',
        kind: 'pcb',
        pcb: { boardOutline: null, layers: [], components: [] }
    }

    const result = AppControllerParserData.normalizeStructuredCloneParseResult({
        documents: [canonical, nativeCompatibilityDocument]
    })

    assert.deepEqual(result.documents, [canonical, nativeCompatibilityDocument])
    assert.deepEqual(
        [
            ...EcadCircuitJsonContext.prepare(canonical).extensions.altium
                .payload
        ],
        [2, 7, 1, 8]
    )
})

test('worker-result normalization cooperatively adopts document batches', async () => {
    const first = structuredClone(createDocument({ marker: 'first' }))
    const second = structuredClone(createDocument({ marker: 'second' }))
    let yields = 0

    const result =
        await AppControllerParserData.normalizeStructuredCloneParseResultAsync(
            {
                documents: [first, second]
            },
            {
                yield: async () => {
                    yields += 1
                }
            }
        )

    assert.deepEqual(result.documents, [first, second])
    assert.equal(yields, 4)
    assert.strictEqual(EcadCircuitJsonContext.prepare(first).document, first)
    assert.strictEqual(EcadCircuitJsonContext.prepare(second).document, second)
})

test('worker-result normalization falls back when an injected scheduler rejects after adoption', async () => {
    const document = structuredClone(createDocument({ marker: 'injected' }))
    let yields = 0

    const result =
        await AppControllerParserData.normalizeStructuredCloneParseResultAsync(
            { documents: [document] },
            {
                yield: () => {
                    yields += 1
                    if (yields === 2) {
                        return Promise.reject(
                            new Error('injected scheduler failed')
                        )
                    }
                }
            }
        )

    assert.equal(yields, 2)
    assert.strictEqual(result.documents[0], document)
    assert.strictEqual(
        EcadCircuitJsonContext.prepare(document).document,
        document
    )
})

test('worker-result normalization falls back when the platform scheduler rejects after adoption', async () => {
    const document = structuredClone(createDocument({ marker: 'platform' }))
    const schedulerDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'scheduler'
    )
    let yields = 0

    try {
        Object.defineProperty(globalThis, 'scheduler', {
            configurable: true,
            value: {
                yield: () => {
                    yields += 1
                    if (yields === 2) {
                        return Promise.reject(
                            new Error('platform scheduler failed')
                        )
                    }
                }
            }
        })
        const result =
            await AppControllerParserData.normalizeStructuredCloneParseResultAsync(
                { documents: [document] }
            )

        assert.equal(yields, 2)
        assert.strictEqual(result.documents[0], document)
        assert.strictEqual(
            EcadCircuitJsonContext.prepare(document).document,
            document
        )
    } finally {
        if (schedulerDescriptor) {
            Object.defineProperty(globalThis, 'scheduler', schedulerDescriptor)
        } else {
            delete globalThis.scheduler
        }
    }
})

test('worker-result normalization disables a rejecting scheduler across large multi-slice batches', async (context) => {
    await context.test('injected scheduler', async () => {
        const document = structuredClone(
            createDocument(
                Array.from({ length: 12_000 }, (_, index) => ({ index }))
            )
        )
        let schedulerCalls = 0

        await AppControllerParserData.normalizeStructuredCloneParseResultAsync(
            { documents: [document] },
            {
                yield: () => {
                    schedulerCalls += 1
                    return Promise.reject(
                        new Error('injected scheduler failed')
                    )
                }
            }
        )

        assert.equal(schedulerCalls, 1)
    })

    await context.test('platform scheduler', async () => {
        const document = structuredClone(
            createDocument(
                Array.from({ length: 12_000 }, (_, index) => ({ index }))
            )
        )
        const schedulerDescriptor = Object.getOwnPropertyDescriptor(
            globalThis,
            'scheduler'
        )
        let schedulerCalls = 0

        try {
            Object.defineProperty(globalThis, 'scheduler', {
                configurable: true,
                value: {
                    yield: () => {
                        schedulerCalls += 1
                        return Promise.reject(
                            new Error('platform scheduler failed')
                        )
                    }
                }
            })
            await AppControllerParserData.normalizeStructuredCloneParseResultAsync(
                { documents: [document] }
            )

            assert.equal(schedulerCalls, 1)
        } finally {
            if (schedulerDescriptor) {
                Object.defineProperty(
                    globalThis,
                    'scheduler',
                    schedulerDescriptor
                )
            } else {
                delete globalThis.scheduler
            }
        }
    })
})

test('concurrent context callers isolate index validation from shared adoption', async () => {
    const document = structuredClone(createDocument({ marker: 'shared' }))
    let releaseAdoption
    const adoptionYield = new Promise((resolve) => {
        releaseAdoption = resolve
    })

    const invalid = EcadCircuitJsonContext.adoptStructuredCloneAsync(document, {
        indexes: ['not-a-real-index'],
        yield: () => adoptionYield
    })
    const valid = EcadCircuitJsonContext.adoptStructuredCloneAsync(document)
    releaseAdoption()

    await assert.rejects(invalid, /index/iu)
    const context = await valid
    assert.strictEqual(context.document, document)
})

test('cancelling one context caller does not reject another shared adopter', async () => {
    const document = structuredClone(
        createDocument(Array.from({ length: 5000 }, (_, index) => ({ index })))
    )
    const cancelledCaller = new AbortController()
    let releaseYield
    let signalYieldStarted
    const yieldStarted = new Promise((resolve) => {
        signalYieldStarted = resolve
    })
    const blockedYield = new Promise((resolve) => {
        releaseYield = resolve
    })

    const cancelled = EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        {
            signal: cancelledCaller.signal,
            yield: async () => {
                signalYieldStarted()
                await blockedYield
            }
        }
    )
    const retained = EcadCircuitJsonContext.adoptStructuredCloneAsync(document)

    await yieldStarted
    cancelledCaller.abort(new Error('caller cancelled'))
    releaseYield()

    await assert.rejects(cancelled, /caller cancelled/iu)
    const context = await retained
    assert.strictEqual(context.document, document)
    assert.equal(Object.isFrozen(context.extensions), true)
})

test('a new adopter joins shared work after the prior caller cancels', async () => {
    const document = structuredClone(
        createDocument(Array.from({ length: 5000 }, (_, index) => ({ index })))
    )
    const cancelledCaller = new AbortController()
    let releaseYield
    let signalYieldStarted
    const yieldStarted = new Promise((resolve) => {
        signalYieldStarted = resolve
    })
    const blockedYield = new Promise((resolve) => {
        releaseYield = resolve
    })

    const cancelled = EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        {
            signal: cancelledCaller.signal,
            yield: async () => {
                signalYieldStarted()
                await blockedYield
            }
        }
    )
    await yieldStarted
    cancelledCaller.abort(new Error('old caller cancelled'))
    const replacement =
        EcadCircuitJsonContext.adoptStructuredCloneAsync(document)
    releaseYield()

    await assert.rejects(cancelled, /old caller cancelled/iu)
    const context = await replacement
    assert.strictEqual(context.document, document)
    assert.equal(Object.isFrozen(context.extensions), true)
})

test('late caller cancellation leaves shared adoption reusable', async () => {
    const document = structuredClone(
        createDocument({
            bytes: new Uint8Array(4096),
            records: Array.from({ length: 12000 }, (_, index) => ({ index }))
        })
    )
    const cancelledCaller = new AbortController()
    let releaseYield
    let signalBlockedYield
    const blockedYieldReached = new Promise((resolve) => {
        signalBlockedYield = resolve
    })
    const blockedYield = new Promise((resolve) => {
        releaseYield = resolve
    })
    let yields = 0

    const cancelled = EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        {
            signal: cancelledCaller.signal,
            yield: async () => {
                yields += 1
                if (yields !== 20) return
                signalBlockedYield()
                await blockedYield
            }
        }
    )
    await blockedYieldReached
    cancelledCaller.abort(new Error('late caller cancelled'))
    const retained = EcadCircuitJsonContext.adoptStructuredCloneAsync(document)
    releaseYield()

    await assert.rejects(cancelled, /late caller cancelled/iu)
    const context = await retained
    assert.strictEqual(context.document, document)
    assert.equal(Object.isFrozen(context.extensions), true)
})

test('a replacement caller can cancel while shared work remains blocked', async () => {
    const document = structuredClone(
        createDocument(Array.from({ length: 5000 }, (_, index) => ({ index })))
    )
    const originalCaller = new AbortController()
    const replacementCaller = new AbortController()
    let releaseYield
    let signalYieldStarted
    const yieldStarted = new Promise((resolve) => {
        signalYieldStarted = resolve
    })
    const blockedYield = new Promise((resolve) => {
        releaseYield = resolve
    })

    const original = EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        {
            signal: originalCaller.signal,
            yield: async () => {
                signalYieldStarted()
                await blockedYield
            }
        }
    )
    await yieldStarted
    originalCaller.abort(new Error('original caller cancelled'))
    const replacement = EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        { signal: replacementCaller.signal }
    )
    replacementCaller.abort(new Error('replacement caller cancelled'))

    await assert.rejects(replacement, /replacement caller cancelled/iu)
    const retained = EcadCircuitJsonContext.adoptStructuredCloneAsync(document)
    releaseYield()
    await assert.rejects(original, /original caller cancelled/iu)
    const context = await retained
    assert.strictEqual(context.document, document)
})

test('shared preparation survives a rejected host scheduler without restarting', async () => {
    const document = structuredClone(
        createDocument(
            Array.from({ length: 12_000 }, (_, index) => ({ index }))
        )
    )
    let yields = 0

    const context = await EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        {
            yield: () => {
                yields += 1
                if (yields === 20) throw new Error('host scheduler failed')
            }
        }
    )

    assert.equal(yields, 20)
    assert.strictEqual(context.document, document)
    assert.strictEqual(EcadCircuitJsonContext.prepare(document), context)
})

test('terminal adoption failures poison a document instead of restarting partial work', async () => {
    const document = structuredClone(
        createDocument(
            Array.from({ length: 12_000 }, (_, index) => ({
                index,
                value: index
            }))
        )
    )
    const retainedRecord = document.extensions.altium.payload[0]
    let yields = 0

    const firstError = await EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        {
            yield: () => {
                yields += 1
                if (yields !== 2) return
                Object.defineProperty(retainedRecord, 'value', {
                    configurable: true,
                    enumerable: true,
                    get: () => 7
                })
            }
        }
    ).then(
        () => null,
        (error) => error
    )
    let retryYields = 0
    const retryError = await EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        { yield: () => (retryYields += 1) }
    ).then(
        () => null,
        (error) => error
    )

    assert.ok(firstError instanceof Error)
    assert.strictEqual(retryError, firstError)
    assert.equal(retryYields, 0)
})

test('reentrant adopters join a pending context registered before the first yield', async () => {
    const document = structuredClone(
        createDocument(Array.from({ length: 5000 }, (_, index) => ({ index })))
    )
    let replacement
    let reentered = false
    let signalReplacementStarted
    const replacementStarted = new Promise((resolve) => {
        signalReplacementStarted = resolve
    })

    const original = EcadCircuitJsonContext.adoptStructuredCloneAsync(
        document,
        {
            yield: () => {
                if (reentered) return
                reentered = true
                replacement =
                    EcadCircuitJsonContext.adoptStructuredCloneAsync(document)
                signalReplacementStarted()
            }
        }
    )
    await replacementStarted
    const [originalContext, replacementContext] = await Promise.all([
        original,
        replacement
    ])

    assert.strictEqual(replacementContext, originalContext)
    assert.strictEqual(
        EcadCircuitJsonContext.prepare(document),
        originalContext
    )
})

test('synchronous prepare rejects a document with async adoption in progress', async () => {
    const document = structuredClone(
        createDocument(Array.from({ length: 5000 }, (_, index) => ({ index })))
    )
    let releaseYield
    let signalYieldStarted
    const yieldStarted = new Promise((resolve) => {
        signalYieldStarted = resolve
    })
    const blockedYield = new Promise((resolve) => {
        releaseYield = resolve
    })
    const pending = EcadCircuitJsonContext.adoptStructuredCloneAsync(document, {
        yield: async () => {
            signalYieldStarted()
            await blockedYield
        }
    })
    await yieldStarted

    assert.throws(
        () => EcadCircuitJsonContext.prepare(document),
        /adoption is in progress/iu
    )
    releaseYield()
    await pending
})

test('synchronous structured-clone adoption rejects an async adoption in progress', async () => {
    const document = structuredClone(
        createDocument(Array.from({ length: 5000 }, (_, index) => ({ index })))
    )
    let releaseYield
    let signalYieldStarted
    const yieldStarted = new Promise((resolve) => {
        signalYieldStarted = resolve
    })
    const blockedYield = new Promise((resolve) => {
        releaseYield = resolve
    })
    const pending = EcadCircuitJsonContext.adoptStructuredCloneAsync(document, {
        yield: async () => {
            signalYieldStarted()
            await blockedYield
        }
    })
    await yieldStarted

    assert.throws(
        () => EcadCircuitJsonContext.adoptStructuredClone(document),
        /adoption is in progress/iu
    )
    releaseYield()
    await pending
})
