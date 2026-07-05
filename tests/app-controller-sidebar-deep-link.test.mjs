import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for sidebar URL-state tests.
 */
class SidebarDeepLinkView {
    /** @type {((files: File[]) => void | Promise<void>) | null} */
    #fileSelectionCallback

    /** @type {((tabName: string) => void) | null} */
    #sidebarTabSelectionCallback

    constructor() {
        this.#fileSelectionCallback = null
        this.#sidebarTabSelectionCallback = null
    }

    /** @param {(files: File[]) => void | Promise<void>} callback @returns {void} */
    bindFileSelection(callback) {
        this.#fileSelectionCallback = callback
    }

    /** @param {(files: File[]) => void | Promise<void>} _callback @returns {void} */
    bindDrop(_callback) {}

    /** @param {(viewName: string) => void} _callback @returns {void} */
    bindViewChange(_callback) {}

    /** @param {(tabName: string) => void} callback @returns {void} */
    bindSidebarTabSelection(callback) {
        this.#sidebarTabSelectionCallback = callback
    }

    /** @param {(demoId: string) => void | Promise<void>} _callback @returns {void} */
    bindDemoSelection(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindLocalOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindGitHubOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindPcbStylerClick(_callback) {}

    /** @returns {boolean} */
    hasLocaleSelect() {
        return false
    }

    /** @param {string} _status @returns {void} */
    setStatus(_status) {}

    /** @param {object} _snapshot @returns {void} */
    render(_snapshot) {}

    /** @param {File[]} files @returns {Promise<void>} */
    async chooseFiles(files) {
        await this.#fileSelectionCallback?.(files)
    }

    /** @param {string} tabName @returns {void} */
    selectSidebarTab(tabName) {
        this.#sidebarTabSelectionCallback?.(tabName)
    }
}

/**
 * Minimal file fake.
 */
class FakeFile {
    /** @type {string} */
    name

    /** @param {string} name File name. */
    constructor(name) {
        this.name = name
    }

    /** @returns {Promise<ArrayBuffer>} */
    async arrayBuffer() {
        return new ArrayBuffer(8)
    }
}

/**
 * Minimal parser fake.
 */
class FakeParser {
    /** @param {string} fileName @param {ArrayBuffer} _buffer @returns {object} */
    parseArrayBuffer(fileName, _buffer) {
        return {
            fileName,
            kind: 'pcb',
            diagnostics: [],
            summary: { title: fileName },
            pcb: {
                boardOutline: { widthMil: 100, heightMil: 100 },
                layers: [],
                components: []
            },
            bom: []
        }
    }
}

/**
 * Verifies user-selected sidebar panels are reflected in the share URL.
 */
test('AppController writes selected sidebar panel into the URL', async () => {
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location
    const replaceCalls = []

    try {
        Object.defineProperty(globalThis, 'history', {
            configurable: true,
            value: {
                state: { active: true },
                replaceState(...args) {
                    replaceCalls.push(args)
                }
            }
        })
        Object.defineProperty(globalThis, 'location', {
            configurable: true,
            value: {
                href: 'https://ecadforge.app/?view=pcb&document=alpha.PcbDoc&reload=1.8.127'
            }
        })

        const state = new AppState()
        const view = new SidebarDeepLinkView()
        const controller = new AppController({
            state,
            view,
            parser: new FakeParser()
        })

        await controller.init()
        await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
        replaceCalls.length = 0

        view.selectSidebarTab('objects')

        assert.equal(state.getSnapshot().activeSidebarTab, 'objects')
        assert.equal(replaceCalls.length, 1)
        const writtenUrl = new URL(replaceCalls.at(-1)[2])
        assert.equal(writtenUrl.searchParams.get('view'), 'pcb')
        assert.equal(writtenUrl.searchParams.get('document'), 'alpha.PcbDoc')
        assert.equal(writtenUrl.searchParams.get('panel'), 'objects')
        assert.equal(writtenUrl.searchParams.get('reload'), '1.8.127')
    } finally {
        restoreGlobalProperty('history', originalHistory)
        restoreGlobalProperty('location', originalLocation)
    }
})

/**
 * Verifies startup deep links can open a non-default sidebar panel.
 */
test('AppController restores startup sidebar panel state', async () => {
    const state = new AppState()
    const view = new SidebarDeepLinkView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser(),
        startupSource: {
            type: 'state',
            panel: 'layers'
        }
    })

    await controller.init()

    assert.equal(state.getSnapshot().activeSidebarTab, 'layers')
})

/**
 * Restores or deletes a patched global property.
 * @param {string} propertyName Global property name.
 * @param {unknown} originalValue Original property value.
 * @returns {void}
 */
function restoreGlobalProperty(propertyName, originalValue) {
    if (originalValue === undefined) {
        delete globalThis[propertyName]
        return
    }

    Object.defineProperty(globalThis, propertyName, {
        configurable: true,
        value: originalValue
    })
}
