import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbHoveredNetHighlighter } from '../../src/ui/PcbHoveredNetHighlighter.mjs'

/**
 * Minimal DOMTokenList for net highlight assertions.
 */
class FakeClassList {
    #tokens = new Set()

    /**
     * @param {string} token Class token.
     * @returns {void}
     */
    add(token) {
        this.#tokens.add(token)
    }

    /**
     * @param {string} token Class token.
     * @returns {void}
     */
    remove(token) {
        this.#tokens.delete(token)
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
 * Minimal PCB primitive with a canonical net name.
 */
class FakeNetPrimitive {
    /**
     * @param {string} netName Net name.
     */
    constructor(netName) {
        this.netName = netName
        this.classList = new FakeClassList()
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return name === 'data-pcb-net-name' ? this.netName : null
    }
}

/**
 * Minimal SVG that exposes tagged PCB primitives.
 */
class FakeSvg {
    /**
     * @param {FakeNetPrimitive[]} primitives Tagged PCB primitives.
     */
    constructor(primitives) {
        this.primitives = primitives
    }

    /**
     * @param {string} selector Requested selector.
     * @returns {FakeNetPrimitive[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-pcb-net-name]' ? this.primitives : []
    }
}

/**
 * Minimal mounted PCB content node.
 */
class FakeContentNode {
    /**
     * @param {FakeSvg} svg PCB SVG node.
     */
    constructor(svg) {
        this.svg = svg
    }

    /**
     * @param {string} selector Requested selector.
     * @returns {FakeSvg | null}
     */
    querySelector(selector) {
        return selector === '.pcb-svg' ? this.svg : null
    }
}

test('PcbHoveredNetHighlighter toggles only the previous and current net primitives', () => {
    const vcc = new FakeNetPrimitive('VCC')
    const gnd = new FakeNetPrimitive('GND')
    const content = new FakeContentNode(new FakeSvg([vcc, gnd]))

    assert.equal(PcbHoveredNetHighlighter.update(content, '', 'VCC'), true)
    assert.equal(vcc.classList.contains('pcb-net-highlight'), true)
    assert.equal(gnd.classList.contains('pcb-net-highlight'), false)

    assert.equal(PcbHoveredNetHighlighter.update(content, '', 'GND'), true)
    assert.equal(vcc.classList.contains('pcb-net-highlight'), false)
    assert.equal(gnd.classList.contains('pcb-net-highlight'), true)
})
