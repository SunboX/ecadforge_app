import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewController } from '../../src/ui/PcbViewController.mjs'

/**
 * Minimal classList implementation for viewport controller tests.
 */
class FakeClassList {
    #tokens

    constructor() {
        this.#tokens = new Set()
    }

    /**
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }

    /**
     * @param {string} token Class token.
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal event target used by fake DOM nodes.
 */
class FakeEventTarget {
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
 * Minimal generic fake node.
 */
class FakeNode extends FakeEventTarget {
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
 * Minimal document node for SVG viewport listeners.
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
 * Minimal PCB measurement toolbar button.
 */
class FakePcbMeasureButton extends FakeNode {
    /**
     * @param {string} tool Tool id.
     */
    constructor(tool) {
        super()
        this.setAttribute('data-pcb-measure-tool', tool)
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakePcbMeasureButton | null}
     */
    closest(selector) {
        return selector === '[data-pcb-measure-tool]' ? this : null
    }
}

/**
 * Minimal PCB trace length toolbar button.
 */
class FakePcbTraceLengthButton extends FakeNode {
    constructor() {
        super()
        this.setAttribute('data-pcb-trace-length-toggle', 'true')
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakePcbTraceLengthButton | null}
     */
    closest(selector) {
        return selector === '[data-pcb-trace-length-toggle]' ? this : null
    }
}

/**
 * Minimal diagnostic focus button.
 */
class FakePcbDiagnosticFocusButton extends FakeNode {
    /**
     * @param {string} diagnosticId Diagnostic id.
     */
    constructor(diagnosticId) {
        super()
        this.setAttribute('data-pcb-diagnostic-focus', diagnosticId)
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakePcbDiagnosticFocusButton | null}
     */
    closest(selector) {
        return selector === '[data-pcb-diagnostic-focus]' ? this : null
    }
}

/**
 * Minimal measurement copy button.
 */
class FakePcbMeasureCopyButton extends FakeNode {
    /**
     * @param {string} value Copied text value.
     */
    constructor(value) {
        super()
        this.setAttribute('data-pcb-measure-copy', value)
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakePcbMeasureCopyButton | null}
     */
    closest(selector) {
        if (selector === '[data-pcb-measure-copy]') return this
        return null
    }
}

/**
 * Minimal content node that reparses rendered PCB view markup.
 */
class FakeContentNode extends FakeEventTarget {
    #ownerDocument
    #svg
    #measureButtons
    #traceLengthButton
    #diagnosticButtons
    #measureCopyButton

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     */
    constructor(ownerDocument) {
        super()
        this.#ownerDocument = ownerDocument
        this.#svg = null
        this.#measureButtons = new Map()
        this.#diagnosticButtons = new Map()
        this.#measureCopyButton = null
        this._innerHTML = ''
    }

    /**
     * @param {string} value Markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#svg = null
        this.#measureButtons = new Map()
        this.#traceLengthButton = null
        this.#diagnosticButtons = new Map()
        this.#measureCopyButton = null

        const svgMatch = this._innerHTML.match(
            /<svg[^>]*class="[^"]*\bpcb-svg\b[^"]*"[^>]*viewBox="([^"]+)"/
        )
        if (svgMatch) {
            this.#svg = new FakeSvgElement(this.#ownerDocument, svgMatch[1])
        }

        for (const match of this._innerHTML.matchAll(
            /<button[^>]*data-pcb-measure-tool="([^"]+)"/g
        )) {
            this.#measureButtons.set(
                match[1],
                new FakePcbMeasureButton(match[1])
            )
        }

        if (this._innerHTML.includes('data-pcb-trace-length-toggle')) {
            this.#traceLengthButton = new FakePcbTraceLengthButton()
        }

        for (const match of this._innerHTML.matchAll(
            /<button[^>]*data-pcb-diagnostic-focus="([^"]+)"/g
        )) {
            this.#diagnosticButtons.set(
                match[1],
                new FakePcbDiagnosticFocusButton(match[1])
            )
        }

        const copyMatch = this._innerHTML.match(
            /<button[^>]*data-pcb-measure-copy="([^"]+)"/
        )
        if (copyMatch) {
            this.#measureCopyButton = new FakePcbMeasureCopyButton(
                copyMatch[1].replaceAll('&quot;', '"')
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
     * @returns {FakeSvgElement | FakePcbMeasureButton | null}
     */
    querySelector(selector) {
        if (selector === '.pcb-svg') return this.#svg
        if (selector === '[data-pcb-trace-length-toggle]') {
            return this.#traceLengthButton
        }
        if (selector === '[data-pcb-measure-copy]') {
            return this.#measureCopyButton
        }
        const match = selector.match(/^\[data-pcb-measure-tool="([^"]+)"\]$/)
        return match ? this.#measureButtons.get(match[1]) || null : null
    }

    /**
     * Clicks a PCB measurement toolbar button.
     * @param {string} tool Tool id.
     * @returns {void}
     */
    clickMeasureTool(tool) {
        const button = this.#measureButtons.get(tool)
        if (!button) return

        this.dispatch('click', { target: button, preventDefault() {} })
    }

    /**
     * Clicks the trace-length overlay toolbar button.
     * @returns {void}
     */
    clickTraceLengthToggle() {
        if (!this.#traceLengthButton) return

        this.dispatch('click', {
            target: this.#traceLengthButton,
            preventDefault() {}
        })
    }

    /**
     * Clicks one rendered diagnostic focus row.
     * @param {string} diagnosticId Diagnostic id.
     * @returns {void}
     */
    clickDiagnosticFocus(diagnosticId) {
        const button = this.#diagnosticButtons.get(diagnosticId)
        if (!button) return

        this.dispatch('click', { target: button, preventDefault() {} })
    }

    /**
     * Clicks the rendered measurement copy button.
     * @returns {void}
     */
    clickMeasurementCopy() {
        if (!this.#measureCopyButton) return

        this.dispatch('click', {
            target: this.#measureCopyButton,
            preventDefault() {}
        })
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
     * @returns {void}
     */
    movePcbBoard(clientX, clientY) {
        if (!this.#svg) return

        this.dispatch('mousemove', {
            target: this.#svg,
            clientX,
            clientY,
            preventDefault() {}
        })
    }
}

/**
 * Builds a compact standards-native PCB document.
 * @returns {object[]}
 */
function createCircuitJsonPcbDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 10,
            height: 6,
            num_layers: 2
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 1, y: 1 },
            layer: 'top'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_1',
            pcb_component_id: 'pcb_u1',
            shape: 'rect',
            x: 1,
            y: 1,
            width: 1.2,
            height: 0.8,
            layer: 'top',
            net: 'VCC'
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_1',
            net: 'VCC',
            route: [
                {
                    route_type: 'wire',
                    x: 1,
                    y: 1,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 3,
                    y: 1,
                    width: 0.2,
                    layer: 'top'
                }
            ]
        },
        {
            type: 'pcb_trace_error',
            pcb_trace_error_id: 'err_1',
            pcb_trace_id: 'trace_1',
            message: 'Trace is over budget.',
            error_type: 'trace_length'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Parses a rendered SVG viewBox.
 * @param {string | null} value ViewBox attribute.
 * @returns {{ minX: number, minY: number, width: number, height: number }}
 */
function parseViewBox(value) {
    const [minX, minY, width, height] = String(value || '')
        .trim()
        .split(/\s+/u)
        .map(Number)

    return { minX, minY, width, height }
}

/**
 * Verifies standards-native PCB documents support 2D hit testing.
 */
test('PcbViewController selects CircuitJSON PCB components and nets', () => {
    const content = new FakeContentNode(new FakeDocument())
    const componentChanges = []
    const netChanges = []
    const controller = new PcbViewController(
        content,
        createCircuitJsonPcbDocument(),
        {
            documentId: 'doc-1',
            onComponentSelectionChange: (change) =>
                componentChanges.push(change),
            onNetSelectionChange: (change) => netChanges.push(change)
        }
    )

    const viewBox = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )
    content.clickPcbBoard(
        ((1 - viewBox.minX) / viewBox.width) * 400,
        ((1 - viewBox.minY) / viewBox.height) * 200
    )

    assert.equal(componentChanges[0].componentKey, 'U1')
    assert.equal(netChanges[0].netName, '')

    controller.dispose()
})

/**
 * Verifies hover hit testing feeds net context back into the rendered PCB.
 */
test('PcbViewController renders CircuitJSON PCB net hover context', () => {
    const content = new FakeContentNode(new FakeDocument())
    const controller = new PcbViewController(
        content,
        createCircuitJsonPcbDocument()
    )
    const viewBox = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )

    content.movePcbBoard(
        ((1 - viewBox.minX) / viewBox.width) * 400,
        ((1 - viewBox.minY) / viewBox.height) * 200
    )

    assert.match(content.innerHTML, /data-pcb-hover-net-name="VCC"/)

    controller.dispose()
})

/**
 * Verifies the trace length overlay can be toggled from the PCB toolbar.
 */
test('PcbViewController toggles CircuitJSON PCB trace length labels', () => {
    const content = new FakeContentNode(new FakeDocument())
    const controller = new PcbViewController(
        content,
        createCircuitJsonPcbDocument()
    )

    assert.match(content.innerHTML, /data-pcb-trace-length-visible="false"/)

    content.clickTraceLengthToggle()

    assert.match(content.innerHTML, /data-pcb-trace-length-visible="true"/)
    assert.match(content.innerHTML, /class="[^"]*\bpcb-trace-length-label\b/)

    controller.dispose()
})

/**
 * Verifies PCB measurements resolve in board coordinates and snap to anchors.
 */
test('PcbViewController measures snapped board distances', () => {
    const content = new FakeContentNode(new FakeDocument())
    const controller = new PcbViewController(
        content,
        createCircuitJsonPcbDocument()
    )
    const viewBox = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )
    const toClient = (point) => ({
        x: ((point.x - viewBox.minX) / viewBox.width) * 400,
        y: ((point.y - viewBox.minY) / viewBox.height) * 200
    })
    const start = toClient({ x: 1.06, y: 1.04 })
    const end = toClient({ x: 3, y: 1 })

    content.clickMeasureTool('distance')
    content.clickPcbBoard(start.x, start.y)
    content.clickPcbBoard(end.x, end.y)

    assert.match(content.innerHTML, /class="[^"]*\bpcb-measurement-overlay\b/)
    assert.match(content.innerHTML, /data-pcb-measurement-distance="2"/)
    assert.match(content.innerHTML, />2\.00<\/text>/)

    controller.dispose()
})

/**
 * Verifies diagnostic rows focus the PCB viewport around related geometry.
 */
test('PcbViewController focuses CircuitJSON PCB diagnostics in the viewport', () => {
    const content = new FakeContentNode(new FakeDocument())
    const controller = new PcbViewController(
        content,
        createCircuitJsonPcbDocument()
    )
    const before = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )

    content.clickDiagnosticFocus('err_1')

    const after = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )
    assert.ok(after.width < before.width)
    assert.ok(after.minX < 1)
    assert.ok(after.minX + after.width > 3)

    controller.dispose()
})

/**
 * Verifies completed bounds measurements can be copied from the PCB view.
 */
test('PcbViewController copies CircuitJSON PCB measurement bounds', async () => {
    const content = new FakeContentNode(new FakeDocument())
    const copied = []
    const previousNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { clipboard: { writeText: async (text) => copied.push(text) } }
    })
    const controller = new PcbViewController(
        content,
        createCircuitJsonPcbDocument()
    )
    const viewBox = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )
    const toClient = (point) => ({
        x: ((point.x - viewBox.minX) / viewBox.width) * 400,
        y: ((point.y - viewBox.minY) / viewBox.height) * 200
    })
    const start = toClient({ x: 0.42, y: 0.62 })
    const end = toClient({ x: 3, y: 1 })

    content.clickMeasureTool('bounds')
    content.clickPcbBoard(start.x, start.y)
    content.clickPcbBoard(end.x, end.y)
    content.clickMeasurementCopy()
    await Promise.resolve()

    assert.deepEqual(copied, [
        'minX: 0.40, minY: 0.60, maxX: 3.00, maxY: 1.00'
    ])

    controller.dispose()
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: previousNavigator
    })
})
