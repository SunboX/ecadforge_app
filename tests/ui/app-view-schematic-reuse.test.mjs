import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for AppView render tests.
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
}

/**
 * Minimal class list for viewer mode updates.
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
}

/**
 * Minimal DOM node.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes = new Map()

    constructor() {
        super()
        this.classList = new FakeClassList()
        this._innerHTML = ''
        this.textContent = ''
        this.value = ''
    }

    /**
     * Stores an attribute value.
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
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

    /**
     * Stores rendered markup.
     * @param {string} value Rendered markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
    }

    /**
     * Returns rendered markup.
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML
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
 * Content node that exposes rendered schematic SVGs.
 */
class FakeContentNode extends FakeNode {
    /** @type {FakeSvgElement | null} */
    #schematicSvg = null

    constructor() {
        super()
        this.renderCount = 0
    }

    /**
     * Stores rendered markup and extracts the schematic SVG node.
     * @param {string} value Rendered markup.
     */
    set innerHTML(value) {
        this.renderCount += 1
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
 * Minimal document that exposes AppView mount nodes.
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
                '#brandHomeLink',
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
                '#pcbStylerLink',
                '#pcbStylerDismiss',
                '#landingStatusMessage'
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
 * Creates a schematic document model.
 * @param {string} fileName File name.
 * @param {string} designator Component designator.
 * @param {{ x?: number, y?: number }} [options] Component position.
 * @returns {object}
 */
function createSchematicDocument(fileName, designator, options = {}) {
    const x = Number(options.x ?? 20)
    const y = Number(options.y ?? 20)
    return {
        sourceFormat: 'kicad',
        kind: 'schematic',
        fileName,
        summary: { title: fileName },
        schematic: {
            sheet: { width: 80, height: 60 },
            components: [
                { ownerIndex: `owner-${designator}`, designator, x, y }
            ],
            rectangles: [
                {
                    ownerIndex: `owner-${designator}`,
                    x,
                    y,
                    width: 12,
                    height: 10
                }
            ],
            texts: [
                {
                    ownerIndex: `owner-${designator}`,
                    x,
                    y: y - 2,
                    value: designator
                }
            ],
            pins: [],
            lines: []
        },
        bom: []
    }
}

/**
 * Creates an AppView snapshot.
 * @param {object} documentModel Active document model.
 * @param {{ id: string, documentModel: object }[]} documents Session docs.
 * @returns {object}
 */
function createSnapshot(documentModel, documents) {
    return {
        activeView: 'schematic',
        activeSidebarTab: 'documents',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: documentModel.fileName,
        documents,
        activeDocumentId: 'doc-1',
        selectedPcbComponents: { 'doc-1': '' },
        documentModel
    }
}

/**
 * Verifies deferred document appends do not remount unchanged schematics.
 */
test('AppView keeps active schematic content mounted when documents append', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const content = fakeDocument.querySelector('#viewContent')
    const activeDocument = createSchematicDocument('active-fake.kicad_sch', 'U1')
    const deferredDocument = createSchematicDocument(
        'deferred-fake.kicad_sch',
        'U2'
    )

    view.render(
        createSnapshot(activeDocument, [
            { id: 'doc-1', documentModel: activeDocument }
        ])
    )
    view.render(
        createSnapshot(activeDocument, [
            { id: 'doc-1', documentModel: activeDocument },
            { id: 'doc-2', documentModel: deferredDocument }
        ])
    )

    assert.equal(content.renderCount, 1)
})

/**
 * Verifies opening a schematic with an existing component selection pans the
 * selected symbol marker into the active viewport.
 */
test('AppView centers selected schematic component on first schematic mount', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const content = fakeDocument.querySelector('#viewContent')
    const activeDocument = createSchematicDocument(
        'active-fake.kicad_sch',
        'U2',
        { x: 70, y: 50 }
    )
    const snapshot = createSnapshot(activeDocument, [
        { id: 'doc-1', documentModel: activeDocument }
    ])
    snapshot.selectedPcbComponents = { 'doc-1': 'U2' }

    view.render(snapshot)

    assert.notEqual(
        content.querySelector('.schematic-svg')?.getAttribute('viewBox'),
        '0 0 80 60'
    )
})
