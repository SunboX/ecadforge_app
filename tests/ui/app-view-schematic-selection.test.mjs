import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for AppView wiring tests.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners = new Map()

    /**
     * Registers an event listener.
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }
        this.#listeners.get(type)?.add(listener)
    }

    /**
     * Removes an event listener.
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Listener.
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }

    /**
     * Dispatches a synthetic event.
     * @param {string} type Event type.
     * @param {Record<string, any>} [event] Event patch.
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
 * Minimal class list for AppView wiring tests.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens = new Set()

    /**
     * Adds class tokens.
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * Removes class tokens.
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }

    /**
     * Returns whether a class token exists.
     * @param {string} token Class token.
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal DOM node for AppView render tests.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes = new Map()

    constructor() {
        super()
        this._innerHTML = ''
        this.textContent = ''
        this.value = ''
        this.hidden = false
        this.classList = new FakeClassList()
    }

    /**
     * Stores an attribute value.
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
        if (name === 'hidden') this.hidden = true
    }

    /**
     * Reads an attribute value.
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Removes an attribute value.
     * @param {string} name Attribute name.
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
        if (name === 'hidden') this.hidden = false
    }

    /**
     * Returns no descendant matches for this focused test.
     * @param {string} _selector Selector.
     * @returns {null}
     */
    querySelector(_selector) {
        return null
    }

    /**
     * Returns no descendant matches for this focused test.
     * @param {string} _selector Selector.
     * @returns {any[]}
     */
    querySelectorAll(_selector) {
        return []
    }
}

/**
 * Minimal schematic SVG node.
 */
class FakeSvgElement extends FakeNode {
    /**
     * @param {string} viewBox SVG viewBox.
     */
    constructor(viewBox) {
        super()
        this.setAttribute('viewBox', viewBox)
    }

    /**
     * Returns a stable SVG client box.
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 320, height: 240 }
    }
}

/**
 * Minimal target inside a selected schematic component.
 */
class FakeSchematicComponentTarget extends FakeNode {
    /**
     * @param {string} componentKey Selected component key.
     */
    constructor(componentKey) {
        super()
        this.setAttribute('data-schematic-component-key', componentKey)
    }

    /**
     * Returns this target for schematic component lookups.
     * @param {string} selector CSS selector.
     * @returns {FakeSchematicComponentTarget | null}
     */
    closest(selector) {
        return selector === '[data-schematic-component-key]' ? this : null
    }
}

/**
 * Minimal target inside a selected schematic net.
 */
class FakeSchematicNetTarget extends FakeNode {
    /**
     * @param {string} netName Selected net name.
     */
    constructor(netName) {
        super()
        this.setAttribute('data-schematic-net-name', netName)
    }

    /**
     * Returns this target for schematic net lookups.
     * @param {string} selector CSS selector.
     * @returns {FakeSchematicNetTarget | null}
     */
    closest(selector) {
        return selector === '[data-schematic-net-name]' ? this : null
    }
}

/**
 * Minimal content node that exposes rendered schematic SVGs.
 */
class FakeContentNode extends FakeNode {
    /** @type {FakeSvgElement | null} */
    #schematicSvg = null

    /**
     * Stores rendered markup and extracts the schematic SVG node.
     * @param {string} value Rendered markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        const match = this._innerHTML.match(
            /<svg\b(?=[^>]*\bclass="[^"]*\bschematic-svg\b[^"]*")(?=[^>]*\bviewBox="([^"]+)")[^>]*>/
        )
        this.#schematicSvg = match ? new FakeSvgElement(match[1]) : null
    }

    /**
     * Returns rendered markup.
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML || ''
    }

    /**
     * Returns the rendered schematic SVG.
     * @param {string} selector Selector.
     * @returns {FakeSvgElement | null}
     */
    querySelector(selector) {
        return selector === '.schematic-svg' ? this.#schematicSvg : null
    }
}

/**
 * Minimal document that exposes the AppView mount nodes.
 */
class FakeDocument {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        this.body = new FakeNode()
        this.documentElement = new FakeNode()
        this.defaultView = { localStorage: null }
        this.#nodes = new Map(
            [
                '#fileInput',
                '#folderInput',
                '#dropZone',
                '#statusMessage',
                '#appVersion',
                '#localeSelect',
                '#viewerStage',
                '#documentRail',
                ['#viewContent', new FakeContentNode()],
                '#viewTabs',
                '#githubOpenForm',
                '#githubUrlInput',
                '#pcbStylerCta',
                '#pcbStylerDismiss',
                '#pcbStylerNotice'
            ].map((entry) =>
                Array.isArray(entry) ? entry : [entry, new FakeNode()]
            )
        )
    }

    /**
     * Returns one mounted fake node.
     * @param {string} selector Selector.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Builds a schematic snapshot with one selected symbol.
 * @returns {object}
 */
function createSnapshot() {
    const documentModel = {
        sourceFormat: 'kicad',
        kind: 'schematic',
        fileName: 'symbol-selection-fake.kicad_sch',
        summary: { title: 'Symbol selection fake' },
        schematic: {
            sheet: { width: 80, height: 60 },
            components: [{ ownerIndex: 'owner-u1', designator: 'U1' }],
            rectangles: [
                { ownerIndex: 'owner-u1', x: 20, y: 20, width: 12, height: 10 }
            ],
            texts: [{ ownerIndex: 'owner-u1', x: 20, y: 18, value: 'U1' }],
            pins: [],
            lines: [],
            nets: [
                {
                    name: 'SENSE_A',
                    segments: [{ x1: 8, y1: 24, x2: 20, y2: 24 }]
                }
            ]
        },
        bom: []
    }
    return {
        activeView: 'schematic',
        activeSidebarTab: 'components',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: documentModel.fileName,
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        selectedPcbComponents: { 'doc-1': 'U1' },
        selectedNets: {},
        documentModel
    }
}

/**
 * Verifies schematic selection state reaches the schematic renderer.
 */
test('AppView highlights the selected schematic symbol', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createSnapshot())

    const html = fakeDocument.querySelector('#viewContent').innerHTML
    assert.match(html, /class="schematic-component-highlight-style"/)
    assert.match(html, /data-schematic-component-key="U1"/)
})

/**
 * Verifies selected schematic net state reaches the schematic renderer.
 */
test('AppView highlights the selected schematic net', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render({
        ...createSnapshot(),
        selectedPcbComponents: {},
        selectedNets: { 'doc-1': 'SENSE_A' }
    })

    const html = fakeDocument.querySelector('#viewContent').innerHTML
    assert.match(html, /class="schematic-net-highlight-style"/)
    assert.match(html, /data-schematic-net-name="SENSE_A"/)
})

/**
 * Verifies schematic component clicks emit the clicked component key.
 */
test('AppView emits schematic component clicks from the rendered svg', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindPcbComponentSelectionChange((change) => {
        received.push(change)
    })
    view.render(createSnapshot())

    fakeDocument
        .querySelector('#viewContent')
        .querySelector('.schematic-svg')
        .dispatch('click', {
            target: new FakeSchematicComponentTarget('U1')
        })

    assert.deepEqual(received, [
        {
            documentId: 'doc-1',
            componentKey: 'U1',
            source: 'schematic'
        }
    ])
})

/**
 * Verifies schematic net clicks emit the clicked net name.
 */
test('AppView emits schematic net clicks from the rendered svg', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindPcbNetSelectionChange((change) => {
        received.push(change)
    })
    view.render(createSnapshot())

    fakeDocument
        .querySelector('#viewContent')
        .querySelector('.schematic-svg')
        .dispatch('click', {
            target: new FakeSchematicNetTarget('SENSE_A')
        })

    assert.deepEqual(received, [
        {
            documentId: 'doc-1',
            netName: 'SENSE_A',
            source: 'schematic'
        }
    ])
})

/**
 * Verifies schematic background clicks clear the current component selection.
 */
test('AppView emits empty schematic selection from schematic background clicks', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindPcbComponentSelectionChange((change) => {
        received.push(change)
    })
    view.render(createSnapshot())

    fakeDocument
        .querySelector('#viewContent')
        .querySelector('.schematic-svg')
        .dispatch('click')

    assert.deepEqual(received, [
        {
            documentId: 'doc-1',
            componentKey: '',
            source: 'schematic'
        }
    ])
})

/**
 * Verifies schematic pan and zoom survive state-driven rerenders.
 */
test('AppView preserves schematic viewport across selection rerenders', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const snapshot = createSnapshot()

    view.render(snapshot)

    const contentNode = fakeDocument.querySelector('#viewContent')
    const initialSvg = contentNode.querySelector('.schematic-svg')
    const initialViewBox = initialSvg.getAttribute('viewBox')

    initialSvg.dispatch('wheel', {
        deltaY: -100,
        clientX: 160,
        clientY: 120,
        preventDefault() {}
    })
    initialSvg.dispatch('mousedown', {
        button: 0,
        clientX: 160,
        clientY: 120,
        preventDefault() {}
    })
    initialSvg.dispatch('mousemove', {
        buttons: 1,
        clientX: 176,
        clientY: 132,
        preventDefault() {}
    })
    initialSvg.dispatch('mouseup', { button: 0 })

    const movedViewBox = initialSvg.getAttribute('viewBox')
    assert.notEqual(movedViewBox, initialViewBox)

    view.render({
        ...snapshot,
        selectedPcbComponents: { 'doc-1': '' }
    })

    assert.equal(
        contentNode.querySelector('.schematic-svg').getAttribute('viewBox'),
        movedViewBox
    )
})
