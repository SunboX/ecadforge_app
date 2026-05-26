import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * View double that exposes the GitHub URL callback as a user action.
 */
class GithubOpenView {
    /** @type {((url: string) => void | Promise<void>) | null} */
    #githubOpenCallback

    constructor() {
        this.#githubOpenCallback = null
    }

    /** @param {() => void} _callback @returns {void} */
    bindLocalOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindPcbStylerClick(_callback) {}

    /** @param {(files: File[]) => void | Promise<void>} _callback @returns {void} */
    bindFileSelection(_callback) {}

    /** @param {(files: File[]) => void | Promise<void>} _callback @returns {void} */
    bindDrop(_callback) {}

    /** @param {(viewName: string) => void} _callback @returns {void} */
    bindViewChange(_callback) {}

    /** @param {(documentId: string) => void} _callback @returns {void} */
    bindDocumentSelection(_callback) {}

    /** @param {(demoId: string) => void | Promise<void>} _callback @returns {void} */
    bindDemoSelection(_callback) {}

    /** @param {(url: string) => void | Promise<void>} callback @returns {void} */
    bindGitHubOpen(callback) {
        this.#githubOpenCallback = callback
    }

    /** @param {(locale: string) => void | Promise<void>} _callback @returns {void} */
    bindLocaleChange(_callback) {}

    /** @returns {boolean} */
    hasLocaleSelect() {
        return false
    }

    /** @param {string} _status @returns {void} */
    setStatus(_status) {}

    /** @param {string} _version @returns {void} */
    setVersion(_version) {}

    /** @param {any} _snapshot @returns {void} */
    render(_snapshot) {}

    /** @param {string} _url @param {string} _mode @returns {void} */
    setPcbStylerLink(_url, _mode) {}

    /**
     * Simulates submitting the GitHub URL form.
     * @param {string} url GitHub source URL.
     * @returns {Promise<void>}
     */
    async openGitHub(url) {
        await this.#githubOpenCallback?.(url)
    }
}

/**
 * Parser double that returns one PCB document for any GitHub batch.
 */
class GithubBatchParser {
    /** @param {{ name: string, buffer: ArrayBuffer }[]} _entries @returns {object} */
    parseEntries(_entries) {
        return {
            documents: [
                {
                    fileName: 'board.kicad_pcb',
                    kind: 'pcb',
                    diagnostics: [],
                    summary: {
                        title: 'board.kicad_pcb',
                        componentCount: 0,
                        layerCount: 2,
                        outlineSegmentCount: 0,
                        boardWidthMil: 100,
                        boardHeightMil: 100
                    },
                    pcb: {
                        boardOutline: {
                            minX: 0,
                            minY: 0,
                            widthMil: 100,
                            heightMil: 100,
                            segments: []
                        },
                        layers: [],
                        components: []
                    },
                    bom: []
                }
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

test('AppController writes successful GitHub form loads into the share URL', async () => {
    const view = new GithubOpenView()
    const replaceCalls = []
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location
    const sourceUrl = 'https://github.com/acme/demo/tree/main/hardware/project'

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
                href: 'https://ecadforge.app/demo/kicad?demo=altium&github=old/ref&ref=dev&v=1.4.26'
            }
        })

        const controller = new AppController({
            state: new AppState(),
            view,
            parser: new GithubBatchParser(),
            analytics: new NoopAnalytics(),
            githubSourceLoader: {
                async loadUrl(_url) {
                    return {
                        sourceType: 'github',
                        formatFamily: 'kicad',
                        rawUrl: 'https://raw.githubusercontent.com/acme/demo/main/hardware/project/board.kicad_pcb',
                        boardUrl:
                            'https://raw.githubusercontent.com/acme/demo/main/hardware/project/board.kicad_pcb',
                        entries: [
                            {
                                name: 'board.kicad_pcb',
                                buffer: new ArrayBuffer(4)
                            }
                        ],
                        assets: [],
                        modelReferences: []
                    }
                }
            }
        })

        await controller.init()
        await view.openGitHub(sourceUrl)

        assert.deepEqual(replaceCalls, [
            [
                { active: true },
                '',
                'https://ecadforge.app/?v=1.4.26&url=https%3A%2F%2Fgithub.com%2Facme%2Fdemo%2Ftree%2Fmain%2Fhardware%2Fproject'
            ]
        ])
    } finally {
        if (originalHistory === undefined) {
            delete globalThis.history
        } else {
            Object.defineProperty(globalThis, 'history', {
                configurable: true,
                value: originalHistory
            })
        }
        if (originalLocation === undefined) {
            delete globalThis.location
        } else {
            Object.defineProperty(globalThis, 'location', {
                configurable: true,
                value: originalLocation
            })
        }
    }
})
