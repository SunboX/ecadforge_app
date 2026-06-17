import assert from 'node:assert/strict'
import test from 'node:test'
import { LocalFileSelectionCollector } from '../../src/ui/LocalFileSelectionCollector.mjs'

/**
 * Minimal browser File fake for local intake tests.
 */
class FakeFile {
    /** @type {string} */
    name

    /** @type {string} */
    webkitRelativePath

    /** @type {ArrayBuffer} */
    #buffer

    /**
     * @param {string} name File name.
     * @param {string} [relativePath] Browser relative path.
     */
    constructor(name, relativePath = '') {
        this.name = name
        this.webkitRelativePath = relativePath
        this.#buffer = new TextEncoder().encode(name).buffer
    }

    /**
     * @returns {Promise<ArrayBuffer>}
     */
    async arrayBuffer() {
        return this.#buffer.slice(0)
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
 * Verifies KiCad file selections can collect companion assets from one
 * browser-selected project directory.
 */
test('LocalFileSelectionCollector appends companion directory files for KiCad selections', async () => {
    const selectedFiles = [
        new FakeFile('demo.kicad_pro'),
        new FakeFile('demo.kicad_sch'),
        new FakeFile('demo.kicad_pcb')
    ]
    const projectDirectory = new FakeDirectoryHandle('Project', [
        new FakeDirectoryHandle('symbols', [
            new FakeFileHandle('logic.kicad_sym')
        ]),
        new FakeDirectoryHandle('footprints', [
            new FakeDirectoryHandle('QFN.pretty', [
                new FakeFileHandle('QFN.kicad_mod')
            ])
        ]),
        new FakeDirectoryHandle('models', [new FakeFileHandle('body.step')]),
        new FakeFileHandle('notes.txt')
    ])
    const pickerOptions = []

    const collectedFiles =
        await LocalFileSelectionCollector.collectFileInputSelection(
            selectedFiles,
            {
                windowRef: {
                    async showDirectoryPicker(options) {
                        pickerOptions.push(options)
                        return projectDirectory
                    }
                }
            }
        )

    assert.deepEqual(pickerOptions, [
        { id: 'kicad-companion-assets', mode: 'read' }
    ])
    assert.deepEqual(
        collectedFiles.map((file) => file.webkitRelativePath || file.name),
        [
            'demo.kicad_pro',
            'demo.kicad_sch',
            'demo.kicad_pcb',
            'symbols/logic.kicad_sym',
            'footprints/QFN.pretty/QFN.kicad_mod',
            'models/body.step'
        ]
    )
    assert.equal(
        await collectedFiles
            .at(-1)
            .arrayBuffer()
            .then((buffer) => buffer.byteLength),
        'body.step'.length
    )
})

/**
 * Verifies non-KiCad selections keep their normal file-picker behavior.
 */
test('LocalFileSelectionCollector does not request companion folders for non-KiCad selections', async () => {
    const selectedFiles = [new FakeFile('board.PcbDoc')]
    let pickerCalled = false

    const collectedFiles =
        await LocalFileSelectionCollector.collectFileInputSelection(
            selectedFiles,
            {
                windowRef: {
                    async showDirectoryPicker() {
                        pickerCalled = true
                        return new FakeDirectoryHandle('unused')
                    }
                }
            }
        )

    assert.equal(pickerCalled, false)
    assert.deepEqual(collectedFiles, selectedFiles)
})

/**
 * Verifies cancelling the optional companion-folder prompt does not block the
 * selected KiCad project files from opening.
 */
test('LocalFileSelectionCollector keeps KiCad files when companion folder picking is cancelled', async () => {
    const selectedFiles = [new FakeFile('demo.kicad_pcb')]
    const abortError = new Error('User cancelled')
    abortError.name = 'AbortError'

    const collectedFiles =
        await LocalFileSelectionCollector.collectFileInputSelection(
            selectedFiles,
            {
                windowRef: {
                    async showDirectoryPicker() {
                        throw abortError
                    }
                }
            }
        )

    assert.deepEqual(collectedFiles, selectedFiles)
})

/**
 * Verifies direct folder picking collects supported ECAD project documents and
 * companion assets from the selected directory tree.
 */
test('LocalFileSelectionCollector collects supported files from a directory picker', async () => {
    const projectDirectory = new FakeDirectoryHandle('Project', [
        new FakeFileHandle('demo.kicad_pro'),
        new FakeFileHandle('demo.kicad_pcb'),
        new FakeDirectoryHandle('symbols', [
            new FakeFileHandle('logic.kicad_sym')
        ]),
        new FakeDirectoryHandle('models', [new FakeFileHandle('body.wrl')]),
        new FakeFileHandle('notes.txt')
    ])

    const collectedFiles =
        await LocalFileSelectionCollector.collectFolderInputSelection({
            windowRef: {
                async showDirectoryPicker(options) {
                    assert.deepEqual(options, {
                        id: 'local-project-folder',
                        mode: 'read'
                    })
                    return projectDirectory
                }
            }
        })

    assert.deepEqual(
        collectedFiles.map((file) => file.webkitRelativePath || file.name),
        [
            'demo.kicad_pro',
            'demo.kicad_pcb',
            'symbols/logic.kicad_sym',
            'models/body.wrl'
        ]
    )
})
