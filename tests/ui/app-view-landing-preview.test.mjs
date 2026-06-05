import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for landing-preview AppView tests.
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
 * Minimal class list for body class assertions.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    constructor() {
        this.#tokens = new Set()
    }

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
 * Minimal generic DOM node for landing-preview AppView tests.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        super()
        this.#attributes = new Map()
        this._innerHTML = ''
        this.textContent = ''
        this.value = ''
        this.hidden = false
        this.classList = new FakeClassList()
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
     * Returns the closest matching node.
     * @param {string} _selector
     * @returns {any}
     */
    closest(_selector) {
        return null
    }

    /**
     * Returns matching child nodes.
     * @param {string} _selector
     * @returns {any[]}
     */
    querySelectorAll(_selector) {
        return []
    }

    /**
     * Returns one matching child node.
     * @param {string} _selector
     * @returns {any}
     */
    querySelector(_selector) {
        return null
    }

    /**
     * @param {string} value
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML
    }
}

/**
 * Minimal 3D viewport node for hero-preview tests.
 */
class FakeScene3dViewportNode extends FakeNode {}

/**
 * Minimal 3D loading overlay node for hero-preview tests.
 */
class FakeScene3dLoadingNode extends FakeNode {}

/**
 * Hero preview screen fake that exposes 3D mount points after rendering.
 */
class FakeHeroPreviewScreenNode extends FakeNode {
    /** @type {Map<string, any>} */
    #nodesBySelector

    constructor() {
        super()
        this.#nodesBySelector = new Map()
    }

    /**
     * @param {string} value
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#nodesBySelector = new Map()

        if (this._innerHTML.includes('data-scene-3d-viewport')) {
            this.#nodesBySelector.set(
                '[data-scene-3d-viewport]',
                new FakeScene3dViewportNode()
            )
        }

        if (this._innerHTML.includes('data-scene-3d-loading')) {
            this.#nodesBySelector.set(
                '[data-scene-3d-loading]',
                new FakeScene3dLoadingNode()
            )
        }
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML
    }

    /**
     * Returns one matching 3D mount node.
     * @param {string} selector
     * @returns {any}
     */
    querySelector(selector) {
        return this.#nodesBySelector.get(selector) || null
    }
}

/**
 * Minimal landing preview chip button node.
 */
class FakeHeroViewChipButton extends FakeNode {
    /**
     * @param {string} viewName
     */
    constructor(viewName) {
        super()
        this.setAttribute('data-view-chip', viewName)
    }

    /**
     * Returns the chip itself when the selector matches.
     * @param {string} selector
     * @returns {FakeHeroViewChipButton | null}
     */
    closest(selector) {
        return selector === '[data-view-chip]' ? this : null
    }
}

/**
 * Minimal landing preview chip container.
 */
class FakeHeroViewChipsNode extends FakeNode {
    /** @type {FakeHeroViewChipButton[]} */
    #buttons

    constructor() {
        super()
        this.#buttons = ['schematic', 'pcb', '3d', 'bom', 'diagnostics'].map(
            (viewName) => new FakeHeroViewChipButton(viewName)
        )
    }

    /**
     * Returns landing preview chip buttons.
     * @param {string} selector
     * @returns {FakeHeroViewChipButton[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-view-chip]' ? this.#buttons : []
    }

    /**
     * Dispatches a click event as if one chip was selected.
     * @param {string} viewName
     * @returns {void}
     */
    clickChip(viewName) {
        const button = this.getChip(viewName)
        if (!button) return

        this.dispatch('click', {
            target: button,
            preventDefault() {}
        })
    }

    /**
     * Returns one chip button by view name.
     * @param {string} viewName
     * @returns {FakeHeroViewChipButton | null}
     */
    getChip(viewName) {
        return (
            this.#buttons.find(
                (entry) => entry.getAttribute('data-view-chip') === viewName
            ) || null
        )
    }
}

/**
 * Minimal document node with AppView constructor targets.
 */
class FakeDocument extends FakeEventTarget {
    /** @type {Map<string, any>} */
    #nodes

    constructor() {
        super()
        this.body = new FakeNode()
        this.#nodes = new Map([
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
            ['#heroPreviewScreen', new FakeHeroPreviewScreenNode()],
            ['#heroViewChips', new FakeHeroViewChipsNode()],
            ['#diagnosticsCount', new FakeNode()],
            ['#githubOpenForm', new FakeNode()],
            ['#githubUrlInput', new FakeNode()],
            ['#pcbStylerCta', new FakeNode()],
            ['#pcbStylerLink', new FakeNode()]
        ])
    }

    /**
     * Returns one node by selector.
     * @param {string} selector
     * @returns {any}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Creates minimal document models for renderer-backed hero previews.
 * @returns {any[]}
 */
function createHeroPreviewDocuments() {
    const schematicDocument = {
        fileName: 'fake-sheet.SchDoc',
        kind: 'schematic',
        diagnostics: [{ severity: 'info', message: 'Fake sheet note' }],
        summary: { title: 'Fake sheet' },
        schematic: {
            sheet: { width: 200, height: 120 },
            lines: [
                {
                    x1: 20,
                    y1: 60,
                    x2: 180,
                    y2: 60,
                    color: '#000080',
                    width: 1
                }
            ],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        },
        bom: [
            {
                designators: ['R1'],
                quantity: 1,
                value: '10k',
                pattern: '0603',
                source: 'fake/resistor'
            }
        ]
    }
    const pcbDocument = {
        sourceFormat: 'kicad',
        fileName: 'fake-board.kicad_pcb',
        kind: 'pcb',
        diagnostics: [],
        summary: {
            title: 'Fake board',
            boardWidthMil: 1000,
            boardHeightMil: 500,
            componentCount: 1
        },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            polygons: [],
            fills: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Fake board',
                bounds: { minX: 0, minY: 0, width: 25.4, height: 12.7 },
                outlines: [],
                pads: [],
                drawings: [],
                texts: []
            },
            components: [
                {
                    designator: 'U1',
                    x: 200,
                    y: 250,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ]
        },
        bom: [
            {
                designators: ['U1'],
                quantity: 1,
                value: 'Controller',
                pattern: 'QFN',
                source: 'fake/controller'
            }
        ]
    }

    return [schematicDocument, pcbDocument]
}

/**
 * Verifies landing preview chips do not dispatch main viewer tab changes.
 */
test('AppView keeps landing preview chip clicks separate from main view changes', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindViewChange((viewName) => {
        received.push(viewName)
    })
    view.setHeroPreviewDocuments(createHeroPreviewDocuments())

    fakeDocument.querySelector('#heroViewChips').clickChip('diagnostics')

    assert.deepEqual(received, [])
    assert.match(
        fakeDocument.querySelector('#heroPreviewScreen').innerHTML,
        /hero-proof__diagnostics/
    )
    assert.equal(
        fakeDocument
            .querySelector('#heroViewChips')
            .getChip('diagnostics')
            ?.getAttribute('aria-pressed'),
        'true'
    )
})

/**
 * Verifies landing preview chip clicks visibly replace the static fallback even
 * when demo documents have not loaded yet.
 */
test('AppView replaces the static landing preview before demo documents load', () => {
    const fakeDocument = new FakeDocument()
    new AppView(fakeDocument)
    const screen = fakeDocument.querySelector('#heroPreviewScreen')
    const chips = fakeDocument.querySelector('#heroViewChips')

    screen.innerHTML = '<img src="/og/ecadforge-product-preview.png" alt="">'

    chips.clickChip('diagnostics')

    assert.doesNotMatch(screen.innerHTML, /ecadforge-product-preview\.png/)
    assert.match(screen.innerHTML, /hero-proof__summary/)
    assert.equal(
        chips.getChip('diagnostics')?.getAttribute('aria-pressed'),
        'true'
    )
})

/**
 * Verifies landing preview chips render the supported views with real renderer
 * output instead of switching the main viewer.
 */
test('AppView renders renderer-backed landing previews for selected chips', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const screen = fakeDocument.querySelector('#heroPreviewScreen')
    const chips = fakeDocument.querySelector('#heroViewChips')

    view.setHeroPreviewDocuments(createHeroPreviewDocuments())

    assert.match(screen.innerHTML, /hero-proof__svg--pcb/)
    assert.match(screen.innerHTML, /class="[^"]*(^|\s)pcb-svg(\s|")/)

    chips.clickChip('schematic')
    assert.match(screen.innerHTML, /hero-proof__svg--schematic/)
    assert.match(screen.innerHTML, /class="[^"]*(^|\s)schematic-svg(\s|")/)
    assert.equal(
        chips.getChip('schematic')?.getAttribute('aria-pressed'),
        'true'
    )

    chips.clickChip('bom')
    assert.match(screen.innerHTML, /bom-table|<table/)

    chips.clickChip('3d')
    assert.match(screen.innerHTML, /scene-3d/)
})

/**
 * Verifies the landing 3D preview mounts the real 3D controller.
 */
test('AppView mounts the renderer-backed 3D landing preview', () => {
    const fakeDocument = new FakeDocument()
    const createdScenes = []
    const view = new AppView(fakeDocument, {
        createScene3dController: (
            viewportNode,
            documentModel,
            options = {}
        ) => {
            const scene = {
                disposed: false,
                dispose() {
                    this.disposed = true
                }
            }
            createdScenes.push({ viewportNode, documentModel, options, scene })
            return scene
        }
    })
    const screen = fakeDocument.querySelector('#heroPreviewScreen')
    const chips = fakeDocument.querySelector('#heroViewChips')

    view.setHeroPreviewDocuments(createHeroPreviewDocuments())
    chips.clickChip('3d')

    assert.equal(createdScenes.length, 1)
    assert.ok(createdScenes[0].viewportNode instanceof FakeScene3dViewportNode)
    assert.match(screen.innerHTML, /scene-3d__loading-content/)
    assert.deepEqual(createdScenes[0].options.sessionAssets, [])

    createdScenes[0].options.setLoadingVisible(false)
    assert.equal(
        screen.querySelector('[data-scene-3d-loading]')?.getAttribute('hidden'),
        'hidden'
    )

    chips.clickChip('pcb')
    assert.equal(createdScenes[0].scene.disposed, true)
})
