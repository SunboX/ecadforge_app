import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicViewportController } from '../../src/ui/SchematicViewportController.mjs'

/**
 * Minimal event target used by viewport controller tests.
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
     * Removes one listener.
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }

    /**
     * Dispatches one synthetic event to all listeners.
     * @param {string} type
     * @param {Record<string, any>} [event]
     * @returns {void}
     */
    dispatch(type, event = {}) {
        const payload = { ...event, type, currentTarget: this, target: this }
        const listeners = [...(this.#listeners.get(type) || [])]
        listeners.forEach((listener) => listener(payload))
    }

    /**
     * Returns the listener count for one event type.
     * @param {string} type
     * @returns {number}
     */
    getListenerCount(type) {
        return this.#listeners.get(type)?.size || 0
    }
}

/**
 * Minimal token list used for class assertions.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    constructor(initialTokens = []) {
        this.#tokens = new Set(initialTokens)
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

    /**
     * Returns true when the class token exists.
     * @param {string} token
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal fake document event target.
 */
class FakeDocument extends FakeEventTarget {}

/**
 * Minimal SVG element used by viewport controller tests.
 */
class FakeSvgElement extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    /** @type {{ left: number, top: number, width: number, height: number }} */
    #rect

    /**
     * @param {{
     * viewBox: string,
     * rect: { left: number, top: number, width: number, height: number },
     * ownerDocument?: FakeDocument
     * }} options
     */
    constructor(options) {
        super()
        this.#attributes = new Map([['viewBox', options.viewBox]])
        this.#rect = options.rect
        this.ownerDocument = options.ownerDocument || new FakeDocument()
        this.classList = new FakeClassList(['schematic-svg'])
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
     * Sets one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }

    /**
     * Returns the fake SVG client box.
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    getBoundingClientRect() {
        return this.#rect
    }
}

/**
 * Verifies wheel zoom keeps the same document point under the cursor.
 */
test('SchematicViewportController keeps the cursor point stable while zooming', () => {
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 }
    })
    const controller = new SchematicViewportController(svg)

    svg.dispatch('wheel', {
        deltaY: -100,
        clientX: 100,
        clientY: 50,
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '1.5 0.75 194 97')

    controller.dispose()
})

/**
 * Verifies zooming cannot shrink the camera below the configured minimum.
 */
test('SchematicViewportController clamps zoom-in to the minimum viewBox size', () => {
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 }
    })
    const controller = new SchematicViewportController(svg)

    for (let index = 0; index < 100; index += 1) {
        svg.dispatch('wheel', {
            deltaY: -100,
            clientX: 200,
            clientY: 100,
            preventDefault() {}
        })
    }

    assert.equal(svg.getAttribute('viewBox'), '95 47.5 10 5')

    controller.dispose()
})

/**
 * Verifies programmatic focus pans to SVG-space bounds without changing zoom.
 */
test('SchematicViewportController centers document bounds', () => {
    const svg = new FakeSvgElement({
        viewBox: '100 100 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 }
    })
    const controller = new SchematicViewportController(svg)

    controller.centerBounds({ x: 20, y: 30, width: 10, height: 10 })

    assert.equal(svg.getAttribute('viewBox'), '-75 -15 200 100')

    controller.dispose()
})

/**
 * Verifies optional animated focus interpolates through animation frames.
 */
test('SchematicViewportController animates focused document bounds', () => {
    const previousRequestAnimationFrame = globalThis.requestAnimationFrame
    const previousCancelAnimationFrame = globalThis.cancelAnimationFrame
    const frames = []
    globalThis.requestAnimationFrame = (callback) => {
        frames.push(callback)
        return frames.length
    }
    globalThis.cancelAnimationFrame = () => {}
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 }
    })
    const controller = new SchematicViewportController(svg)

    try {
        controller.focusBounds(
            { x: 20, y: 30, width: 10, height: 10 },
            { animate: true, animationDurationMs: 120, paddingFactor: 2 }
        )

        assert.ok(frames.length > 0)
        while (frames.length) {
            frames.shift()(1000000)
        }
        assert.equal(svg.getAttribute('viewBox'), '5 25 40 20')
    } finally {
        controller.dispose()
        globalThis.requestAnimationFrame = previousRequestAnimationFrame
        globalThis.cancelAnimationFrame = previousCancelAnimationFrame
    }
})

/**
 * Verifies callers can restore the original fitted SVG viewBox.
 */
test('SchematicViewportController resets to the default viewBox', () => {
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 }
    })
    const controller = new SchematicViewportController(svg)

    controller.centerBounds({ x: 20, y: 30, width: 10, height: 10 })
    controller.resetViewBox()

    assert.equal(svg.getAttribute('viewBox'), '0 0 200 100')

    controller.dispose()
})

/**
 * Verifies drag panning updates the viewBox and toggles the panning class.
 */
test('SchematicViewportController pans while the primary mouse button is held', () => {
    const ownerDocument = new FakeDocument()
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 },
        ownerDocument
    })
    const controller = new SchematicViewportController(svg)

    svg.dispatch('mousedown', {
        button: 0,
        clientX: 200,
        clientY: 100,
        preventDefault() {}
    })

    assert.equal(svg.classList.contains('is-panning'), true)

    ownerDocument.dispatch('mousemove', {
        buttons: 1,
        clientX: 240,
        clientY: 120,
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '-20 -10 200 100')

    ownerDocument.dispatch('mouseup', { button: 0 })

    assert.equal(svg.classList.contains('is-panning'), false)

    controller.dispose()
})

/**
 * Verifies fitted SVG content tracks the mouse by visual pixels even when
 * preserveAspectRatio creates a letterboxed rendered area.
 */
test('SchematicViewportController pans fitted content at pointer speed', () => {
    const ownerDocument = new FakeDocument()
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 400 },
        ownerDocument
    })
    const controller = new SchematicViewportController(svg)

    svg.dispatch('mousedown', {
        button: 0,
        clientX: 200,
        clientY: 200,
        preventDefault() {}
    })

    ownerDocument.dispatch('mousemove', {
        buttons: 1,
        clientX: 240,
        clientY: 240,
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '-20 -20 200 100')

    controller.dispose()
})

/**
 * Verifies one-finger touch dragging pans the viewport on mobile screens.
 */
test('SchematicViewportController pans with one-finger touch dragging', () => {
    const ownerDocument = new FakeDocument()
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 },
        ownerDocument
    })
    const controller = new SchematicViewportController(svg)

    svg.dispatch('touchstart', {
        touches: [{ clientX: 200, clientY: 100 }],
        preventDefault() {}
    })

    svg.dispatch('touchmove', {
        touches: [{ clientX: 240, clientY: 120 }],
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '-20 -10 200 100')

    svg.dispatch('touchend', { touches: [] })

    controller.dispose()
})

/**
 * Verifies two-finger pinching zooms around the gesture midpoint.
 */
test('SchematicViewportController zooms with two-finger pinch gestures', () => {
    const ownerDocument = new FakeDocument()
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 },
        ownerDocument
    })
    const controller = new SchematicViewportController(svg)

    svg.dispatch('touchstart', {
        touches: [
            { clientX: 150, clientY: 100 },
            { clientX: 250, clientY: 100 }
        ],
        preventDefault() {}
    })

    svg.dispatch('touchmove', {
        touches: [
            { clientX: 100, clientY: 100 },
            { clientX: 300, clientY: 100 }
        ],
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '50 25 100 50')

    svg.dispatch('touchend', { touches: [] })

    controller.dispose()
})

/**
 * Verifies active panning toggles a document-level scroll lock hook so the
 * page cannot scroll at the same time.
 */
test('SchematicViewportController locks document scrolling while dragging', () => {
    const ownerDocument = new FakeDocument()
    ownerDocument.documentElement = {
        classList: new FakeClassList()
    }
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 },
        ownerDocument
    })
    const controller = new SchematicViewportController(svg)

    svg.dispatch('mousedown', {
        button: 0,
        clientX: 200,
        clientY: 100,
        preventDefault() {}
    })

    assert.equal(
        ownerDocument.documentElement.classList.contains(
            'is-schematic-panning'
        ),
        true
    )

    ownerDocument.dispatch('mouseup', { button: 0 })

    assert.equal(
        ownerDocument.documentElement.classList.contains(
            'is-schematic-panning'
        ),
        false
    )

    controller.dispose()
})

/**
 * Verifies cleanup removes all bound listeners.
 */
test('SchematicViewportController removes bound listeners on dispose', () => {
    const ownerDocument = new FakeDocument()
    const svg = new FakeSvgElement({
        viewBox: '0 0 200 100',
        rect: { left: 0, top: 0, width: 400, height: 200 },
        ownerDocument
    })
    const controller = new SchematicViewportController(svg)

    controller.dispose()

    assert.equal(svg.getListenerCount('wheel'), 0)
    assert.equal(svg.getListenerCount('mousedown'), 0)
    assert.equal(svg.getListenerCount('touchstart'), 0)
    assert.equal(svg.getListenerCount('touchmove'), 0)
    assert.equal(svg.getListenerCount('touchend'), 0)
    assert.equal(svg.getListenerCount('touchcancel'), 0)
    assert.equal(ownerDocument.getListenerCount('mousemove'), 0)
    assert.equal(ownerDocument.getListenerCount('mouseup'), 0)
})
