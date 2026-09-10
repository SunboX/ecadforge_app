import assert from 'node:assert/strict'
import test from 'node:test'
import { HeroPreviewDemoLoader } from '../src/HeroPreviewDemoLoader.mjs'

/** Provides controllable state notifications for preview lifecycle tests. */
class PreviewState {
    snapshot = { documentModel: null, parseStatus: 'idle' }
    listeners = new Set()

    /** Returns the current snapshot. */
    getSnapshot() {
        return this.snapshot
    }

    /** Registers a listener and emits the current state, as AppState does. */
    subscribe(listener) {
        this.listeners.add(listener)
        listener(this.snapshot)
        return () => this.listeners.delete(listener)
    }

    /** Publishes a state transition. */
    patch(values) {
        this.snapshot = { ...this.snapshot, ...values }
        this.listeners.forEach((listener) => listener(this.snapshot))
    }
}

/** Runs idle work explicitly without relying on wall-clock timing. */
class PreviewScheduler {
    nextId = 0
    callbacks = new Map()

    /** Queues browser idle work. */
    requestIdleCallback(callback) {
        const id = ++this.nextId
        this.callbacks.set(id, callback)
        return id
    }

    /** Cancels pending browser idle work. */
    cancelIdleCallback(id) {
        this.callbacks.delete(id)
    }

    /** Runs the next scheduled callback and returns its result. */
    runNext() {
        const [id, callback] = this.callbacks.entries().next().value
        this.callbacks.delete(id)
        return callback()
    }
}

/** Creates a promise whose completion the test controls. */
const deferred = () => {
    let resolve
    const promise = new Promise((complete) => {
        resolve = complete
    })
    return { promise, resolve }
}

/** Creates synthetic preview dependencies and records observable work. */
const createHarness = (overrides = {}) => {
    const state = new PreviewState()
    const scheduler = new PreviewScheduler()
    const deliveries = []
    const fetched = []
    const parsed = []
    const documents = [{ fileName: 'preview-board.kicad_pcb' }]
    const view = {
        /** Records documents delivered to the landing preview. */
        setHeroPreviewDocuments(models) {
            deliveries.push(models)
        }
    }
    const options = {
        state,
        scheduler,
        /** Returns a synthetic bundled-file response. */
        async fetcher(url, init) {
            fetched.push({ url, signal: init?.signal })
            return new Response('demo', { status: 200 })
        },
        parser: {
            /** Records parsing and returns synthetic models. */
            async parseEntries(entries) {
                parsed.push(entries)
                return { documents }
            }
        },
        ...overrides
    }
    return {
        state,
        scheduler,
        deliveries,
        fetched,
        parsed,
        documents,
        view,
        options
    }
}

test('preview waits for an idle landing page and releases its subscription after delivery', async () => {
    const harness = createHarness()
    const { view, state, scheduler, options, deliveries, parsed, fetched } =
        harness
    state.patch({ documentModel: { fileName: 'board.kicad_pcb' } })
    assert.equal(HeroPreviewDemoLoader.schedule(view, options), true)
    assert.equal(scheduler.callbacks.size, 0)
    state.patch({ documentModel: null, parseStatus: 'loading' })
    assert.equal(scheduler.callbacks.size, 0)
    assert.equal(await HeroPreviewDemoLoader.load(view), false)
    assert.equal(fetched.length, 0)

    state.patch({ parseStatus: 'idle' })
    state.patch({ statusMessage: 'ready' })
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(scheduler.callbacks.size, 1)
    assert.equal(await scheduler.runNext(), true)
    assert.equal(parsed.length, 1)
    assert.equal(fetched.length, 3)
    assert.deepEqual(deliveries, [[{ fileName: 'preview-board.kicad_pcb' }]])
    assert.equal(state.listeners.size, 0)

    state.patch({ documentModel: { fileName: 'board.kicad_pcb' } })
    state.patch({ documentModel: null })
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(await HeroPreviewDemoLoader.load(view, options), true)
    assert.equal(scheduler.callbacks.size, 0)
    assert.equal(parsed.length, 1)
    assert.equal(deliveries.length, 1)
})

test('starting an import cancels idle work and invalidates an already-dequeued callback', async () => {
    const { view, state, scheduler, options, fetched, parsed, deliveries } =
        createHarness()
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(scheduler.callbacks.size, 1)
    const staleCallback = [...scheduler.callbacks.values()][0]
    state.patch({ parseStatus: 'loading' })
    assert.equal(scheduler.callbacks.size, 0)
    state.patch({ parseStatus: 'idle' })
    assert.equal(scheduler.callbacks.size, 1)
    await staleCallback()
    assert.equal(fetched.length, 0)

    await scheduler.runNext()
    assert.equal(parsed.length, 1)
    assert.equal(deliveries.length, 1)
})

test('an interrupted fetch cannot start parsing even if fetch ignores its aborted signal', async () => {
    const responseReady = deferred()
    const requests = []
    const harness = createHarness({
        /** Holds the first fetch batch and deliberately ignores abort. */
        async fetcher(url, init) {
            requests.push({ url, signal: init?.signal })
            if (requests.length <= 3) {
                await responseReady.promise
            }
            return new Response('demo', { status: 200 })
        }
    })
    const { view, state, scheduler, options, parsed, deliveries } = harness
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(scheduler.callbacks.size, 1)
    const firstLoad = scheduler.runNext()
    assert.equal(requests.length, 3)
    state.patch({ parseStatus: 'loading' })
    assert.ok(requests.every((request) => request.signal?.aborted))
    state.patch({ parseStatus: 'idle' })
    assert.equal(scheduler.callbacks.size, 0)
    responseReady.resolve()
    assert.equal(await firstLoad, false)
    assert.equal(parsed.length, 0)
    assert.equal(deliveries.length, 0)

    assert.equal(scheduler.callbacks.size, 1)
    await scheduler.runNext()
    assert.equal(requests.length, 6)
    assert.equal(parsed.length, 1)
    assert.equal(deliveries.length, 1)
})

test('aborting a browser fetch waits for a later landing transition before retrying', async () => {
    const requests = []
    const harness = createHarness({
        /** Rejects the first batch when the browser abort signal fires. */
        fetcher(url, init) {
            requests.push({ url, signal: init?.signal })
            if (requests.length > 3) {
                return Promise.resolve(new Response('demo', { status: 200 }))
            }
            return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener(
                    'abort',
                    () => {
                        reject(new DOMException('Aborted', 'AbortError'))
                    },
                    { once: true }
                )
            })
        }
    })
    const { view, state, scheduler, options, parsed, deliveries } = harness
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(scheduler.callbacks.size, 1)
    const firstLoad = scheduler.runNext()
    state.patch({ parseStatus: 'loading' })
    assert.equal(await firstLoad, false)
    state.patch({
        parseStatus: 'ready',
        documentModel: { fileName: 'board.kicad_pcb' }
    })
    assert.equal(scheduler.callbacks.size, 0)
    assert.equal(parsed.length, 0)
    state.patch({ parseStatus: 'idle', documentModel: null })
    await scheduler.runNext()
    assert.equal(parsed.length, 1)
    assert.equal(deliveries.length, 1)
})

test('a parse already running is cached and delivered only after returning to landing', async () => {
    const parsing = deferred()
    const parsedResult = deferred()
    let parseCount = 0
    const harness = createHarness({
        parser: {
            /** Holds a parse after it has started. */
            parseEntries() {
                parseCount += 1
                parsing.resolve()
                return parsedResult.promise
            }
        }
    })
    const { view, state, scheduler, options, fetched, deliveries } = harness
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(scheduler.callbacks.size, 1)
    const loading = scheduler.runNext()
    await parsing.promise
    state.patch({ parseStatus: 'loading' })
    state.patch({
        documentModel: { fileName: 'board.kicad_pcb' },
        parseStatus: 'ready'
    })
    assert.ok(fetched.every((request) => !request.signal.aborted))
    parsedResult.resolve({
        documents: [{ fileName: 'preview-board.kicad_pcb' }]
    })
    assert.equal(await loading, false)
    assert.equal(deliveries.length, 0)
    assert.equal(scheduler.callbacks.size, 0)

    state.patch({ documentModel: null, parseStatus: 'idle' })
    state.patch({ statusMessage: 'ready' })
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(scheduler.callbacks.size, 1)
    assert.equal(await scheduler.runNext(), true)
    assert.deepEqual(deliveries, [[{ fileName: 'preview-board.kicad_pcb' }]])
    assert.equal(parseCount, 1)
    assert.equal(fetched.length, 3)
    assert.equal(state.listeners.size, 0)
})

test('a failed preview retries on a later landing transition without retrying every state update', async () => {
    let requestCount = 0
    const harness = createHarness({
        /** Fails the first request batch, then serves synthetic demo bytes. */
        async fetcher() {
            requestCount += 1
            return new Response('demo', {
                status: requestCount <= 3 ? 503 : 200
            })
        }
    })
    const { view, state, scheduler, options, parsed, deliveries } = harness
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(scheduler.callbacks.size, 1)
    assert.equal(await scheduler.runNext(), false)
    state.patch({ statusMessage: 'ready' })
    assert.equal(scheduler.callbacks.size, 0)
    assert.equal(parsed.length, 0)
    state.patch({ parseStatus: 'loading' })
    state.patch({ parseStatus: 'idle' })
    assert.equal(await scheduler.runNext(), true)
    assert.equal(parsed.length, 1)
    assert.equal(deliveries.length, 1)
})

test('repeated load requests share a running parse across state updates', async () => {
    const parsing = deferred()
    const result = deferred()
    let parseCount = 0
    const harness = createHarness({
        parser: {
            /** Holds a single parse until concurrent requests have joined. */
            parseEntries() {
                parseCount += 1
                parsing.resolve()
                return result.promise
            }
        }
    })
    const { view, state, scheduler, options, fetched, deliveries } = harness
    const firstLoad = HeroPreviewDemoLoader.load(view, options)
    await parsing.promise
    const secondLoad = HeroPreviewDemoLoader.load(view, options)
    state.patch({ statusMessage: 'ready' })
    state.patch({ parseStatus: 'loading' })
    state.patch({ parseStatus: 'idle' })
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(scheduler.callbacks.size, 0)
    assert.equal(state.listeners.size, 1)

    result.resolve({ documents: [{ fileName: 'preview-board.kicad_pcb' }] })
    assert.deepEqual(await Promise.all([firstLoad, secondLoad]), [true, true])
    assert.equal(parseCount, 1)
    assert.equal(fetched.length, 3)
    assert.equal(deliveries.length, 1)
})

test('returning to landing as a hidden parse finishes cannot strand its cached documents', async () => {
    const parsing = deferred()
    const result = deferred()
    const harness = createHarness({
        parser: {
            /** Holds parsing until a same-turn landing transition is queued. */
            parseEntries() {
                parsing.resolve()
                return result.promise
            }
        }
    })
    const { view, state, scheduler, options, deliveries } = harness
    const loading = HeroPreviewDemoLoader.load(view, options)
    await parsing.promise
    state.patch({ parseStatus: 'loading' })
    const returningHome = result.promise.then(() => {
        state.patch({ parseStatus: 'idle' })
    })
    result.resolve({ documents: [{ fileName: 'preview-board.kicad_pcb' }] })
    await Promise.all([loading, returningHome])
    assert.equal(scheduler.callbacks.size, 1)
    assert.equal(await scheduler.runNext(), true)
    assert.equal(deliveries.length, 1)
})

test('timeout scheduling also cancels during imports when idle callbacks are unavailable', async () => {
    const pending = new PreviewScheduler()
    const harness = createHarness({
        scheduler: {
            setTimeout: pending.requestIdleCallback.bind(pending),
            clearTimeout: pending.cancelIdleCallback.bind(pending)
        }
    })
    const { view, state, options, parsed, deliveries } = harness
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(pending.callbacks.size, 1)
    state.patch({ parseStatus: 'loading' })
    assert.equal(pending.callbacks.size, 0)
    state.patch({ parseStatus: 'idle' })
    assert.equal(await pending.runNext(), true)
    assert.equal(parsed.length, 1)
    assert.equal(deliveries.length, 1)
})

test('a scheduler failure can retry on the next landing transition', async () => {
    const pending = new PreviewScheduler()
    let schedulingFails = true
    const harness = createHarness({
        scheduler: {
            /** Simulates an unavailable scheduler during its first request. */
            requestIdleCallback(callback) {
                if (schedulingFails) {
                    throw new Error('Scheduler unavailable')
                }
                return pending.requestIdleCallback(callback)
            }
        }
    })
    const { view, state, options, parsed, deliveries } = harness
    HeroPreviewDemoLoader.schedule(view, options)
    assert.equal(pending.callbacks.size, 0)
    schedulingFails = false
    state.patch({ statusMessage: 'ready' })
    assert.equal(pending.callbacks.size, 0)
    state.patch({ parseStatus: 'loading' })
    state.patch({ parseStatus: 'idle' })
    assert.equal(await pending.runNext(), true)
    assert.equal(parsed.length, 1)
    assert.equal(deliveries.length, 1)
    assert.equal(state.listeners.size, 0)
})
