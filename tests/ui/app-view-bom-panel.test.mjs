import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal classList implementation for AppView tests.
 */
class FakeClassList {
    #tokens = new Set()

    /**
     * Adds class tokens.
     * @param {...string} tokens
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * Removes class tokens.
     * @param {...string} tokens
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }
}

/**
 * Minimal DOM node used by AppView.
 */
class FakeNode {
    #attributes = new Map()

    constructor() {
        this.classList = new FakeClassList()
        this.innerHTML = ''
        this.textContent = ''
    }

    /**
     * Stores one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }

    /**
     * Removes one attribute value.
     * @param {string} name
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
    }

    /**
     * Registers an ignored event listener.
     * @returns {void}
     */
    addEventListener() {}

    /**
     * Returns no child for generic nodes.
     * @returns {null}
     */
    querySelector() {
        return null
    }

    /**
     * Returns no children for generic nodes.
     * @returns {any[]}
     */
    querySelectorAll() {
        return []
    }
}

/**
 * Minimal document exposing AppView mount points.
 */
class FakeDocument {
    #nodes

    constructor() {
        this.body = new FakeNode()
        this.#nodes = new Map([
            ['#brandHomeLink', new FakeNode()],
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
            ['#viewTabs', new FakeNode()],
            ['#diagnosticsCount', new FakeNode()],
            ['#githubOpenForm', new FakeNode()],
            ['#githubUrlInput', new FakeNode()],
            ['#pcbStylerCta', new FakeNode()],
            ['#pcbStylerLink', new FakeNode()]
        ])
    }

    /**
     * Returns one mounted node.
     * @param {string} selector
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Builds a minimal BOM snapshot for one source format.
 * @param {string} sourceFormat
 * @returns {any}
 */
function createBomSnapshot(sourceFormat) {
    const documentModel = {
        sourceFormat,
        kind: 'pcb',
        fileName:
            sourceFormat === 'kicad' ? 'demo.kicad_pcb' : 'demo.PcbDoc',
        diagnostics: [],
        summary: {
            bomRowCount: 1,
            componentCount: 1,
            layerCount: 2,
            outlineSegmentCount: 4,
            boardWidthMil: 1000,
            boardHeightMil: 500
        },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            components: [{ designator: 'U1' }]
        },
        bom: [
            {
                designators: ['U1'],
                quantity: 1,
                value: 'Demo',
                pattern: 'Package:Demo',
                source: 'Device:U'
            }
        ]
    }

    return {
        activeView: 'bom',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: '',
        activeFileName: documentModel.fileName,
        documentModel,
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1'
    }
}

/**
 * Renders a BOM view and returns the content node markup.
 * @param {string} sourceFormat
 * @returns {string}
 */
function renderBomMarkup(sourceFormat) {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createBomSnapshot(sourceFormat))

    return fakeDocument.querySelector('#viewContent').innerHTML
}

/**
 * Verifies KiCad BOM tables get the report panel needed for overflow styles.
 */
test('AppView wraps KiCad BOM tables in the report overflow panel', () => {
    const markup = renderBomMarkup('kicad')

    assert.match(markup, /^<div class="bom-panel"><table class="bom-table"/)
})

/**
 * Verifies BOM renderers that already emit a report panel are not double-wrapped.
 */
test('AppView keeps existing BOM report panels as the outer panel', () => {
    const markup = renderBomMarkup('altium')
    const panelMatches = markup.match(/class="bom-panel"/g) || []

    assert.match(markup, /^<section class="bom-panel">/)
    assert.equal(panelMatches.length, 1)
})
