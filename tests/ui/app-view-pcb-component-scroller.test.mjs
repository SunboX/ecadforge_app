import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewPcbComponentScroller } from '../../src/ui/AppViewPcbComponentScroller.mjs'

/**
 * Minimal row fake for selected component and net scroll tests.
 */
class FakeSelectionRow {
    /** @type {string} */
    #attributeName

    /** @type {string} */
    #value

    /** @type {any[]} */
    scrollIntoViewCalls

    /**
     * @param {string} attributeName Selection attribute name.
     * @param {string} value Selection key.
     */
    constructor(attributeName, value) {
        this.#attributeName = attributeName
        this.#value = value
        this.scrollIntoViewCalls = []
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return name === this.#attributeName ? this.#value : null
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
    /** @type {FakeSelectionRow[]} */
    #rows

    /** @type {string} */
    #selector

    /**
     * @param {FakeSelectionRow[]} rows Selection rows.
     * @param {string} selector Row selector.
     */
    constructor(rows, selector = '[data-pcb-component-key]') {
        this.#rows = rows
        this.#selector = selector
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeSelectionRow[]}
     */
    querySelectorAll(selector) {
        return selector === this.#selector ? this.#rows : []
    }
}

/**
 * Builds a fake selected component row.
 * @param {string} key Component key.
 * @returns {FakeSelectionRow}
 */
function createComponentRow(key) {
    return new FakeSelectionRow('data-pcb-component-key', key)
}

/**
 * Builds a fake selected net row.
 * @param {string} key Net key.
 * @returns {FakeSelectionRow}
 */
function createNetRow(key) {
    return new FakeSelectionRow('data-pcb-net-key', key)
}

/**
 * Verifies the selected component row is centered in the sidebar panel.
 */
test('AppViewPcbComponentScroller centers selected component row', () => {
    const selectedRow = createComponentRow('R1')
    const railNode = new FakeRailNode([createComponentRow('U1'), selectedRow])

    AppViewPcbComponentScroller.scrollSelectedIntoView(railNode, {
        activeSidebarTab: 'components',
        activeDocumentId: 'doc-1',
        selectedPcbComponents: { 'doc-1': 'R1' }
    })

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [
        {
            block: 'center',
            inline: 'nearest'
        }
    ])
})

/**
 * Verifies list-originated selections can preserve the current list scroll.
 */
test('AppViewPcbComponentScroller skips suppressed selected component row', () => {
    const selectedRow = createComponentRow('R1')
    const railNode = new FakeRailNode([selectedRow])

    AppViewPcbComponentScroller.scrollSelectedIntoView(
        railNode,
        {
            activeSidebarTab: 'components',
            activeDocumentId: 'doc-1',
            selectedPcbComponents: { 'doc-1': 'R1' }
        },
        { suppressScroll: true }
    )

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [])
})

/**
 * Verifies inactive sidebar tabs do not scroll component rows.
 */
test('AppViewPcbComponentScroller ignores inactive footprint panels', () => {
    const selectedRow = createComponentRow('R1')
    const railNode = new FakeRailNode([selectedRow])

    AppViewPcbComponentScroller.scrollSelectedIntoView(railNode, {
        activeSidebarTab: 'layers',
        activeDocumentId: 'doc-1',
        selectedPcbComponents: { 'doc-1': 'R1' }
    })

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [])
})

/**
 * Verifies the selected net row is centered in the sidebar panel.
 */
test('AppViewPcbComponentScroller centers selected net row', () => {
    const selectedRow = createNetRow('SENSE_A')
    const railNode = new FakeRailNode(
        [createNetRow('GND'), selectedRow],
        '[data-pcb-net-key]'
    )

    AppViewPcbComponentScroller.scrollSelectedNetIntoView(railNode, {
        activeSidebarTab: 'nets',
        activeDocumentId: 'doc-1',
        selectedNets: { 'doc-1': 'SENSE_A' }
    })

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [
        {
            block: 'center',
            inline: 'nearest'
        }
    ])
})

/**
 * Verifies list-originated net selections can preserve current list scroll.
 */
test('AppViewPcbComponentScroller skips suppressed selected net row', () => {
    const selectedRow = createNetRow('SENSE_A')
    const railNode = new FakeRailNode([selectedRow], '[data-pcb-net-key]')

    AppViewPcbComponentScroller.scrollSelectedNetIntoView(
        railNode,
        {
            activeSidebarTab: 'nets',
            activeDocumentId: 'doc-1',
            selectedNets: { 'doc-1': 'SENSE_A' }
        },
        { suppressScroll: true }
    )

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [])
})

/**
 * Verifies inactive sidebar tabs do not scroll net rows.
 */
test('AppViewPcbComponentScroller ignores inactive net panels', () => {
    const selectedRow = createNetRow('SENSE_A')
    const railNode = new FakeRailNode([selectedRow], '[data-pcb-net-key]')

    AppViewPcbComponentScroller.scrollSelectedNetIntoView(railNode, {
        activeSidebarTab: 'components',
        activeDocumentId: 'doc-1',
        selectedNets: { 'doc-1': 'SENSE_A' }
    })

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [])
})
