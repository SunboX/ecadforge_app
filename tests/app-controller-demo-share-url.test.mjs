import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for demo URL controller tests.
 */
class DemoUrlView {
    /** @type {((demoId: string) => void | Promise<void>) | null} */
    #demoSelectionCallback

    constructor() {
        this.#demoSelectionCallback = null
    }

    /** @param {() => void} _callback @returns {void} */
    bindFileSelection(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindDrop(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindViewChange(_callback) {}

    /** @param {(demoId: string) => void | Promise<void>} callback @returns {void} */
    bindDemoSelection(callback) {
        this.#demoSelectionCallback = callback
    }

    /** @param {() => void} _callback @returns {void} */
    bindLocalOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindGitHubOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindPcbStylerClick(_callback) {}

    /** @param {string} _url @param {string} _mode @returns {void} */
    setPcbStylerLink(_url, _mode) {}

    /** @returns {boolean} */
    hasLocaleSelect() {
        return false
    }

    /** @param {string} _status @returns {void} */
    setStatus(_status) {}

    /** @param {object} _snapshot @returns {void} */
    render(_snapshot) {}

    /**
     * Runs the registered demo selection callback.
     * @param {string} demoId Demo id.
     * @returns {Promise<void>}
     */
    async chooseDemo(demoId) {
        await this.#demoSelectionCallback?.(demoId)
    }
}

/**
 * Parser double returning a fixed project batch.
 */
class DemoBatchParser {
    /**
     * Parses demo entries into a schematic and PCB document.
     * @param {{ name: string, buffer: ArrayBuffer }[]} _entries Parser entries.
     * @returns {{ documents: object[], assets: object[] }}
     */
    parseEntries(_entries) {
        return {
            documents: [
                createSchematicDocument('RP2040_minimal.kicad_sch'),
                createPcbDocument('RP2040_minimal.kicad_pcb')
            ],
            assets: []
        }
    }
}

/**
 * Analytics double that ignores tracked events.
 */
class NoopAnalytics {
    /** @param {string} _name @param {object} [_properties] @returns {void} */
    track(_name, _properties = {}) {}
}

/**
 * Builds a schematic document stub.
 * @param {string} fileName File name.
 * @returns {object}
 */
function createSchematicDocument(fileName) {
    return {
        fileName,
        kind: 'schematic',
        diagnostics: [],
        schematic: { lines: [], texts: [], components: [], pins: [] },
        bom: []
    }
}

/**
 * Builds a PCB document stub.
 * @param {string} fileName File name.
 * @returns {object}
 */
function createPcbDocument(fileName) {
    return {
        fileName,
        kind: 'pcb',
        diagnostics: [],
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            layers: [],
            components: []
        },
        bom: []
    }
}

/**
 * Verifies user-selected demo loads write a URL that can reload the same
 * bundled source instead of falling back to landing preview parsing.
 */
test('AppController writes user-selected bundled demos into the share URL', async () => {
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
                href: 'https://ecadforge.app/?view=3d&document=RP2040_minimal.kicad_pcb&reload=1.5.43'
            }
        })

        const view = new DemoUrlView()
        const controller = new AppController({
            state: new AppState(),
            view,
            parser: new DemoBatchParser(),
            analytics: new NoopAnalytics(),
            fetcher: async () => new Response('demo', { status: 200 })
        })

        await controller.init()
        await view.chooseDemo('kicad')

        assert.equal(replaceCalls.length, 1)
        const writtenUrl = new URL(replaceCalls[0][2])
        assert.equal(writtenUrl.pathname, '/')
        assert.equal(writtenUrl.searchParams.get('demo'), 'kicad')
        assert.equal(writtenUrl.searchParams.get('view'), 'pcb')
        assert.equal(
            writtenUrl.searchParams.get('document'),
            'RP2040_minimal.kicad_pcb'
        )
        assert.equal(writtenUrl.searchParams.get('reload'), '1.5.43')
    } finally {
        restoreGlobalProperty('history', originalHistory)
        restoreGlobalProperty('location', originalLocation)
    }
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
