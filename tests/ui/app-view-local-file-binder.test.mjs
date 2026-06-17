import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewLocalFileBinder } from '../../src/ui/AppViewLocalFileBinder.mjs'

/**
 * Minimal browser File fake for local input binding tests.
 */
class FakeFile {
    /** @type {string} */
    name

    /** @type {string} */
    webkitRelativePath

    /**
     * @param {string} name File name.
     * @param {string} [relativePath] Browser relative path.
     */
    constructor(name, relativePath = '') {
        this.name = name
        this.webkitRelativePath = relativePath
    }

    /**
     * @returns {Promise<ArrayBuffer>}
     */
    async arrayBuffer() {
        return new TextEncoder().encode(this.name).buffer
    }
}

/**
 * Minimal FileSystemFileHandle fake.
 */
class FakeFileHandle {
    /** @type {'file'} */
    kind

    /** @type {string} */
    name

    /**
     * @param {string} name File name.
     */
    constructor(name) {
        this.kind = 'file'
        this.name = name
    }

    /**
     * @returns {Promise<FakeFile>}
     */
    async getFile() {
        return new FakeFile(this.name)
    }
}

/**
 * Minimal FileSystemDirectoryHandle fake.
 */
class FakeDirectoryHandle {
    /** @type {'directory'} */
    kind

    /** @type {string} */
    name

    /** @type {(FakeDirectoryHandle | FakeFileHandle)[]} */
    #children

    /**
     * @param {string} name Directory name.
     * @param {(FakeDirectoryHandle | FakeFileHandle)[]} children Entries.
     */
    constructor(name, children = []) {
        this.kind = 'directory'
        this.name = name
        this.#children = children
    }

    /**
     * @returns {AsyncGenerator<[string, FakeDirectoryHandle | FakeFileHandle]>}
     */
    async *entries() {
        for (const child of this.#children) {
            yield [child.name, child]
        }
    }
}

/**
 * Minimal event target for input binding tests.
 */
class FakeInput {
    /** @type {Map<string, Set<(event: any) => void | Promise<void>>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
        this.files = null
        this.value = ''
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void | Promise<void>} listener Listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }
        this.#listeners.get(type)?.add(listener)
    }

    /**
     * @param {string} type Event type.
     * @param {Record<string, any>} [event] Event payload.
     * @returns {Promise<Record<string, any>>}
     */
    async dispatch(type, event = {}) {
        const payload = {
            type,
            defaultPrevented: false,
            preventDefault() {
                this.defaultPrevented = true
            },
            ...event
        }

        for (const listener of this.#listeners.get(type) || []) {
            await listener(payload)
        }

        return payload
    }
}

/**
 * Verifies Chrome-capable folder opens use the browser directory picker API
 * instead of the upload-style webkitdirectory input dialog.
 */
test('AppViewLocalFileBinder uses directory handles for folder clicks when available', async () => {
    const folderInput = new FakeInput()
    const projectDirectory = new FakeDirectoryHandle('Project', [
        new FakeFileHandle('demo.kicad_pro'),
        new FakeDirectoryHandle('models', [new FakeFileHandle('body.step')])
    ])
    const received = []

    AppViewLocalFileBinder.bind({
        folderInput,
        windowRef: {
            async showDirectoryPicker() {
                return projectDirectory
            }
        },
        callback(files) {
            received.push(files)
        }
    })

    const clickEvent = await folderInput.dispatch('click')

    assert.equal(clickEvent.defaultPrevented, true)
    assert.deepEqual(
        received[0].map((file) => file.webkitRelativePath || file.name),
        ['demo.kicad_pro', 'models/body.step']
    )
})

/**
 * Verifies browsers without directory handles still use the existing hidden
 * folder input fallback.
 */
test('AppViewLocalFileBinder keeps folder input fallback without directory handles', async () => {
    const folderInput = new FakeInput()
    const pickedFiles = [
        new FakeFile('demo.kicad_pro', 'Project/demo.kicad_pro')
    ]
    const received = []

    AppViewLocalFileBinder.bind({
        folderInput,
        windowRef: {},
        callback(files) {
            received.push(files)
        }
    })

    const clickEvent = await folderInput.dispatch('click')
    folderInput.files = pickedFiles
    folderInput.value = 'filled'
    await folderInput.dispatch('change')

    assert.equal(clickEvent.defaultPrevented, false)
    assert.deepEqual(received, [pickedFiles])
    assert.equal(folderInput.value, '')
})
