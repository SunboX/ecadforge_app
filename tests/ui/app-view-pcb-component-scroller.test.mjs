import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewPcbComponentScroller } from '../../src/ui/AppViewPcbComponentScroller.mjs'

/**
 * Minimal row fake for selected-component scroll tests.
 */
class FakeComponentRow {
    /** @type {string} */
    #componentKey

    /** @type {any[]} */
    scrollIntoViewCalls

    /**
     * @param {string} componentKey Component key.
     */
    constructor(componentKey) {
        this.#componentKey = componentKey
        this.scrollIntoViewCalls = []
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return name === 'data-pcb-component-key' ? this.#componentKey : null
    }

    /**
     * @param {ScrollIntoViewOptions | boolean} [options] Scroll options.
     * @returns {void}
     */
    scrollIntoView(options = true) {
        this.scrollIntoViewCalls.push(options)
    }
}

/**
 * Minimal rail fake for selected-component scroll tests.
 */
class FakeRailNode {
    /** @type {FakeComponentRow[]} */
    #rows

    /**
     * @param {FakeComponentRow[]} rows Component rows.
     */
    constructor(rows) {
        this.#rows = rows
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeComponentRow[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-pcb-component-key]' ? this.#rows : []
    }
}

/**
 * Verifies the selected PCB component row is scrolled into view.
 */
test('AppViewPcbComponentScroller scrolls selected PCB row into view', () => {
    const selectedRow = new FakeComponentRow('R1')
    const railNode = new FakeRailNode([
        new FakeComponentRow('U1'),
        selectedRow
    ])

    AppViewPcbComponentScroller.scrollSelectedIntoView(railNode, {
        activeSidebarTab: 'components',
        activeDocumentId: 'doc-1',
        selectedPcbComponents: { 'doc-1': 'R1' }
    })

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [
        {
            block: 'nearest',
            inline: 'nearest'
        }
    ])
})

/**
 * Verifies inactive sidebar tabs do not scroll component rows.
 */
test('AppViewPcbComponentScroller ignores inactive footprint panels', () => {
    const selectedRow = new FakeComponentRow('R1')
    const railNode = new FakeRailNode([selectedRow])

    AppViewPcbComponentScroller.scrollSelectedIntoView(railNode, {
        activeSidebarTab: 'layers',
        activeDocumentId: 'doc-1',
        selectedPcbComponents: { 'doc-1': 'R1' }
    })

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [])
})
