import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewController } from '../../src/ui/PcbViewController.mjs'

/**
 * Minimal classList implementation for viewport controller tests.
 */
class FakeClassList {
    /**
     * @returns {void}
     */
    add() {}

    /**
     * @returns {void}
     */
    remove() {}
}

/**
 * Minimal event target used by fake DOM nodes.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }
        this.#listeners.get(type).add(listener)
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Listener.
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }

    /**
     * @param {string} type Event type.
     * @param {any} event Event payload.
     * @returns {void}
     */
    dispatch(type, event = {}) {
        for (const listener of this.#listeners.get(type) || []) {
            listener(event)
        }
    }

    /**
     * @param {string} type Event type.
     * @returns {number}
     */
    getListenerCount(type) {
        return this.#listeners.get(type)?.size || 0
    }
}

/**
 * Minimal generic fake node.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        super()
        this.#attributes = new Map()
        this.classList = new FakeClassList()
        this.style = {}
    }

    /**
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * @param {string} _selector Selector.
     * @returns {FakeNode | null}
     */
    closest(_selector) {
        return null
    }
}

/**
 * Minimal document node for SVG viewport document-level listeners.
 */
class FakeDocument extends FakeEventTarget {
    constructor() {
        super()
        this.documentElement = { classList: new FakeClassList() }
    }
}

/**
 * Minimal rendered PCB SVG node.
 */
class FakeSvgElement extends FakeNode {
    /**
     * @param {FakeDocument} ownerDocument Owner document.
     * @param {string} viewBox SVG viewBox.
     */
    constructor(ownerDocument, viewBox) {
        super()
        this.ownerDocument = ownerDocument
        this.setAttribute('viewBox', viewBox)
    }

    /**
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 400, height: 200 }
    }
}

/**
 * Minimal PCB side selector button.
 */
class FakePcbSideButton extends FakeNode {
    /**
     * @param {string} side PCB side.
     * @param {string} pressed Pressed state.
     */
    constructor(side, pressed) {
        super()
        this.setAttribute('data-pcb-view-side', side)
        this.setAttribute('aria-pressed', pressed)
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakePcbSideButton | null}
     */
    closest(selector) {
        return selector === '[data-pcb-view-side]' ? this : null
    }
}

/**
 * Minimal content node that reparses rendered PCB view markup.
 */
class FakeContentNode extends FakeEventTarget {
    /** @type {FakeDocument} */
    #ownerDocument

    /** @type {FakeSvgElement | null} */
    #svg

    /** @type {Map<string, FakePcbSideButton>} */
    #buttonsBySide

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     */
    constructor(ownerDocument) {
        super()
        this.#ownerDocument = ownerDocument
        this.#svg = null
        this.#buttonsBySide = new Map()
        this._innerHTML = ''
        this.renderCount = 0
    }

    /**
     * @param {string} value Markup.
     */
    set innerHTML(value) {
        this.renderCount += 1
        this._innerHTML = String(value)
        this.#svg = null
        this.#buttonsBySide = new Map()

        const svgMatch = this._innerHTML.match(
            /<svg[^>]*class="[^"]*\bpcb-svg\b[^"]*"[^>]*viewBox="([^"]+)"/
        )
        if (svgMatch) {
            this.#svg = new FakeSvgElement(this.#ownerDocument, svgMatch[1])
        }

        for (const match of this._innerHTML.matchAll(
            /<button[^>]*data-pcb-view-side="([^"]+)"[^>]*aria-pressed="([^"]+)"[^>]*>/g
        )) {
            this.#buttonsBySide.set(
                match[1],
                new FakePcbSideButton(match[1], match[2])
            )
        }
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML || ''
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeSvgElement | FakePcbSideButton | null}
     */
    querySelector(selector) {
        if (selector === '.pcb-svg') {
            return this.#svg
        }

        const sideMatch = selector.match(/^\[data-pcb-view-side="([^"]+)"\]$/)
        if (sideMatch) {
            return this.#buttonsBySide.get(sideMatch[1]) || null
        }

        return null
    }

    /**
     * @param {string} side PCB side.
     * @returns {void}
     */
    clickPcbSide(side) {
        const button = this.#buttonsBySide.get(side)
        if (!button) {
            return
        }

        this.dispatch('click', { target: button, preventDefault() {} })
    }

    /**
     * Dispatches a click on the rendered PCB SVG.
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @returns {void}
     */
    clickPcbBoard(clientX, clientY) {
        if (!this.#svg) {
            return
        }

        this.dispatch('click', {
            target: this.#svg,
            clientX,
            clientY,
            preventDefault() {}
        })
    }

    /**
     * Dispatches a mousemove on the rendered PCB SVG.
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @returns {void}
     */
    movePcbPointer(clientX, clientY) {
        if (!this.#svg) {
            return
        }

        this.dispatch('mousemove', {
            target: this.#svg,
            clientX,
            clientY
        })
    }
}

/**
 * Builds PCB controller fixtures.
 */
class PcbViewControllerFixture {
    /**
     * @returns {object}
     */
    static createAltiumPcbDocument() {
        return {
            kind: 'pcb',
            fileName: 'side-toggle.PcbDoc',
            summary: { title: 'side-toggle' },
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 100,
                    heightMil: 100,
                    segments: [
                        { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
                        { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100 },
                        { type: 'line', x1: 100, y1: 100, x2: 0, y2: 100 },
                        { type: 'line', x1: 0, y1: 100, x2: 0, y2: 0 }
                    ]
                },
                layers: [{ name: 'Top Layer', layerId: 1 }],
                primitiveLayers: [
                    { name: 'Top Overlay', layerId: 33 },
                    { name: 'Bottom Overlay', layerId: 34 }
                ],
                texts: [
                    {
                        text: 'TOP_SIDE_MARK',
                        x: 20,
                        y: 20,
                        height: 8,
                        layerId: 33,
                        visible: true
                    },
                    {
                        text: 'BOTTOM_SIDE_MARK',
                        x: 40,
                        y: 40,
                        height: 8,
                        layerId: 34,
                        visible: true
                    }
                ],
                components: [],
                pads: []
            },
            bom: []
        }
    }

    /**
     * @returns {object}
     */
    static createSelectableAltiumPcbDocument() {
        const documentModel = PcbViewControllerFixture.createAltiumPcbDocument()
        documentModel.fileName = 'board-selection.PcbDoc'
        documentModel.pcb.layers = [
            { name: 'Top Layer', layerId: 1 },
            { name: 'Bottom Layer', layerId: 32 }
        ]
        documentModel.pcb.tracks = [
            {
                x1: 0,
                y1: 50,
                x2: 100,
                y2: 50,
                width: 10,
                layerId: 1,
                netName: 'SENSE'
            }
        ]
        documentModel.pcb.vias = [
            {
                x: 50,
                y: 50,
                diameter: 20,
                holeDiameter: 8,
                netName: 'SENSE'
            }
        ]
        documentModel.pcb.pads = [
            {
                x: 50,
                y: 50,
                sizeTopX: 24,
                sizeTopY: 24,
                rotation: 0,
                componentIndex: 0,
                layerId: 1,
                netName: 'SENSE'
            }
        ]
        documentModel.pcb.regions = [
            {
                layerId: 1,
                netName: 'SENSE',
                points: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 100 },
                    { x: 0, y: 100 }
                ]
            }
        ]
        documentModel.pcb.components = [
            {
                componentIndex: 0,
                designator: 'U1',
                x: 50,
                y: 50,
                rotation: 0,
                layer: 'TOP',
                pattern: 'QFN'
            }
        ]

        return documentModel
    }
}

/**
 * Verifies the PCB controller renders and switches between board sides.
 */
test('PcbViewController switches PCB sides from the toolbar', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const controller = new PcbViewController(
        content,
        PcbViewControllerFixture.createAltiumPcbDocument()
    )

    const topButton = content.querySelector('[data-pcb-view-side="top"]')
    const bottomButton = content.querySelector('[data-pcb-view-side="bottom"]')
    const topSvg = content.querySelector('.pcb-svg')

    assert.equal(topButton?.getAttribute('aria-pressed'), 'true')
    assert.equal(bottomButton?.getAttribute('aria-pressed'), 'false')
    assert.match(content.innerHTML, /data-pcb-view-active-side="top"/)
    assert.match(content.innerHTML, /pcb-svg--top/)
    assert.match(content.innerHTML, />TOP_SIDE_MARK<\/text>/)
    assert.doesNotMatch(content.innerHTML, />BOTTOM_SIDE_MARK<\/text>/)
    assert.equal(topSvg?.getListenerCount('wheel'), 1)

    content.clickPcbSide('bottom')

    const pressedTopButton = content.querySelector('[data-pcb-view-side="top"]')
    const pressedBottomButton = content.querySelector(
        '[data-pcb-view-side="bottom"]'
    )
    const bottomSvg = content.querySelector('.pcb-svg')

    assert.equal(topSvg?.getListenerCount('wheel'), 0)
    assert.equal(pressedTopButton?.getAttribute('aria-pressed'), 'false')
    assert.equal(pressedBottomButton?.getAttribute('aria-pressed'), 'true')
    assert.match(content.innerHTML, /data-pcb-view-active-side="bottom"/)
    assert.match(content.innerHTML, /pcb-svg--bottom/)
    assert.match(content.innerHTML, />BOTTOM_SIDE_MARK<\/text>/)
    assert.doesNotMatch(content.innerHTML, />TOP_SIDE_MARK<\/text>/)
    assert.equal(bottomSvg?.getListenerCount('wheel'), 1)

    controller.dispose()

    assert.equal(bottomSvg?.getListenerCount('wheel'), 0)
})

/**
 * Verifies remounting the same PCB view keeps the user's zoom and pan
 * position instead of returning to the renderer default viewBox.
 */
test('PcbViewController preserves PCB viewport when remounted for the same side', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const documentModel = PcbViewControllerFixture.createAltiumPcbDocument()
    const controller = new PcbViewController(content, documentModel)
    const firstSvg = content.querySelector('.pcb-svg')

    firstSvg?.setAttribute('viewBox', '10 20 30 40')
    controller.dispose()

    const remountedController = new PcbViewController(content, documentModel)
    const remountedSvg = content.querySelector('.pcb-svg')

    assert.equal(firstSvg?.getListenerCount('wheel'), 0)
    assert.equal(remountedSvg?.getAttribute('viewBox'), '10 20 30 40')
    assert.equal(remountedSvg?.getListenerCount('wheel'), 1)

    remountedController.dispose()
})

/**
 * Verifies the initial PCB side is refreshed after embedded browser fonts are
 * ready so first paint converges to the same metrics as later side renders.
 */
test('PcbViewController refreshes the active PCB side after fonts settle', async () => {
    const originalDocument = globalThis.document
    globalThis.document = {
        fonts: {
            ready: Promise.resolve()
        }
    }

    try {
        const fakeDocument = new FakeDocument()
        const content = new FakeContentNode(fakeDocument)
        const documentModel = PcbViewControllerFixture.createAltiumPcbDocument()
        documentModel.pcb.embeddedFonts = [
            {
                name: 'Synthetic Mono',
                payloadBase64: 'AAEAAA=='
            }
        ]
        const controller = new PcbViewController(content, documentModel)

        assert.equal(content.renderCount, 1)
        assert.match(content.innerHTML, /data-pcb-view-active-side="top"/)
        assert.match(content.innerHTML, /pcb-svg--top/)

        await new Promise((resolve) => setTimeout(resolve, 0))

        assert.equal(content.renderCount, 2)
        assert.match(content.innerHTML, /data-pcb-view-active-side="top"/)
        assert.match(content.innerHTML, /pcb-svg--top/)
        assert.match(content.innerHTML, />TOP_SIDE_MARK<\/text>/)

        controller.dispose()
    } finally {
        if (originalDocument) {
            globalThis.document = originalDocument
        } else {
            delete globalThis.document
        }
    }
})

/**
 * Verifies the embedded-font refresh is a one-time correction for the mounted
 * controller and does not add another full render after later side toggles.
 */
test('PcbViewController skips repeated font refreshes after side changes', async () => {
    const originalDocument = globalThis.document
    globalThis.document = {
        fonts: {
            ready: Promise.resolve()
        }
    }

    try {
        const fakeDocument = new FakeDocument()
        const content = new FakeContentNode(fakeDocument)
        const documentModel = PcbViewControllerFixture.createAltiumPcbDocument()
        documentModel.pcb.embeddedFonts = [
            {
                name: 'Synthetic Mono',
                payloadBase64: 'AAEAAA=='
            }
        ]
        const controller = new PcbViewController(content, documentModel)

        await new Promise((resolve) => setTimeout(resolve, 0))
        assert.equal(content.renderCount, 2)

        content.clickPcbSide('bottom')
        assert.equal(content.renderCount, 3)
        assert.match(content.innerHTML, /data-pcb-view-active-side="bottom"/)

        await new Promise((resolve) => setTimeout(resolve, 0))

        assert.equal(content.renderCount, 3)
        assert.match(content.innerHTML, />BOTTOM_SIDE_MARK<\/text>/)

        controller.dispose()
    } finally {
        if (originalDocument) {
            globalThis.document = originalDocument
        } else {
            delete globalThis.document
        }
    }
})

/**
 * Verifies PCB SVG clicks are converted into board-space hit-test requests and
 * overlap candidates are reported in selection-priority order.
 */
test('PcbViewController reports prioritized PCB click candidates', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const candidateChanges = []
    const controller = new PcbViewController(
        content,
        PcbViewControllerFixture.createSelectableAltiumPcbDocument(),
        {
            documentId: 'doc-1',
            onInteractionCandidatesChange: (change) => {
                candidateChanges.push(change)
            }
        }
    )
    const svg = content.querySelector('.pcb-svg')

    svg?.setAttribute('viewBox', '0 0 100 100')
    content.clickPcbBoard(200, 100)

    assert.equal(candidateChanges.length, 1)
    assert.equal(candidateChanges[0].documentId, 'doc-1')
    assert.deepEqual(
        candidateChanges[0].candidates.map((candidate) => candidate.type),
        ['track', 'pad', 'via', 'component', 'zone']
    )
    assert.equal(candidateChanges[0].point.x, 50)
    assert.equal(candidateChanges[0].point.y, 50)

    controller.dispose()
})

/**
 * Verifies PCB click selection can feed the existing selected component state
 * path when the top visible hit candidate is component-backed.
 */
test('PcbViewController selects a component-backed PCB click candidate', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const selections = []
    const controller = new PcbViewController(
        content,
        PcbViewControllerFixture.createSelectableAltiumPcbDocument(),
        {
            documentId: 'doc-1',
            hiddenObjects: ['tracks'],
            onComponentSelectionChange: (change) => {
                selections.push(change)
            }
        }
    )
    const svg = content.querySelector('.pcb-svg')

    svg?.setAttribute('viewBox', '0 0 100 100')
    content.clickPcbBoard(200, 100)

    assert.deepEqual(selections, [
        {
            documentId: 'doc-1',
            componentKey: 'U1',
            source: 'pcb-board'
        }
    ])

    controller.dispose()
})

/**
 * Verifies component-backed PCB hits expose the browser pointing-hand cursor.
 */
test('PcbViewController shows pointer cursor over component-backed PCB hits', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const controller = new PcbViewController(
        content,
        PcbViewControllerFixture.createSelectableAltiumPcbDocument(),
        {
            documentId: 'doc-1',
            hiddenObjects: ['tracks']
        }
    )
    const svg = content.querySelector('.pcb-svg')

    svg?.setAttribute('viewBox', '0 0 100 100')
    content.movePcbPointer(200, 100)

    assert.equal(svg?.style.cursor, 'pointer')

    content.movePcbPointer(700, 350)

    assert.equal(svg?.style.cursor, '')

    controller.dispose()
})

/**
 * Verifies clicking empty PCB space clears the selected component path.
 */
test('PcbViewController clears PCB component selection when clicking empty board space', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const selections = []
    const controller = new PcbViewController(
        content,
        PcbViewControllerFixture.createSelectableAltiumPcbDocument(),
        {
            documentId: 'doc-1',
            selectedComponentKey: 'U1',
            onComponentSelectionChange: (change) => {
                selections.push(change)
            }
        }
    )
    const svg = content.querySelector('.pcb-svg')

    svg?.setAttribute('viewBox', '0 0 100 100')
    content.clickPcbBoard(700, 350)

    assert.deepEqual(selections, [
        {
            documentId: 'doc-1',
            componentKey: '',
            source: 'pcb-board'
        }
    ])

    controller.dispose()
})
