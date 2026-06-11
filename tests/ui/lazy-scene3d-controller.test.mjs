import assert from 'node:assert/strict'
import test from 'node:test'
import { LazyScene3dController } from '../../src/ui/LazyScene3dController.mjs'

/**
 * Defers promise settlement until a test chooses to resolve it.
 * @returns {{ promise: Promise<any>, resolve: (value: any) => void, reject: (error: Error) => void }}
 */
function createDeferred() {
    let resolve
    let reject
    const promise = new Promise((nextResolve, nextReject) => {
        resolve = nextResolve
        reject = nextReject
    })

    return { promise, resolve, reject }
}

/**
 * Flushes queued promise continuations.
 * @returns {Promise<void>}
 */
async function flushPromises() {
    await Promise.resolve()
    await Promise.resolve()
}

/**
 * Verifies queued 3D selections are replayed after the real runtime loads.
 */
test('LazyScene3dController replays the latest selection after runtime loading', async () => {
    const deferred = createDeferred()
    const createdControllers = []
    const documentModel = { pcb: {} }
    const viewportNode = {}
    const options = {}
    const controller = new LazyScene3dController(
        viewportNode,
        documentModel,
        options,
        () => deferred.promise
    )

    controller.setSelectedComponent('C1')
    controller.setSelectedComponent('U2')
    deferred.resolve((nextViewportNode, nextDocumentModel, nextOptions) => {
        const runtimeController = {
            viewportNode: nextViewportNode,
            documentModel: nextDocumentModel,
            options: nextOptions,
            selectedComponents: [],
            setSelectedComponent(componentKey) {
                this.selectedComponents.push(componentKey)
            },
            dispose() {}
        }
        createdControllers.push(runtimeController)
        return runtimeController
    })
    await flushPromises()

    assert.equal(controller.getDocumentModel(), documentModel)
    assert.equal(createdControllers.length, 1)
    assert.equal(createdControllers[0].viewportNode, viewportNode)
    assert.equal(createdControllers[0].documentModel, documentModel)
    assert.equal(createdControllers[0].options, options)
    assert.deepEqual(createdControllers[0].selectedComponents, ['U2'])
})

/**
 * Verifies disposal before the runtime import resolves prevents scene creation.
 */
test('LazyScene3dController skips runtime construction after disposal', async () => {
    const deferred = createDeferred()
    let createCount = 0
    const controller = new LazyScene3dController(
        {},
        { pcb: {} },
        {},
        () => deferred.promise
    )

    controller.dispose()
    deferred.resolve(() => {
        createCount += 1
        return { dispose() {} }
    })
    await flushPromises()

    assert.equal(createCount, 0)
})
