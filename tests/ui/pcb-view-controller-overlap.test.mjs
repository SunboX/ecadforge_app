import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
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
 * Minimal SVG node for board click projection.
 */
class FakeSvgElement extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     * @param {string} viewBox SVG viewBox.
     */
    constructor(ownerDocument, viewBox) {
        super()
        this.#attributes = new Map()
        this.classList = new FakeClassList()
        this.ownerDocument = ownerDocument
        this.style = {}
        this.setAttribute('viewBox', viewBox)
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
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 400, height: 200 }
    }
}

/**
 * Minimal content node that reparses rendered PCB markup.
 */
class FakeContentNode extends FakeEventTarget {
    /** @type {FakeDocument} */
    #ownerDocument

    /** @type {FakeSvgElement | null} */
    #svg

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     */
    constructor(ownerDocument) {
        super()
        this.#ownerDocument = ownerDocument
        this.#svg = null
        this._innerHTML = ''
    }

    /**
     * @param {string} value Rendered markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        const svgMatch = this._innerHTML.match(
            /<svg[^>]*class="[^"]*\bpcb-svg\b[^"]*"[^>]*viewBox="([^"]+)"/
        )
        this.#svg = svgMatch
            ? new FakeSvgElement(this.#ownerDocument, svgMatch[1])
            : null
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeSvgElement | null}
     */
    querySelector(selector) {
        return selector === '.pcb-svg' ? this.#svg : null
    }

    /**
     * Dispatches a click on the rendered PCB SVG.
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @returns {void}
     */
    clickPcbBoard(clientX, clientY) {
        if (!this.#svg) return

        this.dispatch('click', {
            target: this.#svg,
            clientX,
            clientY,
            preventDefault() {}
        })
    }

    /**
     * Dispatches pointer movement on the rendered PCB SVG.
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @param {number} buttons Pressed mouse-button mask.
     * @returns {void}
     */
    movePcbBoard(clientX, clientY, buttons) {
        if (!this.#svg) return

        this.dispatch('mousemove', {
            target: this.#svg,
            buttons,
            clientX,
            clientY
        })
    }
}

/**
 * Builds compact PCB selection fixtures.
 */
class PcbSelectionFixture {
    /**
     * @returns {object}
     */
    static createOverlappingPcbDocument() {
        return {
            kind: 'pcb',
            fileName: 'selection-overlap-fake.PcbDoc',
            pcb: {
                boardOutline: PcbSelectionFixture.#createBoardOutline(),
                layers: [
                    { name: 'Top Layer', layerId: 1 },
                    { name: 'Bottom Layer', layerId: 32 }
                ],
                components: [
                    {
                        componentIndex: 0,
                        designator: 'U1',
                        x: 50,
                        y: 50,
                        rotation: 0,
                        layer: 'TOP',
                        pattern: 'QFN'
                    }
                ],
                pads: [
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
                ],
                tracks: [
                    {
                        x1: 0,
                        y1: 50,
                        x2: 100,
                        y2: 50,
                        width: 10,
                        layerId: 1,
                        netName: 'SENSE'
                    }
                ],
                vias: [
                    {
                        x: 50,
                        y: 50,
                        diameter: 20,
                        holeDiameter: 8,
                        netName: 'SENSE'
                    }
                ],
                regions: []
            },
            bom: []
        }
    }

    /**
     * @returns {object}
     */
    static createMirroredBottomPcbDocument() {
        return {
            kind: 'pcb',
            fileName: 'bottom-selection-fake.PcbDoc',
            pcb: {
                boardOutline: PcbSelectionFixture.#createBoardOutline(),
                layers: [
                    { name: 'Top Layer', layerId: 1 },
                    { name: 'Bottom Layer', layerId: 32 },
                    { name: 'Bottom Overlay', layerId: 34 }
                ],
                components: [
                    {
                        componentIndex: 0,
                        designator: 'U1',
                        x: 20,
                        y: 50,
                        rotation: 0,
                        layer: 'BOTTOM',
                        pattern: '0603'
                    }
                ],
                pads: [
                    {
                        x: 20,
                        y: 50,
                        sizeBottomX: 20,
                        sizeBottomY: 20,
                        rotation: 0,
                        componentIndex: 0,
                        layerId: 32,
                        netName: 'PAD_NET'
                    }
                ],
                tracks: [
                    {
                        x1: 75,
                        y1: 50,
                        x2: 85,
                        y2: 50,
                        width: 16,
                        layerId: 32,
                        netName: 'WRONG_NET'
                    }
                ],
                vias: [],
                regions: []
            },
            bom: []
        }
    }

    /**
     * @returns {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: object[] }}
     */
    static #createBoardOutline() {
        return {
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
        }
    }
}

/**
 * Verifies footprint clicks prefer components over overlapping routed nets.
 */
test('PcbViewController selects components before overlapping PCB nets', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const componentSelections = []
    const netSelections = []
    const controller = new PcbViewController(
        content,
        PcbSelectionFixture.createOverlappingPcbDocument(),
        {
            documentId: 'doc-1',
            onComponentSelectionChange: (change) => {
                componentSelections.push(change)
            },
            onNetSelectionChange: (change) => {
                netSelections.push(change)
            }
        }
    )
    const svg = content.querySelector('.pcb-svg')

    svg?.setAttribute('viewBox', '0 0 100 100')
    content.clickPcbBoard(200, 100)

    assert.deepEqual(componentSelections, [
        {
            documentId: 'doc-1',
            componentKey: 'U1',
            source: 'pcb-board'
        }
    ])
    assert.deepEqual(netSelections, [
        {
            documentId: 'doc-1',
            netName: '',
            source: 'pcb-board'
        }
    ])

    controller.dispose()
})

/**
 * Verifies drag movement bypasses hover hit testing and preview mutations.
 */
test('PcbViewController skips hover candidates during active drag movement', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const candidateChanges = []
    const controller = new PcbViewController(
        content,
        PcbSelectionFixture.createOverlappingPcbDocument(),
        {
            documentId: 'doc-1',
            onInteractionCandidatesChange: (change) => {
                candidateChanges.push(change)
            }
        }
    )
    const svg = content.querySelector('.pcb-svg')

    svg?.setAttribute('viewBox', '0 0 100 100')
    content.movePcbBoard(200, 100, 1)

    assert.deepEqual(candidateChanges, [])

    controller.dispose()
})

/**
 * Verifies bottom-side Altium clicks are mapped back from mirrored SVG space.
 */
test('PcbViewController selects mirrored bottom-side components at their visual position', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const componentSelections = []
    const netSelections = []
    const candidateChanges = []
    const controller = new PcbViewController(
        content,
        PcbSelectionFixture.createMirroredBottomPcbDocument(),
        {
            documentId: 'doc-1',
            side: 'bottom',
            onComponentSelectionChange: (change) => {
                componentSelections.push(change)
            },
            onNetSelectionChange: (change) => {
                netSelections.push(change)
            },
            onInteractionCandidatesChange: (change) => {
                candidateChanges.push(change)
            }
        }
    )
    const svg = content.querySelector('.pcb-svg')

    svg?.setAttribute('viewBox', '0 0 100 100')
    content.clickPcbBoard(320, 100)

    assert.equal(Math.round(candidateChanges[0]?.point.x || 0), 20)
    assert.deepEqual(componentSelections, [
        {
            documentId: 'doc-1',
            componentKey: 'U1',
            source: 'pcb-board'
        }
    ])
    assert.deepEqual(netSelections, [
        {
            documentId: 'doc-1',
            netName: '',
            source: 'pcb-board'
        }
    ])

    controller.dispose()
})

test('PcbViewController excludes pours and component-owned silkscreen from hover previews', () => {
    const originalHitTestPcb = EcadRendererService.hitTestPcb
    const content = new FakeContentNode(new FakeDocument())
    const changes = []
    EcadRendererService.hitTestPcb = () => [
        { type: 'zone', netName: 'GND' },
        { kind: 'silkscreen', componentKey: 'U1' }
    ]

    try {
        const controller = new PcbViewController(
            content,
            PcbSelectionFixture.createOverlappingPcbDocument(),
            {
                documentId: 'doc-1',
                onInteractionCandidatesChange: (change) => changes.push(change)
            }
        )
        const svg = content.querySelector('.pcb-svg')
        svg?.setAttribute('viewBox', '0 0 100 100')

        content.movePcbBoard(200, 100)

        assert.equal(changes.at(-1)?.source, 'hover')
        assert.deepEqual(changes.at(-1)?.candidates, [])
        assert.equal(changes.at(-1)?.selectedCandidate, null)
        assert.equal(svg?.style.cursor, '')
        controller.dispose()
    } finally {
        EcadRendererService.hitTestPcb = originalHitTestPcb
    }
})

test('PcbViewController treats clicks on pours and silkscreen as empty board space', () => {
    const originalHitTestPcb = EcadRendererService.hitTestPcb
    const content = new FakeContentNode(new FakeDocument())
    const interactions = []
    const componentChanges = []
    const netChanges = []
    EcadRendererService.hitTestPcb = () => [
        { type: 'zone', netName: 'GND' },
        { kind: 'silkscreen', componentKey: 'U1' }
    ]

    try {
        const controller = new PcbViewController(
            content,
            PcbSelectionFixture.createOverlappingPcbDocument(),
            {
                documentId: 'doc-1',
                selectedComponentKey: 'U1',
                selectedNetName: 'GND',
                onInteractionCandidatesChange: (change) =>
                    interactions.push(change),
                onComponentSelectionChange: (change) =>
                    componentChanges.push(change),
                onNetSelectionChange: (change) => netChanges.push(change)
            }
        )
        const svg = content.querySelector('.pcb-svg')
        svg?.setAttribute('viewBox', '0 0 100 100')

        content.clickPcbBoard(200, 100)

        assert.deepEqual(interactions.at(-1)?.candidates, [])
        assert.equal(interactions.at(-1)?.selectedCandidate, null)
        assert.equal(componentChanges.at(-1)?.componentKey, '')
        assert.equal(netChanges.at(-1)?.netName, '')
        controller.dispose()
    } finally {
        EcadRendererService.hitTestPcb = originalHitTestPcb
    }
})
