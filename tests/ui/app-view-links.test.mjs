import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for view-link interaction tests.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * Registers one listener.
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }
        this.#listeners.get(type)?.add(listener)
    }

    /**
     * Dispatches one synthetic event.
     * @param {string} type
     * @param {Record<string, any>} [event]
     * @returns {void}
     */
    dispatch(type, event = {}) {
        const payload = { type, currentTarget: this, target: this, ...event }
        ;[...(this.#listeners.get(type) || [])].forEach((listener) =>
            listener(payload)
        )
    }
}

/**
 * Minimal generic node for AppView tests.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        super()
        this.#attributes = new Map()
        this.innerHTML = ''
        this.textContent = ''
        this.value = ''
        this.hidden = false
        this.classList = {
            add: () => {},
            remove: () => {}
        }
    }

    /**
     * Sets one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
        if (name === 'hidden') {
            this.hidden = true
        }
    }

    /**
     * Returns one attribute value.
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Removes one attribute value.
     * @param {string} name
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
        if (name === 'hidden') {
            this.hidden = false
        }
    }

    /**
     * Returns no matching descendants for generic nodes.
     * @param {string} _selector
     * @returns {null}
     */
    querySelector(_selector) {
        return null
    }
}

globalThis.HTMLElement = FakeNode

/**
 * Minimal anchor-like tab node.
 */
class FakeViewLink extends FakeNode {
    /**
     * @param {string} viewName
     */
    constructor(viewName) {
        super()
        this.dataset = { view: viewName }
        this.setAttribute('data-view', viewName)
        this.setAttribute('href', '/' + viewName)
    }

    /**
     * Returns this link for AppView delegated click handling.
     * @param {string} selector
     * @returns {FakeViewLink | null}
     */
    closest(selector) {
        return selector === '[data-view]' ? this : null
    }
}

/**
 * Minimal container that exposes view links.
 */
class FakeTabsNode extends FakeNode {
    /** @type {FakeViewLink[]} */
    #links

    constructor() {
        super()
        this.#links = ['schematic', 'pcb', '3d', 'bom', 'diagnostics'].map(
            (viewName) => new FakeViewLink(viewName)
        )
    }

    /**
     * Returns matching view links.
     * @param {string} selector
     * @returns {FakeViewLink[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-view]' ? this.#links : []
    }

    /**
     * Dispatches a click event as if one view link was selected.
     * @param {string} viewName
     * @returns {{ prevented: boolean }}
     */
    clickView(viewName) {
        const link = this.#links.find(
            (entry) => entry.getAttribute('data-view') === viewName
        )
        const eventState = { prevented: false }

        if (!link) {
            return eventState
        }

        this.dispatch('click', {
            target: link,
            preventDefault: () => {
                eventState.prevented = true
            }
        })

        return eventState
    }
}

/**
 * Minimal brand-home link node.
 */
class FakeBrandHomeLink extends FakeNode {
    /**
     * Dispatches a click event as if the brand lockup was selected.
     * @returns {{ prevented: boolean }}
     */
    clickBrand() {
        const eventState = { prevented: false }

        this.dispatch('click', {
            preventDefault: () => {
                eventState.prevented = true
            }
        })

        return eventState
    }
}

/**
 * Minimal document exposing AppView mount points.
 */
class FakeDocument {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        this.#nodes = new Map([
            ['#brandHomeLink', new FakeBrandHomeLink()],
            ['#fileInput', new FakeNode()],
            ['#folderInput', new FakeNode()],
            ['#dropZone', new FakeNode()],
            ['#statusMessage', new FakeNode()],
            ['#appVersion', new FakeNode()],
            ['#localeSelect', new FakeNode()],
            ['#summaryGrid', new FakeNode()],
            ['#viewerStage', new FakeNode()],
            ['#documentRail', new FakeNode()],
            ['#viewContent', new FakeNode()],
            ['#activeDocumentName', new FakeNode()],
            ['#viewTabs', new FakeTabsNode()],
            ['#diagnosticsCount', new FakeNode()]
        ])
    }

    /**
     * Returns one node by selector.
     * @param {string} selector
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Builds a minimal render snapshot.
 * @param {string} activeView
 * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents: any[], activeDocumentId: string, documentModel: null }}
 */
function createSnapshot(activeView) {
    return {
        activeView,
        locale: 'en',
        parseStatus: 'idle',
        statusMessage: '',
        activeFileName: '',
        documents: [],
        activeDocumentId: '',
        documentModel: null
    }
}

/**
 * Verifies view links update the active tab through JavaScript without forcing
 * a browser navigation during an open file session.
 */
test('AppView binds normal view links without navigating away', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindViewChange((viewName) => {
        received.push(viewName)
    })
    const eventState = fakeDocument.querySelector('#viewTabs').clickView('pcb')

    assert.deepEqual(received, ['pcb'])
    assert.equal(eventState.prevented, true)
})

/**
 * Verifies view links keep the current browser URL copyable for the active
 * tab without discarding existing source parameters.
 */
test('AppView writes selected views into the browser URL', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const replaceCalls = []
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location

    try {
        Object.defineProperty(globalThis, 'history', {
            configurable: true,
            value: {
                state: { source: true },
                replaceState(...args) {
                    replaceCalls.push(args)
                }
            }
        })
        Object.defineProperty(globalThis, 'location', {
            configurable: true,
            value: {
                href: 'https://ecadforge.app/?reload=1.4.57&url=https%3A%2F%2Fgithub.com%2Facme%2Fdemo%2Ftree%2Fmain%2Fhardware'
            }
        })

        view.bindViewChange(() => {})
        fakeDocument.querySelector('#viewTabs').clickView('3d')

        assert.deepEqual(replaceCalls, [
            [
                { source: true },
                '',
                'https://ecadforge.app/?reload=1.4.57&url=https%3A%2F%2Fgithub.com%2Facme%2Fdemo%2Ftree%2Fmain%2Fhardware&view=3d'
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

/**
 * Verifies selected state updates still work when view controls are links.
 */
test('AppView marks the active view link as selected', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const tabs = fakeDocument.querySelector('#viewTabs')

    view.render(createSnapshot('pcb'))

    const selected = tabs
        .querySelectorAll('[data-view]')
        .filter((tab) => tab.getAttribute('aria-selected') === 'true')

    assert.equal(selected.length, 1)
    assert.equal(selected[0]?.getAttribute('data-view'), 'pcb')
})

/**
 * Verifies the app brand lockup behaves as an in-app home link.
 */
test('AppView binds the brand lockup as a landing-page link', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const replaceCalls = []
    const originalHistory = globalThis.history
    const originalLocation = globalThis.location
    let homeClicks = 0

    try {
        Object.defineProperty(globalThis, 'history', {
            configurable: true,
            value: {
                state: { source: true },
                replaceState(...args) {
                    replaceCalls.push(args)
                }
            }
        })
        Object.defineProperty(globalThis, 'location', {
            configurable: true,
            value: {
                href: 'https://ecadforge.app/?view=schematic&url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Ftree%2Fmain%2Fhardware&reload=1.4.62'
            }
        })

        view.bindHomeNavigation(() => {
            homeClicks += 1
        })
        const eventState = fakeDocument
            .querySelector('#brandHomeLink')
            .clickBrand()

        assert.equal(homeClicks, 1)
        assert.equal(eventState.prevented, true)
        assert.deepEqual(replaceCalls, [
            [{ source: true }, '', 'https://ecadforge.app/']
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
